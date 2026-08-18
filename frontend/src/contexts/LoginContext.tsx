// src/context/LoginContext.js
import { createContext } from 'react';
import type { Dispatch, SetStateAction, RefObject } from 'react';

interface LoginContextType {
    gameRunning: boolean;
    setGameRunning: Dispatch<SetStateAction<boolean>>;
    avatar: string;
    setAvatar: Dispatch<SetStateAction<string>>;
    nicknameRef: RefObject<string>;
    serverAddrRef: RefObject<string>;
}

export const LoginContext = createContext<LoginContextType | undefined>(
    undefined
);
