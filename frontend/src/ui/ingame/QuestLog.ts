import {
    QUESTS,
    EventType,
    GameEvent,
    type QuestLogEntry,
} from 'ftr-common/sharedTypes';

type MinigameName = NonNullable<GameEvent['data']['game']>;

const WIN_QUEST_ID_BY_GAME: ReadonlyMap<MinigameName, string> = new Map([
    ['Rock-Paper-Scissors', QUESTS.RPS_WIN_QUEST_ID.id],
    ['Tic-Tac-Toe', QUESTS.TTT_WIN_QUEST_ID.id],
]);

export type ResolvedQuestLogEntry = QuestLogEntry & {
    readonly completed: boolean;
};

export type QuestStatusChange = {
    readonly questId: string;
    readonly questText: string;
    readonly completed: boolean;
};

function isQuestCompleted(
    quest: QuestLogEntry,
    blackHoleQuestCompleted: boolean,
    completedQuestIds: ReadonlySet<string>
): boolean {
    if (quest.id === QUESTS.BLACK_HOLE_QUEST_ID.id) {
        return blackHoleQuestCompleted;
    }

    return quest.completed === true || completedQuestIds.has(quest.id);
}

export function resolveQuestLogEntries(
    quests: typeof QUESTS,
    completedQuestIds: readonly string[],
    blackHoleQuestCompleted: boolean
): ResolvedQuestLogEntry[] {
    const completedQuestIdSet = new Set(completedQuestIds);

    // build & return an array of ResolvedQuestLogEntries from the quests-obj
    return Object.values(quests).map((quest) => ({
        id: quest.id,
        text: quest.text,
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
        return QUESTS.MEET_PLAYER_QUEST_ID.id;
    }

    if (
        event.eventType !== EventType.GameResult ||
        event.data.outcome !== 'won' ||
        event.data.game === undefined
    ) {
        return null;
    }

    return WIN_QUEST_ID_BY_GAME.get(event.data.game) ?? null;
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
