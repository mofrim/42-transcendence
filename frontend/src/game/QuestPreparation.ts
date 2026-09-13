import * as THREE from 'three';
import {
    PlayerState,
    QUESTS_OBJ,
    type PreparationQuestId,
    type QuestCompleteHandler,
} from 'ftr-common/sharedTypes';

import { EVALUATION_TERMINAL_POSITION, Interaction } from './interaction';
import type { PlayerAnimationState } from './player';

type PreparationQuestDefinition = {
    readonly position: THREE.Vector3;
    readonly interactionRange?: THREE.Vector3;
    readonly successMessage: string;
    readonly animation: PlayerAnimationState;
    readonly callbackBeforeCompletion?: boolean;
};

const PREPARATION_QUEST_DEFINITIONS: Readonly<
    Record<PreparationQuestId, PreparationQuestDefinition>
> = {
    [QUESTS_OBJ.RUBBER_DUCK_QUEST_ID.id]: {
        position: new THREE.Vector3(15.5, 0, -24),
        successMessage: 'Found the duck 🦆! One less thing to worry about.',
        animation: PlayerState.Surprised,
    },
    [QUESTS_OBJ.COFFEE_QUEST_ID.id]: {
        position: new THREE.Vector3(24.5, 0, -8),
        successMessage: 'Ahh ☕ much better... Now I can finally think!',
        animation: PlayerState.Drinking,
    },
    [QUESTS_OBJ.PAPER_QUEST_ID.id]: {
        position: new THREE.Vector3(12.2, 0, -10.5),
        interactionRange: new THREE.Vector3(1.3, 2, 1.3),
        successMessage:
            'I found some paper 📃! Now I can finally take some notes.',
        animation: PlayerState.ThumbsUp,
    },
    [QUESTS_OBJ.COMPUTER_LOGIN_QUEST_ID.id]: {
        position: EVALUATION_TERMINAL_POSITION,
        successMessage:
            'Great, the computer is ready. Just a few more steps to go!',
        animation: PlayerState.ThumbsUp,
        callbackBeforeCompletion: true,
    },
};

export class PreparationQuest {
    readonly interaction: Interaction;
    private readonly definition: PreparationQuestDefinition;

    constructor(
        scene: THREE.Scene,
        private readonly questId: PreparationQuestId,
        defaultInteractionRange: THREE.Vector3
    ) {
        this.definition = PREPARATION_QUEST_DEFINITIONS[questId]!;
        const interactionRange =
            this.definition.interactionRange ?? defaultInteractionRange;

        this.interaction = new Interaction(
            scene,
            questId,
            this.definition.position,
            interactionRange,
            true
        );
    }

    async handleInteraction(
        interaction: Interaction,
        completeQuest: QuestCompleteHandler<PlayerAnimationState>,
        onHandled?: () => void
    ): Promise<boolean> {
        if (interaction.typeID !== this.questId) {
            return false;
        }

        if (this.definition.callbackBeforeCompletion === true) {
            onHandled?.();
        }

        await completeQuest(
            this.questId,
            this.definition.successMessage,
            this.definition.animation
        );

        if (this.definition.callbackBeforeCompletion !== true) {
            onHandled?.();
        }

        this.interaction.disableInteraction();
        return true;
    }
}
