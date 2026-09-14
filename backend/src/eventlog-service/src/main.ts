// TODO add endpoint  GET `/api/eventlog/matchhist` for getting the matchhistory
// as was originally inteded by maryam's mathistory table. goal is to do all the
// filtering in the backend and return a clean array which contains already all
// necessary data
// -> should return `EventLogEntry[]`

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

import { ORMEventLog, ORMUser } from 'ftr-common/ormTypes';
import {
    EventType,
    MAX_MATCH_HISTORY_ENTRIES,
    type MatchHistResponse,
    type EventDataGameResult,
} from 'ftr-common/sharedTypes';
import { authenticateMid } from 'ftr-common/middleware';
import { getUserById } from 'backend-utils';
import 'ftr-common/expressTypes';

// Initialize main tslog-logger
const log = new Logger<ILogObj>({
    name: 'eventlog',
    minLevel: process.env['NODE_ENV'] === 'development' ? 'INFO' : 'WARN',
});

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

// ------------------------=[  normal eventlogging ]=------------------------ //

// the data-validation for the POST endpoint. what do we want here? what do we
// allow here? so far we only reject empty data
//
// TODO validate EventData type here completely.. or let it be :)
const validateEventData = () => body('data').optional();

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

        const { eventType, data, logtime } = req.body;

        if (!Object.values(EventType).includes(eventType)) {
            res.status(400).json({
                error: 'Invalid event type',
            });
            return;
        }

        const user = await getUserById(DB, req.userId!);
        if (user === null) {
            res.status(400).json({
                error: `UID ${req.userId} not found`,
            });
            return;
        }

        if (typeof data !== 'object') {
            res.status(400).json({
                error: 'Event data must be an object',
            });
            return;
        }

        try {
            const event = DB.manager.create(ORMEventLog, {
                eventType: eventType,
                data: data,
                logtime: logtime,
                user: { id: user.id },
            });

            const savedEvent = await DB.manager.save(event);
            logPost.info('stored event:', savedEvent);

            // only info we need in frontend is that saving was successful and
            // the id under which it was saved
            res.status(201).json({ status: 'success', id: savedEvent.id });
        } catch (err) {
            logPost.error(err as Error);

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
// if no uid is specified user will be determined from JWT
app.get(
    '/api/eventlog',
    authenticate,
    async (req: Request, res: Response): Promise<void> => {
        const logGet = log.getSubLogger({ name: 'GET(eventlog)' });

        const queryUser = req.query['uid'];
        let queryUID;

        let limit: number | undefined;
        if (queryUser) {
            limit =
                req.query['limit'] != null
                    ? Number(req.query['limit'])
                    : undefined;
        } else {
            limit = Number(req.query['limit'] ?? 10);
        }

        if (!(limit === undefined) && !(Number.isInteger(limit) && limit > 0)) {
            res.status(400).json({
                error: 'limit must be a positive integer',
            });
            return;
        }

        if (queryUser != null) {
            if ((await getUserById(DB, Number(queryUser))) === null) {
                res.status(400).json({
                    error: `User ${queryUser} not found`,
                });
                return;
            }
            queryUID = Number(queryUser);
        }

        try {
            const events = await DB.manager.find(ORMEventLog, {
                order: {
                    id: 'DESC', // get entries starting from most recent
                },
                take: limit,
                // @ts-expect-error exactOptionalPropertyTypes
                //
                // NOTE: we would get code-dup because TS does ot want `where`
                // attribute to be undefined. writing it like this here is just
                // shorter and still correct.
                where:
                    queryUser != null
                        ? {
                              user: {
                                  id: queryUID,
                              },
                          }
                        : undefined,
                relations: { user: true },
                select: {
                    id: true,
                    eventType: true,
                    data: true,
                    user: {
                        nickname: true,
                        id: true,
                    },
                    logtime: true,
                },
            });
            events.reverse(); // make order in slice ascending again
            res.status(200).json(events);
        } catch (err) {
            logGet.error(err as Error);
            res.status(500).json({
                error: 'Failed to fetch events',
            });
        }
    }
);

// get everything, regardless of user from eventlog
// FIXME so far only here for debugging..
app.get(
    '/api/eventlog/all',
    authenticate,
    async (req: Request, res: Response): Promise<void> => {
        const logGet = log.getSubLogger({ name: 'GET(eventlog)' });
        void req;

        try {
            const events = await DB.manager.find(ORMEventLog, {
                relations: { user: true },
                select: {
                    id: true,
                    eventType: true,
                    data: true,
                    user: {
                        nickname: true,
                        id: true,
                    },
                    logtime: true,
                },
            });
            events.reverse(); // make order in slice ascending again
            res.status(200).json(events);
        } catch (err) {
            logGet.error(err as Error);
            res.status(500).json({
                error: 'Failed to fetch events',
            });
        }
    }
);

// ----------------------=[ match history endpoints ]=---------------------- //

app.get(
    '/api/eventlog/matchhist',
    authenticate,
    async (req: Request, res: Response): Promise<void> => {
        const logGet = log.getSubLogger({ name: 'GET(matchhist)' });

        // req.userId will always be set after successful auth
        const userId = req.userId!;

        try {
            const events = await DB.manager.find(ORMEventLog, {
                order: {
                    id: 'DESC', // get entries starting from most recent
                },
                take: MAX_MATCH_HISTORY_ENTRIES,
                where: {
                    user: { id: userId },
                    eventType: EventType.GameResult,
                },
                select: {
                    id: true,
                    data: {
                        game: true,
                        outcome: true,
                        opponentNickname: true,
                    },
                    logtime: true,
                },
            });
            events.reverse(); // make order in slice ascending again
            res.status(200).json(events);
        } catch (err) {
            logGet.error(err as Error);
            res.status(500).json({
                error: 'Failed to fetch events',
            });
        }
    }
);

// a simple enpoint for storing the matchresult. almost the same as the standard
// post endpoint but returns the stored GameResult in response for parsing in
// frontend
app.post(
    '/api/eventlog/matchhist',
    authenticate,
    async (req: Request, res: Response): Promise<void> => {
        const logPost = log.getSubLogger({ name: 'POST(matchhist)' });

        const { eventType, data, logtime } = req.body;

        if (eventType !== 'GameResult') {
            res.status(400).json({
                error: 'Invalid event type',
            });
            return;
        }

        const user = await getUserById(DB, req.userId!);
        if (user === null) {
            res.status(400).json({
                error: `UID ${req.userId} not found`,
            });
            return;
        }

        if (typeof data !== 'object') {
            res.status(400).json({
                error: 'Event data must be an object',
            });
            return;
        }

        try {
            const event = DB.manager.create(ORMEventLog, {
                eventType: eventType,
                data: data,
                logtime: logtime,
                user: { id: user.id },
            });

            const savedEvent = await DB.manager.save(event);
            const savedEventMatchHist: MatchHistResponse = {
                id: savedEvent.id,
                data: savedEvent.data as EventDataGameResult,
                logtime: savedEvent.logtime,
            };
            logPost.info('stored event:', savedEvent);
            res.status(201).json(savedEventMatchHist);
        } catch (err) {
            logPost.error(err as Error);

            res.status(500).json({
                error: 'Failed to save event',
            });
        }
    }
);

// -------------------=[ the delete everything endpoint ]=------------------- //

// WARN maybe remove this for prod.. or create a admin account that cannot be
// logged in to from frontend
app.delete(
    '/api/eventlog',
    authenticate,
    async (req: Request, res: Response): Promise<void> => {
        const logDel = log.getSubLogger({ name: 'DELETE' });
        void req;

        try {
            await DB.manager.deleteAll(ORMEventLog);
            res.status(204).json({ message: 'success' });
        } catch (err) {
            logDel.error(err as Error);
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
