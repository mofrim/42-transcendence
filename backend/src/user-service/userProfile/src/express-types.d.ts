declare global {
    namespace Express {
        interface Request {
            user?: {
                id: number;
                nickname: string;
            };
        }
    }
}

export {};
