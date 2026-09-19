// ---------------------=[ authentication middleware ]=--------------------- //

import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import { Logger, type ILogObj } from 'tslog';

export const verifyToken = (
    token: string,
    secretKey: string,
    log: Logger<ILogObj>
): number => {
    try {
        const decoded = jwt.verify(token, secretKey);
        log.debug(
            'decoded:',
            typeof decoded === 'string' ? decoded : JSON.stringify(decoded)
        );
        if (typeof decoded === 'string') {
            log.error('verify: invalid token data');
            throw new Error('Invalid token');
        }
        const userId = Number(decoded['userId']);
        if (!Number.isSafeInteger(userId)) {
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

    let token;
    try {
        token = req.cookies['token'];
    } catch (err) {
        void err;
        res.status(401).json({ error: 'Unauthorized' });
        authLog.warn('Unauthorized request');
        return;
    }

    try {
        req.userId = verifyToken(token, secretKey, authLog);
        next();
    } catch (err) {
        void err;
        authLog.warn('Got invalid JWT from', req.ip);
        res.status(401).json({ error: 'Invalid token' });
    }
};
