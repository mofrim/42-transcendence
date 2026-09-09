// ---------------------=[ authentication middleware ]=--------------------- //

import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import { Logger, type ILogObj } from 'tslog';

export const verifyToken = (
    token: string,
    secretKey: string
): { nickname: string } => {
    try {
        const decoded = jwt.verify(token, secretKey);
        if (typeof decoded === 'string' || !decoded['nickname']) {
            throw new Error('Invalid token');
        }
        return decoded as { nickname: string };
    } catch (err) {
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
    const authLog = log.getSubLogger({ name: 'authenticate' });

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
        const decoded = verifyToken(token, secretKey);
        req.user = decoded;
        next();
    } catch (err) {
        void err;
        authLog.warn('Got invalid JWT from', req.ip);
        res.status(401).json({ error: 'Invalid token' });
    }
};
