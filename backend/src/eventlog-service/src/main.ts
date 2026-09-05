import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { DataSource } from 'typeorm';
import { exit } from 'node:process';
import { Logger } from 'tslog';
import cookieParser from 'cookie-parser';
import { body, validationResult } from 'express-validator';

import type { ILogObj } from 'tslog';
import type { Express, Request, Response, NextFunction } from 'express';

import { ORMEventLog, ORMUser } from 'common/ormTypes';
import { EventType } from 'common/sharedTypes';
import { authenticateMid } from 'common/middleware';

// Initialize main tslog-logger
const log = new Logger<ILogObj>({ name: 'eventlog', minLevel: 'INFO' });

if (process.env['NODE_ENV'] === 'development') {
    log.info('loading dev.env...');
    dotenv.config({ path: '../../../dev.env', quiet: true });
}

// using partial function evaluation here to set the local logger and SECRET_KEY
// in auth middleware function
const authenticate = (req: Request, res: Response, next: NextFunction) =>
    authenticateMid(req, res, next, log, SECRET_KEY);

const SECRET_KEY: string = process.env['JWT_SECRET'] || 'FooBarBaz';
const PORT = Number(process.env['EVENTLOG_SERVICE_PORT']) || 3002;

const app: Express = express();

app.use(cors({ credentials: true }));
app.use(express.json());

// reject any non-JSON bodies early
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    void req;
    if (err instanceof SyntaxError && err.message.includes('JSON')) {
        log.warn('Got invalid JSON body from IP ', req.ip);
        res.status(400).json({ error: 'Invalid JSON body' });
    } else {
        next(err);
    }
});

app.use(cookieParser());

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
} catch (err) {
    log.error('Failed to connect to database!');
    log.error(err as Error);
    exit(1);
}

// get the id belonging to a nickname string
const getUserId = async (nick: string): Promise<number | null> => {
    try {
        const exists = await DB.manager.findOneBy(ORMUser, { nickname: nick });
        return exists === null ? null : exists.id;
    } catch (err) {
        console.error(err);
        return null;
    }
};

// -------------------------=[ the POST endpoint ]=------------------------- //

// the data-validation for the POST endpoint. what do we want here? what do we
// allow here? so far we only reject empty data
const validateEventData = () =>
    body('data').notEmpty().withMessage('empty data');

app.post(
    '/api/eventlog',
    authenticate,
    validateEventData(),
    async (req: Request, res: Response): Promise<void> => {
        const logPost = log.getSubLogger({ name: 'POST' });

        // check any errors from Validation
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            logPost.warn('Got bad request from', req.ip);
            res.status(400).json({ errors: errors.array() });
            return;
        }

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
                user: { id: userId },
            });

            const savedEvent = await DB.manager.save(event);

            res.status(201).json(savedEvent);
        } catch (err) {
            logPost.error(err as Error);

            res.status(500).json({
                error: 'Failed to save event',
            });
        }
    }
);

// --------------------------=[ the GET endpoint ]=-------------------------- //

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
app.get(
    '/api/eventlog',
    authenticate,
    async (req: Request, res: Response): Promise<void> => {
        const logGet = log.getSubLogger({ name: 'GET' });

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
        } catch (err) {
            logGet.error(err as Error);
            res.status(500).json({
                error: 'Failed to fetch events',
            });
        }
    }
);

// --------=[ fallback endpoint for catching unsuppoerted methods ]=-------- //

app.all('/api/eventlog', (req: Request, res: Response) => {
    log.warn('Invalid Request to /api/eventlog:', req.method);
    res.status(405).json({ error: 'Unsupported Method' });
});

// ---------------------=[ finally launch the server ]=--------------------- //

app.listen(PORT, () => {
    log.info(`EventLog service listening on port ${PORT}`);
});
