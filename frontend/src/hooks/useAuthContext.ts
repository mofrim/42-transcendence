import { useContext } from 'react';
import { AuthContext } from '../contexts/AuthContext';

/**
 * now as we can access
 * the real user-data from db via the backend using useAuth now
 */
export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
