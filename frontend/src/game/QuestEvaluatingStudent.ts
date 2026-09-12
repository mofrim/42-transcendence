import * as THREE from 'three';
import {
    EVALUATING_STUDENT_QUEST_ID,
    NPCState,
    PlayerState,
    type QuestCompleteHandler,
    type QuestDialogHandler,
} from 'ftr-common/sharedTypes';

import { MODEL_NPC } from './Assets.js';
import { CanvasTextSprite } from './CanvasTextSprite.js';
import {
    CHAT_BUBBLE_HEIGHT,
    CHAT_BUBBLE_PREFIX,
    CHAT_BUBBLE_SCALE,
    CHAT_BUBBLE_SIZE,
} from './FloatingTextSprite.js';
import {
    EVALUATION_TERMINAL_POSITION,
    EVALUATOR_LOCATION_INTERACTION_ID,
    Interaction,
} from './interaction';
import { NPC, type NPCManager } from './npc';
import type { PlayerAnimationState } from './player';

const EVALUATING_STUDENT_POSITION = new THREE.Vector3(4, 0, -22.5);
const EVALUATING_STUDENT_NPC_ID = 6;
const EVALUATING_STUDENT_NICKNAME = 'Idle Student';
const EVALUATING_STUDENT_CHAT_BUBBLE_TEXT = `${CHAT_BUBBLE_PREFIX}Ready for Evaluation?`;
const EVALUATING_STUDENT_NAME_SIZE = 48;
const EVALUATING_STUDENT_NAME_HEIGHT = 1.9;
const EVALUATING_STUDENT_NAME_SCALE = 0.3;
const EVALUATING_STUDENT_CHAT_BUBBLE_HEIGHT = CHAT_BUBBLE_HEIGHT + 0.4;
const EVALUATOR_LOCATION_MESSAGE =
    "Someone's been assigned to my evaluation. They're at c1r12s2. Let's go.";
const EVALUATING_STUDENT_SUCCESS_MESSAGE =
    'Found him! Time to head back and kick off the evaluation.';

export class EvaluatingStudentQuest {
    readonly interactions: readonly [Interaction, Interaction];
    private readonly scene: THREE.Scene;
    private readonly npcManager: NPCManager;
    private evaluatingStudent: NPC | null = null;
    private evaluatingStudentAvailable = false;

    get studentInteraction(): Interaction {
        return this.interactions[1];
    }

    constructor(
        scene: THREE.Scene,
        interactionRange: THREE.Vector3,
        npcManager: NPCManager
    ) {
        this.scene = scene;
        this.npcManager = npcManager;
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
        this.setEvaluatingStudentAvailability(true);
    }

    reset(): void {
        for (const interaction of this.interactions) {
            interaction.reset(false);
        }
        this.setEvaluatingStudentAvailability(false);
    }

    setEvaluatingStudentAvailability(available: boolean): void {
        this.evaluatingStudentAvailable = available;

        if (!available) {
            this.syncEvaluatingStudentVisibility();
            return;
        }

        if (this.evaluatingStudent) {
            this.syncEvaluatingStudentVisibility();
            return;
        }

        const student = new NPC(
            MODEL_NPC,
            EVALUATING_STUDENT_NPC_ID,
            this.scene,
            NPCState.Standing
        );
        student.group.position.copy(this.studentInteraction.position);

        const nameLabel = new CanvasTextSprite(
            EVALUATING_STUDENT_NICKNAME,
            EVALUATING_STUDENT_NAME_SIZE
        );
        nameLabel.position.set(0, EVALUATING_STUDENT_NAME_HEIGHT, 0);
        nameLabel.scale.multiplyScalar(EVALUATING_STUDENT_NAME_SCALE);

        const chatBubble = new CanvasTextSprite(
            EVALUATING_STUDENT_CHAT_BUBBLE_TEXT,
            CHAT_BUBBLE_SIZE
        );
        chatBubble.position.set(0, EVALUATING_STUDENT_CHAT_BUBBLE_HEIGHT, 0);
        chatBubble.scale.multiplyScalar(CHAT_BUBBLE_SCALE);

        student.group.add(nameLabel, chatBubble);
        this.evaluatingStudent = student;
        student.group.addEventListener('childadded', () => {
            this.syncEvaluatingStudentVisibility();
        });
        this.npcManager.addNPC(student);
        this.syncEvaluatingStudentVisibility();
    }

    private syncEvaluatingStudentVisibility(): void {
        const student = this.evaluatingStudent;
        if (!student) {
            return;
        }

        student.group.visible =
            this.evaluatingStudentAvailable && student.model !== null;
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
