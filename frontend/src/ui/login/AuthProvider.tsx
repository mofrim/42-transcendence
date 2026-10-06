import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AuthContext, type LoginResponse } from '../../contexts/AuthContext';
import { type User, type ApiResponse, API_USER } from 'ftr-common/sharedTypes';
import axios from 'axios';
import type { AxiosRequestConfig } from 'axios';
import { resetIntroCutsceneSession } from './IntroCutsceneSession';

const getAuthenticatedUser = async (signal?: AbortSignal): Promise<User> => {
    const config: AxiosRequestConfig = {
        withCredentials: true,
    };

    if (signal !== undefined) {
        // Make the optional Axios abort signal compatible with
        // exactOptionalPropertyTypes by only adding the signal property
        config.signal = signal;
    }

    const userResponse = await axios.get<ApiResponse<User>>(
        API_USER.root,
        config
    );
    return userResponse.data.data!;
};

// validate session cookie without risking a 401 response. querying
// /api/user with no avlid `token` cookie set would cause a console error
// because of the 401 response. with the `/api/validateSession` endpoint we can
// now safely query the backend for session validation
const isValidSession = async (signal?: AbortSignal): Promise<boolean> => {
    const config: AxiosRequestConfig = {
        withCredentials: true,
    };

    if (signal !== undefined) {
        config.signal = signal;
    }

    const res = await axios.get<ApiResponse>('/api/validateSession', config);
    return res.data.status === 'success';
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
    children,
}) => {
    const [user, setUser] = useState<User | null>(null);
    const [isInitializing, setIsInitializing] = useState(true);

    useEffect(() => {
        const controller = new AbortController();

        const restoreSession = async (): Promise<void> => {
            // first check for valid token cookie
            if (!(await isValidSession(controller.signal))) {
                console.log('no valid token cookie found!');
                setUser(null);
                if (!controller.signal.aborted) {
                    setIsInitializing(false);
                }
                return;
            }

            // this should now safely succeed. only possible failure (401) can
            // happen if token expires just in between both requests :/
            try {
                const currentUser = await getAuthenticatedUser(
                    controller.signal
                );
                if (!controller.signal.aborted) {
                    setUser(currentUser);
                }
                console.log('session restored from valid token cookie');
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
        async (nickname: string, password: string): Promise<LoginResponse> => {
            try {
                await axios.post(
                    '/api/login',
                    { nickname, password },
                    {
                        withCredentials: true,
                    }
                );
            } catch (error) {
                // Distinguish invalid credentials from operational login
                // failures so AuthCard can show the correct error path.
                if (axios.isAxiosError(error)) {
                    if (error.response?.status === 400) return 'bad_creds';
                    if (error.response?.status === 401) return 'invalid_creds';
                    if (error.response?.status === 409)
                        return 'already_loggedin';
                }
                console.error('Login failed:', error);
                throw error;
            }

            const currentUser = await getAuthenticatedUser();
            console.log(`user authenticated: ${currentUser.nickname}`);

            resetIntroCutsceneSession();
            setUser(currentUser);
            return 'success';
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
            resetIntroCutsceneSession();
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
