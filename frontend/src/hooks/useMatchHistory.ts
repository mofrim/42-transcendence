// NOTE: For future improvements it might be worth thinking about merging this
// into EventLogContext

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import {
    API_EVENTLOG,
    EventType,
    GameEvent,
    MAX_MATCH_HISTORY_ENTRIES,
    type ApiResponse,
    type EventDataMiniGameResult,
    type MatchHistResponse,
} from 'ftr-common/sharedTypes';
import type { EventLogEntry } from '../ui/ingame/EventLogItems';
import { useOptionalEventLog } from './useEventLog';
import {
    EVENT_TIME_FORMAT,
    MAX_EVENT_LOG_ENTRIES,
    describeGameEvent,
    getGameEventProfileNicknames,
} from '../lib/eventLogUtils.ts';

const MATCH_HISTORY_DATE_TIME_FORMAT = new Intl.DateTimeFormat(undefined, {
    dateStyle: 'short',
    timeStyle: 'short',
});

type UseMatchHistoryOptions = {
    readonly isSpectator: boolean;
};

function parseMatchHistoryEntry(respoData: MatchHistResponse): EventLogEntry {
    let result = 'Draw';
    if (respoData.data.outcome === 'won') {
        result = 'Win';
    } else if (respoData.data.outcome === 'lost') {
        result = 'Loss';
    }

    const matchDate = new Date(respoData.logtime.valueOf());

    return {
        id: String(respoData.id),
        timestamp: MATCH_HISTORY_DATE_TIME_FORMAT.format(matchDate),
        description: `${respoData.data.game}: ${result} vs ${respoData.data.opponentNickname}`,
        profileNicknames: [respoData.data.opponentNickname],
    };
}

export function useMatchHistory({ isSpectator }: UseMatchHistoryOptions) {
    const [matchHistory, setMatchHistory] = useState<EventLogEntry[]>([]);

    const eventLog = useOptionalEventLog();
    const setEvents = eventLog?.setEvents;

    useEffect(() => {
        if (isSpectator) {
            return;
        }

        const controller = new AbortController();

        const loadMatchHistory = async (): Promise<void> => {
            console.log('Loading MatchHistory from DB...');
            try {
                const response = await axios.get<
                    ApiResponse<MatchHistResponse[]>
                >(API_EVENTLOG.matchHistory, {
                    params: {
                        limit: MAX_MATCH_HISTORY_ENTRIES,
                    },
                    signal: controller.signal,
                });

                if (controller.signal.aborted) {
                    return;
                }

                const history = response.data.data!.map(parseMatchHistoryEntry);

                setMatchHistory(history.slice(-MAX_MATCH_HISTORY_ENTRIES));
            } catch (error) {
                if (!controller.signal.aborted) {
                    console.error('Failed to load match history:', error);
                }
            }
        };

        void loadMatchHistory();

        return () => {
            controller.abort();
        };
    }, [isSpectator]);

    const saveMatchResult = useCallback(
        async (event: GameEvent): Promise<void> => {
            if (isSpectator || event.eventType !== EventType.MiniGameResult) {
                return;
            }

            const evData = event.data as EventDataMiniGameResult;
            if (!evData) {
                return;
            }

            try {
                const response = await axios.post<
                    ApiResponse<MatchHistResponse>
                >(API_EVENTLOG.matchHistory, {
                    eventType: EventType.MiniGameResult,
                    data: evData,
                    logtime: event.logtime,
                });

                const savedMatch = parseMatchHistoryEntry(response.data.data!);

                setMatchHistory((currentHistory) => {
                    const newHist = [...currentHistory, savedMatch].slice(
                        -MAX_MATCH_HISTORY_ENTRIES
                    );
                    return newHist;
                });

                // NOTE: also handle updating the **InGame**-EventLog here only
                // because the event is already stored in DB but would otherwise
                // not appear in the log. This is basically code-dup with
                // frontend/src/contexts/EventLogProvider.tsx
                const timestamp = EVENT_TIME_FORMAT.format(event.logtime);
                const description = describeGameEvent(event);

                const ev: EventLogEntry = {
                    id: response.data.data!.id!.toString(),
                    timestamp,
                    description,
                    profileNicknames: getGameEventProfileNicknames(event),
                };

                if (!setEvents) {
                    throw new Error(
                        'useMatchHistory must be used within an EventLogProvider'
                    );
                }

                setEvents((currentEvents) =>
                    [...currentEvents, ev].slice(-MAX_EVENT_LOG_ENTRIES)
                );
            } catch (error) {
                console.error('Failed to save match result:', error);
            }
        },
        [isSpectator, setEvents]
    );

    if (!isSpectator && !eventLog) {
        throw new Error(
            'useMatchHistory must be used within an EventLogProvider'
        );
    }

    return { matchHistory, saveMatchResult, setMatchHistory };
}
