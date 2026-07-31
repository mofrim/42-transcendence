// src/context/LoginContext.js
import { createContext } from 'react';
import type { Dispatch, SetStateAction, RefObject } from 'react';
import type { CreateCharPreviewReturnType } from '../game/character_preview';

interface LoginContextType {
    gameRunning: boolean;
    setGameRunning: Dispatch<SetStateAction<boolean>>;
    avatar: string;
    setAvatar: Dispatch<SetStateAction<string>>;
    nicknameRef: RefObject<string>;
    serverAddrRef: RefObject<string>;
    portRef: RefObject<string>;
    fullAddrRef: RefObject<string>;
    charPreviewCanvas: HTMLElement | null;
    setCharPreviewCanvas: Dispatch<SetStateAction<HTMLElement | null>>;
    charPreviewLabel: HTMLElement | null;
    setCharPreviewLabel: Dispatch<SetStateAction<HTMLElement | null>>;
    charPreviewRef: RefObject<CreateCharPreviewReturnType | null>;
}

export const LoginContext = createContext<LoginContextType | undefined>(
    undefined
);
