import request from 'supertest';
import { date2psqlstamp, psqlstamp2date } from 'ftr-common/utils';
// import type { GameEvent} from 'ftr-common/sharedTypes';

const authBaseUrl = 'http://localhost:3001';
const eventlogBaseUrl = 'http://localhost:3002';

let authCookie: string;

describe('basic get cookie test', () => {
    it('should authenticate and receive a JWT cookie', async () => {
        const res = await request(authBaseUrl)
            .post('/api/login')
            .send({ nickname: 'freddy', password: 'Moritz' });
        expect(res.headers['set-cookie']).toBeDefined();
        if ('set-cookie' in res.headers) {
            authCookie = res.headers['set-cookie'] as string;
            // console.log(`got cookie: ${authCookie}`);
        }
    });

    it('should access a protected endpoint using the JWT cookie', async () => {
        const res = await request(authBaseUrl)
            .get('/api/protected')
            .set('Cookie', authCookie);

        expect(res.statusCode).toEqual(200);
    });
});

describe('eventlog test', () => {
    it('should create a chatmsg event', async () => {
        const res = await request(eventlogBaseUrl)
            .post('/api/eventlog')
            .set('Cookie', authCookie)
            .send({
                eventType: 'ChatMsg',
                data: { chatmsg: 'moep' },
                logtime: '2026-09-06 20:42:12',
                user: 'freddy',
            });
        expect(res.statusCode).toEqual(201);
    });

    it('should create game event', async () => {
        const res = await request(eventlogBaseUrl)
            .post('/api/eventlog')
            .set('Cookie', authCookie)
            .send({
                eventType: 'GameResult',
                data: {
                    game: 'Tic-Tac-Toe-Game',
                    playerNickname: 'freddy',
                    outcome: 'draw',
                    opponentNickname: 'mandy',
                },
                logtime: '2026-09-06 20:42:12',
                user: 'freddy',
            });
        // console.log(`got response: ${JSON.stringify(res.body, null, 2)}`);
        expect(res.statusCode).toEqual(201);
    });

    it('should get the last 2 items', async () => {
        const res = await request(eventlogBaseUrl)
            .get('/api/eventlog')
            .query({ limit: 2 })
            .set('Cookie', authCookie);
        // console.log(`got response: ${JSON.stringify(res.body, null, 2)}`);
        expect(res.statusCode).toEqual(200);
        expect(res.body.length).toBe(2);
        expect(res.body[1].data.game).toBe('Tic-Tac-Toe-Game');
    });

    it('should get events only for a specific user', async () => {
        const res = await request(eventlogBaseUrl)
            .get('/api/eventlog')
            .query({ user: 'freddy' })
            .set('Cookie', authCookie);
        // console.log(`got response: ${JSON.stringify(res.body, null, 2)}`);
        expect(res.statusCode).toEqual(200);
    });
});

describe('eventlog date tests', () => {
    it('should be the same dates before and after conversion', () => {
        const d = new Date();
        const dd = date2psqlstamp(d);
        const ddd = psqlstamp2date(dd!);
        // console.log(d)
        // console.log(dd);
        // console.log(ddd);
        const ddRe = new Date(dd!);
        expect(ddRe.getHours()).toEqual(d.getUTCHours());
        expect(ddRe.getMinutes()).toEqual(d.getMinutes());
        expect(ddRe.getSeconds()).toEqual(d.getSeconds());
        expect(ddd!.getHours()).toEqual(d.getHours());
        expect(ddd!.getMinutes()).toEqual(d.getMinutes());
        expect(ddd!.getSeconds()).toEqual(d.getSeconds());
    });

    const dOrig = new Date();
    it('should create a GameResult event with timestamp', async () => {
        console.log('date2: ', date2psqlstamp(dOrig));
        const res = await request(eventlogBaseUrl)
            .post('/api/eventlog')
            .set('Cookie', authCookie)
            .send({
                eventType: 'GameResult',
                data: {
                    outcome: 'won',
                    opponentNickname: 'mandy',
                },
                logtime: dOrig,
                user: 'freddy',
            });
        expect(res.statusCode).toEqual(201);
    });

    it('should retrieve the GameResult event and convert tstamp', async () => {
        const res = await request(eventlogBaseUrl)
            .get('/api/eventlog')
            .query({ limit: 1 })
            .set('Cookie', authCookie);
        expect(res.statusCode).toEqual(200);
        const logDate = new Date(res.body[0].logtime);
        expect(logDate).toEqual(dOrig);
        console.log(logDate.toString());
    });
});
