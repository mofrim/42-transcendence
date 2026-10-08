import request from 'supertest';
import dotenv from 'dotenv';

dotenv.config({ path: '../../dev.env', quiet: true });

const authBaseUrl = 'http://localhost:3001';

let authCookie: string;

describe('basic get cookie test', () => {
    it('should authenticate and receive a JWT cookie', async () => {
        const res = await request(authBaseUrl)
            .post('/api/login')
            .send({ nickname: 'freddy', password: process.env['FMAURER_PW'] });
        expect(res.headers['set-cookie']).toBeDefined();
        if ('set-cookie' in res.headers) {
            authCookie = res.headers['set-cookie'] as string;
        }
    });

    it('should access a protected endpoint using the JWT cookie', async () => {
        const res = await request(authBaseUrl)
            .get('/api/protected')
            .set('Cookie', authCookie);
        expect(res.statusCode).toEqual(200);
        console.log('res.body:', res.body);
    });
});
