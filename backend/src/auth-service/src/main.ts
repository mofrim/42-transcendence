// FIXME seems like we don't need this anymore...
// https://www.npmjs.com/package/reflect-metadata
import 'reflect-metadata';

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { Express, Request, Response, NextFunction } from 'express';
import { DataSource } from 'typeorm';
import { exit } from 'node:process';
import { ORMUser } from './orm_types.ts';
import cookieParser from 'cookie-parser';

// load env vars from global dotenv...
// this path is correct if ran from backend/src/auth-service dir
if (process.env['NODE_ENV'] === 'development') {
    console.log('loading dev.env...');
    dotenv.config({ path: '../../../dev.env' });
}

const SECRET_KEY = process.env['JWT_SECRET'] || 'FooBarBaz';
const PORT = Number(process.env['AUTH_SERVICE_PORT']) || 3001;
const app: Express = express();

app.use(cors());
app.use(express.json());
app.use(cookieParser());

// -------------------------=[ DB initialization ]=------------------------- //

const DB = new DataSource({
    type: 'postgres',
    host: process.env['DB_HOST'] || 'localhost',
    port: Number(process.env['DB_PORT']) || 5432,
    username: process.env['DB_USER'] || 'postgres',
    password: process.env['DB_PASSWD'] || 'postgres',
    database: process.env['DB_NAME'] || 'postgres',
    entities: [ORMUser],
    synchronize: true,
    logging: false,
});

try {
    await DB.initialize();
} catch (error) {
    console.error('Failed to connect to database!');
    console.log(error);
    exit(1);
}

// ---------------------------=[ add test user ]=--------------------------- //

try {
    const defaultUser1 = new ORMUser({
        firstName: 'test',
        lastName: 'user',
        nickname: 'testy',
        email: 'test@test.de',
        character: true,
        hashedPw: bcrypt.hashSync('testpw', 10),
    });
    const savedUser: ORMUser = await DB.manager.save(defaultUser1);
    console.log('default user created successfully: ', savedUser);
} catch (error) {
    if (error instanceof Error) {
        if (error.message.includes('duplicate')) {
            console.warn('test user already created!');
        } else {
            console.error(`type of error: ${error.name}`);
            exit(1);
        }
    } else {
        console.error('Unknown error occurred:', error);
        exit(1);
    }
}

// -----------------------=[ define login endpoint ]=----------------------- //

app.post('/login', async (req: Request, res: Response): Promise<void> => {
    console.log(`body: ${JSON.stringify(req.body, null, 2)}`);

    const { nickname, password } = req.body;

    try {
        const exists = await DB.manager.find(ORMUser, {
            where: {
                nickname: nickname,
            },
        });

        if (
            exists.length !== 1 ||
            exists === undefined ||
            exists[0] === undefined
        ) {
            res.status(401).json({ error: 'User not found' });
            return;
        }

        const user = exists[0];

        const isPasswordValid = await bcrypt.compare(password, user.hashedPw);
        if (!isPasswordValid) {
            res.status(401).json({ error: 'Invalid credentials' });
            return;
        }

        const token = jwt.sign({ nickname: user.nickname }, SECRET_KEY, {
            expiresIn: '1h',
        });

        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env['NODE_ENV'] === 'production',
            // sameSite: 'strict',
            sameSite: 'lax',
            maxAge: 24 * 60 * 60 * 1000,
        });

        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// clear the cookie endpoint
app.post('/logout', (req, res) => {
    void req;
    res.clearCookie('token', {
        httpOnly: true,
        secure: process.env['NODE_ENV'] === 'production',
        sameSite: 'strict',
    });
    res.json({ success: true });
});

app.listen(PORT, (): void => {
    console.log(`auth-service listening on port: ${PORT}`);
});

////////////////////////////////////////////////////////////////////////////////
// The section below represents an outlook on how to verify access in the
// backend using the cookie...
// not really code relevant for the auth-service.
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

const verifyToken = (token: string): { nickname: string } => {
    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        if (typeof decoded === 'string' || !decoded['nickname']) {
            throw new Error('Invalid token');
        }
        return decoded as { nickname: string };
    } catch (err) {
        throw new Error('Invalid token', { cause: err });
    }
};

// this is a so-called middleware function
const authenticate = (req: Request, res: Response, next: NextFunction) => {
    const token = req.cookies['token'];
    if (!token) {
        res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const decoded = verifyToken(token);
        req.user = decoded;
        next();
    } catch (error) {
        console.log(error);
        res.status(401).json({ error: 'Invalid token' });
    }
};

app.get('/protected', authenticate, (req: Request, res: Response) => {
    const nickname = req.user!.nickname;
    res.json({ msg: `hello ${nickname}!` });
});

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
        const user = await DB.manager.find(ORMUser, {
            where: {
                nickname: nickname,
            },
        });
        if (user.length !== 1 || user === undefined || user[0] === undefined) {
            res.status(401).json({ error: 'User not found' });
            return;
        }
        res.json(user[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});
