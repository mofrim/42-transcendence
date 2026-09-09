// https://expressjs.com/en/5x/guide/writing-middleware/#middleware-function-requesttime

declare global {
    namespace Express {
        interface Request {
            user?: { nickname: string };
        }
    }
}
