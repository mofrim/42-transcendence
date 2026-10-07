import * as THREE from 'three';
import {
    PlayerState,
    QUESTS,
    type QuestCompleteHandler,
} from 'ftr-common/sharedTypes';

import { Interaction } from './interaction';
import type { PlayerAnimationState } from './player';

/** auf der Map Plane209 ist rechts neben der Eingangstür (haustür) des Gebäudes. */
const FRONT_DOOR_POSITION = new THREE.Vector3(
    11.188980389089282,
    0.0019360799342356128,
    -0.4070003350462352
);
const FRONT_DOOR_SUCCESS_MESSAGE = 'Token accepted. Welcome to 42 campus!';

/** Enter 42 campus via token */
export class FrontDoorQuest {
    readonly interaction: Interaction;

    constructor(scene: THREE.Scene, interactionRange: THREE.Vector3) {
        this.interaction = new Interaction(
            scene,
            QUESTS.ENTER_CAMPUS_TOKEN_QUEST_ID.id,
            FRONT_DOOR_POSITION,
            /**  Der Radius, in dem die Taste E gedrückt werden kann */
            interactionRange,
            /** wird erst wenn token gefunden aktiv */
            false
        );
    }

    async handleInteraction(
        interaction: Interaction,
        completeQuest: QuestCompleteHandler<PlayerAnimationState>
    ): Promise<boolean> {
        if (interaction.typeID !== QUESTS.ENTER_CAMPUS_TOKEN_QUEST_ID.id) {
            return false;
        }

        await completeQuest(
            QUESTS.ENTER_CAMPUS_TOKEN_QUEST_ID.id,
            FRONT_DOOR_SUCCESS_MESSAGE,
            PlayerState.ThumbsUp
        );
        this.interaction.reset(false);
        // TODO: add animation for opening the door
        /** erlaube nun die Öffnung */
        return true;
    }
}
