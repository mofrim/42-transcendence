import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import type { Express, Request, Response } from 'express';
import { DataSource } from 'typeorm';
import { exit } from 'node:process';

import { ORMEventLog, ORMUser } from 'common/ormTypes';
import { EventType } from 'common/sharedTypes';

if (process.env['NODE_ENV'] === 'development') {
    console.log('loading dev.env...');
    dotenv.config({ path: '../../../dev.env' });
}

const PORT = Number(process.env['EVENTLOG_SERVICE_PORT']) || 3002;

const app: Express = express();

app.use(cors({ credentials: true }));
app.use(express.json());

const DB = new DataSource({
    type: 'postgres',
    host:
        process.env['NODE_ENV'] === 'production'
            ? process.env['DB_HOST'] || 'localhost'
            : 'localhost',
    port: Number(process.env['DB_PORT']) || 5432,
    username: process.env['DB_USER'] || 'postgres',
    password: process.env['DB_PASSWD'] || 'postgres',
    database: process.env['DB_NAME'] || 'postgres',
    entities: [ORMEventLog, ORMUser],
    synchronize: true,
    logging: false,
});

try {
    await DB.initialize();
} catch (error) {
    console.error('Failed to connect to database!');
    console.error(error);
    exit(1);
}

const getUserId = async (nick: string): Promise<number | null> => {
    try {
        const exists = await DB.manager.find(ORMUser, {
            where: {
                nickname: nick,
            },
        });

        // TODO: make this check more consise / cleaner
        if (
            exists.length !== 1 ||
            exists === undefined ||
            exists[0] === undefined
        ) {
            return null;
        }

        return exists[0].id;
    } catch (err) {
        console.error(err);
        return null;
    }
};

app.post(
    '/api/eventlog',
    async (req: Request, res: Response): Promise<void> => {
        const { eventType, data, user } = req.body;

        if (!Object.values(EventType).includes(eventType)) {
            res.status(400).json({
                error: 'Invalid event type',
            });
            return;
        }

        const userId = await getUserId(user);
        if (userId === null) {
            res.status(400).json({
                error: `User ${user} not found`,
            });
            return;
        }

        if (typeof data !== 'string') {
            res.status(400).json({
                error: 'Event data must be a string',
            });
            return;
        }

        try {
            const event = DB.manager.create(ORMEventLog, {
                eventType: eventType,
                data: data,
                // this has to be Partial<ORMUser> so...
                user: { id: userId },
            });

            const savedEvent = await DB.manager.save(event);

            res.status(201).json(savedEvent);
        } catch (error) {
            console.error(error);

            res.status(500).json({
                error: 'Failed to save event',
            });
        }
    }
);

// TODO add proper api documentation here & for other endpoints!
//
// endpoint returns per default up to last 50 logs sorted in _ascending_ order ,
// i.e. the most recent log entry will be last in array.
//
// the follwing query params are possible:
//
// - limit=[number] will output the last `number` logs
// - user=[nickname] will filter the logs for the given nickname
//
app.get('/api/eventlog', async (req: Request, res: Response): Promise<void> => {
    const limit = Number(req.query['limit'] ?? 50);
    const queryUser = req.query['user'];

    if (!Number.isInteger(limit) || limit <= 0) {
        res.status(400).json({
            error: 'limit must be a positive integer',
        });
        return;
    }

    if (queryUser != null) {
        if ((await getUserId(String(queryUser))) === null) {
            res.status(400).json({
                error: `User ${queryUser} not found`,
            });
            return;
        }
    }

    try {
        let events;
        if (queryUser == null) {
            events = await DB.manager.find(ORMEventLog, {
                order: {
                    id: 'DESC',
                },
                take: limit,
                relations: { user: true },
                select: {
                    id: true,
                    eventType: true,
                    data: true,
                    user: {
                        nickname: true,
                    },
                },
            });
        } else {
            events = await DB.manager.find(ORMEventLog, {
                order: {
                    id: 'ASC',
                },
                take: limit,
                where: {
                    user: {
                        nickname: String(queryUser),
                    },
                },
                relations: { user: true },
                select: {
                    id: true,
                    eventType: true,
                    data: true,
                    user: {
                        nickname: true,
                    },
                },
            });
        }

        res.status(200).json(events);
    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: 'Failed to fetch events',
        });
    }
});

app.listen(PORT, () => {
    console.log(`EventLog service listening on port ${PORT}`);
});
