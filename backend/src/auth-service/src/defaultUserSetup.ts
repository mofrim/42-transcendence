import { ORMUser } from './orm_types.ts';
import bcrypt from 'bcryptjs';
import { exit } from 'node:process';
import { DataSource } from 'typeorm';

const defaultUsers = [
    {
        // firstName: 'test',
        // lastName: 'user',
        nickname: 'testy',
        email: 'test@42.fr',
        character: true,
        hashedPw: bcrypt.hashSync('testpw', 10),
    },
    {
        // firstName: 'Anatolij',
        // lastName: 'Semykin',
        nickname: 'alice',
        email: 'alice@example.com',
        character: true,
        hashedPw: bcrypt.hashSync('Anatolij', 10),
    },
    {
        // firstName: 'Daniel',
        // lastName: 'Helmert',
        nickname: 'bob',
        email: 'bob@example.com',
        character: true,
        hashedPw: bcrypt.hashSync('Daniel', 10),
    },
    {
        // firstName: 'Lukas',
        // lastName: 'Wagner',
        nickname: 'jeff',
        email: 'jeff@example.com',
        character: true,
        hashedPw: bcrypt.hashSync('Lukas', 10),
    },
    {
        // firstName: 'Maryam',
        // lastName: 'Pazouki',
        nickname: 'mandy',
        email: 'mandy@example.com',
        character: false,
        hashedPw: bcrypt.hashSync('Maryam', 10),
    },
    {
        // firstName: 'Moritz',
        // lastName: 'Maurer',
        nickname: 'freddy',
        email: 'freddy@example.com',
        character: true,
        hashedPw: bcrypt.hashSync('Moritz', 10),
    },
];

export const setupDefaultUsers = async (DB: DataSource) => {
    for (const user of defaultUsers) {
        try {
            const defaultUser = new ORMUser(user);
            await DB.manager.save(defaultUser);
            console.log(`defaultUser ${user.nickname} successfully created!`);
        } catch (error) {
            if (error instanceof Error) {
                if (error.message.includes('duplicate')) {
                    console.warn(`user ${user.nickname} already there!`);
                } else {
                    console.error(`type of error: ${error.name}`);
                    exit(1);
                }
            } else {
                console.error('Unknown error occurred:', error);
                exit(1);
            }
        }
    }
};
