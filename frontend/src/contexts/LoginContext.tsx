// src/context/LoginContext.js
import React, { createContext, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';

interface LoginContextType {
    gameRunning: boolean;
    setGameRunning: Dispatch<SetStateAction<boolean>>;
    avatar: string;
    setAvatar: Dispatch<SetStateAction<string>>;
    serverAddr: string;
    setServerAddr: Dispatch<SetStateAction<string>>;
    port: string;
    setPort: Dispatch<SetStateAction<string>>;
    fullAddr: string;
    setFullAddr: Dispatch<SetStateAction<string>>;
    charPreviewCanvas: HTMLElement | null;
    setCharPreviewCanvas: Dispatch<SetStateAction<HTMLElement | null>>;
    charPreviewLabel: HTMLElement | null;
    setCharPreviewLabel: Dispatch<SetStateAction<HTMLElement | null>>;
}

export const LoginContext = createContext<LoginContextType | undefined>(
    undefined
);

export const LoginProvider: React.FC<{ children: React.ReactNode }> = ({
    children,
}) => {
    const [gameRunning, setGameRunning] = useState(false);
    const [avatar, setAvatar] = useState('true');
    const [serverAddr, setServerAddr] = useState('localhost');
    const [port, setPort] = useState('3000');
    const [fullAddr, setFullAddr] = useState('http://localhost:3000');
    const [charPreviewCanvas, setCharPreviewCanvas] =
        useState<HTMLElement | null>(null);
    const [charPreviewLabel, setCharPreviewLabel] =
        useState<HTMLElement | null>(null);

    return (
        <LoginContext.Provider
            value={{
                gameRunning,
                setGameRunning,
                avatar,
                setAvatar,
                serverAddr,
                setServerAddr,
                port,
                setPort,
                fullAddr,
                setFullAddr,
                charPreviewCanvas,
                setCharPreviewCanvas,
                charPreviewLabel,
                setCharPreviewLabel,
            }}
        >
            {children}
        </LoginContext.Provider>
    );
};
