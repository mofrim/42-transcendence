// Mirror of auth-service main.ts but for user-service
import 'reflect-metadata';

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import type { Express, Request, Response } from 'express';
import { DataSource } from 'typeorm';
import { exit } from 'node:process';
import cookieParser from 'cookie-parser';
import { ORMUserProfile, ORMMatchHistory } from './orm_types.js';

// load env vars from global dotenv (correct when running from backend/src/user-service)
if (process.env['NODE_ENV'] === 'development') {
    console.log('loading dev.env...');
    dotenv.config({ path: '../../../dev.env' });
}

const PORT = Number(process.env['USER_SERVICE_PORT']) || 3003;
const app: Express = express();

app.use(cors({ credentials: true }));
app.use(express.json());
app.use(cookieParser());

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
    entities: [ORMUserProfile, ORMMatchHistory],
    synchronize: true,
    logging: false,
});

try {
    await DB.initialize();
    console.log('Database connected');

    const userProfileRepo = DB.getRepository(ORMUserProfile);

    // Create user profile
    app.post('/api/user-profiles', async (req: Request, res: Response) => {
        try {
            const body = req.body as {
                userId?: unknown;
                character?: unknown;
            };

            if (!Number.isInteger(body.userId)) {
                return res
                    .status(400)
                    .json({ error: 'userId must be an integer' });
            }
            if (typeof body.character !== 'boolean') {
                return res
                    .status(400)
                    .json({ error: 'character must be a boolean' });
            }

            const userId = body.userId as number;
            const character = body.character as boolean;

            const existing = await userProfileRepo.findOne({
                where: { userId },
            });
            if (existing) {
                return res
                    .status(409)
                    .json({ error: 'Profile already exists for this userId' });
            }

            const profile = userProfileRepo.create({ userId, character });
            await userProfileRepo.save(profile);
            return res.status(201).json(profile);
        } catch (err) {
            return res.status(500).json({
                error: 'Failed to create user profile',
                details: String(err),
            });
        }
    });

    // Get user profile by userId
    app.get(
        '/api/user-profiles/:userId',
        async (req: Request, res: Response) => {
            const userId = Number(req.params['userId']);
            if (!Number.isInteger(userId)) {
                return res
                    .status(400)
                    .json({ error: 'userId must be an integer' });
            }

            try {
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
                return res.status(500).json({
                    error: 'Failed to fetch user profile',
                    details: String(err),
                });
            }
        }
    );

    // Update user profile by userId
    app.put(
        '/api/user-profiles/:userId',
        async (req: Request, res: Response) => {
            const userId = Number(req.params['userId']);
            if (!Number.isInteger(userId)) {
                return res
                    .status(400)
                    .json({ error: 'userId must be an integer' });
            }

            try {
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
                return res.json(profile);
            } catch (err) {
                return res.status(500).json({
                    error: 'Failed to update user profile',
                    details: String(err),
                });
            }
        }
    );

    // Delete user profile by userId
    app.delete(
        '/api/user-profiles/:userId',
        async (req: Request, res: Response) => {
            const userId = Number(req.params['userId']);
            if (!Number.isInteger(userId)) {
                return res
                    .status(400)
                    .json({ error: 'userId must be an integer' });
            }

            try {
                const result = await userProfileRepo.delete({ userId });
                if (result.affected !== 1) {
                    return res
                        .status(404)
                        .json({ error: 'User profile not found' });
                }
                return res.status(204).send();
            } catch (err) {
                return res.status(500).json({
                    error: 'Failed to delete user profile',
                    details: String(err),
                });
            }
        }
    );
} catch (error) {
    console.error('Failed to connect to database!');
    console.log(error);
    exit(1);
}

// -----------------------=[ Health check endpoint ]=----------------------- //
app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'user-service is running' });
});

app.listen(PORT, (): void => {
    console.log(`user-service listening on port: ${PORT}`);
});
