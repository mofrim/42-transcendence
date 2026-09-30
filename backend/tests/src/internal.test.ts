import request from 'supertest';
import {
    mintInternalToken,
    verifyInternalToken,
} from 'ftr-common/internalAuth';
import { API_USER } from 'ftr-common/sharedTypes';
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
let token: string = '';

console.log('secret:', KEY);

describe('token minting & verification', () => {
    it('should mint a new token for an internal req', async () => {
        token = mintInternalToken(
            'connService',
            'userService',
            { actingForUID: 4 },
            KEY
        );
        expect(token).toBeDefined();
        console.log(`token generated: ${token}`);
    });
    it('should verify a token', async () => {
        const verifiedToken = verifyInternalToken(token, 'userService', KEY);
        expect(verifiedToken).toBeDefined();
        console.log('token verified:', verifiedToken);
    });
});

describe('internal req', () => {
    it('make a successful req to /api/user POST endpoint', async () => {
        const res = await request(userBaseUrl)
            .post(API_USER.root)
            .set('Cookie', `token=${token}`)
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
});
