import React, { useState, useRef } from 'react';
import { LoginContext } from '../../contexts/LoginContext';

export const LoginProvider: React.FC<{ children: React.ReactNode }> = ({
    children,
}) => {
    // these elements should clearly trigger a re-render
    const [gameRunning, setGameRunning] = useState(false);
    const [isSpectator, setIsSpectator] = useState(false);

    const [avatar, setAvatar] = useState('true');

    // not these ones
    const nicknameRef = useRef<string>('');
    const serverAddrRef = useRef<string>('https://localhost:1111');

    return (
        <LoginContext.Provider
            value={{
                gameRunning,
                setGameRunning,
                isSpectator,
                setIsSpectator,
                avatar,
                setAvatar,
                nicknameRef,
                serverAddrRef,
            }}
        >
            {children}
        </LoginContext.Provider>
    );
};
