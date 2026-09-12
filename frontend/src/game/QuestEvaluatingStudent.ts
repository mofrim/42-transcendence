import * as THREE from 'three';
import {
    EVALUATING_STUDENT_QUEST_ID,
    PlayerState,
    type QuestCompleteHandler,
    type QuestDialogHandler,
} from 'ftr-common/sharedTypes';

import {
    EVALUATION_TERMINAL_POSITION,
    EVALUATOR_LOCATION_INTERACTION_ID,
    Interaction,
} from './interaction';
import type { PlayerAnimationState } from './player';

const EVALUATING_STUDENT_POSITION = new THREE.Vector3(4, 0, -22.5);
const EVALUATOR_LOCATION_MESSAGE =
    "Someone's been assigned to my evaluation. They're at c1r12s2. Let's go.";
const EVALUATING_STUDENT_SUCCESS_MESSAGE =
    'Found him! Time to head back and kick off the evaluation.';

export class EvaluatingStudentQuest {
    readonly interactions: readonly [Interaction, Interaction];

    get studentInteraction(): Interaction {
        return this.interactions[1];
    }

    constructor(scene: THREE.Scene, interactionRange: THREE.Vector3) {
        this.interactions = [
            new Interaction(
                scene,
                EVALUATOR_LOCATION_INTERACTION_ID,
                EVALUATION_TERMINAL_POSITION,
                interactionRange,
                false
            ),
            new Interaction(
                scene,
                EVALUATING_STUDENT_QUEST_ID,
                EVALUATING_STUDENT_POSITION,
                interactionRange,
                false
            ),
        ];
    }

    unlock(): void {
        for (const interaction of this.interactions) {
            interaction.enableInteraction();
        }
    }

    reset(): void {
        for (const interaction of this.interactions) {
            interaction.reset(false);
        }
    }

    async handleInteraction(
        interaction: Interaction,
        playDialog: QuestDialogHandler<PlayerAnimationState>,
        completeQuest: QuestCompleteHandler<PlayerAnimationState>,
        onEvaluatorLocation?: () => void,
        onStudentFound?: () => void
    ): Promise<boolean> {
        if (interaction.typeID === EVALUATOR_LOCATION_INTERACTION_ID) {
            onEvaluatorLocation?.();
            await playDialog(EVALUATOR_LOCATION_MESSAGE, PlayerState.ThumbsUp);
            return true;
        }

        if (interaction.typeID !== EVALUATING_STUDENT_QUEST_ID) {
            return false;
        }

        await completeQuest(
            EVALUATING_STUDENT_QUEST_ID,
            EVALUATING_STUDENT_SUCCESS_MESSAGE,
            PlayerState.Strong
        );
        for (const questInteraction of this.interactions) {
            questInteraction.disableInteraction();
        }
        onStudentFound?.();
        return true;
    }
}
