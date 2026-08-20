import { useContext } from 'react';
import { LoginContext } from '../contexts/LoginContext';

/**
 * wrapper... only purpose is to handle missing context which would lead to
 * context == null
 */
export const useLoginContext = () => {
    const context = useContext(LoginContext);
    if (!context) {
        throw new Error('useLoginContext must be used within a LoginProvider!');
    }
    return context;
};
