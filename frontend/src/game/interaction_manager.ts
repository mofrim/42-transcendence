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
            new THREE.Vector3(1, 2, 1)
        );
        const interaction2 = new Interaction(
            scene,
            'GET_COFFEE',
            new THREE.Vector3(24.5, 0, -8),
            new THREE.Vector3(1, 2, 1)
        );
        const interaction3 = new Interaction(
            scene,
            'GET_PAPER',
            new THREE.Vector3(12.5, 0, -10.5),
            new THREE.Vector3(1, 2, 1)
        );
        const interaction4 = new Interaction(
            scene,
            'LOGIN_COMPUTER',
            new THREE.Vector3(8, 3.72, -14),
            new THREE.Vector3(1, 2, 1)
        );
        //const interaction5 = new Interaction(scene, 'START_EVALUATION', new THREE.Vector3(10, 0, 10), new THREE.Vector3(1, 2, 1));

        this.add(interaction1);
        this.add(interaction2);
        this.add(interaction3);
        this.add(interaction4);
        //this.add(interaction5);
    }

    add(interaction: Interaction): void {
        this.interactions.push(interaction);
    }

    OnActivatePress(playerPosition: THREE.Vector3): void {
        this.currentInteraction = null;

        for (const interaction of this.interactions) {
            if (interaction.zone.containsPoint(playerPosition)) {
                // console.log(`Interaction triggered: ${interaction.typeID}`);
                this.currentInteraction = interaction;
                this.interact();
                break;
            }
        }
    }

    update(playerPosition: THREE.Vector3): void {
        for (const interaction of this.interactions) {
            if (interaction.zone.containsPoint(playerPosition))
                interaction.showEngageButton();
            else interaction.removeEngageButton();
        }
    }

    // Called when the player presses the interaction key
    interact(): void {
        if (this.currentInteraction) {
            this.onInteraction?.(this.currentInteraction);
        }
    }

    // Callback
    onInteraction?: (interaction: Interaction) => void;
}
