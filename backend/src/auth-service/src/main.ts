// --------------------------=[ the auth-service ]=-------------------------- //
//
// The basic idea is to make direct calls to DB here, instead of querying DB via
// user-service because
//
// - they are read-only
// - very limited in scope (only for verification)
// - login-process should as fast as possible
//
// so...

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { DataSource } from 'typeorm';
import { exit } from 'node:process';
import cookieParser from 'cookie-parser';
import { Logger } from 'tslog';
import { body, matchedData, validationResult } from 'express-validator';

import type { ILogObj } from 'tslog';
import type { Request, Express, Response, NextFunction } from 'express';

import { ORMEventLog, ORMUser } from 'common/ormTypes';
import { authenticateMid } from 'common/middleware';
import { setupDefaultUsers } from './defaultUserSetup.ts';
import 'common/expressTypes';

// Initialize main tslog-logger
const log = new Logger<ILogObj>({ name: 'auth', minLevel: 'INFO' });

// Load env vars from global dotenv...
// this path is correct if ran from backend/src/auth-service dir
// TODO add proper handling for production `.env`
if (process.env['NODE_ENV'] === 'development') {
    log.info('loading dev.env...');
    dotenv.config({ path: '../../../dev.env', quiet: true });
}

const SECRET_KEY: string = process.env['JWT_SECRET'] || 'FooBarBaz';
const PORT = Number(process.env['AUTH_SERVICE_PORT']) || 3001;

// using partial function evaluation here to set the local logger and SECRET_KEY
// in auth middleware function
const authenticate = (req: Request, res: Response, next: NextFunction) =>
    authenticateMid(req, res, next, log, SECRET_KEY);

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
} catch (err) {
    log.fatal('Failed to connect to database!');
    log.fatal(err as Error);
    exit(1);
}

// -------------------=[ add us + testy as users to DB ]=-------------------- //

setupDefaultUsers(DB);

// ------------------------=[ define login endpoint ]=----------------------- //

// Validation funcs for nick & pw.
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

app.post(
    '/api/login',
    validateNick(),
    validatePw(),
    async (req: Request, res: Response): Promise<void> => {
        // create sublogger which will have the prefix 'auth:login' on console
        const loginLog = log.getSubLogger({ name: 'login' });

        // check any errors from Validation
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            loginLog.warn('Got bad request from', req.ip);
            res.status(400).json({ errors: errors.array() });
            return;
        }

        // use validated aka matched data
        const bodyData = matchedData(req);

        const userNick: string = bodyData['nickname'];
        const userPass: string = bodyData['password'];

        try {
            const user = await DB.manager.findOneBy(ORMUser, {
                nickname: userNick,
            });
            if (user === null) {
                loginLog.warn('Cannot find user', userNick, 'in DB');
                res.status(401).json({ error: 'Invalid credentials' });
                return;
            }

            const isPasswordValid = await bcrypt.compare(
                userPass,
                user.hashedPw
            );
            if (!isPasswordValid) {
                res.status(401).json({ error: 'Invalid credentials' });
                return;
            }

            const token = jwt.sign({ nickname: user.nickname }, SECRET_KEY, {
                algorithm: 'HS256',
                expiresIn: '1h',
            });

            res.cookie('token', token, {
                httpOnly: true,
                secure: process.env['NODE_ENV'] === 'production',
                sameSite: 'strict',
                maxAge: 60 * 60 * 1000, // 1h
            });
            res.json({ success: true });
        } catch (err) {
            loginLog.fatal(err as Error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
);

// ------------------=[ logout aka clear-cookie endpoint ]=------------------ //

app.post('/api/logout', authenticate, (req, res) => {
    void req;
    res.clearCookie('token', {
        httpOnly: true,
        secure: process.env['NODE_ENV'] === 'production',
        sameSite: 'strict',
    });
    res.json({ success: true });
});

// --------------------------------=[ misc ]=-------------------------------- //

// The section below represents an outlook on how to verify access in the
// backend using the cookie -> not really code relevant for the auth-service.
//
// try it out using
//
// - `curl -v localhost:3001/login -H 'Content-Type: application/json' -d '{"nickname": "testy", "password": "testpw"}'`
//
// - this will return something like a `Set-Cookie: token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJuaWNrbmFtZSI6InRlc3R5IiwiaWF0IjoxNzg1ODU4ODk2LCJleHAiOjE3ODU4NjI0OTZ9.RMgdl7vLqmlkRkd0W88mzCp5t815ZzohlWLn7PX3qXs; Max-Age=86400; Path=/; Expires=Wed, 05 Aug 2026 15:54:56 GMT; HttpOnly; SameSite=Lax` header
//
// - make the next curl using the cookie: `curl -v localhost:3001/protected -H 'Cookie: token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJuaWNrbmFtZSI6InRlc3R5IiwiaWF0IjoxNzg1ODU4ODk2LCJleHAiOjE3ODU4NjI0OTZ9.RMgdl7vLqmlkRkd0W88mzCp5t815ZzohlWLn7PX3qXs'`
//
// => {"msg":"hello testy!"}

if (process.env['NODE_ENV'] === 'development') {
    // this is only a demo endpoint
    app.get('/api/protected', authenticate, (req: Request, res: Response) => {
        const nickname = req.user!.nickname;
        res.json({ msg: `hello ${nickname}!` });
    });
}

////////////////////////////////////////////////////////////////////////////////
// Another example endpoint...
//
// Example user endpoint which extracts the user from the token-cookie
// certainly a TODO to move this to user-service!
//
// with this endpoint you can retrieve the complete authenticated user data
// (definitely nothing we want for production!). retrieve a valid auth cookie
// then use: `curl -v localhost:3001/api/user -H 'Cookie: token=.....'`
app.get('/api/user', authenticate, async (req, res) => {
    const { nickname } = req.user!;
    try {
        const user = await DB.manager.findOneBy(ORMUser, {
            nickname: nickname,
        });
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

// --------=[ Fallback enpoint for catching invalid methods etc.. ]=-------- //

app.all('/api/login', (req: Request, res: Response) => {
    log.warn('Invalid Request:', req.method);
    res.status(405).json({ error: 'Unsupported Method' });
});

// -----------------=[ launch the express server finally ]=----------------- //

app.listen(PORT, (): void => {
    log.info('listening on port:', PORT);
});
