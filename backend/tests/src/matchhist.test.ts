import request from 'supertest';
import { API_EVENTLOG } from 'ftr-common/sharedTypes';

const authBaseUrl = 'http://localhost:3001';
const eventlogBaseUrl = 'http://localhost:3002';

let authCookieFmaurer: string;
let authCookieMpazouki: string;

describe('basic get cookie test', () => {
    it('should authenticate and receive a JWT cookie as freddy', async () => {
        const res = await request(authBaseUrl)
            .post('/api/login')
            .send({ nickname: 'freddy', password: 'Moritz' });
        expect(res.headers['set-cookie']).toBeDefined();
        if ('set-cookie' in res.headers) {
            authCookieFmaurer = res.headers['set-cookie'] as string;
        }
    });

    it('should authenticate and receive a JWT cookie', async () => {
        const res = await request(authBaseUrl)
            .post('/api/login')
            .send({ nickname: 'mandy', password: 'Maryam' });
        expect(res.headers['set-cookie']).toBeDefined();
        if ('set-cookie' in res.headers) {
            authCookieMpazouki = res.headers['set-cookie'] as string;
        }
    });
});

// reset
describe('resetting eventlog table for tests', () => {
    it('delete all eventlog', async () => {
        const res = await request(eventlogBaseUrl)
            .delete(API_EVENTLOG.root)
            .set('Cookie', authCookieFmaurer);
        expect(res.statusCode).toEqual(204);
    });

    it('should try to get all items but empty array is returned', async () => {
        const res = await request(eventlogBaseUrl)
            .get(API_EVENTLOG.root)
            .set('Cookie', authCookieFmaurer);
        console.log(`got response: ${JSON.stringify(res.body, null, 2)}`);
        expect(res.statusCode).toEqual(200);
        expect(res.body.length).toBe(0);
    });
});

describe('matchhist test', () => {
    it('should create game event', async () => {
        const res = await request(eventlogBaseUrl)
            .post(API_EVENTLOG.root)
            .set('Cookie', authCookieFmaurer)
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
            .set('Cookie', authCookieFmaurer)
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
            .set('Cookie', authCookieFmaurer)
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
            .set('Cookie', authCookieMpazouki)
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
            .set('Cookie', authCookieFmaurer)
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
            .set('Cookie', authCookieFmaurer);
        console.log(`got response: ${JSON.stringify(res.body, null, 2)}`);
        expect(res.statusCode).toEqual(200);
        expect(res.body.length).toBe(3);
    });

    it('should get ...', async () => {
        const res = await request(eventlogBaseUrl)
            .get(API_EVENTLOG.matchHistory)
            .set('Cookie', authCookieMpazouki);
        console.log(`got response: ${JSON.stringify(res.body, null, 2)}`);
        expect(res.statusCode).toEqual(200);
        expect(res.body.length).toBe(1);
        // expect(res.body[1].data.game).toBe('Tic-Tac-Toe-Game');
    });
});
