declare global {
    namespace Express {
        interface Request {
            user?: {
                nickname: string;
            };
        }
    }
}

export {};
