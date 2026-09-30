import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import type { Express, NextFunction, Request, Response } from 'express';
import { DataSource } from 'typeorm';
import { exit } from 'node:process';
import cookieParser from 'cookie-parser';
import { Logger, type ILogObj } from 'tslog';
import {
    checkSchema,
    matchedData,
    validationResult,
    type ValidationError,
} from 'express-validator';
import bcrypt from 'bcryptjs';

import 'ftr-common/expressTypes';
import { authenticateMid } from 'ftr-common/middleware';
import { ORMEventLog, ORMUser } from 'ftr-common/ormTypes';
import { mkApiResponse } from 'ftr-common/utils';
import { getUserByIdNoPw } from 'backend-utils';
import {
    User,
    API_USER,
    QuestIDs,
    type PublicUserProfile,
    type PersistentSaveGameSnapshot,
    type QuestTuple,
} from 'ftr-common/sharedTypes';
import { authenticateInternalMid } from 'ftr-common/internalAuth';

// Initialize main tslog-logger
const log = new Logger<ILogObj>({
    name: 'userService',
    minLevel: process.env['NODE_ENV'] === 'development' ? 'DEBUG' : 'INFO',
});

// load env vars from global dotenv (correct when running from backend/src/user-service)
if (process.env['NODE_ENV'] === 'development') {
    log.info('loading dev.env...');
    dotenv.config({ path: '../../../dev.env', quiet: true });
}

// FIXME use no fallback. if there is no env-var -> exit
const PORT = Number(process.env['USER_SERVICE_PORT']) || 3003;
const SECRET_KEY: string = process.env['JWT_SECRET'] || 'FooBarBaz';
const INTERNAL_SECRET_KEY: string =
    process.env['INTERNAL_JWT_SECRET'] || 'FooBarBazInternal';
const app: Express = express();

app.use(cors({ credentials: true }));
app.use(express.json());

// reject any non-JSON bodies early
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    void req;
    if (err instanceof SyntaxError && err.message.includes('JSON')) {
        log.warn('Got invalid JSON body from IP ', req.ip);
        res.status(400).json(mkApiResponse('Invalid JSON body', 'error'));
    } else {
        next(err);
    }
});

app.use(cookieParser());

// using partial function evaluation here to set the local logger and SECRET_KEY
// in auth middleware function
const authenticate = (req: Request, res: Response, next: NextFunction) =>
    authenticateMid(req, res, next, log, SECRET_KEY);

// same.. but different
const authenticateInternal = (
    req: Request,
    res: Response,
    next: NextFunction
) =>
    authenticateInternalMid(
        req,
        res,
        next,
        log,
        'userService',
        INTERNAL_SECRET_KEY
    );
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
    log.info('user-service connected to DB');
} catch (err) {
    log.fatal('Failed to connect to database!');
    log.fatal(err as Error);
    exit(1);
}

const userRepo = DB.getRepository(ORMUser);

// -------------------------=[ user GET endpoints ]=------------------------- //

// simply get user record of authenticated user
app.get(API_USER.root, authenticate, async (req, res) => {
    const logGet = log.getSubLogger({ name: 'GET(user)' });
    try {
        const user = await getUserByIdNoPw(DB, req.userId!);
        if (user === null) {
            res.status(401).json(mkApiResponse('User not found', 'error'));
            return;
        }
        res.json(mkApiResponse<User>('User found', 'success', user.id, user));
    } catch (err) {
        logGet.error(err as Error);
        res.status(500).json(mkApiResponse('Internal server error', 'error'));
    }
});

// NOTE: Endpoint for internal use. Why not simply use the same endpoint as
// above?
//
//  - If we were to add rate-limiting (which would be a very pro thing to do ;)
//    we need different rates for frontend and backend-exposed services
//
//  - Separation of tokens: if we were to use the frontend-exposed service
//    we would need to pass the frontend JWT to the backend or we would need a
//    hacky auth-wrapper that makes auth via both middlewares possible.
app.get(API_USER.rootInternal, authenticateInternal, async (req, res) => {
    const logGet = log.getSubLogger({ name: 'GET-Internal' });

    if (req.actingForUID === undefined) {
        logGet.error('actingForUID missing in request!');
        res.status(400).json(mkApiResponse('actingForUID missing', 'error'));
        return;
    }

    try {
        const user = await getUserByIdNoPw(DB, req.actingForUID);
        if (user === null) {
            res.status(401).json(mkApiResponse('User not found', 'error'));
            return;
        }
        res.json(mkApiResponse<User>('User found', 'success', user.id, user));
    } catch (err) {
        logGet.error(err as Error);
        res.status(500).json(mkApiResponse('Internal server error', 'error'));
    }
});

