import { createContext } from 'react';
import { User } from '@common/types';

interface AuthContextType {
    user: User | null;
    login: (nickname: string, password: string) => Promise<boolean>;
    logout: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(
    undefined
);
