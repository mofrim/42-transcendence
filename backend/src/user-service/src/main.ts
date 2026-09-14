import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import type { Express, NextFunction, Request, Response } from 'express';
import { DataSource } from 'typeorm';
import { exit } from 'node:process';
import cookieParser from 'cookie-parser';
import { Logger, type ILogObj } from 'tslog';
import { authenticateMid } from 'ftr-common/middleware';

import { ORMEventLog, ORMUser } from 'ftr-common/ormTypes';
import { ORMMatchHistory, ORMUserProfile } from './orm_types.js';
import 'ftr-common/expressTypes';
import { getUserById } from 'backend-utils';

// load env vars from global dotenv (correct when running from backend/src/user-service)
if (process.env['NODE_ENV'] === 'development') {
    console.log('loading dev.env...');
    dotenv.config({ path: '../../../dev.env' });
}

const PORT = Number(process.env['USER_SERVICE_PORT']) || 3003;
const SECRET_KEY: string = process.env['JWT_SECRET'] || 'FooBarBaz';
const log = new Logger<ILogObj>({ name: 'user', minLevel: 'INFO' });
const app: Express = express();

app.use(cors({ credentials: true }));

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
app.use(express.json());

app.use(cookieParser());

// using partial function evaluation here to set the local logger and SECRET_KEY
// in auth middleware function
const authenticate = (req: Request, res: Response, next: NextFunction) =>
    authenticateMid(req, res, next, log, SECRET_KEY);

// -------------------------=[ DB initialization ]=------------------------- //

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
    entities: [ORMUserProfile, ORMMatchHistory, ORMUser, ORMEventLog],
    synchronize: true,
    logging: false,
});

try {
    await DB.initialize();
} catch (err) {
    log.fatal('Failed to connect to database!');
    log.fatal(err as Error);
    exit(1);
}

const userProfileRepo = DB.getRepository(ORMUserProfile);
const matchHistoryRepo = DB.getRepository(ORMMatchHistory);
const userRepo = DB.getRepository(ORMUser);

const getCurrentUser = async (req: Request) => {
    if (!req.userId) {
        return null;
    }

    return userRepo.findOne({
        where: { id: req.userId },
        select: {
            id: true,
            nickname: true,
            character: true,
            email: true,
        },
    });
};

app.get('/api/user', authenticate, async (req, res) => {
    try {
        const user = await getUserById(DB, req.userId!);
        if (user === null) {
            res.status(401).json({ error: 'User not found' });
            return;
        }
        res.json(user);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get user profile by userId
app.get(
    '/api/user/:userId',
    authenticate,
    async (req: Request, res: Response) => {
        const userId = Number(req.params['userId']);
        if (!Number.isInteger(userId)) {
            return res.status(400).json({ error: 'userId must be an integer' });
        }

        try {
            const user = await getCurrentUser(req);
            if (!user || user.id !== userId) {
                return res.status(403).json({ error: 'Forbidden' });
            }

            const profile = await userProfileRepo.findOne({
                where: { userId },
            });
            if (!profile) {
                return res
                    .status(404)
                    .json({ error: 'User profile not found' });
            }
            return res.json(profile);
        } catch (err) {
            log.error(err as Error);
            return res
                .status(500)
                .json({ error: 'Failed to fetch user profile' });
        }
    }
);

app.get(
    '/api/match-history',
    authenticate,
    async (req: Request, res: Response) => {
        const limit = Number(req.query['limit'] ?? 50);
        if (!Number.isInteger(limit) || limit <= 0 || limit > 100) {
            res.status(400).json({
                error: 'limit must be an integer between 1 and 100',
            });
            return;
        }

        try {
            const user = await getCurrentUser(req);
            if (!user) {
                res.status(404).json({ error: 'User not found' });
                return;
            }

            const history = await matchHistoryRepo.find({
                where: { userId: user.id },
                order: { finishedAt: 'DESC' },
                take: limit,
            });
            res.json(history);
        } catch (err) {
            log.error(err as Error);
            res.status(500).json({ error: 'Failed to fetch match history' });
        }
    }
);

// Create user profile
app.post(
    '/api/user-profiles',
    authenticate,
    async (req: Request, res: Response) => {
        try {
            const user = await getCurrentUser(req);
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            const body = req.body as { character?: unknown };
            if (typeof body.character !== 'boolean') {
                return res
                    .status(400)
                    .json({ error: 'character must be a boolean' });
            }

            const existing = await userProfileRepo.findOne({
                where: { userId: user.id },
            });
            if (existing) {
                return res
                    .status(409)
                    .json({ error: 'Profile already exists for this user' });
            }

            const profile = userProfileRepo.create({
                userId: user.id,
                character: body.character,
            });
            await userProfileRepo.save(profile);
            return res.status(201).json(profile);
        } catch (err) {
            log.error(err as Error);
            return res
                .status(500)
                .json({ error: 'Failed to create user profile' });
        }
    }
);

// Update user profile by userId
app.put(
    '/api/user-profiles/:userId',
    authenticate,
    async (req: Request, res: Response) => {
        const userId = Number(req.params['userId']);
        if (!Number.isInteger(userId)) {
            return res.status(400).json({ error: 'userId must be an integer' });
        }

        try {
            const user = await getCurrentUser(req);
            if (!user || user.id !== userId) {
                return res.status(403).json({ error: 'Forbidden' });
            }

            const profile = await userProfileRepo.findOne({
                where: { userId },
            });
            if (!profile) {
                return res
                    .status(404)
                    .json({ error: 'User profile not found' });
            }

            const body = req.body as { character?: unknown };
            if (
                Object.prototype.hasOwnProperty.call(body, 'character') &&
                typeof body.character !== 'boolean'
            ) {
                return res
                    .status(400)
                    .json({ error: 'character must be a boolean' });
            }

            if (typeof body.character === 'boolean') {
                profile.character = body.character;
            }
            await userProfileRepo.save(profile);
            await userRepo.update(userId, { character: profile.character });
            return res.json(profile);
        } catch (err) {
            log.error(err as Error);
            return res
                .status(500)
                .json({ error: 'Failed to update user profile' });
        }
    }
);

// Delete user profile by userId
app.delete(
    '/api/user-profiles/:userId',
    authenticate,
    async (req: Request, res: Response) => {
        const userId = Number(req.params['userId']);
        if (!Number.isInteger(userId)) {
            return res.status(400).json({ error: 'userId must be an integer' });
        }

        try {
            const user = await getCurrentUser(req);
            if (!user || user.id !== userId) {
                return res.status(403).json({ error: 'Forbidden' });
            }

            const result = await userProfileRepo.delete({ userId });
            if (result.affected !== 1) {
                return res
                    .status(404)
                    .json({ error: 'User profile not found' });
            }
            return res.status(204).send();
        } catch (err) {
            log.error(err as Error);
            return res
                .status(500)
                .json({ error: 'Failed to delete user profile' });
        }
    }
);

// -----------------------=[ Health check endpoint ]=----------------------- //
app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'user-service is running' });
});

app.listen(PORT, (): void => {
    console.log(`user-service listening on port: ${PORT}`);
});
