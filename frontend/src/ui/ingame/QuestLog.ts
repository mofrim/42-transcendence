import type { GameRuntimeEvent } from '../../game/main';

export const BLACK_HOLE_QUEST_ID = 'avoid-blackhole';
export const BLACK_HOLE_DURATION_SECONDS = 5 * 60; // 5 minutes in seconds (05:00)
export const MEET_PLAYER_QUEST_ID = 'meet-player';
export const RPS_WIN_QUEST_ID = 'win-rps-minigame';
export const TTT_WIN_QUEST_ID = 'win-ttt-minigame';

export type QuestLogEntry = {
    readonly id: string;
    readonly text: string;
    readonly completed?: boolean;
};

export type ResolvedQuestLogEntry = QuestLogEntry & {
    readonly completed: boolean;
};

export type QuestStatusChange = {
    readonly questId: string;
    readonly questText: string;
    readonly completed: boolean;
};

/** Beispielaufgaben für das Quest Log. */
export const DEFAULT_QUESTS: readonly QuestLogEntry[] = [
    {
        // TODO: logikal quest id for entering campus, maybe use the token or door trigger
        id: 'FIND_RUBBERDUCK',
        text: 'Find the Rubber Duck',
    },
    {
        id: 'GET_COFFEE',
        text: 'Get a Coffee',
    },
    {
        id: 'GET_PAPER',
        text: 'Get a Piece of Paper',
    },
    {
        id: 'LOGIN_COMPUTER',
        text: 'Log In to Computer c2r12s6',
    },
    {
        id: 'FIND_EVALUATING_STUDENT',
        text: 'Find the Evaluating Student',
    },
    {
        id: 'START_EVALUATION',
        text: 'Start Evaluation',
    },
    {
        id: BLACK_HOLE_QUEST_ID,
        text: "Don't get blackholed",
    },

    // Secondary quests, once blackhole is disabled ?
    /* 
    {
        id: RPS_WIN_QUEST_ID,
        text: 'Gewinne eine Runde Schere, Stein, Papier',
    },
    {
        id: TTT_WIN_QUEST_ID,
        text: 'Gewinne eine Runde Tic-Tac-Toe',
    },
    {
        id: MEET_PLAYER_QUEST_ID,
        text: 'Finde einen anderen Student',
    },
    */
];

/** blackhole timer */
export function formatQuestCountdown(totalSeconds: number): string {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return [minutes, seconds]
        .map((part) => String(part).padStart(2, '0'))
        .join(':');
}

function isQuestCompleted(
    quest: QuestLogEntry,
    blackHoleSecondsRemaining: number,
    completedQuestIds: ReadonlySet<string>
): boolean {
    if (quest.id === BLACK_HOLE_QUEST_ID) {
        return blackHoleSecondsRemaining > 0;
    }

    return quest.completed === true || completedQuestIds.has(quest.id);
}

export function resolveQuestLogEntries(
    quests: readonly QuestLogEntry[],
    completedQuestIds: readonly string[],
    blackHoleSecondsRemaining: number
): ResolvedQuestLogEntry[] {
    const completedQuestIdSet = new Set(completedQuestIds);

    return quests.map((quest) => ({
        ...quest,
        completed: isQuestCompleted(
            quest,
            blackHoleSecondsRemaining,
            completedQuestIdSet
        ),
    }));
}

export function getQuestStatusChanges(
    previousQuests: readonly ResolvedQuestLogEntry[] | null,
    currentQuests: readonly ResolvedQuestLogEntry[]
): QuestStatusChange[] {
    if (previousQuests === null) {
        return [];
    }

    const previousStatuses = new Map(
        previousQuests.map((quest) => [quest.id, quest.completed])
    );
    const statusChanges: QuestStatusChange[] = [];

    for (const quest of currentQuests) {
        const previousCompleted = previousStatuses.get(quest.id);

        if (
            previousCompleted === undefined ||
            previousCompleted === quest.completed
        ) {
            continue;
        }

        statusChanges.push({
            questId: quest.id,
            questText: quest.text,
            completed: quest.completed,
        });
    }

    return statusChanges;
}

export function describeQuestStatusChange(change: QuestStatusChange): string {
    if (change.completed) {
        return `✅ Quest abgeschlossen: ${change.questText}`;
    }

    return `❌ Quest fehlgeschlagen: ${change.questText}`;
}

function getCompletedQuestId(event: GameRuntimeEvent): string | null {
    if (event.type === 'player_in_range') {
        return MEET_PLAYER_QUEST_ID;
    }

    if (event.type !== 'game_result' || event.outcome !== 'won') {
        return null;
    }

    if (event.game === 'Rock-Paper-Scissors') {
        return RPS_WIN_QUEST_ID;
    }

    return TTT_WIN_QUEST_ID;
}

export function applyQuestCompletionEvent(
    currentQuestIds: string[],
    event: GameRuntimeEvent
): string[] {
    const completedQuestId = getCompletedQuestId(event);

    if (
        completedQuestId === null ||
        currentQuestIds.includes(completedQuestId)
    ) {
        return currentQuestIds;
    }

    return [...currentQuestIds, completedQuestId];
}
