import React, { useState, useRef } from 'react';
import { LoginContext } from '../../contexts/LoginContext';
import type { CreateCharPreviewReturnType } from '../../game/character_preview';

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
    const nicknameRef = useRef<string>('');
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
                nicknameRef,
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
