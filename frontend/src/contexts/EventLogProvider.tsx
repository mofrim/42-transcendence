// contexts/EventLogContext.tsx
import React, { useState, useCallback, useRef } from 'react';
import type { EventLogEntry } from '../ui/ingame/EventLogItems';
import { EventLogContext } from '../contexts/EventLogContext.tsx';
import { GameEvent } from 'ftr-common/sharedTypes';
import { EVENT_TIME_FORMAT, describeGameEvent } from '../lib/eventLogUtils.ts';

// TODO handle reset / loading of old events on login

export const EventLogProvider: React.FC<{ children: React.ReactNode }> = ({
    children,
}) => {
    const [events, setEvents] = useState<EventLogEntry[]>([]);
    const eventIdCounter = useRef(0);
    const MAX_EVENT_LOG_ENTRIES = 10;

    // FIXME handle setting the `id` param properly. but maybe this is already
    // enough.. another solution would be to use the id returned after the
    // db-req has completed and returned
    const appendEvent = useCallback(async (event: GameEvent) => {
        const now = new Date();
        const id = (eventIdCounter.current++).toString();
        const timestamp = EVENT_TIME_FORMAT.format(now);
        const description = describeGameEvent(event);

        const ev: EventLogEntry = {
            id,
            timestamp,
            description,
        };

        setEvents((currentEvents) => {
            const updatedEvents = [...currentEvents, ev].slice(
                -MAX_EVENT_LOG_ENTRIES
            );
            return updatedEvents;
        });

        try {
            // TODO store event in DB via API req
        } catch (error) {
            console.error('Failed to save event to database:', error);
        }

        console.log(`[EventLog] ${description}`);
    }, []);

    return (
        <EventLogContext.Provider
            value={{
                events,
                appendEvent,
            }}
        >
            {children}
        </EventLogContext.Provider>
    );
};
