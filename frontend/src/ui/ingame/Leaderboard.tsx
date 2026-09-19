import axios from 'axios';
import { useEffect, useState } from 'react';
import {
    API_EVENTLOG,
    BLACK_HOLE_DURATION_SECONDS,
    EventType,
    QUESTS,
    type ApiResponse,
    type BaseEventLog,
    type EventDataGameResult,
    type EventDataQuestCompleted,
} from 'ftr-common/sharedTypes';

type LeaderboardProps = {
    readonly currentNickname: string;
    readonly isOpen: boolean;
};

type LeaderboardEntry = {
    readonly nickname: string;
    readonly wins: number;
    readonly draws: number;
    readonly losses: number;
    readonly games: number;
    readonly quests: number;
    readonly blackHoles: number;
    /**
     * Black Haole Time Out Timer minus der Startzeit die
     * aktuell bei 5 Minuten liegt,
     * ist die Zeit, die der Spieler gebraucht hat,
     * um die Quest szu erledigen und umso schneller,
     * desto besser.
     */
    readonly bestBlackHoleSecondsRemaining: number | null;
};

type PlayerStats = {
    readonly completedQuestIds: Set<string>;
    readonly countedMatchKeys: Set<string>;
    games: number;
    wins: number;
    draws: number;
    losses: number;
    blackHoles: number;
    sessionStartedAtMs: number | null;
    bestBlackHoleSecondsRemaining: number | null;
};

/** aktuell sinds 13 Quests */
const TOTAL_QUESTS = Object.keys(QUESTS).length;

function calculateQuestProgressPercent(completedQuests: number): number {
    if (TOTAL_QUESTS === 0) {
        return 0;
    }

    return Math.min(100, Math.round((completedQuests / TOTAL_QUESTS) * 100));
}

function getEventTimeMs(logtime: Date | string): number | null {
    let timestamp: number;
    if (logtime instanceof Date) {
        timestamp = logtime.getTime();
    } else {
        timestamp = Date.parse(logtime);
    }

    if (!Number.isFinite(timestamp)) {
        return null;
    }

    return timestamp;
}

function calculateBlackHoleSecondsRemaining(
    sessionStartedAtMs: number,
    completedAtMs: number
): number {
    const elapsedMs = Math.max(0, completedAtMs - sessionStartedAtMs);
    const remainingMs = BLACK_HOLE_DURATION_SECONDS * 1_000 - elapsedMs;
    return Math.max(
        0,
        Math.min(BLACK_HOLE_DURATION_SECONDS, Math.ceil(remainingMs / 1_000))
    );
}

function formatBlackHoleTime(secondsRemaining: number | null): string {
    if (secondsRemaining === null) {
        return '—';
    }

    const minutes = Math.floor(secondsRemaining / 60);
    const seconds = secondsRemaining % 60;
    return minutes + ':' + seconds.toString().padStart(2, '0');
}

function createPlayerStats(): PlayerStats {
    return {
        completedQuestIds: new Set<string>(),
        countedMatchKeys: new Set<string>(),
        games: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        blackHoles: 0,
        sessionStartedAtMs: null,
        bestBlackHoleSecondsRemaining: null,
    };
}

