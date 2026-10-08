import request from 'supertest';
import { QUESTS } from 'ftr-common/sharedTypes';
import dotenv from 'dotenv';

dotenv.config({ path: '../../dev.env', quiet: true });

const authBaseUrl = 'http://localhost:3001';
const userBaseUrl = 'http://localhost:3003';

let authCookieRoot: string;
let authCookieFm: string;

describe('basic get cookie test', () => {
    it('should authenticate as freddy and receive a JWT cookie', async () => {
        const res = await request(authBaseUrl)
            .post('/api/login')
            .send({ nickname: 'freddy', password: process.env['FMAURER_PW'] });
        expect(res.statusCode).toEqual(200);
        expect(res.headers['set-cookie']).toBeDefined();
        authCookieFm = res.headers['set-cookie'] as string;
    });
    it('should authenticate as root and receive a JWT cookie', async () => {
        const res = await request(authBaseUrl)
            .post('/api/login')
            .send({ nickname: 'root', password: process.env['FTR_ROOT_PW'] });
        expect(res.statusCode).toEqual(200);
        expect(res.headers['set-cookie']).toBeDefined();
        authCookieRoot = res.headers['set-cookie'] as string;
    });
});

describe('test quests', () => {
    it('should get freddy', async () => {
        const res = await request(userBaseUrl)
            .get('/api/user/all')
            .set('Cookie', authCookieRoot);
        console.log(
            `got response: ${JSON.stringify(res.body.data[2], null, 2)}`
        );
        expect(res.statusCode).toEqual(200);
    });

    it('set blackhole quest to true', async () => {
        const res = await request(userBaseUrl)
            .post('/api/user/quests')
            .set('Cookie', authCookieFm)
            .send({ quest: QUESTS.BLACK_HOLE_QUEST_ID.id });
        console.log(`got response: ${JSON.stringify(res.body.data, null, 2)}`);
        expect(res.statusCode).toEqual(200);
    });

    it('set coffee quest to true', async () => {
        const res = await request(userBaseUrl)
            .post('/api/user/quests')
            .set('Cookie', authCookieFm)
            .send({ quest: QUESTS.COFFEE_QUEST_ID.id });
        console.log(`got response: ${JSON.stringify(res.body.data, null, 2)}`);
        expect(res.statusCode).toEqual(200);
    });

    it('should get freddy', async () => {
        const res = await request(userBaseUrl)
            .get('/api/user/all')
            .set('Cookie', authCookieRoot);
        console.log(
            `got response: ${JSON.stringify(res.body.data[2], null, 2)}`
        );
        expect(res.statusCode).toEqual(200);
    });

    it("get freddy's quests", async () => {
        const res = await request(userBaseUrl)
            .get('/api/user/quests')
            .set('Cookie', authCookieFm);
        console.log(`got response: ${JSON.stringify(res.body.data, null, 2)}`);
        expect(res.statusCode).toEqual(200);
    });
});
