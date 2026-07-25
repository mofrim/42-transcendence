// src/context/LoginContext.js
import React, { createContext, useState, useRef } from 'react';
import type { Dispatch, SetStateAction, RefObject } from 'react';
import type { CreateCharPreviewReturnType } from '../game/character_preview';

interface LoginContextType {
    gameRunning: boolean;
    setGameRunning: Dispatch<SetStateAction<boolean>>;
    avatar: string;
    setAvatar: Dispatch<SetStateAction<string>>;
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
    const serverAddrRef = useRef<string>('localhost');
    const portRef = useRef<string>('3000');
    const fullAddrRef = useRef<string>('http://localhost:3000');
    const charPreviewRef = useRef<CreateCharPreviewReturnType>(null);

    return (
        <LoginContext.Provider
            value={{
                gameRunning,
                setGameRunning,
                avatar,
                setAvatar,
                serverAddrRef,
                portRef,
                fullAddrRef,
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
