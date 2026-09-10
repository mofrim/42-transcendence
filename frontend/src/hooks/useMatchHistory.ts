import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import {
    EventType,
    GameEvent,
    type BaseEventLog,
    type EventData,
} from 'ftr-common/sharedTypes';
import type { EventLogEntry } from '../ui/ingame/EventLogItems';

const EVENT_LOG_HISTORY_LIMIT = 50;
const MAX_MATCH_HISTORY_ENTRIES = 10;
const MATCH_HISTORY_DATE_TIME_FORMAT = new Intl.DateTimeFormat(undefined, {
    dateStyle: 'short',
    timeStyle: 'short',
});

type UseMatchHistoryOptions = {
    readonly userId: number;
    readonly isSpectator: boolean;
};

type MatchResultData = Required<
    Pick<EventData, 'game' | 'outcome' | 'opponentNickname'>
>;

function getMatchResultData(data: EventData): MatchResultData | null {
    if (data.game !== 'Tic-Tac-Toe' && data.game !== 'Rock-Paper-Scissors') {
        return null;
    }
    if (
        data.outcome !== 'won' &&
        data.outcome !== 'lost' &&
        data.outcome !== 'draw'
    ) {
        return null;
    }

    const opponentNickname = data.opponentNickname?.trim();
    if (!opponentNickname) {
        return null;
    }

    return {
        game: data.game,
        outcome: data.outcome,
        opponentNickname,
    };
}

function createMatchHistoryEntry(
    id: number,
    data: MatchResultData,
    tstamp: Date | string
): EventLogEntry {
    let result = 'Draw';
    if (data.outcome === 'won') {
        result = 'Win';
    } else if (data.outcome === 'lost') {
        result = 'Loss';
    }

    const matchDate = new Date(tstamp.valueOf());

    return {
        id: String(id),
        timestamp: MATCH_HISTORY_DATE_TIME_FORMAT.format(matchDate),
        description: `${data.game}: ${result} vs ${data.opponentNickname}`,
    };
}

function parseMatchHistoryEntry(event: BaseEventLog): EventLogEntry | null {
    if (event.eventType !== EventType.GameResult) {
        return null;
    }

    try {
        const data = getMatchResultData(event.data);
        if (!data || event.id === undefined) {
            return null;
        }

        return createMatchHistoryEntry(event.id, data, event.logtime);
    } catch {
        return null;
    }
}

export function useMatchHistory({
    userId,
    isSpectator,
}: UseMatchHistoryOptions) {
    const [matchHistory, setMatchHistory] = useState<EventLogEntry[]>([]);

    useEffect(() => {
        if (isSpectator) {
            return;
        }

        const controller = new AbortController();

        const loadMatchHistory = async (): Promise<void> => {
            try {
                const response = await axios.get<BaseEventLog[]>(
                    '/api/eventlog',
                    {
                        params: {
                            limit: EVENT_LOG_HISTORY_LIMIT,
                            uid: userId,
                        },
                        signal: controller.signal,
                    }
                );

                if (controller.signal.aborted) {
                    return;
                }

                const history = response.data
                    .map(parseMatchHistoryEntry)
                    .filter((match): match is EventLogEntry => match !== null);

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
    }, [isSpectator, userId]);

    const saveMatchResult = useCallback(
        async (event: GameEvent): Promise<void> => {
            if (isSpectator || event.eventType !== EventType.GameResult) {
                return;
            }

            const storedResult = getMatchResultData(event.data);
            if (!storedResult) {
                return;
            }

            try {
                const response = await axios.post<BaseEventLog>(
                    '/api/eventlog',
                    {
                        eventType: EventType.GameResult,
                        data: storedResult,
                        logtime: event.logtime,
                    }
                );

                const savedMatch = parseMatchHistoryEntry(response.data);
                if (!savedMatch) {
                    throw new Error('Saved match result is invalid');
                }

                setMatchHistory((currentHistory) =>
                    [...currentHistory, savedMatch].slice(
                        -MAX_MATCH_HISTORY_ENTRIES
                    )
                );
            } catch (error) {
                console.error('Failed to save match result:', error);
            }
        },
        [isSpectator]
    );

    return { matchHistory, saveMatchResult };
}
