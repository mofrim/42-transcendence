import { ORMUser } from 'ftr-common/ormTypes';
import { InitialQuestStatus } from 'ftr-common/sharedTypes';
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
    },
    {
        nickname: 'bob',
        email: 'bob@example.com',
        TOSPPchecked: false,
        character: true,
        hashedPw: bcrypt.hashSync('Daniel', 10),
        quests: InitialQuestStatus,
        friends: [],
    },
    {
        nickname: 'jeff',
        email: 'jeff@example.com',
        TOSPPchecked: false,
        character: true,
        hashedPw: bcrypt.hashSync('Lukas', 10),
        quests: InitialQuestStatus,
        friends: [],
    },
    {
        nickname: 'mandy',
        email: 'mandy@example.com',
        TOSPPchecked: false,
        character: false,
        hashedPw: bcrypt.hashSync('Maryam', 10),
        quests: InitialQuestStatus,
        friends: [],
    },
    {
        nickname: 'freddy',
        email: 'freddy@example.com',
        TOSPPchecked: false,
        character: true,
        hashedPw: bcrypt.hashSync('Moritz', 10),
        quests: InitialQuestStatus,
        friends: [],
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
    // add root
    const root = {
        nickname: 'root',
        email: 'root@admin.dev',
        TOSPPchecked: false,
        character: true,
        hashedPw:
            // crashOverride 8)
            '$2b$10$3S0UNdtZnOzGM.NPPJtxUOt5rHD9GqvEcA8tk42IbSNhYYqXpmNyy',
        quests: InitialQuestStatus,
        friends: [],
    };
    try {
        await userRepo.save(userRepo.create(root));
        console.log(`defaultUser superadmin successfully created!`);
        await userRepo.update({ nickname: 'root' }, { id: 0 });
    } catch (error) {
        userSetupError(root.nickname, error);
    }
};