function buildLeaderboard(
    events: readonly BaseEventLog[],
    currentNickname: string
): LeaderboardEntry[] {
    const players = new Map<string, PlayerStats>();
    const chronologicalEvents = events.toSorted(
        (left, right) => (left.id ?? 0) - (right.id ?? 0)
    );

    for (const event of chronologicalEvents) {
        const nickname = event.user?.nickname?.trim();
        if (!nickname) {
            continue;
        }

        const stats = players.getOrInsertComputed(nickname, createPlayerStats);
        const eventTimeMs = getEventTimeMs(event.logtime);

        // A local PlayerJoined event uses data:null and marks the beginning of
        // a fresh five-minute Black Hole window. Remote join notifications use
        // playerId data and therefore do not reset this player's timer.
        if (event.eventType === EventType.PlayerJoined) {
            if (event.data === null && eventTimeMs !== null) {
                stats.sessionStartedAtMs = eventTimeMs;
            }
            continue;
        }

        if (event.eventType === EventType.PlayerLeft) {
            if (event.data === null) {
                stats.sessionStartedAtMs = null;
            }
            continue;
        }

        if (event.eventType === EventType.QuestCompleted) {
            const data = event.data as EventDataQuestCompleted;
            if (typeof data?.questId === 'string') {
                stats.completedQuestIds.add(data.questId);
            }

            if (
                data?.questId === QUESTS.START_EVALUATION_QUEST_ID.id &&
                stats.sessionStartedAtMs !== null &&
                eventTimeMs !== null
            ) {
                const secondsRemaining = calculateBlackHoleSecondsRemaining(
                    stats.sessionStartedAtMs,
                    eventTimeMs
                );
                stats.bestBlackHoleSecondsRemaining = Math.max(
                    stats.bestBlackHoleSecondsRemaining ?? 0,
                    secondsRemaining
                );
                stats.sessionStartedAtMs = null;
            }
            continue;
        }

        if (event.eventType === EventType.Blackholed) {
            stats.blackHoles += 1;
            if (stats.sessionStartedAtMs !== null) {
                stats.bestBlackHoleSecondsRemaining ??= 0;
                stats.sessionStartedAtMs = null;
            }
            continue;
        }

        if (event.eventType !== EventType.GameResult) {
            continue;
        }

        const data = event.data as EventDataGameResult;
        if (
            !data ||
            typeof data.game !== 'string' ||
            typeof data.outcome !== 'string' ||
            typeof data.opponentNickname !== 'string'
        ) {
            continue;
        }

        const matchKey = JSON.stringify([
            event.logtime,
            data.game,
            data.outcome,
            data.opponentNickname,
        ]);

        if (stats.countedMatchKeys.has(matchKey)) {
            continue;
        }

        stats.countedMatchKeys.add(matchKey);
        stats.games += 1;

        if (data.outcome === 'won') {
            stats.wins += 1;
        } else if (data.outcome === 'draw') {
            stats.draws += 1;
        } else if (data.outcome === 'lost') {
            stats.losses += 1;
        }
    }

    const normalizedCurrentNickname = currentNickname.trim();
    if (normalizedCurrentNickname) {
        players.getOrInsertComputed(
            normalizedCurrentNickname,
            createPlayerStats
        );
    }

    return Array.from(players, ([nickname, stats]) => ({
        nickname,
        wins: stats.wins,
        draws: stats.draws,
        losses: stats.losses,
        games: stats.games,
        quests: stats.completedQuestIds.size,
        blackHoles: stats.blackHoles,
        bestBlackHoleSecondsRemaining: stats.bestBlackHoleSecondsRemaining,
    })).toSorted(
        (left, right) =>
            right.wins - left.wins ||
            right.quests - left.quests ||
            left.nickname.localeCompare(right.nickname)
    );
}

export function Leaderboard({ currentNickname, isOpen }: LeaderboardProps) {
    const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [loadFailed, setLoadFailed] = useState(false);

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        const controller = new AbortController();

        const loadLeaderboard = async (): Promise<void> => {
            setIsLoading(true);
            setLoadFailed(false);

            try {
                // TODO: load from database instead of loading from the temporary in-memory event log?

                const response = await axios.get<ApiResponse<BaseEventLog[]>>(
                    API_EVENTLOG.all,
                    {
                        signal: controller.signal,
                    }
                );

                setEntries(
                    buildLeaderboard(response.data.data ?? [], currentNickname)
                );
            } catch (error) {
                if (controller.signal.aborted) {
                    return;
                }

                console.error('Failed to load leaderboard:', error);
                setLoadFailed(true);
            } finally {
                if (!controller.signal.aborted) {
                    setIsLoading(false);
                }
            }
        };

        void loadLeaderboard();

        return () => {
            controller.abort();
        };
    }, [currentNickname, isOpen]);

    if (entries.length === 0) {
        let message = 'No players yet.';

        if (isLoading) {
            message = 'Loading leaderboard...';
        } else if (loadFailed) {
            message = 'Leaderboard could not be loaded.';
        }

        return <p className='hud-match-history-empty'>{message}</p>;
    }

    return (
        <div className='hud-leaderboard' role='table' aria-label='Leaderboard'>
            <div
                className='hud-leaderboard-row hud-leaderboard-header'
                role='row'
            >
                <div role='columnheader'>Rank</div>
                <div role='columnheader'>Player</div>
                <div role='columnheader'>Wins</div>
                <div role='columnheader'>Draws</div>
                <div role='columnheader'>Losses</div>
                <div role='columnheader'>Games</div>
                <div role='columnheader'>Quests</div>
                <div role='columnheader'>Black Holes</div>
                <div
                    role='columnheader'
                    title='Best remaining time when the evaluation was started'
                >
                    BH Time Left
                </div>
            </div>
            <div className='hud-leaderboard-body' role='rowgroup'>
                {entries.map((entry, index) => (
                    <div
                        className='hud-leaderboard-row'
                        role='row'
                        key={entry.nickname}
                    >
                        <div role='cell'>{index + 1}.</div>
                        <div role='cell'>{entry.nickname}</div>
                        <div role='cell'>{entry.wins}</div>
                        <div role='cell'>{entry.draws}</div>
                        <div role='cell'>{entry.losses}</div>
                        <div role='cell'>{entry.games}</div>
                        <div role='cell'>
                            {entry.quests} (
                            {calculateQuestProgressPercent(entry.quests)}%)
                        </div>
                        <div role='cell'>{entry.blackHoles}</div>
                        <div role='cell'>
                            {formatBlackHoleTime(
                                entry.bestBlackHoleSecondsRemaining
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
