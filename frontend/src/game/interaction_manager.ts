import * as THREE from 'three';
import { ENTER_CAMPUS_TOKEN_QUEST_ID, Interaction } from './interaction';

const INTERACTION_RANGE = new THREE.Vector3(1, 2, 1);

export class InteractionManager {
    interactions: Interaction[] = [];
    currentInteraction: Interaction | null = null;

    constructor(scene: THREE.Scene) {
        this.initInteractions(scene);
    }

    initInteractions(scene: THREE.Scene): void {
        const interaction1 = new Interaction(
            scene,
            'FIND_RUBBERDUCK',
            new THREE.Vector3(15.5, 0, -24),
            INTERACTION_RANGE,
            true
        );
        const interaction2 = new Interaction(
            scene,
            'GET_COFFEE',
            new THREE.Vector3(24.5, 0, -8),
            INTERACTION_RANGE,
            true
        );
        const interaction3 = new Interaction(
            scene,
            'GET_PAPER',
            new THREE.Vector3(12.2, 0, -10.5),
            new THREE.Vector3(1.3, 2, 1.3),
            true
        );
        const interaction4 = new Interaction(
            scene,
            'LOGIN_COMPUTER',
            new THREE.Vector3(8, 3.72, -14),
            INTERACTION_RANGE,
            true
        );
        const interaction5 = new Interaction(
            scene,
            'WHERE_IS_EVALUATOR',
            new THREE.Vector3(8, 3.72, -14),
            INTERACTION_RANGE,
            false
        );
        const interaction6 = new Interaction(
            scene,
            'FIND_EVALUATING_STUDENT',
            new THREE.Vector3(4, 0, -22.5),
            INTERACTION_RANGE,
            false
        );
        const interaction7 = new Interaction(
            scene,
            'START_EVALUATION',
            new THREE.Vector3(8, 3.72, -14),
            INTERACTION_RANGE,
            false
        );

        const interaction8 = new Interaction(
            scene,
            'EVENT_SPACE_DOOR_A',
            new THREE.Vector3(15.5, 3.72, -16.85),
            INTERACTION_RANGE,
            true
        );
        const interaction9 = new Interaction(
            scene,
            'EVENT_SPACE_DOOR_B',
            new THREE.Vector3(16.7, 3.72, -8.5),
            INTERACTION_RANGE,
            true
        );
        const interaction10 = new Interaction(
            scene,
            ENTER_CAMPUS_TOKEN_QUEST_ID,
            new THREE.Vector3(
                11.188980389089282,
                0.0019360799342356128,
                -0.4070003350462352
            ),
            INTERACTION_RANGE,
            true
        );

        this.interactions.push(
            interaction1,
            interaction2,
            interaction3,
            interaction4,
            interaction5,
            interaction6,
            interaction7,
            interaction8,
            interaction9,
            interaction10
        );

        this.interactionStartingState();
    }

    enableInteraction(typeID: string): void {
        this.interactions
            .find((interaction) => interaction.typeID === typeID)
            ?.enableInteraction();
    }

    disableInteraction(typeID: string): void {
        this.interactions
            .find((interaction) => interaction.typeID === typeID)
            ?.disableInteraction();
    }

    interactionStartingState(): void {
        this.currentInteraction = null;
        for (const interaction of this.interactions) {
            interaction.removeEngageButton();
        }

        this.enableInteraction('FIND_RUBBERDUCK');
        this.enableInteraction('GET_COFFEE');
        this.enableInteraction('GET_PAPER');
        this.enableInteraction('LOGIN_COMPUTER');
        this.enableInteraction('EVENT_SPACE_DOOR_A');
        this.enableInteraction('EVENT_SPACE_DOOR_B');
        this.enableInteraction(ENTER_CAMPUS_TOKEN_QUEST_ID);

        this.disableInteraction('WHERE_IS_EVALUATOR');
        this.disableInteraction('FIND_EVALUATING_STUDENT');
        this.disableInteraction('START_EVALUATION');
    }

    OnActivatePress(playerPosition: THREE.Vector3): void {
        this.currentInteraction =
            this.interactions.find(
                (interaction) =>
                    interaction.zone.containsPoint(playerPosition) &&
                    interaction.enabled
            ) ?? null;

        this.interact();
    }

    update(playerPosition: THREE.Vector3): Interaction | null {
        let interactionInZone: Interaction | null = null;

        for (const interaction of this.interactions) {
            const isInZone = interaction.zone.containsPoint(playerPosition);

            if (interactionInZone === null && isInZone) {
                interactionInZone = interaction;
            }

            if (isInZone && interaction.enabled) interaction.showEngageButton();
            else interaction.removeEngageButton();
        }

        return interactionInZone;
    }

    // Called when the player presses the interaction key
    interact(): void {
        if (this.currentInteraction && this.currentInteraction.enabled) {
            this.onInteraction?.(this.currentInteraction);
        }
    }

    // Callback
    onInteraction?: (interaction: Interaction) => void;
}
