// src/context/LoginContext.js
import React, { createContext, useState, useRef } from 'react';
import type { Dispatch, SetStateAction, RefObject } from 'react';
import type { CreateCharPreviewReturnType } from '../game/character_preview';

interface LoginContextType {
    gameRunning: boolean;
    setGameRunning: Dispatch<SetStateAction<boolean>>;
    avatar: string;
    setAvatar: Dispatch<SetStateAction<string>>;
    serverAddr: RefObject<string>;
    port: RefObject<string>;
    fullAddr: RefObject<string>;
    charPreviewCanvas: HTMLElement | null;
    setCharPreviewCanvas: Dispatch<SetStateAction<HTMLElement | null>>;
    charPreviewLabel: HTMLElement | null;
    setCharPreviewLabel: Dispatch<SetStateAction<HTMLElement | null>>;
    charPreviewRef: RefObject<CreateCharPreviewReturnType | null>;
}

export const LoginContext = createContext<LoginContextType | undefined>(
    undefined
);

export const LoginProvider: React.FC<{ children: React.ReactNode }> = ({
    children,
}) => {
    // these elements should clearly trigger a re-render
    const [gameRunning, setGameRunning] = useState(false);

    // TODO clarify this
    // QUESTION should these trigger re-render?
    const [avatar, setAvatar] = useState('true');
    const [charPreviewCanvas, setCharPreviewCanvas] =
        useState<HTMLElement | null>(null);
    const [charPreviewLabel, setCharPreviewLabel] =
        useState<HTMLElement | null>(null);

    // not these ones
    const serverAddr = useRef<string>('localhost');
    const port = useRef<string>('3000');
    const fullAddr = useRef<string>('http://localhost:3000');
    const charPreviewRef = useRef<CreateCharPreviewReturnType>(null);

    return (
        <LoginContext.Provider
            value={{
                gameRunning,
                setGameRunning,
                avatar,
                setAvatar,
                serverAddr,
                port,
                fullAddr,
                charPreviewCanvas,
                setCharPreviewCanvas,
                charPreviewLabel,
                setCharPreviewLabel,
                charPreviewRef,
            }}
        >
            {children}
        </LoginContext.Provider>
    );
};
