import * as THREE from 'three';
import {
    QUESTS_OBJ,
    PlayerState,
    type QuestDialogHandler,
} from 'ftr-common/sharedTypes';

import {
    EVENT_SPACE_DOOR_A_INTERACTION_ID,
    EVENT_SPACE_DOOR_B_INTERACTION_ID,
    Interaction,
} from './interaction';
import type { PlayerAnimationState } from './player';

const EVENT_SPACE_DOOR_A_POSITION = new THREE.Vector3(15.5, 3.72, -16.85);
const EVENT_SPACE_DOOR_B_POSITION = new THREE.Vector3(16.7, 3.72, -8.5);
const EVENT_SPACE_LOCKED_MESSAGE =
    "I've got an evaluation to finish first. The championship can wait a little longer.";
const EVENT_SPACE_DEV_MESSAGE =
    'DEV NOTE: Door opens now for testing purposes. Remove this later.';

export class EventSpaceQuest {
    readonly interactions: readonly [Interaction, Interaction];
    private traversalStarted = false;
    private completed = false;

    constructor(scene: THREE.Scene, interactionRange: THREE.Vector3) {
        this.interactions = [
            new Interaction(
                scene,
                EVENT_SPACE_DOOR_A_INTERACTION_ID,
                EVENT_SPACE_DOOR_A_POSITION,
                interactionRange,
                true
            ),
            new Interaction(
                scene,
                EVENT_SPACE_DOOR_B_INTERACTION_ID,
                EVENT_SPACE_DOOR_B_POSITION,
                interactionRange,
                true
            ),
        ];
    }

    reset(): void {
        for (const interaction of this.interactions) {
            interaction.reset(true);
        }
        this.traversalStarted = false;
        this.completed = false;
    }

    disableInteractions(): void {
        for (const interaction of this.interactions) {
            interaction.disableInteraction();
        }
    }

    async handleInteraction(
        interaction: Interaction,
        playDialog: QuestDialogHandler<PlayerAnimationState>
    ): Promise<boolean> {
        if (!this.interactions.includes(interaction)) {
            return false;
        }

        await playDialog(EVENT_SPACE_LOCKED_MESSAGE, PlayerState.Angry);

        // TODO: JUST INFO: REMOVE THAT LATER
        await playDialog(EVENT_SPACE_DEV_MESSAGE, PlayerState.Angry);
        return true;
    }

    updateTraversal(
        interaction: Interaction | null,
        doorsOpen: boolean
    ): string | null {
        if (!doorsOpen || this.completed) {
            return null;
        }

        if (interaction !== null && this.interactions.includes(interaction)) {
            this.traversalStarted = true;
            return null;
        }

        if (!this.traversalStarted) {
            return null;
        }

        this.completed = true;
        this.traversalStarted = false;
        return QUESTS_OBJ.ENTER_EVENT_SPACE_QUEST_ID.id;
    }
}
