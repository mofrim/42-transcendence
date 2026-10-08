import request from 'supertest';
import { API_EVENTLOG } from 'ftr-common/sharedTypes';
import dotenv from 'dotenv';

dotenv.config({ path: '../../dev.env', quiet: true });

const authBaseUrl = 'http://localhost:3001';
const eventlogBaseUrl = 'http://localhost:3002';

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
});

describe('eventlog test', () => {
    it('should create a chatmsg event', async () => {
        const res = await request(eventlogBaseUrl)
            .post(API_EVENTLOG.root)
            .set('Cookie', authCookie)
            .send({
                eventType: 'ChatMsg',
                data: { chatmsg: 'moep' },
                logtime: new Date(),
            });
        expect(res.statusCode).toEqual(201);
    });
});
