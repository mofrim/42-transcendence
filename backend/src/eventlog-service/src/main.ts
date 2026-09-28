import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { DataSource, type FindManyOptions } from 'typeorm';
import { exit } from 'node:process';
import { Logger } from 'tslog';
import cookieParser from 'cookie-parser';

import type { ILogObj } from 'tslog';
import type { Express, Request, Response, NextFunction } from 'express';

import { ORMEventLog, ORMUser } from 'ftr-common/ormTypes';
import {
    API_EVENTLOG,
    EventType,
    MAX_MATCH_HISTORY_ENTRIES,
    type MatchHistResponse,
    type EventDataGameResult,
} from 'ftr-common/sharedTypes';
import { authenticateMid } from 'ftr-common/middleware';
import { getUserById } from 'backend-utils';
import { mkApiResponse } from 'ftr-common/utils';
import 'ftr-common/expressTypes';

// Initialize main tslog-logger
const log = new Logger<ILogObj>({
    name: 'eventlog',
    minLevel: process.env['NODE_ENV'] === 'development' ? 'DEBUG' : 'INFO',
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
    if (err instanceof SyntaxError && err.message.includes('JSON')) {
        log.warn('Got invalid JSON body from IP ', req.ip);
        res.status(400).json(mkApiResponse('Invalid JSON body', 'error'));
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
    log.info('user-service connected to DB');
} catch (err) {
    log.error('Failed to connect to database!');
    log.error(err as Error);
    exit(1);
}

/** ORMEventLog */
const eventLogRepo = DB.getRepository(ORMEventLog);
const eventLogWithUserOptions = {
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
} satisfies FindManyOptions<ORMEventLog>;

// ------------------------=[  normal eventlogging ]=------------------------ //

const eventLogRoute = app.route(API_EVENTLOG.root);

eventLogRoute.post(
    authenticate,
    async (req: Request, res: Response): Promise<void> => {
        const logPost = log.getSubLogger({ name: 'POST' });

        const { eventType, data, logtime } = req.body;

        if (!Object.values(EventType).includes(eventType)) {
            res.status(400).json(mkApiResponse('Invalid event type', 'error'));
            return;
        }

        const user = await getUserById(DB, req.userId!);
        if (user === null) {
            res.status(400).json(
                mkApiResponse(`UID ${req.userId} not found`, 'error')
            );
            return;
        }

        if (typeof data !== 'object') {
            res.status(400).json(
                mkApiResponse('Event data must be an object', 'error')
            );
            return;
        }

        try {
            const savedEvent = await eventLogRepo.save({
                eventType,
                data,
                logtime,
                user: { id: user.id },
            });
            logPost.info('stored event:', savedEvent);

            // only info we need in frontend is that saving was successful and
            // the id under which it was saved
            res.status(201).json(
                mkApiResponse('Event stored', 'success', savedEvent.id)
            );
        } catch (err) {
            logPost.error(err as Error);

            res.status(500).json(
                mkApiResponse('Failed to save event', 'error')
            );
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
eventLogRoute.get(
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
            res.status(400).json(
                mkApiResponse('limit must be a positive integer', 'error')
            );
            return;
        }

        if (queryUser != null) {
            if ((await getUserById(DB, Number(queryUser))) === null) {
                res.status(400).json(
                    mkApiResponse(`User ${queryUser} not found`, 'error')
                );
                return;
            }
            queryUID = Number(queryUser);
        }

        try {
            const events = await eventLogRepo.find({
                ...eventLogWithUserOptions,
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
            });
            events.reverse(); // make order in slice ascending again
            res.status(200).json(
                mkApiResponse<ORMEventLog[]>(
                    'Found eventlogs',
                    'success',
                    undefined,
                    events
                )
            );
        } catch (err) {
            logGet.error(err as Error);
            res.status(500).json(
                mkApiResponse('Failed to fetch events', 'error')
            );
        }
    }
);

// get everything, regardless of user from eventlog
// FIXME so far only here for debugging..
app.get(
    API_EVENTLOG.all,
    authenticate,
    async (req: Request, res: Response): Promise<void> => {
        const logGet = log.getSubLogger({ name: 'GET(eventlog)' });
        void req;

        try {
            const events = await eventLogRepo.find(eventLogWithUserOptions);
            events.reverse(); // make order in slice ascending again
            res.status(200).json(
                mkApiResponse<ORMEventLog[]>(
                    'Found eventlogs',
                    'success',
                    undefined,
                    events
                )
            );
        } catch (err) {
            logGet.error(err as Error);
            res.status(500).json(
                mkApiResponse('Failed to fetch events', 'error')
            );
        }
    }
);

// ----------------------=[ match history endpoints ]=---------------------- //

const matchHistoryRoute = app.route(API_EVENTLOG.matchHistory);

matchHistoryRoute.get(
    authenticate,
    async (req: Request, res: Response): Promise<void> => {
        const logGet = log.getSubLogger({ name: 'GET(matchhist)' });

        // req.userId will always be set after successful auth
        const userId = req.userId!;

        try {
            const events = await eventLogRepo.find({
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
            res.status(200).json(
                mkApiResponse<MatchHistResponse[]>(
                    'Found eventlogs',
                    'success',
                    undefined,
                    events as MatchHistResponse[]
                )
            );
        } catch (err) {
            logGet.error(err as Error);
            res.status(500).json(
                mkApiResponse('Failed to fetch events', 'error')
            );
        }
    }
);

// a simple enpoint for storing the matchresult. almost the same as the standard
// post endpoint but returns the stored GameResult in response for parsing in
// frontend
matchHistoryRoute.post(
    authenticate,
    async (req: Request, res: Response): Promise<void> => {
        const logPost = log.getSubLogger({ name: 'POST(matchhist)' });

        const { eventType, data, logtime } = req.body;

        if (eventType !== EventType.GameResult) {
            res.status(400).json(mkApiResponse('Invalid event type', 'error'));
            return;
        }

        const user = await getUserById(DB, req.userId!);
        if (user === null) {
            res.status(400).json(
                mkApiResponse(`UID ${req.userId} not found`, 'error')
            );
            return;
        }

        if (typeof data !== 'object') {
            res.status(400).json(
                mkApiResponse('Event data must be an object', 'error')
            );
            return;
        }

        try {
            const savedEvent = await eventLogRepo.save({
                eventType,
                data,
                logtime,
                user: { id: user.id },
            });
            const savedEventMatchHist: MatchHistResponse = {
                id: savedEvent.id,
                data: savedEvent.data as EventDataGameResult,
                logtime: savedEvent.logtime,
            };
            logPost.info('stored event:', savedEvent);
            res.status(201).json(
                mkApiResponse<MatchHistResponse>(
                    'Saving event successful',
                    'success',
                    undefined,
                    savedEventMatchHist
                )
            );
        } catch (err) {
            logPost.error(err as Error);

            res.status(500).json(
                mkApiResponse('Failed to save event', 'error')
            );
        }
    }
);

// ------------------------=[ the reset endpoint ]=-------------------------- //

// can be used to reset eventlog during tests / dev
// NOTE admin only endpoint!
eventLogRoute.delete(
    authenticate,
    async (req: Request, res: Response): Promise<void> => {
        const logDel = log.getSubLogger({ name: 'DELETE' });
        void req;

        try {
            await eventLogRepo.deleteAll();
            res.status(204).end();
        } catch (err) {
            logDel.error(err as Error);
            res.status(500).json(
                mkApiResponse('Failed to fetch events', 'error')
            );
        }
    }
);

// --------=[ fallback endpoint for catching unsuppoerted methods ]=-------- //

eventLogRoute.all((req: Request, res: Response) => {
    log.warn(`Invalid Request to ${API_EVENTLOG.root}:`, req.method);
    res.status(405).json(mkApiResponse('Unsupported Method', 'error'));
});

// ---------------------=[ finally launch the server ]=--------------------- //

app.listen(PORT, () => {
    log.info(`EventLog service listening on port ${PORT}`);
});
