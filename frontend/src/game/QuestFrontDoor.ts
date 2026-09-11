import * as THREE from 'three';
import {
    PlayerState,
    ENTER_CAMPUS_TOKEN_QUEST_ID,
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

type CompleteQuest = (
    questId: string,
    message: string,
    animation: PlayerAnimationState
) => Promise<void>;

/** Enter 42 campus via token */
export class FrontDoorQuest {
    readonly interaction: Interaction;

    constructor(scene: THREE.Scene, interactionRange: THREE.Vector3) {
        this.interaction = new Interaction(
            scene,
            ENTER_CAMPUS_TOKEN_QUEST_ID,
            FRONT_DOOR_POSITION.clone(),
            /**  Der Radius, in dem die Taste E gedrückt werden kann */
            interactionRange,
            /** wird erst wenn token gefunden aktiv */
            false
        );
    }

    unlock(): void {
        this.interaction.enableInteraction();
    }

    reset(): void {
        this.interaction.removeEngageButton();
        this.interaction.disableInteraction();
    }

    async handleInteraction(
        interaction: Interaction,
        completeQuest: CompleteQuest
    ): Promise<boolean> {
        if (interaction.typeID !== ENTER_CAMPUS_TOKEN_QUEST_ID) {
            return false;
        }

        await completeQuest(
            ENTER_CAMPUS_TOKEN_QUEST_ID,
            FRONT_DOOR_SUCCESS_MESSAGE,
            PlayerState.ThumbsUp
        );
        this.reset();
        return true;
    }
}