// get all users
// NOTE admin only endpoint!
app.get(API_USER.all, authenticate, async (req: Request, res: Response) => {
    const logGet = log.getSubLogger({ name: 'GET(userAll)' });

    // guard this endpoint
    if (req.userId !== 0) {
        logGet.warn('access denied for uid', req.userId);
        res.status(401).json(mkApiResponse('invalid credentials', 'error'));
        return;
    }

    try {
        const users = await userRepo.find({
            relations: {
                friends: true,
                eventLogs: true,
            },
        });
        if (users.length === 0) {
            res.status(401).json(
                mkApiResponse('no users in users table?!', 'error')
            );
            return;
        }
        res.json(
            mkApiResponse<ORMUser[]>('all users', 'success', undefined, users)
        );
    } catch (err) {
        logGet.error(err as Error);
        res.status(500).json(
            mkApiResponse('Failed to fetch user profile', 'error')
        );
    }
});

/**
 * required for profile system (view user information)
 */
app.get(
    API_USER.profile + '/:nickname',
    authenticate,
    async (req: Request, res: Response) => {
        const logGet = log.getSubLogger({ name: 'GET(publicProfile)' });
        const nicknameParam = req.params['nickname'];
        let nickname = '';
        if (typeof nicknameParam === 'string') {
            nickname = nicknameParam.trim();
        }

        if (
            !nickname ||
            nickname.length > 64 ||
            !/^[A-Za-z0-9]+$/.test(nickname)
        ) {
            res.status(400).json(mkApiResponse('Invalid nickname', 'error'));
            return;
        }

        try {
            const user = await userRepo.findOne({
                select: {
                    id: true,
                    nickname: true,
                    character: true,
                    isLoggedIn: true,
                },
                where: { nickname },
            });

            if (user === null) {
                res.status(404).json(mkApiResponse('User not found', 'error'));
                return;
            }

            const profile: PublicUserProfile = {
                id: user.id,
                nickname: user.nickname,
                character: user.character,
                isLoggedIn: user.isLoggedIn,
            };

            res.json(
                mkApiResponse<PublicUserProfile>(
                    'User profile found',
                    'success',
                    profile.id,
                    profile
                )
            );
        } catch (err) {
            logGet.error(err as Error);
            res.status(500).json(
                mkApiResponse('Failed to fetch user profile', 'error')
            );
        }
    }
);

// health-check endpoint
app.get(API_USER.health, (_req: Request, res: Response) => {
    res.json(mkApiResponse('user-service is running', 'success'));
});

// GET endpoint which will return the QuestStatus object
app.get(API_USER.quests, authenticate, async (req: Request, res: Response) => {
    const logQst = log.getSubLogger({ name: 'quests' });
    try {
        const user = await userRepo.findOneBy({ id: req.userId! });

        if (user === null) {
            res.status(401).json(mkApiResponse('User not found', 'error'));
            return;
        }
        const questsArr: QuestTuple[] = Array.from(
            Object.entries(user.quests),
            ([k, v]) => {
                return { [k]: v };
            }
        );
        res.status(200).json(
            mkApiResponse<QuestTuple[]>(
                'User quests',
                'success',
                undefined,
                questsArr
            )
        );
    } catch (err) {
        logQst.error('something went wrong: ', err);
        res.status(500).json(mkApiResponse('DB query failed', 'error'));
    }
});

// get users tospp settings from DB
app.get(API_USER.tospp, authenticate, async (req: Request, res: Response) => {
    const logTosPp = log.getSubLogger({ name: 'GET(TOS/PP)' });
    try {
        const user = await getUserByIdNoPw(DB, req.userId!);
        if (user === null) {
            logTosPp.error('somehow user not found in DB');
            res.status(401).json(mkApiResponse('User not found', 'error'));
            return;
        }
        res.status(200).json(
            mkApiResponse<boolean>(
                'Found TOS/PP setting',
                'success',
                undefined,
                user.TOSPPchecked
            )
        );
    } catch (err) {
        logTosPp.error('could not get user from DB:', err);
        res.status(401).json(mkApiResponse('Internal server error', 'error'));
    }
});

