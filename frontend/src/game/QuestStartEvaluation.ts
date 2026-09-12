import * as THREE from 'three';
import {
    PlayerState,
    START_EVALUATION_QUEST_ID,
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
            START_EVALUATION_QUEST_ID,
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
        if (interaction.typeID !== START_EVALUATION_QUEST_ID) {
            return false;
        }

        onStart?.();
        await completeQuest(
            START_EVALUATION_QUEST_ID,
            START_EVALUATION_MESSAGE,
            PlayerState.Strong
        );

        // TODO: Do small quiz or something here to simulate evaluation. For now, just wait a few seconds.
        await completeQuest(
            START_EVALUATION_QUEST_ID,
            EVALUATION_COMPLETE_MESSAGE,
            PlayerState.Victory
        );

        this.interaction.reset(false);
        onFinished?.();
        return true;
    }
}
