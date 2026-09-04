import * as THREE from 'three';
import { CanvasTextSprite } from './CanvasTextSprite';

/* import { Player } from './player';
import { Camera } from './camera'; */

/* export enum IID {
    FIND_RUBBERDUCK = 'FIND_RUBBERDUCK',
    GET_COFFEE = 'GET_COFFEE',
    GET_PAPER = 'GET_PAPER',
    LOGIN_COMPUTER = 'LOGIN_COMPUTER',
    START_EVALUATION = 'START_EVALUATION'
} */

export class Interaction {
    zone: THREE.Box3;
    typeID: string;
    pressText: CanvasTextSprite | null = null;
    scene: THREE.Scene;
    position: THREE.Vector3;
    enabled: boolean;

    constructor(
        scene: THREE.Scene,
        typeID:
            | 'FIND_RUBBERDUCK'
            | 'GET_COFFEE'
            | 'GET_PAPER'
            | 'LOGIN_COMPUTER'
            | 'WHERE_IS_EVALUATOR'
            | 'FIND_EVALUATING_STUDENT'
            | 'START_EVALUATION',
        position: THREE.Vector3,
        size: THREE.Vector3,
        enabled: boolean
    ) {
        this.typeID = typeID;
        this.scene = scene;
        this.position = position;
        this.enabled = enabled;

        this.zone = this.createInteractionBox(position, size);

        const helper = new THREE.Box3Helper(this.zone, 0xff0000);
        this.scene = scene;
        this.scene.add(helper);
    }

    createInteractionBox(
        bottomCenter: THREE.Vector3,
        size: THREE.Vector3
    ): THREE.Box3 {
        const center = bottomCenter.clone();
        center.y += size.y / 2;
        return new THREE.Box3().setFromCenterAndSize(center, size);
    }

    enableInteraction(): void {
        this.enabled = true;
    }

    disableInteraction(): void {
        this.enabled = false;
    }

    showEngageButton(): void {
        if (this.pressText) return;

        this.pressText = new CanvasTextSprite('Press [E]', 25);
        this.pressText.position.set(
            this.position.x,
            this.position.y + 1.75,
            this.position.z
        );

        this.scene.add(this.pressText);
    }

    removeEngageButton(): void {
        if (this.pressText) {
            this.scene.remove(this.pressText);
            this.pressText = null;
        }
    }
}
