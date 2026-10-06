// shared/internal-auth.ts
import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import { Logger, type ILogObj } from 'tslog';

// add every service that should be able to make internal calls here
// so far only conn-service needs to post to user service
const ALLOWED_SERVICES = new Set(['connService']);

// all our microservices
export type BackendServices =
    'userService' | 'connService' | 'eventService' | 'authService';

export interface InternalTokenPayload {
    iss: string; // who created the token
    aud: string; // who it's for
    sub: string; // the calling service identity
    iat: number;
    exp: number;
    actingForUID?: number;
}

/**
 * Generate aka 'mint' a new JWT token for use in backend service internal
 * communication. This has to be done by the sender of an internal req!
 *
 * @param extra  Obj with room for payload like UID
 * @param srcService the name of the service who is making the req.
 */
export function mintInternalToken(
    srcService: BackendServices,
    targetService: string,
    extra: object = {},
    internalSecretKey: string
): string {
    return jwt.sign({ sub: srcService, ...extra }, internalSecretKey, {
        audience: targetService, // e.g. 'user-service'
        issuer: srcService, // 'connection-service'
        expiresIn: '5m', // we only need short lifetime here
    });
}

/**
 * Verify an internal token against thefINTERNAL_SECRET. To be used only
 * backend's internal communication middleware.
 *
 * @param expectedAudience the service the request has been send to
 * @param token the JWT token to verify
 */
export const verifyInternalToken = (
    token: string,
    expectedAudience: BackendServices,
    internalSecretKey: string
): InternalTokenPayload => {
    return jwt.verify(token, internalSecretKey, {
        audience: expectedAudience,
        issuer: undefined, // or pin... only accept known services
    }) as InternalTokenPayload;
};

/**
 * Internal auth middleware.
 *
 * @param audience The audience servicec aka the target of the request to be
 * authenticated. I.e. when this func is used in e.g. 'userService' the
 * partially evaluated function should set `audience` to `userService`
 */
export const authenticateInternalMid = (
    req: Request,
    res: Response,
    next: NextFunction,
    log: Logger<ILogObj>,
    audience: BackendServices,
    internalSecretKey: string
) => {
    const token = req.cookies?.['token'];
    if (!token) {
        log.warn('Missing token in internal request');
        return res.status(401);
    }

    try {
        const payload = verifyInternalToken(token, audience, internalSecretKey);
        if (!ALLOWED_SERVICES.has(payload.sub)) return res.sendStatus(403);
        req.internalCaller = payload.sub;
        if (payload.actingForUID !== undefined) {
            req.actingForUID = payload.actingForUID;
        } else {
            log.warn('actingForUID not found in token payload!');
        }
        return next();
    } catch {
        log.warn('Invalid token in internal request');
        return res.sendStatus(401);
    }
};
