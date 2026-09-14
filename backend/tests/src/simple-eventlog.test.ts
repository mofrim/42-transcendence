import request from 'supertest';

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
});

describe('eventlog test', () => {
    it('should create a chatmsg event', async () => {
        const res = await request(eventlogBaseUrl)
            .post('/api/eventlog')
            .set('Cookie', authCookie)
            .send({
                eventType: 'ChatMsg',
                data: { chatmsg: 'moep' },
                logtime: new Date(),
            });
        expect(res.statusCode).toEqual(201);
    });
});
