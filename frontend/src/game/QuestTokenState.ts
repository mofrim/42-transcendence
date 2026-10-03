import { QUESTS } from 'ftr-common/sharedTypes';

export function isLostTokenQuestCompleted(
    completedQuestIds: readonly string[]
): boolean {
    return completedQuestIds.includes(
        QUESTS.FIND_LOST_DROPPED_TOKEN_QUEST_ID.id
    );
}

export function shouldEnableFrontDoorQuest(
    completedQuestIds: readonly string[]
): boolean {
    return (
        isLostTokenQuestCompleted(completedQuestIds) &&
        !completedQuestIds.includes(QUESTS.ENTER_CAMPUS_TOKEN_QUEST_ID.id)
    );
}
