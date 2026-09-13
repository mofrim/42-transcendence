import { ORMUser } from 'ftr-common/ormTypes';
import { InitialQuestStatus  } from 'ftr-common/sharedTypes';
import bcrypt from 'bcryptjs';
import { exit } from 'node:process';
import { DataSource } from 'typeorm';

const defaultUsers = [
    {
        nickname: 'alice',
        email: 'alice@example.com',
        character: true,
        hashedPw: bcrypt.hashSync('Anatolij', 10),
        quests: InitialQuestStatus,

    },
    {
        nickname: 'bob',
        email: 'bob@example.com',
        character: true,
        hashedPw: bcrypt.hashSync('Daniel', 10),
        quests: InitialQuestStatus,
    },
    {
        nickname: 'jeff',
        email: 'jeff@example.com',
        character: true,
        hashedPw: bcrypt.hashSync('Lukas', 10),
        quests: InitialQuestStatus,
    },
    {
        nickname: 'mandy',
        email: 'mandy@example.com',
        character: false,
        hashedPw: bcrypt.hashSync('Maryam', 10),
        quests: InitialQuestStatus,
    },
    {
        nickname: 'freddy',
        email: 'freddy@example.com',
        character: true,
        hashedPw: bcrypt.hashSync('Moritz', 10),
        quests: InitialQuestStatus,
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
