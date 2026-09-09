import { createContext } from 'react';
import type { User } from 'ftr-common/sharedTypes';

interface AuthContextType {
    user: User | null;
    isInitializing: boolean;
    login: (nickname: string, password: string) => Promise<boolean>;
    logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(
    undefined
);
