import { createContext } from 'react';
import type { EventLogEntry } from '../ui/ingame/EventLogItems';
import { GameEvent } from 'ftr-common/sharedTypes';

type EventLogContextType = {
    events: EventLogEntry[];
    appendEvent: (event: GameEvent) => Promise<void>;
};

export const EventLogContext = createContext<EventLogContextType | undefined>(
    undefined
);
