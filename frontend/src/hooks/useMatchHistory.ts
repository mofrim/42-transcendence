import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import {
    API_EVENTLOG,
    EventType,
    GameEvent,
    MAX_MATCH_HISTORY_ENTRIES,
    type EventDataGameResult,
    type MatchHistResponse,
} from 'ftr-common/sharedTypes';
import type { EventLogEntry } from '../ui/ingame/EventLogItems';

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
    };
}

export function useMatchHistory({ isSpectator }: UseMatchHistoryOptions) {
    const [matchHistory, setMatchHistory] = useState<EventLogEntry[]>([]);

    useEffect(() => {
        if (isSpectator) {
            return;
        }

        const controller = new AbortController();

        const loadMatchHistory = async (): Promise<void> => {
            console.log('Loading MatchHistory from DB...');
            try {
                const response = await axios.get<MatchHistResponse[]>(
                    API_EVENTLOG.matchHistory,
                    {
                        params: {
                            limit: MAX_MATCH_HISTORY_ENTRIES,
                        },
                        signal: controller.signal,
                    }
                );

                if (controller.signal.aborted) {
                    return;
                }

                const history = response.data.map(parseMatchHistoryEntry);

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
            if (isSpectator || event.eventType !== EventType.GameResult) {
                return;
            }

            const evData = event.data as EventDataGameResult;
            if (!evData) {
                return;
            }

            try {
                const response = await axios.post<MatchHistResponse>(
                    API_EVENTLOG.matchHistory,
                    {
                        eventType: EventType.GameResult,
                        data: evData,
                        logtime: event.logtime,
                    }
                );

                const savedMatch = parseMatchHistoryEntry(response.data);

                setMatchHistory((currentHistory) => {
                    const newHist = [...currentHistory, savedMatch].slice(
                        -MAX_MATCH_HISTORY_ENTRIES
                    );
                    return newHist;
                });
            } catch (error) {
                console.error('Failed to save match result:', error);
            }
        },
        [isSpectator]
    );

    return { matchHistory, saveMatchResult };
}
