import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { EventType, type BaseEventLog } from 'common/sharedTypes';
import type { GameResultEvent } from '../game/main';
import type { EventLogEntry } from '../ui/ingame/EventLogItems';

const EVENT_LOG_HISTORY_LIMIT = 50;
const MAX_MATCH_HISTORY_ENTRIES = 10;

type StoredTicTacToeResult = Pick<
    GameResultEvent,
    'game' | 'outcome' | 'opponentNickname'
> & {
    readonly playedAt: string;
};

type UseMatchHistoryOptions = {
    readonly nickname: string;
    readonly isSpectator: boolean;
};

function createMatchHistoryEntry(
    id: number,
    data: StoredTicTacToeResult
): EventLogEntry {
    let result = 'Draw';
    if (data.outcome === 'won') {
        result = 'Win';
    } else if (data.outcome === 'lost') {
        result = 'Loss';
    }

    return {
        id: String(id),
        timestamp: new Date(data.playedAt).toLocaleString(undefined, {
            dateStyle: 'short',
            timeStyle: 'short',
        }),
        description: `${data.game}: ${result} vs ${data.opponentNickname}`,
    };
}

function parseTicTacToeMatch(event: BaseEventLog): EventLogEntry | null {
    if (event.eventType !== EventType.GameResult) {
        return null;
    }

    try {
        const data = JSON.parse(event.data) as Partial<StoredTicTacToeResult>;
        if (
            data.game !== 'Tic-Tac-Toe' ||
            typeof data.playedAt !== 'string' ||
            Number.isNaN(Date.parse(data.playedAt)) ||
            (data.outcome !== 'won' &&
                data.outcome !== 'lost' &&
                data.outcome !== 'draw') ||
            typeof data.opponentNickname !== 'string' ||
            data.opponentNickname.trim().length === 0
        ) {
            return null;
        }

        return createMatchHistoryEntry(event.id, {
            game: data.game,
            playedAt: data.playedAt,
            outcome: data.outcome,
            opponentNickname: data.opponentNickname,
        });
    } catch {
        return null;
    }
}

export function useMatchHistory({
    nickname,
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
                            user: nickname,
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
    }, [isSpectator, nickname]);

    const saveTicTacToeMatch = useCallback(
        async (event: GameResultEvent): Promise<void> => {
            if (isSpectator || event.game !== 'Tic-Tac-Toe') {
                return;
            }

            const storedResult: StoredTicTacToeResult = {
                game: event.game,
                playedAt: new Date().toISOString(),
                outcome: event.outcome,
                opponentNickname: event.opponentNickname,
            };

            try {
                const response = await axios.post<BaseEventLog>(
                    '/api/eventlog',
                    {
                        eventType: EventType.GameResult,
                        data: JSON.stringify(storedResult),
                        user: nickname,
                    }
                );

                const savedMatch = createMatchHistoryEntry(
                    response.data.id,
                    storedResult
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
        [isSpectator, nickname]
    );

    return { matchHistory, saveTicTacToeMatch };
}
