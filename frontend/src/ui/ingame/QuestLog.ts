import { ENTER_EVENT_SPACE_QUEST_ID } from '../../game/main';
import {
    ENTER_CAMPUS_TOKEN_QUEST_ID,
    FIND_LOST_DROPPED_TOKEN_QUEST_ID,
} from '../../game/interaction';
import { GameEvent, EventType } from 'ftr-common/sharedTypes';

export const BLACK_HOLE_QUEST_ID = 'avoid-blackhole';
export const MEET_PLAYER_QUEST_ID = 'meet-player';
export const RPS_WIN_QUEST_ID = 'win-rps-minigame';
export const START_EVALUATION_QUEST_ID = 'START_EVALUATION';
export const TTT_WIN_QUEST_ID = 'win-ttt-minigame';

const COUNTDOWN_FORMAT = new Intl.DurationFormat('en', {
    style: 'digital',
    hoursDisplay: 'auto',
    minutes: '2-digit',
    seconds: '2-digit',
});

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
        id: FIND_LOST_DROPPED_TOKEN_QUEST_ID,
        text: 'Find lost dropped Token',
    },
    {
        id: ENTER_CAMPUS_TOKEN_QUEST_ID,
        text: 'Enter 42 campus via token',
    },
    {
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
        id: MEET_PLAYER_QUEST_ID,
        text: 'Find another Student',
    },
    {
        id: 'FIND_EVALUATING_STUDENT',
        text: 'Find the Evaluating Student',
    },
    {
        id: START_EVALUATION_QUEST_ID,
        text: 'Start Evaluation',
    },
    {
        id: ENTER_EVENT_SPACE_QUEST_ID,
        text: 'Enter the Event Space',
    },
    // Secondary quests, once blackhole is disabled ?
    {
        id: RPS_WIN_QUEST_ID,
        text: 'Win Rock-Paper-Scissors',
    },
    {
        id: TTT_WIN_QUEST_ID,
        text: 'Win Tic-Tac-Toe',
    },
    {
        id: BLACK_HOLE_QUEST_ID,
        text: "Don't get blackholed",
    },
];

/** blackhole timer */
export function formatQuestCountdown(totalSeconds: number): string {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return COUNTDOWN_FORMAT.format({ minutes, seconds });
}

function isQuestCompleted(
    quest: QuestLogEntry,
    blackHoleQuestCompleted: boolean,
    completedQuestIds: ReadonlySet<string>
): boolean {
    if (quest.id === BLACK_HOLE_QUEST_ID) {
        return blackHoleQuestCompleted;
    }

    return quest.completed === true || completedQuestIds.has(quest.id);
}

export function resolveQuestLogEntries(
    quests: readonly QuestLogEntry[],
    completedQuestIds: readonly string[],
    blackHoleQuestCompleted: boolean
): ResolvedQuestLogEntry[] {
    const completedQuestIdSet = new Set(completedQuestIds);

    return quests.map((quest) => ({
        ...quest,
        completed: isQuestCompleted(
            quest,
            blackHoleQuestCompleted,
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
        return `✅ Quest succeeded: ${change.questText}`;
    }

    return `❌ Quest failed: ${change.questText}`;
}

function getCompletedQuestId(event: GameEvent): string | null {
    if (event.eventType === EventType.QuestCompleted) {
        return event.data.questId!;
    }

    if (event.eventType === EventType.PlayerInRange) {
        return MEET_PLAYER_QUEST_ID;
    }

    if (
        event.eventType !== EventType.GameResult ||
        event.data.outcome !== 'won'
    ) {
        return null;
    }

    if (event.data.game === 'Rock-Paper-Scissors') {
        return RPS_WIN_QUEST_ID;
    }

    return TTT_WIN_QUEST_ID;
}

export function applyQuestCompletionEvent(
    currentQuestIds: string[],
    event: GameEvent
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
