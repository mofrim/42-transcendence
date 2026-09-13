import * as THREE from 'three';
import {
    PlayerState,
    QUESTS_OBJ,
    type QuestCompleteHandler,
} from 'ftr-common/sharedTypes';

import { EVALUATION_TERMINAL_POSITION, Interaction } from './interaction';
import type { PlayerAnimationState } from './player';

const START_EVALUATION_MESSAGE = "Evaluation is starting. Let's go!";
const EVALUATION_COMPLETE_MESSAGE =
    "Evaluation is DONE! Let's go to the championship!";

export class StartEvaluationQuest {
    readonly interaction: Interaction;

    constructor(scene: THREE.Scene, interactionRange: THREE.Vector3) {
        this.interaction = new Interaction(
            scene,
            QUESTS_OBJ.START_EVALUATION_QUEST_ID.id,
            EVALUATION_TERMINAL_POSITION,
            interactionRange,
            false
        );
    }

    async handleInteraction(
        interaction: Interaction,
        completeQuest: QuestCompleteHandler<PlayerAnimationState>,
        onStart?: () => void,
        onFinished?: () => void
    ): Promise<boolean> {
        if (interaction.typeID !== QUESTS_OBJ.START_EVALUATION_QUEST_ID.id) {
            return false;
        }

        onStart?.();
        await completeQuest(
            QUESTS_OBJ.START_EVALUATION_QUEST_ID.id,
            START_EVALUATION_MESSAGE,
            PlayerState.Strong
        );

        // TODO: Do small quiz or something here to simulate evaluation. For now, just wait a few seconds.
        await completeQuest(
            QUESTS_OBJ.START_EVALUATION_QUEST_ID.id,
            EVALUATION_COMPLETE_MESSAGE,
            PlayerState.Victory
        );

        this.interaction.reset(false);
        onFinished?.();
        return true;
    }
}
