import request from 'supertest';

const authBaseUrl = 'http://localhost:3001';
const userBaseUrl = 'http://localhost:3003';

let authCookieRoot: string;

describe('basic get cookie test', () => {
    it('should authenticate as root and receive a JWT cookie', async () => {
        const res = await request(authBaseUrl).post('/api/login').send({
            nickname: 'superadmin',
            password: process.env['FTR_ROOT_PW'],
        });
        expect(res.statusCode).toEqual(200);
        expect(res.headers['set-cookie']).toBeDefined();
        authCookieRoot = res.headers['set-cookie'] as string;
    });
});

describe('get all users', () => {
    it('should get all users', async () => {
        const res = await request(userBaseUrl)
            .get('/api/user/all')
            .set('Cookie', authCookieRoot);
        console.log(`got response: ${JSON.stringify(res.body.data, null, 2)}`);
        expect(res.statusCode).toEqual(200);
    });
});
