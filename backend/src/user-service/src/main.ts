import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import type { Express, NextFunction, Request, Response } from 'express';
import { DataSource, DeleteResult } from 'typeorm';
import { exit } from 'node:process';
import cookieParser from 'cookie-parser';
import { Logger, type ILogObj } from 'tslog';
import { authenticateMid } from 'ftr-common/middleware';
import { body, matchedData, validationResult } from 'express-validator';
import bcrypt from 'bcryptjs';

import { ORMEventLog, ORMUser } from 'ftr-common/ormTypes';
import 'ftr-common/expressTypes';
import { getUserByIdNoPw, mkStatus } from 'backend-utils';

// Initialize main tslog-logger
const log = new Logger<ILogObj>({
    name: 'userService',
    minLevel: process.env['NODE_ENV'] === 'development' ? 'DEBUG' : 'INFO',
});

// load env vars from global dotenv (correct when running from backend/src/user-service)
if (process.env['NODE_ENV'] === 'development') {
    log.info('loading dev.env...');
    dotenv.config({ path: '../../../dev.env', quiet: true });
}

const PORT = Number(process.env['USER_SERVICE_PORT']) || 3003;
const SECRET_KEY: string = process.env['JWT_SECRET'] || 'FooBarBaz';
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
    entities: [ORMUser, ORMEventLog],
    synchronize: true,
    logging: false,
});

try {
    await DB.initialize();
    log.info('user-service connected to DB');
} catch (err) {
    log.fatal('Failed to connect to database!');
    log.fatal(err as Error);
    exit(1);
}

const userRepo = DB.getRepository(ORMUser);

// -------------------------=[ user GET endpoints ]=------------------------- //

// simply get user record of authenticated user
app.get('/api/user', authenticate, async (req, res) => {
    const logGet = log.getSubLogger({ name: 'GET(user)' });
    try {
        const user = await getUserByIdNoPw(DB, req.userId!);
        if (user === null) {
            res.status(401).json({ error: 'User not found' });
            return;
        }
        res.json(user);
    } catch (err) {
        logGet.error(err as Error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// get all users
// NOTE admin only endpoint!
app.get('/api/user/all', authenticate, async (req: Request, res: Response) => {
    const logGet = log.getSubLogger({ name: 'GET(userAll)' });

    // guard this endpoint
    if (req.userId !== 0) {
        logGet.warn('access denied for uid', req.userId);
        res.status(401).json({ error: 'invalid credentials' });
        return;
    }

    try {
        const users = await userRepo.find();
        if (users.length === 0) {
            res.status(401).json({ error: 'no users in users table?!' });
            return;
        }
        res.json(users);
    } catch (err) {
        logGet.error(err as Error);
        res.status(500).json({ error: 'Failed to fetch user profile' });
    }
});

// health-check endpoint
app.get('/api/user/health', (_req: Request, res: Response) => {
    res.json({ status: 'user-service is running' });
});

// query users by uid
// NOTE admin only endpoint!
app.get(
    '/api/user/:userId',
    authenticate,
    async (req: Request, res: Response) => {
        const logGet = log.getSubLogger({ name: 'GET(userId)' });

        // guard this endpoint
        if (req.userId !== 0) {
            logGet.warn('access denied for uid', req.userId);
            res.status(401).json({ error: 'invalid credentials' });
            return;
        }

        const userId = Number(req.params['userId']);
        if (!Number.isInteger(userId)) {
            logGet.warn(`userId-enpoint queried with invalid uid ${userId}`);
            return res.status(400).json({ error: 'userId must be an integer' });
        }

        try {
            const user = await getUserByIdNoPw(DB, userId);
            if (user === null) {
                logGet.warn(`userId-enpoint queried with wrong uid ${userId}`);
                return res.status(401).json({ error: 'User not found' });
            }
            return res.json(user);
        } catch (err) {
            logGet.error(err as Error);
            return res
                .status(500)
                .json({ error: 'Failed to fetch user profile' });
        }
    }
);

// delete users by uid
// NOTE admin only endpoint!
app.delete(
    '/api/user/:userId',
    authenticate,
    async (req: Request, res: Response) => {
        const logGet = log.getSubLogger({ name: 'DEL(userId)' });

        // guard this endpoint
        if (req.userId !== 0) {
            logGet.warn('access denied for uid', req.userId);
            res.status(401).json(mkStatus('invalid credentials', 'error'));
            return;
        }

        const userId = Number(req.params['userId']);
        if (!Number.isInteger(userId)) {
            logGet.warn(`DelUserId-enpoint queried with invalid uid ${userId}`);
            return res
                .status(400)
                .json(mkStatus('userId must be an integer', 'error'));
        }

        try {
            const result: DeleteResult = await userRepo.delete({ id: userId });
            if (result.affected == null) {
                logGet.warn(`userId-enpoint queried with wrong uid ${userId}`);
                return res.status(404).json(mkStatus('invalid id', 'error'));
            }
            return res.status(204).json(mkStatus('', 'success'));
        } catch (err) {
            logGet.error(err as Error);
            return res
                .status(500)
                .json(mkStatus('Failed to fetch user profile', 'error'));
        }
    }
);
// ------------------------=[ user POST endpoints ]=------------------------ //

const validateNick = () =>
    body('nickname')
        .escape()
        .notEmpty()
        .withMessage('nick empty')
        .isLength({ max: 64 })
        .withMessage('nick invalid length')
        .isAlphanumeric()
        .withMessage('invalid char in nick');

const validatePw = () =>
    body('password')
        .escape()
        .notEmpty()
        .withMessage('pw empty')
        .isLength({ min: 4, max: 64 })
        .withMessage('pw invalid length')
        .isAlphanumeric()
        .withMessage('pw invalid char');

const validateMail = () =>
    body('email')
        .escape()
        .notEmpty()
        .withMessage('pw empty')
        .isEmail()
        .withMessage('invalid email');

app.post(
    '/api/user/register',
    validateNick(),
    validatePw(),
    validateMail(),
    async (req: Request, res: Response) => {
        const logReg = log.getSubLogger({ name: 'register' });

        // check any errors from Validation
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            logReg.warn('Got bad request from', req.ip);
            res.status(400).json(errors.array());
            return;
        }

        // use validated aka matched data
        const bodyData = matchedData(req);
        const userNick: string = bodyData['nickname'];
        const userPass: string = bodyData['password'];
        const userMail: string = bodyData['email'];

        try {
            const user = await DB.manager.findOneBy(ORMUser, {
                nickname: userNick,
            });
            if (user !== null) {
                logReg.warn(`user ${userNick} already exists in DB!`);
                res.status(403).json(mkStatus('user exists', 'error'));
                return;
            }
            const newUser = new ORMUser({
                nickname: userNick,
                hashedPw: bcrypt.hashSync(userPass, 10),
                email: userMail,
            });
            const savedUser = await userRepo.save(newUser);
            logReg.info(
                `created user ${savedUser.nickname} with id ${savedUser.id}`
            );
            res.status(201).json(
                mkStatus('user created', 'success', savedUser.id)
            );
        } catch (err) {
            logReg.fatal(err as Error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
);

// --------=[ fallback endpoint for catching unsuppoerted methods ]=-------- //

app.all('/api/user', (req: Request, res: Response) => {
    log.warn('Invalid Request to /api/user:', req.method);
    res.status(405).json({ error: 'Unsupported Method' });
});

// ---------------------------=[ launch server ]=--------------------------- //

app.listen(PORT, (): void => {
    log.info(`user-service listening on port: ${PORT}`);
});
