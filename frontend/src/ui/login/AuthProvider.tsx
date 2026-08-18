import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AuthContext } from '../../contexts/AuthContext';
import type { User } from '@common/types';
import axios from 'axios';
import type { AxiosRequestConfig } from 'axios';

const getAuthenticatedUser = async (signal?: AbortSignal): Promise<User> => {
    const config: AxiosRequestConfig = {
        withCredentials: true,
    };

    if (signal !== undefined) {
        // Make the optional Axios abort signal compatible with exactOptionalPropertyTypes by only adding the signal property
        config.signal = signal;
    }

    const userResponse = await axios.get<User>('/api/user', config);
    return userResponse.data;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
    children,
}) => {
    const [user, setUser] = useState<User | null>(null);
    const [isInitializing, setIsInitializing] = useState(true);

    useEffect(() => {
        const controller = new AbortController();

        const restoreSession = async (): Promise<void> => {
            try {
                const currentUser = await getAuthenticatedUser(
                    controller.signal
                );
                if (!controller.signal.aborted) {
                    setUser(currentUser);
                }
            } catch (error) {
                if (controller.signal.aborted) {
                    return;
                }

                if (
                    !axios.isAxiosError(error) ||
                    error.response?.status !== 401
                ) {
                    console.error('Session restore failed:', error);
                }
                setUser(null);
            } finally {
                if (!controller.signal.aborted) {
                    setIsInitializing(false);
                }
            }
        };

        void restoreSession();

        return () => controller.abort();
    }, []);

    const login = useCallback(
        async (nickname: string, password: string): Promise<boolean> => {
            try {
                await axios.post(
                    '/api/login',
                    { nickname, password },
                    {
                        withCredentials: true,
                    }
                );
            } catch (error) {
                // Distinguish invalid credentials from operational login failures so AuthCard can show the correct error path.
                if (
                    axios.isAxiosError(error) &&
                    error.response?.status === 401
                ) {
                    return false;
                }
                console.error('Login failed:', error);
                throw error;
            }

            const currentUser = await getAuthenticatedUser();
            console.log(`userResponse: ${currentUser.nickname}`);

            setUser(currentUser);
            return true;
        },
        []
    );

    const logout = useCallback(async (): Promise<void> => {
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
            throw error;
        }
    }, []);

    const value = useMemo(
        () => ({
            user,
            isInitializing,
            login,
            logout,
        }),
        [user, isInitializing, login, logout]
    );

    return (
        <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
    );
};
