import request from 'supertest';

import { API_USER } from 'ftr-common/sharedTypes';

const authBaseUrl = 'http://localhost:3001';
const userBaseUrl = 'http://localhost:3003';

let authCookieFm: string;
let authCookieRoot: string;

describe('basic get cookie test', () => {
    it('should authenticate as freddy and receive a JWT cookie', async () => {
        const res = await request(authBaseUrl)
            .post('/api/login')
            .send({ nickname: 'freddy', password: 'Moritz' });
        expect(res.statusCode).toEqual(200);
        expect(res.headers['set-cookie']).toBeDefined();
        authCookieFm = res.headers['set-cookie'] as string;
    });
    it('should authenticate as root and receive a JWT cookie', async () => {
        const res = await request(authBaseUrl)
            .post('/api/login')
            // FIXME obfuscate pw here! how?
            .send({ nickname: 'root', password: process.env['FTR_ROOT_PW'] });
        expect(res.statusCode).toEqual(200);
        expect(res.headers['set-cookie']).toBeDefined();
        authCookieRoot = res.headers['set-cookie'] as string;
        // console.log(`set cookie for root: ${res.headers['set-cookie']}`);
    });
});

describe('basic user-service test', () => {
    it('should get currently authenticated user (fm)', async () => {
        const res = await request(userBaseUrl)
            .get(API_USER.root)
            .set('Cookie', authCookieFm);
        // console.log(`got response: ${JSON.stringify(res.body, null, 2)}`);
        expect(res.statusCode).toEqual(200);
        expect(res.body.data.nickname).toEqual('freddy');
    });

    it('should get user with id 0', async () => {
        const res = await request(userBaseUrl)
            .get(API_USER.root + '/0')
            .set('Cookie', authCookieRoot);
        // console.log(`got response: ${JSON.stringify(res.body, null, 2)}`);
        expect(res.statusCode).toEqual(200);
        expect(res.body.id).toEqual(0);
        expect(res.body.data.nickname).toEqual('root');
    });

    it('should fail as unauthorized', async () => {
        const res = await request(userBaseUrl)
            .get(API_USER.root + '/0')
            .set('Cookie', authCookieFm);
        // console.log(`got response: ${JSON.stringify(res.body, null, 2)}`);
        expect(res.statusCode).toEqual(401);
    });

    it('should fail as unauthorized (/all)', async () => {
        const res = await request(userBaseUrl)
            .get(API_USER.all)
            .set('Cookie', authCookieFm);
        // console.log(`got response: ${JSON.stringify(res.body, null, 2)}`);
        expect(res.statusCode).toEqual(401);
    });

    it('should get all users', async () => {
        const res = await request(userBaseUrl)
            .get(API_USER.all)
            .set('Cookie', authCookieRoot);
        // console.log(`got response: ${JSON.stringify(res.body, null, 2)}`);
        expect(res.statusCode).toEqual(200);
    });
});

describe('add/del user aka register tests', () => {
    it('should fail creating an already existing user', async () => {
        const user = {
            nickname: 'freddy',
            password: 'miep',
            email: 'moep@miep.de',
        };
        const res = await request(userBaseUrl)
            .post(API_USER.register)
            .send(user);
        // console.log(`got response: ${JSON.stringify(res.body, null, 2)}`);
        expect(res.statusCode).toEqual(403);
    });

    let moepId: number;

    it('should successfully create a new user "moep"', async () => {
        const user = {
            nickname: 'moep',
            password: 'miep',
            email: 'moep@miep.de',
        };
        const res = await request(userBaseUrl)
            .post(API_USER.register)
            .send(user);
        console.log(`got response: ${JSON.stringify(res.body, null, 2)}`);
        expect(res.statusCode).toEqual(201);
        moepId = res.body.id;
    });

    it('should successfully delete "moep" again', async () => {
        const res = await request(userBaseUrl)
            .delete(API_USER.root + `/${moepId}`)
            .set('Cookie', authCookieRoot);
        console.log(`got response: ${JSON.stringify(res.body, null, 2)}`);
        expect(res.statusCode).toEqual(204);
    });

    it('should successfully create a new user "moep2"', async () => {
        const user = {
            nickname: 'moep2',
            password: 'miep',
            email: 'moep@miep.de',
        };
        const res = await request(userBaseUrl)
            .post(API_USER.register)
            .send(user);
        console.log(`got response: ${JSON.stringify(res.body, null, 2)}`);
        expect(res.statusCode).toEqual(201);
        moepId = res.body.id;
    });

    it('should fail deleting user due to invalid creds', async () => {
        const res = await request(userBaseUrl)
            .delete(API_USER.root + `/${moepId}`)
            .set('Cookie', authCookieFm);
        console.log(`got response: ${JSON.stringify(res.body, null, 2)}`);
        expect(res.statusCode).toEqual(401);
    });

    it('should successfully delete "moep2" again', async () => {
        const res = await request(userBaseUrl)
            .delete(API_USER.root + `/${moepId}`)
            .set('Cookie', authCookieRoot);
        console.log(`got response: ${JSON.stringify(res.body, null, 2)}`);
        expect(res.statusCode).toEqual(204);
    });
});

describe('simple output of response', () => {
    it('should get currently authenticated user (fm)', async () => {
        const res = await request(userBaseUrl)
            .get(API_USER.root)
            .set('Cookie', authCookieFm);
        console.log(`got response: ${JSON.stringify(res.body, null, 2)}`);
        expect(res.statusCode).toEqual(200);
        expect(res.body.data.nickname).toEqual('freddy');
    });
});