// set users TOS/PP settings in DB to `true`
app.post(API_USER.tospp, authenticate, async (req: Request, res: Response) => {
    const logTosPp = log.getSubLogger({ name: 'POST(TOS/PP)' });
    try {
        const user = await userRepo.findOneBy({ id: req.userId! });
        if (user === null) {
            logTosPp.error('somehow user not found in DB');
            res.status(401).json(mkApiResponse('User not found', 'error'));
            return;
        }
        user.TOSPPchecked = true;
        const result = await userRepo.update(user.id, user);
        if (result.affected == null) {
            logTosPp.warn(`updating TOS/PP of uid ${user.id} failed`);
            res.status(500).json(
                mkApiResponse('TOS/PP update failure', 'error')
            );
            return;
        }
        res.status(200).json(
            mkApiResponse<boolean>('TOS/PP settings updated', 'success')
        );
    } catch (err) {
        logTosPp.error('could not get user from DB:', err);
        res.status(401).json(mkApiResponse('Internal server error', 'error'));
    }
});

// ----------=[ UID GET endpoint - keep as last GET endpoint!!! ]=---------- //

// query users by uid
// NOTE admin only endpoint!
// ATTENTION this has to be the last GET-endpoint declared as otherwise other
// endpoints will match this
app.get(API_USER.uid, authenticate, async (req: Request, res: Response) => {
    const logGet = log.getSubLogger({ name: 'GET(userId)' });

    // guard this endpoint
    if (req.userId !== 0) {
        logGet.warn('access denied for uid', req.userId);
        res.status(401).json(mkApiResponse('invalid credentials', 'error'));
        return;
    }

    const userId = Number(req.params['userId']);
    if (!Number.isInteger(userId)) {
        logGet.warn(`userId-enpoint queried with invalid uid ${userId}`);
        return res
            .status(400)
            .json(mkApiResponse('userId must be an integer', 'error'));
    }

    try {
        const user = await getUserByIdNoPw(DB, userId);
        if (user === null) {
            logGet.warn(`userId-enpoint queried with wrong uid ${userId}`);
            return res
                .status(401)
                .json(mkApiResponse('User not found', 'error'));
        }
        return res.json(
            mkApiResponse<User>('User found', 'success', user.id, user)
        );
    } catch (err) {
        logGet.error(err as Error);
        return res
            .status(500)
            .json(mkApiResponse('Failed to fetch user profile', 'error'));
    }
});

// delete users by uid
// NOTE admin only endpoint!
app.delete(API_USER.uid, authenticate, async (req: Request, res: Response) => {
    const logGet = log.getSubLogger({ name: 'DEL(userId)' });

    // guard this endpoint
    if (req.userId !== 0) {
        logGet.warn('access denied for uid', req.userId);
        res.status(401).json(mkApiResponse('invalid credentials', 'error'));
        return;
    }

    const userId = Number(req.params['userId']);
    if (!Number.isInteger(userId)) {
        logGet.warn(`DelUserId-enpoint queried with invalid uid ${userId}`);
        return res
            .status(400)
            .json(mkApiResponse('userId must be an integer', 'error'));
    }

    try {
        const result = await userRepo.delete(userId);
        if (result.affected == null) {
            logGet.warn(`userId-enpoint queried with wrong uid ${userId}`);
            return res.status(404).json(mkApiResponse('invalid id', 'error'));
        }
        return res
            .status(204)
            .json(mkApiResponse('Successfully fetche user by ID', 'success'));
    } catch (err) {
        logGet.error(err as Error);
        return res
            .status(500)
            .json(mkApiResponse('Failed to fetch user profile', 'error'));
    }
});
// ------------------------=[ user POST endpoints ]=------------------------ //

const registrationValidation = checkSchema(
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
        email: {
            escape: true,
            notEmpty: { errorMessage: 'email empty' },
            isEmail: { errorMessage: 'invalid email' },
        },
    },
    ['body']
);

