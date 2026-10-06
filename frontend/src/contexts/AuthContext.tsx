import { createContext } from 'react';
import type { User } from 'ftr-common/sharedTypes';

// return enum of login function
export type LoginResponse =
    'success' | 'invalid_creds' | 'already_loggedin' | 'bad_creds';

interface AuthContextType {
    user: User | null;
    isInitializing: boolean;
    login: (nickname: string, password: string) => Promise<LoginResponse>;
    logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(
    undefined
);
