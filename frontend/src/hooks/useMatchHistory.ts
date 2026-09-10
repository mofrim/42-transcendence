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

function createMatchHistoryEntry(
    id: number,
    data: EventData,
    tstamp: Date
): EventLogEntry {
    let result = 'Draw';
    if (data.outcome === 'won') {
        result = 'Win';
    } else if (data.outcome === 'lost') {
        result = 'Loss';
    }

    return {
        id: String(id),
        timestamp: MATCH_HISTORY_DATE_TIME_FORMAT.format(tstamp),
        description: `${data.game}: ${result} vs ${data.opponentNickname}`,
    };
}

function parseTicTacToeMatch(event: BaseEventLog): EventLogEntry | null {
    if (event.eventType !== EventType.GameResult) {
        return null;
    }

    try {
        const data: EventData = event.data;
        if (
            data.game !== 'Tic-Tac-Toe' ||
            (data.outcome !== 'won' &&
                data.outcome !== 'lost' &&
                data.outcome !== 'draw') ||
            typeof data.opponentNickname !== 'string' ||
            data.opponentNickname.trim().length === 0
        ) {
            return null;
        }

        return createMatchHistoryEntry(
            // as all events come from DB they will safely have an id
            event.id!,
            {
                game: data.game,
                outcome: data.outcome,
                opponentNickname: data.opponentNickname,
            },
            event.logtime
        );
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
                    .map(parseTicTacToeMatch)
                    .filter((match): match is EventLogEntry => match !== null);

                setMatchHistory(history.slice(-MAX_MATCH_HISTORY_ENTRIES));
            } catch (error) {
                if (!controller.signal.aborted) {
                    console.error(
                        'Failed to load Tic-Tac-Toe match history:',
                        error
                    );
                }
            }
        };

        void loadMatchHistory();

        return () => {
            controller.abort();
        };
    }, [isSpectator, userId]);

    const saveTicTacToeMatch = useCallback(
        async (event: GameEvent): Promise<void> => {
            if (isSpectator || event.data.game !== 'Tic-Tac-Toe') {
                return;
            }

            // QUESTION is this really so clear that all fields will be set?
            const storedResult: EventData = {
                game: event.data.game!,
                outcome: event.data.outcome!,
                opponentNickname: event.data.opponentNickname!,
            };

            const timestamp = new Date();

            try {
                const response = await axios.post<BaseEventLog>(
                    '/api/eventlog',
                    {
                        eventType: EventType.GameResult,
                        data: storedResult,
                        logtime: timestamp,
                    }
                );

                const savedMatch = createMatchHistoryEntry(
                    response.data.id!,
                    storedResult,
                    timestamp
                );

                setMatchHistory((currentHistory) =>
                    [...currentHistory, savedMatch].slice(
                        -MAX_MATCH_HISTORY_ENTRIES
                    )
                );
            } catch (error) {
                console.error(
                    'Failed to save Tic-Tac-Toe match result:',
                    error
                );
            }
        },
        [isSpectator]
    );

    return { matchHistory, saveTicTacToeMatch };
}
