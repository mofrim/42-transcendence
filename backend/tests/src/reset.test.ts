import request from 'supertest';
import { API_EVENTLOG, API_USER } from 'ftr-common/sharedTypes';
import dotenv from 'dotenv';

dotenv.config({ path: '../../dev.env', quiet: true });

const userBaseUrl = 'http://localhost:3003';
const authBaseUrl = 'http://localhost:3001';
const eventlogBaseUrl = 'http://localhost:3002';

let authCookieFm: string;
let authCookieMp: string;
let authCookieS: string;

describe('basic get cookie test', () => {
    it('should authenticate and receive a JWT cookie as freddy', async () => {
        const res = await request(authBaseUrl)
            .post('/api/login')
            .send({ nickname: 'freddy', password: process.env['FMAURER_PW'] });
        expect(res.headers['set-cookie']).toBeDefined();
        if ('set-cookie' in res.headers) {
            authCookieFm = res.headers['set-cookie'] as string;
        }
    });

    it('should authenticate and receive a JWT cookie', async () => {
        const res = await request(authBaseUrl).post('/api/login').send({
            nickname: 'mandy',
            password: process.env['MPAZOUKI_PW'],
        });
        expect(res.headers['set-cookie']).toBeDefined();
        if ('set-cookie' in res.headers) {
            authCookieMp = res.headers['set-cookie'] as string;
        }
    });

    it('should authenticate and receive a JWT cookie', async () => {
        const res = await request(authBaseUrl).post('/api/login').send({
            nickname: 'superadmin',
            password: process.env['FTR_ROOT_PW'],
        });
        expect(res.headers['set-cookie']).toBeDefined();
        if ('set-cookie' in res.headers) {
            authCookieS = res.headers['set-cookie'] as string;
        }
    });
});

describe('resetting eventlog table for tests', () => {
    it('delete all eventlog', async () => {
        const res = await request(eventlogBaseUrl)
            .delete(API_EVENTLOG.root)
            .set('Cookie', authCookieS);
        expect(res.statusCode).toEqual(204);
    });

    it('should try to get all items but empty array is returned', async () => {
        const res = await request(eventlogBaseUrl)
            .get(API_EVENTLOG.root)
            .set('Cookie', authCookieFm);
        // console.log(`got response: ${JSON.stringify(res.body, null, 2)}`);
        expect(res.statusCode).toEqual(200);
        expect(res.body.data.length).toBe(0);
    });
});

describe('matchhist test', () => {
    it('should create game event', async () => {
        const res = await request(eventlogBaseUrl)
            .post(API_EVENTLOG.root)
            .set('Cookie', authCookieFm)
            .send({
                eventType: 'MiniGameResult',
                data: {
                    game: 'Tic-Tac-Toe-Game',
                    outcome: 'lost',
                    opponentNickname: 'mandy',
                },
                logtime: '2026-09-06 20:42:12',
            });
        expect(res.statusCode).toEqual(201);
    });

    it('should create game event', async () => {
        const res = await request(eventlogBaseUrl)
            .post(API_EVENTLOG.root)
            .set('Cookie', authCookieFm)
            .send({
                eventType: 'MiniGameResult',
                data: {
                    game: 'Tic-Tac-Toe-Game',
                    outcome: 'lost',
                    opponentNickname: 'mandy',
                },
                logtime: '2026-09-06 20:42:12',
            });
        expect(res.statusCode).toEqual(201);
    });

    it('should create game event', async () => {
        const res = await request(eventlogBaseUrl)
            .post(API_EVENTLOG.root)
            .set('Cookie', authCookieFm)
            .send({
                eventType: 'MiniGameResult',
                data: {
                    game: 'Rock-Paper-Scissors',
                    outcome: 'draw',
                    opponentNickname: 'mandy',
                },
                logtime: '2026-09-06 20:42:12',
            });
        expect(res.statusCode).toEqual(201);
    });

    it('should create game event', async () => {
        const res = await request(eventlogBaseUrl)
            .post(API_EVENTLOG.root)
            .set('Cookie', authCookieMp)
            .send({
                eventType: 'MiniGameResult',
                data: {
                    game: 'Rock-Paper-Scissors',
                    outcome: 'draw',
                    opponentNickname: 'bob',
                },
                logtime: '2026-09-06 20:42:12',
            });
        expect(res.statusCode).toEqual(201);
    });

    it('should create some other event', async () => {
        const res = await request(eventlogBaseUrl)
            .post(API_EVENTLOG.root)
            .set('Cookie', authCookieFm)
            .send({
                eventType: 'PlayerLeft',
                data: {
                    playerId: 'moep',
                },
                logtime: new Date(),
            });
        expect(res.statusCode).toEqual(201);
    });

    it('should get ...', async () => {
        const res = await request(eventlogBaseUrl)
            .get(API_EVENTLOG.matchHistory)
            .set('Cookie', authCookieFm);
        // console.log(`got response: ${JSON.stringify(res.body, null, 2)}`);
        expect(res.statusCode).toEqual(200);
        expect(res.body.data.length).toBe(3);
    });

    it('should get ...', async () => {
        const res = await request(eventlogBaseUrl)
            .get(API_EVENTLOG.matchHistory)
            .set('Cookie', authCookieMp);
        // console.log(`got response: ${JSON.stringify(res.body, null, 2)}`);
        expect(res.statusCode).toEqual(200);
        expect(res.body.data.length).toBe(1);
    });
});

