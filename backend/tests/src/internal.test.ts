import request from 'supertest';
import {
    mintInternalToken,
    verifyInternalToken,
} from 'ftr-common/internalAuth';
import { API_USER, PersistentSaveGameSnapshot } from 'ftr-common/sharedTypes';
import dotenv from 'dotenv';
import { exit } from 'node:process';

// load dotenv
dotenv.config({ path: '../../dev.env', quiet: true });

if (process.env['INTERNAL_JWT_SECRET'] === undefined) {
    console.error('need internal JWT secret from env!');
    exit(1);
}

const KEY = process.env['INTERNAL_JWT_SECRET'];
const userBaseUrl = 'http://localhost:3003';
const authBaseUrl = 'http://localhost:3001';
let internalToken: string = '';
let authCookie: string = '';

describe('token minting & verification', () => {
    it('should mint a new token for an internal req', async () => {
        internalToken = mintInternalToken(
            'connService',
            'userService',
            { actingForUID: 5 },
            KEY
        );
        expect(internalToken).toBeDefined();
        console.log(`token generated: ${internalToken}`);
    });

    it('should verify a token', async () => {
        const verifiedToken = verifyInternalToken(
            internalToken,
            'userService',
            KEY
        );
        expect(verifiedToken).toBeDefined();
        console.log('token verified:', verifiedToken);
    });

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

describe('internal req', () => {
    it('make a successful req to /api/user POST endpoint', async () => {
        const res = await request(userBaseUrl)
            .post(API_USER.root)
            .set('Cookie', `token=${internalToken}`)
            .send({
                position: {
                    x: 0,
                    y: 0,
                    z: 0,
                },
                blackHoleSecondsRemaining: 1000,
            });
        console.log(res.body);
        expect(res.statusCode).toEqual(200);
    });

    it('make a successful req to /api/user/internal PATCH endpoint', async () => {
        const snap: PersistentSaveGameSnapshot = {
            position: { x: 1, y: 2, z: 3 },
            blackHoleSecondsRemaining: 777,
        };
        const res = await request(userBaseUrl)
            .patch(API_USER.rootInternal)
            .set('Cookie', `token=${internalToken}`)
            .send({ snap: snap });
        console.log(res.body);
        expect(res.statusCode).toEqual(200);
    });

    it('make a successful req to /api/user/internal PATCH endpoint', async () => {
        const res = await request(userBaseUrl)
            .patch(API_USER.rootInternal)
            .set('Cookie', `token=${internalToken}`)
            .send({ isLoggedIn: true });
        console.log(res.body);
        expect(res.statusCode).toEqual(200);
    });

    it('check updated state', async () => {
        const res = await request(userBaseUrl)
            .get(API_USER.root)
            .set('Cookie', authCookie);
        console.log(res.body);
        expect(res.statusCode).toEqual(200);
    });
});
