import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import type { Express, Request, Response } from 'express';
import { DataSource } from 'typeorm';
import { exit } from 'node:process';

import { ORMEventLog } from 'common/ormTypes';
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
    entities: [ORMEventLog],
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

app.post(
    '/api/eventlog',
    async (req: Request, res: Response): Promise<void> => {
        const { eventType, data } = req.body;

        if (!Object.values(EventType).includes(eventType)) {
            res.status(400).json({
                error: 'Invalid event type',
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
                eventType,
                data,
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

app.get('/api/eventlog', async (req: Request, res: Response): Promise<void> => {
    const limit = Number(req.query['limit'] ?? 50);

    if (!Number.isInteger(limit) || limit <= 0) {
        res.status(400).json({
            error: 'limit must be a positive integer',
        });
        return;
    }

    try {
        const events = await DB.manager.find(ORMEventLog, {
            order: {
                id: 'DESC',
            },
            take: limit,
        });

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