describe('reset test', () => {
    it('try to reset the user Fm', async () => {
        const res = await request(userBaseUrl)
            .delete(API_USER.root)
            .set('Cookie', authCookieFm);
        expect(res.status).toEqual(204);
    });

    it('try to reset the user Fm a 2nd time', async () => {
        const res = await request(userBaseUrl)
            .delete(API_USER.root)
            .set('Cookie', authCookieFm);
        expect(res.status).toEqual(204);
    });

    it('should get an empty matchhist', async () => {
        const res = await request(eventlogBaseUrl)
            .get(API_EVENTLOG.matchHistory)
            .set('Cookie', authCookieFm);
        // console.log(`got response: ${JSON.stringify(res.body, null, 2)}`);
        expect(res.statusCode).toEqual(200);
        expect(res.body.data.length).toEqual(0);
    });

    it('should still find a PlayerLeft event', async () => {
        const res = await request(eventlogBaseUrl)
            .get(API_EVENTLOG.root)
            .set('Cookie', authCookieFm);
        // console.log(`got response: ${JSON.stringify(res.body, null, 2)}`);
        expect(res.statusCode).toEqual(200);
        expect(res.body.data.length).toEqual(2);
        expect(res.body.data[1].user.nickname).toEqual('freddy');
    });

    it('should get ...', async () => {
        const res = await request(eventlogBaseUrl)
            .get(API_EVENTLOG.matchHistory)
            .set('Cookie', authCookieMp);
        // console.log(`got response: ${JSON.stringify(res.body, null, 2)}`);
        expect(res.statusCode).toEqual(200);
        expect(res.body.data.length).toEqual(1);
    });
});

describe('after reset test', () => {
    it('should return one event via relation', async () => {
        const res = await request(userBaseUrl)
            .get(API_USER.root + '/4')
            .set('Cookie', authCookieS);
        console.log(`got response: ${JSON.stringify(res.body, null, 2)}`);
        expect(res.statusCode).toEqual(200);
        expect(res.body.data.eventLogs[0].eventType).toEqual('PlayerLeft');
    });
});

// WARN don't forget to logout again!
describe('basic get cookie test', () => {
    it('should logout user Mp', async () => {
        const res = await request(authBaseUrl)
            .post('/api/logout')
            .set('Cookie', authCookieFm);
        expect(res.status).toEqual(200);
    });
    it('should logout user Fm', async () => {
        const res = await request(authBaseUrl)
            .post('/api/logout')
            .set('Cookie', authCookieMp);
        expect(res.status).toEqual(200);
    });
});
