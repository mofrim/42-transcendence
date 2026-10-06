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
import {
    checkSchema,
    matchedData,
    validationResult,
    type ValidationError,
} from 'express-validator';

import type { ILogObj } from 'tslog';
import type { Request, Express, Response, NextFunction } from 'express';

import { ORMEventLog, ORMUser } from 'ftr-common/ormTypes';
import { authenticateMid, verifyToken } from 'ftr-common/middleware';
import { setupDefaultUsers } from './defaultUserSetup.ts';
import { getUserById } from 'backend-utils';
import { mkApiResponse } from 'ftr-common/utils';
import 'ftr-common/expressTypes';

// Initialize main tslog-logger
const log = new Logger<ILogObj>({
    name: 'authService',
    minLevel: process.env['NODE_ENV'] === 'development' ? 'DEBUG' : 'INFO',
});

if (process.env['NODE_ENV'] === 'development') {
    log.info('loading dev.env...');
    dotenv.config({ path: '../../../dev.env', quiet: true });
}

// enforce config through dotenv only! add any require env-vars here
const REQUIRED_ENV = ['AUTH_SERVICE_PORT', 'JWT_SECRET', 'DB_HOST'];
if (REQUIRED_ENV.some((v) => process.env[v] === undefined)) {
    log.error(`env not like it should be! exiting...`);
    exit(1);
}

const DB_HOST: string = process.env['DB_HOST']!;
const SECRET_KEY: string = process.env['JWT_SECRET']!;
const PORT = Number(process.env['AUTH_SERVICE_PORT']);

const IS_PRODUCTION = process.env['NODE_ENV'] === 'production';
const TOKEN_COOKIE_OPTIONS = {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: 'strict',
} as const;

// using partial function evaluation here to set the local logger and SECRET_KEY
// in auth middleware function
const authenticate = (req: Request, res: Response, next: NextFunction) =>
    authenticateMid(req, res, next, log, SECRET_KEY);

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

// -------------------------=[ DB initialization ]=------------------------- //

const DB = new DataSource({
    type: 'postgres',
    host: DB_HOST,
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

const userRepo = DB.getRepository(ORMUser);

// -------------------=[ add us + testy as users to DB ]=-------------------- //

setupDefaultUsers(DB);

// ------------------------=[ define login endpoint ]=----------------------- //

/** Validation funcs for nick & pw. */
const loginValidation = checkSchema(
    {
        nickname: {
            escape: true,
            notEmpty: { errorMessage: 'nick empty' },
            isLength: {
                options: { max: 64 },
                errorMessage: 'nick invalid length',
            },
            isAlphanumeric: { errorMessage: 'invalid char in nick' },
        },
        password: {
            escape: true,
            notEmpty: { errorMessage: 'pw empty' },
            isLength: {
                options: { min: 4, max: 64 },
                errorMessage: 'pw invalid length',
            },
            isAlphanumeric: { errorMessage: 'pw invalid char' },
        },
    },
    ['body']
);

app.post(
    '/api/login',
    loginValidation,
    async (req: Request, res: Response): Promise<void> => {
        // create sublogger which will have the prefix 'auth:login' on console
        const loginLog = log.getSubLogger({ name: 'login' });

        // check any errors from Validation
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            loginLog.warn('Got bad request from', req.ip);
            res.status(400).json(
                mkApiResponse<ValidationError[]>(
                    'Validation failed',
                    'error',
                    undefined,
                    errors.array()
                )
            );
            return;
        }

        // use validated aka matched data
        const bodyData = matchedData(req);

        const userNick: string = bodyData['nickname'];
        const userPass: string = bodyData['password'];

        try {
            const user = await userRepo.findOneBy({
                nickname: userNick,
            });
            if (user === null) {
                loginLog.warn('Cannot find user', userNick, 'in DB');
                res.status(401).json(
                    mkApiResponse('Invalid credentials', 'error')
                );
                return;
            }

            const isPasswordValid = await bcrypt.compare(
                userPass,
                user.hashedPw
            );
            if (!isPasswordValid) {
                res.status(401).json(
                    mkApiResponse('Invalid credentials', 'error')
                );
                return;
            }

            // Fail if user already logged in!
            if (user.isLoggedIn) {
                res.status(409).json(
                    mkApiResponse('Already logged in', 'error')
                );
                return;
            }

            // Using standard claim fields here. no need for custom fields in
            // our case -> https://en.wikipedia.org/wiki/JSON_Web_Token#Standard_fields
            const token = jwt.sign({ sub: String(user.id) }, SECRET_KEY, {
                issuer: 'auth-service',
                algorithm: 'HS256',
                expiresIn: '6h',
                audience: 'backend',
            });

            // Toggle login-status in DB
            user.isLoggedIn = true;
            const result = await userRepo.update({ id: user.id }, user);
            if (result.affected !== 1) {
                loginLog.error('Failed to update user login state in DB');
                res.status(500).json(
                    mkApiResponse('Failed updating login-status', 'error')
                );
            }

            res.cookie('token', token, {
                ...TOKEN_COOKIE_OPTIONS,
                maxAge: 360 * 60 * 1000, // 6h
            });
            res.json(
                mkApiResponse('Setting auth cookie successful', 'success')
            );
        } catch (err) {
            loginLog.fatal(err as Error);
            res.status(500).json(
                mkApiResponse('Internal server error', 'error')
            );
        }
    }
);

// ------------------=[ logout aka clear-cookie endpoint ]=------------------ //

app.post('/api/logout', authenticate, async (req, res) => {
    const logLogout = log.getSubLogger({ name: 'logout' });

    // Toggle login-status in DB
    const result = await userRepo.update(req.userId!, {
        isLoggedIn: false,
    });
    if (result.affected !== 1) {
        logLogout.error('Failed to update user logout state in DB');
        res.status(500).json(mkApiResponse('User update error', 'error'));
        return;
    }
    logLogout.info(`User logout state updated in DB for UID ${req.userId}`);
    res.clearCookie('token', TOKEN_COOKIE_OPTIONS);
    res.json(mkApiResponse('Auth cookie cleared', 'success'));
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
    app.get(
        '/api/protected',
        authenticate,
        async (req: Request, res: Response) => {
            if (req.userId === undefined) {
                res.status(500).json(
                    mkApiResponse('Token verification malfunction', 'error')
                );
                return;
            }
            const user = await getUserById(DB, req.userId);
            if (user === null) {
                res.status(500).json(
                    mkApiResponse(
                        'Invalid userId in token or DB error',
                        'error'
                    )
                );
                return;
            }
            res.json(mkApiResponse(`hello ${user.nickname}!`, 'success'));
        }
    );
}

// endpoint for validating if a valid Session-Cookie is still set. Used in
// restoreSession-logic in AuthProvider
app.get('/api/validateSession', async (req, res) => {
    const logValidate = log.getSubLogger({ name: 'validateSession' });

    try {
        const token = req.cookies['token'];
        verifyToken(token, SECRET_KEY, logValidate);
    } catch {
        res.status(200).json(mkApiResponse('Session invalid', 'error'));
        logValidate.info('validateSession failed');
        return;
    }
    res.status(200).json(mkApiResponse('Session valid', 'success'));
});

// --------=[ Fallback enpoint for catching invalid methods etc.. ]=-------- //

app.all('/api/login', (req: Request, res: Response) => {
    log.warn('Invalid Request:', req.method);
    res.status(405).json(mkApiResponse('Unsupported Method', 'error'));
});

// -----------------=[ launch the express server finally ]=----------------- //

app.listen(PORT, (): void => {
    log.info('listening on port:', PORT);
});