app.post(
    API_USER.register,
    registrationValidation,
    async (req: Request, res: Response) => {
        const logReg = log.getSubLogger({ name: 'register' });

        // check any errors from Validation
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            logReg.warn('Got bad request from', req.ip);
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
        const userMail: string = bodyData['email'];

        try {
            const userExists = await userRepo.existsBy({
                nickname: userNick,
            });
            if (userExists) {
                logReg.warn(`user ${userNick} already exists in DB!`);
                res.status(403).json(mkApiResponse('user exists', 'error'));
                return;
            }
            const newUser = userRepo.create({
                nickname: userNick,
                hashedPw: bcrypt.hashSync(userPass, 10),
                email: userMail,
            });
            const savedUser = await userRepo.save(newUser);
            logReg.info(
                `created user ${savedUser.nickname} with id ${savedUser.id}`
            );
            res.status(201).json(
                mkApiResponse('user created', 'success', savedUser.id)
            );
        } catch (err) {
            logReg.fatal(err as Error);
            res.status(500).json(
                mkApiResponse('Internal server error', 'error')
            );
        }
    }
);

// -----------------------=[ quest update endpoint ]=----------------------- //

app.post(API_USER.quests, authenticate, async (req: Request, res: Response) => {
    const logQst = log.getSubLogger({ name: 'quests' });

    if (!QuestIDs.some((val) => val === req.body.quest)) {
        logQst.error(`requested quest '${req.body.quest}' not found in QUESTS`);
        res.status(400).json(mkApiResponse('Quest not found', 'error'));
        return;
    }

    try {
        const user = await userRepo.findOneBy({ id: req.userId! });

        if (user === null) {
            res.status(401).json(mkApiResponse('User not found', 'error'));
            return;
        }
        user.quests[req.body.quest] = true;
        const result = await userRepo.update(user.id, user);
        if (result.affected == null) {
            logQst.warn(`updating quests of uid ${user.id} failed`);
            res.status(500).json(
                mkApiResponse('quest update failure', 'error')
            );
            return;
        }
        res.status(200).json(mkApiResponse('Quests updated', 'success'));
    } catch (err) {
        logQst.error('something went wrong: ', err);
        res.status(500).json(mkApiResponse('DB query failed', 'error'));
    }
});

// -------------=[ the internal endpoint for data persistence ]=------------- //

// NOTE: Internal endpoint! Only to be used for backend internal com
app.post(
    API_USER.root,
    authenticateInternal,
    async (req: Request, res: Response) => {
        const logInt = log.getSubLogger({ name: 'InternalSaveGame' });

        if (req.actingForUID === undefined) {
            logInt.error('actingForUID missing in request!');
            res.status(400).json(
                mkApiResponse('actingForUID missing', 'error')
            );
            return;
        }
        log.info('actingForUID', req.actingForUID);

        try {
            const user = await userRepo.findOneBy({ id: req.actingForUID });

            if (user === null) {
                res.status(401).json(mkApiResponse('User not found', 'error'));
                return;
            }

            const bodyData = req.body as PersistentSaveGameSnapshot;
            if (
                bodyData.position === undefined ||
                bodyData.blackHoleSecondsRemaining === undefined
            ) {
                res.status(401).json(
                    mkApiResponse('Invalid snapshot', 'error')
                );
                return;
            }
            user.blackholeTimer = bodyData.blackHoleSecondsRemaining;
            user.position = bodyData.position;

            const result = await userRepo.update(user.id, user);
            if (result.affected == null) {
                logInt.warn(`Saving state for user ${user.id} failed`);
                res.status(500).json(
                    mkApiResponse('User state update failure', 'error')
                );
                return;
            }
            res.status(200).json(
                mkApiResponse<ORMUser>(
                    'User state stored in DB',
                    'success',
                    undefined,
                    user
                )
            );
        } catch (err) {
            logInt.error('something went wrong: ', err);
            res.status(500).json(mkApiResponse('DB query failed', 'error'));
        }
    }
);

// --------=[ fallback endpoint for catching unsuppoerted methods ]=-------- //

app.all(API_USER.root, (req: Request, res: Response) => {
    log.warn('Invalid Request to /api/user:', req.method);
    res.status(405).json(mkApiResponse('Unsupported Method', 'error'));
});

// ---------------------------=[ launch server ]=--------------------------- //

app.listen(PORT, (): void => {
    log.info(`user-service listening on port: ${PORT}`);
});
