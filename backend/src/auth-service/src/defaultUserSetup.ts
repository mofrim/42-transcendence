import { ORMUser } from 'ftr-common/ormTypes';
import {
    BLACK_HOLE_DURATION_SECONDS,
    InitialQuestStatus,
} from 'ftr-common/sharedTypes';
import bcrypt from 'bcryptjs';
import { exit } from 'node:process';
import type { DataSource } from 'typeorm';

const defaultUsers = [
    {
        nickname: 'alice',
        email: 'alice@example.com',
        TOSPPchecked: false,
        character: true,
        hashedPw: bcrypt.hashSync('Anatolij', 10),
        quests: InitialQuestStatus,
        friends: [],
        isLoggedIn: false,
        blackholeTimer: BLACK_HOLE_DURATION_SECONDS,
    },
    {
        nickname: 'bob',
        email: 'bob@example.com',
        TOSPPchecked: false,
        character: true,
        hashedPw: bcrypt.hashSync('Daniel', 10),
        quests: InitialQuestStatus,
        friends: [],
        isLoggedIn: false,
        blackholeTimer: BLACK_HOLE_DURATION_SECONDS,
    },
    {
        nickname: 'jeff',
        email: 'jeff@example.com',
        TOSPPchecked: false,
        character: true,
        hashedPw: bcrypt.hashSync('Lukas', 10),
        quests: InitialQuestStatus,
        friends: [],
        isLoggedIn: false,
        blackholeTimer: BLACK_HOLE_DURATION_SECONDS,
    },
    {
        nickname: 'mandy',
        email: 'mandy@example.com',
        TOSPPchecked: false,
        character: false,
        hashedPw: bcrypt.hashSync('Maryam', 10),
        quests: InitialQuestStatus,
        friends: [],
        isLoggedIn: false,
        blackholeTimer: BLACK_HOLE_DURATION_SECONDS,
    },
    {
        nickname: 'freddy',
        email: 'freddy@example.com',
        TOSPPchecked: false,
        character: true,
        hashedPw: bcrypt.hashSync('Moritz', 10),
        quests: InitialQuestStatus,
        friends: [],
        isLoggedIn: false,
        blackholeTimer: BLACK_HOLE_DURATION_SECONDS,
    },
];

/** default user setup error */
const userSetupError = (nickname: string, error: unknown): void => {
    if (error instanceof Error) {
        if (error.message.includes('duplicate')) {
            console.warn(`user ${nickname} already there!`);
            return;
        }
        console.error(`type of error: ${error.name}`);
    } else {
        console.error('Unknown error occurred:', error);
    }
    exit(1);
};

export const setupDefaultUsers = async (DB: DataSource) => {
    const userRepo = DB.getRepository(ORMUser);
    for (const user of defaultUsers) {
        try {
            const defaultUser = userRepo.create(user);
            await userRepo.save(defaultUser);
            console.log(`defaultUser ${user.nickname} successfully created!`);
        } catch (error) {
            userSetupError(user.nickname, error);
        }
    }
    // add superadmin
    const superadmin = {
        nickname: 'superadmin',
        email: 'superadmin@admin.dev',
        TOSPPchecked: false,
        character: true,
        hashedPw:
            // crashOverride 8)
            '$2b$10$3S0UNdtZnOzGM.NPPJtxUOt5rHD9GqvEcA8tk42IbSNhYYqXpmNyy',
        quests: InitialQuestStatus,
        friends: [],
    };
    try {
        await userRepo.save(userRepo.create(superadmin));
        console.log(`defaultUser superadmin successfully created!`);
        await userRepo.update({ nickname: 'superadmin' }, { id: 0 });
    } catch (error) {
        userSetupError(superadmin.nickname, error);
    }
};
