import { ORMUser } from 'ftr-common/ormTypes';
import {
    BLACK_HOLE_DURATION_SECONDS,
    PLAYER_START_POSITION,
    InitialQuestStatus,
} from 'ftr-common/sharedTypes';
import bcrypt from 'bcryptjs';
import { exit } from 'node:process';
import type { DataSource } from 'typeorm';
import dotenv from 'dotenv';
import { Logger, type ILogObj } from 'tslog';

if (process.env['NODE_ENV'] === 'development') {
    dotenv.config({ path: '../../../dev.env', quiet: true });
}
// Initialize main tslog-logger
const log = new Logger<ILogObj>({
    name: 'defaultUserSetup',
    minLevel: process.env['NODE_ENV'] === 'development' ? 'DEBUG' : 'INFO',
});

// enforce config through dotenv only! add any require env-vars here
const REQUIRED_ENV = [
    'ASEMYKIN_NICK',
    'ASEMYKIN_MAIL',
    'ASEMYKIN_PW',
    'DHELMERT_NICK',
    'DHELMERT_MAIL',
    'DHELMERT_PW',
    'GWAGNER_NICK',
    'GWAGNER_MAIL',
    'GWAGNER_PW',
    'FMAURER_NICK',
    'FMAURER_MAIL',
    'FMAURER_PW',
    'MPAZOUKI_NICK',
    'MPAZOUKI_MAIL',
    'MPAZOUKI_PW',
    'SUPERADMIN_NICK',
    'SUPERADMIN_MAIL',
    'SUPERADMIN_PW',
];

if (REQUIRED_ENV.some((v) => process.env[v] === undefined)) {
    log.error(`env not like it should be! exiting...`);
    exit(1);
}

const getEnv = (v: string): string => process.env[v]!;

const mkUser = (nick: string, mail: string, hashedPw: string) => {
    return {
        nickname: nick,
        email: mail,
        hashedPw,
        TOSPPchecked: false,
        character: true,
        quests: InitialQuestStatus,
        friends: [],
        isLoggedIn: false,
        blackholeTimer: BLACK_HOLE_DURATION_SECONDS,
        position: PLAYER_START_POSITION,
    };
};

const defaultUsers = [
    mkUser(
        getEnv('ASEMYKIN_NICK'),
        getEnv('ASEMYKIN_MAIL'),
        bcrypt.hashSync(getEnv('ASEMYKIN_PW'), 10)
    ),
    mkUser(
        getEnv('DHELMERT_NICK'),
        getEnv('DHELMERT_MAIL'),
        bcrypt.hashSync(getEnv('DHELMERT_PW'), 10)
    ),
    mkUser(
        getEnv('GWAGNER_NICK'),
        getEnv('GWAGNER_MAIL'),
        bcrypt.hashSync(getEnv('GWAGNER_PW'), 10)
    ),
    mkUser(
        getEnv('MPAZOUKI_NICK'),
        getEnv('MPAZOUKI_MAIL'),
        bcrypt.hashSync(getEnv('MPAZOUKI_PW'), 10)
    ),
    mkUser(
        getEnv('FMAURER_NICK'),
        getEnv('FMAURER_MAIL'),
        bcrypt.hashSync(getEnv('FMAURER_PW'), 10)
    ),
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
    // NOTE: for extra-hackiness-feeling superadmins pw is stored hashed.. which
    // would also be an option for the others!
    const superadmin = mkUser(
        getEnv('SUPERADMIN_NICK'),
        getEnv('SUPERADMIN_MAIL'),
        getEnv('SUPERADMIN_PW')
    );
    try {
        await userRepo.save(userRepo.create(superadmin));
        console.log(`defaultUser superadmin successfully created!`);
        await userRepo.update({ nickname: 'superadmin' }, { id: 0 });
    } catch (error) {
        userSetupError(superadmin.nickname, error);
    }
};
