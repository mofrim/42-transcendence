import request from 'supertest';
import { API_USER } from 'ftr-common/sharedTypes';
import dotenv from 'dotenv';

dotenv.config({ path: '../../dev.env', quiet: true });

const authBaseUrl = 'http://localhost:3001';
const userBaseUrl = 'http://localhost:3003';

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
});

describe('basic user-service test', () => {
    it('should get current TOSPP status', async () => {
        const res = await request(userBaseUrl)
            .get(API_USER.tospp)
            .set('Cookie', authCookieFm);
        console.log(`got response: ${JSON.stringify(res.body, null, 2)}`);
        expect(res.statusCode).toEqual(200);
        expect(res.body.data).toEqual(false);
    });

    it('should toggle users TOSPP', async () => {
        const res = await request(userBaseUrl)
            .post(API_USER.tospp)
            .set('Cookie', authCookieFm);
        console.log(`got response: ${JSON.stringify(res.body, null, 2)}`);
        expect(res.statusCode).toEqual(200);
    });

    it('should get toggled TOSPP status', async () => {
        const res = await request(userBaseUrl)
            .get(API_USER.tospp)
            .set('Cookie', authCookieFm);
        console.log(`got response: ${JSON.stringify(res.body, null, 2)}`);
        expect(res.statusCode).toEqual(200);
        expect(res.body.data).toEqual(true);
    });
});
