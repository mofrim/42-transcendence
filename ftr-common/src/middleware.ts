// ---------------------=[ authentication middleware ]=--------------------- //

import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import { Logger, type ILogObj } from 'tslog';
import { mkApiResponse } from './utils.ts';

export const verifyToken = (
    token: string,
    secretKey: string,
    log: Logger<ILogObj>
): number => {
    try {
        const decoded = jwt.verify(token, secretKey, { algorithms: ['HS256'] });
        if (typeof decoded === 'string') {
            log.error('verify: invalid token data');
            throw new Error('Invalid token');
        }
        const userId = Number(decoded?.sub);

        // comparing only `!Number.isSafeInteger` would be a bug because `null`
        // and empty string also coerce to `0`
        if (!decoded.sub || !Number.isSafeInteger(userId)) {
            log.error('verify: invalid UID');
            throw new Error('Invalid token');
        }
        return userId;
    } catch (err) {
        log.error('verify: jwt.verify failed');
        throw new Error('Invalid token', { cause: err });
    }
};

export const authenticateMid = (
    req: Request,
    res: Response,
    next: NextFunction,
    log: Logger<ILogObj>,
    secretKey: string
) => {
    const authLog = log.getSubLogger({ name: 'authMid' });

    // guard against req.cookies being `undefined` which would lead to TypeError
    // being thrown
    const token = req.cookies?.['token'];
    if (!token) {
        res.status(401).json(mkApiResponse('Missing token', 'error'));
        authLog.warn('Missing token in request');
        return;
    }

    try {
        req.userId = verifyToken(token, secretKey, authLog);
        next();
    } catch (err) {
        authLog.warn('Got invalid JWT from', req.ip, ' -> ', err);
        res.status(401).json(mkApiResponse('Invalid token', 'error'));
    }
};
