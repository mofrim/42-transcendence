import 'reflect-metadata';
import express from 'express';
import cors from 'cors';
// import bcrypt from 'bcryptjs';
// import pg from 'pg';
// import jwt from 'jsonwebtoken';
// import type { Express, Request, Response } from 'express';
import type { Express } from 'express';

import { BaseUser } from '@common/types';
import { Entity, PrimaryGeneratedColumn, Column, DataSource } from 'typeorm';

const PORT = Number(process.env['AUTH_SERVICE_PORT']) || 3001;
const app: Express = express();

app.use(cors());
app.use(express.json());

// -------------------------=[ DB initialization ]=------------------------- //

@Entity()
export class ORMUser extends BaseUser {
    @PrimaryGeneratedColumn()
    declare id: number;

    @Column('text')
    declare firstName: string;

    @Column('text')
    declare lastName: string;

    @Column('text')
    declare nickname: string;

    @Column('text')
    declare email: string;

    @Column('text')
    declare hashedPw: string;
}

const AppDataSource = new DataSource({
    type: 'postgres',
    host: 'localhost',
    port: 5432,
    username: 'postgres',
    password: 'postgres',
    database: 'postgres',
    entities: [ORMUser],
    synchronize: true,
    logging: true,
});

try {
    await AppDataSource.initialize();
} catch (error) {
    console.log(error);
}

const user = new ORMUser();
user.firstName = 'Kalle';
user.lastName = 'Hoinz';
user.nickname = 'K';
user.email = 'kalle@hoinz.de';
user.hashedPw = 'zxyz';

await AppDataSource.manager.save(user);
console.log('user has been saved. user id is', user.id);

// const pool = new pg.Pool({
//     host: process.env['DB_HOST'] || 'localhost',
//     port: Number(process.env['DB_PORT']) || 5432,
//     user: process.env['DB_USER'] || 'postgres',
//     password: process.env['DB_PASSWORD'] || 'postgres',
//     database: process.env['DB_NAME'] || 'postgres',
// });

// app.post('/login', async (req: Request, res: Response): Promise<void> => {
//     console.log(`body: ${JSON.stringify(req.body, null, 2)}`);
//     const { username, password } = req.body;
//
//     try {
//         const result = await pool.query(
//             'SELECT * FROM users WHERE username = $1',
//             [username]
//         );
//
//         if (result.rows.length === 0) {
//             res.status(401).json({ error: 'Invalid credentials' });
//             return;
//         }
//
//         const user = result.rows[0];
//
//         const isPasswordValid = await bcrypt.compare(password, user.password);
//         if (!isPasswordValid) {
//             res.status(401).json({ error: 'Invalid credentials' });
//             return;
//         }
//
//         const token = jwt.sign(
//             { id: user.id, username: user.username },
//             process.env['JWT_SECRET'] || 'FooBarBaz',
//             { expiresIn: '1h' }
//         );
//
//         res.json({ token, user: { id: user.id, username: user.username, email: user.email, nickname: user.nickname } });
//     } catch (error) {
//         console.error(error);
//         res.status(500).json({ error: 'Internal server error' });
//     }
// });

app.listen(PORT, (): void => {
    console.log(`auth-service listening on port: ${PORT}`);
});
