import { useContext } from 'react';
import { EventLogContext } from '../contexts/EventLogContext.tsx';

export const useOptionalEventLog = () => useContext(EventLogContext);

export const useEventLog = () => {
    const context = useOptionalEventLog();
    if (!context) {
        throw new Error('useEventLog must be used within an EventLogProvider');
    }
    return context;
};
