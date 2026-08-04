import 'reflect-metadata';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { Express, Request, Response } from 'express';
import { DataSource } from 'typeorm';
import { exit } from 'node:process';
import { ORMUser } from './orm_types.ts';

// load env vars from global dotenv...
// this path is correct if ran from backend/src/auth-service dir
if (process.env['NODE_ENV'] === 'development') {
    console.log('loading dev.env...')
    dotenv.config({ path: '../../../dev.env' });
}

const PORT = Number(process.env['AUTH_SERVICE_PORT']) || 3001;
const app: Express = express();

app.use(cors());
app.use(express.json());

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
        firstName: "test",
        lastName: "user",
        nickname: 'testy',
        email: 'test@test.de',
        character: true,
        hashedPw: bcrypt.hashSync('testpw', 10)
    })
    const savedUser: ORMUser = await DB.manager.save(defaultUser1);
    console.log('default user created successfully: ', savedUser);

} catch (error) {
    if (error instanceof Error) {
        if (error.message.includes("duplicate")) {
            console.warn('test user already created!');
        } else {
            console.error(`type of error: ${error.name}`);
            exit(1);
        }
    } else {
        console.error("Unknown error occurred:", error);
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
                nickname: nickname
            }
        });

        if (exists.length !== 1 || exists === undefined || exists[0] === undefined) {
            res.status(401).json({ error: 'User not found' });
            return;
        }

        const user = exists[0];

        const isPasswordValid = await bcrypt.compare(password, user.hashedPw);
        if (!isPasswordValid) {
            res.status(401).json({ error: 'Invalid credentials' });
            return;
        }

        const token = jwt.sign(
            { nickname: user.nickname },
            process.env['JWT_SECRET'] || 'FooBarBaz',
            { expiresIn: '1h' }
        );

        res.json({ access_token: token, token_type: 'bearer' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.listen(PORT, (): void => {
    console.log(`auth-service listening on port: ${PORT}`);
});
