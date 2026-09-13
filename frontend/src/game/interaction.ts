import * as THREE from 'three';
import { CanvasTextSprite } from './CanvasTextSprite';
import {
    EVALUATING_STUDENT_QUEST_ID,
    START_EVALUATION_QUEST_ID,
    type PreparationQuestId,
    QUESTS_OBJ,
} from 'ftr-common/sharedTypes';

/* import { Player } from './player';
import { Camera } from './camera'; */

export const EVALUATOR_LOCATION_INTERACTION_ID = 'WHERE_IS_EVALUATOR';
export const EVENT_SPACE_DOOR_A_INTERACTION_ID = 'EVENT_SPACE_DOOR_A';
export const EVENT_SPACE_DOOR_B_INTERACTION_ID = 'EVENT_SPACE_DOOR_B';
export const EVALUATION_TERMINAL_POSITION = new THREE.Vector3(8, 3.72, -14);

export type InteractionTypeId =
    | PreparationQuestId
    | typeof EVALUATOR_LOCATION_INTERACTION_ID
    | typeof EVALUATING_STUDENT_QUEST_ID
    | typeof START_EVALUATION_QUEST_ID
    | typeof EVENT_SPACE_DOOR_A_INTERACTION_ID
    | typeof EVENT_SPACE_DOOR_B_INTERACTION_ID
    | typeof QUESTS_OBJ.FIND_LOST_DROPPED_TOKEN_QUEST_ID
    | typeof QUESTS_OBJ.ENTER_CAMPUS_TOKEN_QUEST_ID;

/* export enum IID {
    FIND_RUBBERDUCK = 'FIND_RUBBERDUCK',
    GET_COFFEE = 'GET_COFFEE',
    GET_PAPER = 'GET_PAPER',
    LOGIN_COMPUTER = 'LOGIN_COMPUTER',
    START_EVALUATION = 'START_EVALUATION'
} */

export class Interaction {
    zone: THREE.Box3;
    typeID: InteractionTypeId;
    pressText: CanvasTextSprite | null = null;
    scene: THREE.Scene;
    position: THREE.Vector3;
    enabled: boolean;

    constructor(
        scene: THREE.Scene,
        typeID: InteractionTypeId,
        position: THREE.Vector3,
        size: THREE.Vector3,
        enabled: boolean
    ) {
        this.typeID = typeID;
        this.scene = scene;
        this.position = position.clone();
        this.enabled = enabled;

        const center = this.position.clone().setY(this.position.y + size.y / 2);
        this.zone = new THREE.Box3().setFromCenterAndSize(center, size);

        /* const helper = new THREE.Box3Helper(this.zone, 0xff0000);
        this.scene.add(helper); */
    }

    enableInteraction(): void {
        this.enabled = true;
    }

    disableInteraction(): void {
        this.enabled = false;
    }

    reset(enabled: boolean): void {
        this.removeEngageButton();
        this.enabled = enabled;
    }

    showEngageButton(): void {
        if (this.pressText) return;

        this.pressText = new CanvasTextSprite('Press: ⌨️ [E]', 25);
        this.pressText.position
            .copy(this.position)
            .setY(this.position.y + 1.75);

        this.scene.add(this.pressText);
    }

    removeEngageButton(): void {
        if (this.pressText) {
            this.pressText.removeFromParent();
            this.pressText = null;
        }
    }
}
