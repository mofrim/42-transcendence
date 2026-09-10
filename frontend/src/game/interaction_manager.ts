import * as THREE from 'three';
import { Interaction } from './interaction';

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
            new THREE.Vector3(1, 2, 1),
            true
        );
        const interaction2 = new Interaction(
            scene,
            'GET_COFFEE',
            new THREE.Vector3(24.5, 0, -8),
            new THREE.Vector3(1, 2, 1),
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
            new THREE.Vector3(1, 2, 1),
            true
        );
        const interaction5 = new Interaction(
            scene,
            'WHERE_IS_EVALUATOR',
            new THREE.Vector3(8, 3.72, -14),
            new THREE.Vector3(1, 2, 1),
            false
        );
        const interaction6 = new Interaction(
            scene,
            'FIND_EVALUATING_STUDENT',
            new THREE.Vector3(4, 0, -22.5),
            new THREE.Vector3(1, 2, 1),
            false
        );
        const interaction7 = new Interaction(
            scene,
            'START_EVALUATION',
            new THREE.Vector3(8, 3.72, -14),
            new THREE.Vector3(1, 2, 1),
            false
        );

        const interaction8 = new Interaction(
            scene,
            'EVENT_SPACE_DOOR_A',
            new THREE.Vector3(15.5, 3.72, -16.85),
            new THREE.Vector3(1, 2, 1),
            true
        );
        const interaction9 = new Interaction(
            scene,
            'EVENT_SPACE_DOOR_B',
            new THREE.Vector3(16.7, 3.72, -8.5),
            new THREE.Vector3(1, 2, 1),
            true
        );

        this.add(interaction1);
        this.add(interaction2);
        this.add(interaction3);
        this.add(interaction4);
        this.add(interaction5);
        this.add(interaction6);
        this.add(interaction7);

        this.add(interaction8);
        this.add(interaction9);

        this.interactionStartingState();
    }

    add(interaction: Interaction): void {
        this.interactions.push(interaction);
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
