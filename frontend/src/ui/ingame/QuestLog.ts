import {
    BLACK_HOLE_QUEST_ID,
    MEET_PLAYER_QUEST_ID,
    RPS_WIN_QUEST_ID,
    TTT_WIN_QUEST_ID,
    GameEvent,
    EventType,
    type QuestLogEntry,
} from 'ftr-common/sharedTypes';

const COUNTDOWN_FORMAT = new Intl.DurationFormat('en', {
    style: 'digital',
    hoursDisplay: 'auto',
    minutes: '2-digit',
    seconds: '2-digit',
});

export type ResolvedQuestLogEntry = QuestLogEntry & {
    readonly completed: boolean;
};

export type QuestStatusChange = {
    readonly questId: string;
    readonly questText: string;
    readonly completed: boolean;
};

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
