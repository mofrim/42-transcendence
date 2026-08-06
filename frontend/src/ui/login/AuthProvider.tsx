import React, { useState } from 'react';
import { AuthContext } from '../../contexts/AuthContext';
import { User } from '@common/types';
import axios from 'axios';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
    children,
}) => {
    const [user, setUser] = useState<User | null>(null);

    const login = async (
        nickname: string,
        password: string
    ): Promise<boolean> => {
        try {
            await axios.post(
                '/api/login',
                { nickname, password },
                {
                    withCredentials: true,
                }
            );
            const userResponse = await axios.get('/api/user', {
                withCredentials: true,
            });
            console.log(`userResponse: ${userResponse.data}`);

            setUser(userResponse.data);
            return true;
        } catch (error) {
            console.error('Login failed:', error);
            return false;
        }
    };

    const logout = async () => {
        try {
            await axios.post(
                '/api/logout',
                {},
                {
                    withCredentials: true,
                }
            );
            setUser(null);
            console.log('token cookie has been cleared!');
        } catch (error) {
            console.error('Logout failed:', error);
        }
    };

    const value = {
        user,
        login,
        logout,
    };

    return (
        <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
    );
};
