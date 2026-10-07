import * as THREE from 'three';
import { Player, type PlayerAnimationState } from './player';
import { Camera } from './camera';
import { InteractionManager } from './interaction_manager';
import { Interaction } from './interaction';
import {
    type DialogState,
    PREPARATION_QUEST_IDS,
    PlayerState,
    QUESTS,
} from 'ftr-common/sharedTypes';

export class Story_Manager {
    scene: THREE.Scene;
    renderer: THREE.WebGLRenderer;
    player: Player;
    camera: Camera;
    inCutscene: boolean = false;
    keyStates: { [key: string]: boolean };
    keys: [number, number];
    skipCameraAnimation: boolean;
    interactionManager: InteractionManager;
    advanceDialogue: boolean;
    advanceDialogueCamera: boolean;
    // private = only Story_Manager should access these values.
    // readonly = callback reference is set once and should not be changed.
    // Keep dialogue handling internal and prevent accidental reassignment.
    private dialogResolver: (() => void) | null;
    private readonly onDialogChange: ((state: DialogState) => void) | undefined;
    private readonly onGameReset: (() => void | Promise<void>) | undefined;
    private camPositionBackup: THREE.Vector3;

    // TODO: TEMP - need to be changed with Database
    questState: Map<string, boolean>;

    constructor(
        scene: THREE.Scene,
        player: Player,
        renderer: THREE.WebGLRenderer,
        camera: Camera,
        keyStates: { [key: string]: boolean },
        keys: [number, number],
        interactionManager: InteractionManager,
        onDialogChange?: (state: DialogState) => void,
        onGameReset?: () => void | Promise<void>
    ) {
        this.scene = scene;
        this.player = player;
        this.renderer = renderer;
        this.camera = camera;
        this.inCutscene = false;
        this.keyStates = keyStates;
        this.keys = keys;
        this.interactionManager = interactionManager;
        this.onDialogChange = onDialogChange;
        this.onGameReset = onGameReset;

        this.skipCameraAnimation = false;
        this.advanceDialogue = false;
        this.advanceDialogueCamera = false;
        this.dialogResolver = null;

        // TODO: TEMP - need to be changed with Database
        this.questState = new Map();
        this.initQuestState();
        this.camPositionBackup = camera.camera.position;
    }

    // TODO: TEMP - need to be changed with Database
    initQuestState(): void {
        for (const questId of PREPARATION_QUEST_IDS) {
            this.questState.set(questId, false);
        }
    }

    resetGameState(): void {
        this.questState.clear();
        this.initQuestState();
        this.interactionManager.interactionStartingState();
    }

    releaseAllKeys(): void {
        for (const key in this.keyStates) {
            this.keyStates[key] = false;
        }
        this.keys[0] = 0;
        this.keys[1] = 0;
    }

    /**
     * Return the Camera's position and LookAt to the Player
     *
     * @param isIntro For the Intro we want to have a different kind of
     * Animation as for the other occations where we want to return to the same
     * cam pos where we left before cutscene was triggerd
     */
    returnCameraToPlayer(time: number, isIntro?: boolean): Promise<void> {
        return new Promise((resolve) => {
            this.skipCameraAnimation = false;

            const startTime = performance.now();

            const startPosition = this.camera.camera.position.clone();

            const playerTarget = this.player.group.position
                .clone()
                .setY(this.player.group.position.y + 1);

            let endPosition: THREE.Vector3;
            if (isIntro) {
                const direction = startPosition
                    .clone()
                    .sub(playerTarget)
                    .setLength(3);

                endPosition = playerTarget.clone().add(direction);
            } else {
                endPosition = this.camPositionBackup.clone();
            }

            const cameraDirection = new THREE.Vector3();
            this.camera.camera.getWorldDirection(cameraDirection);

            const startLookAt = startPosition
                .clone()
                .addScaledVector(cameraDirection, 10);

            const endLookAt = playerTarget.clone();
            const currentLookAt = new THREE.Vector3();

            const updateCamera = (currentTime: number) => {
                const elapsedSeconds = (currentTime - startTime) / 1000;
                const progress = Math.min(elapsedSeconds / time, 1);

                this.camera.camera.position.lerpVectors(
                    startPosition,
                    endPosition,
                    progress
                );

                currentLookAt.lerpVectors(startLookAt, endLookAt, progress);

                this.camera.camera.lookAt(currentLookAt);

                if (progress < 1 && !this.skipCameraAnimation) {
                    requestAnimationFrame(updateCamera);
                    return;
                }

                resolve();
            };

            requestAnimationFrame(updateCamera);
        });
    }

    lookAtPlayer(time: number): Promise<void> {
        return new Promise((resolve) => {
            this.skipCameraAnimation = false;

            const startTime = performance.now();

            const startLookAt = new THREE.Vector3();
            const direction = new THREE.Vector3();

            // Get current look direction
            this.camera.camera.getWorldDirection(direction);
            startLookAt
                .copy(this.camera.camera.position)
                .addScaledVector(direction, 10);

            const endLookAt = this.player.group.position
                .clone()
                .setY(this.player.group.position.y + 1);
            const currentLookAt = new THREE.Vector3();

            const updateCamera = (currentTime: number) => {
                const elapsedSeconds = (currentTime - startTime) / 1000;
                const progress = Math.min(elapsedSeconds / time, 1);

                currentLookAt.lerpVectors(startLookAt, endLookAt, progress);

                this.camera.camera.lookAt(currentLookAt);

                if (progress < 1 && !this.skipCameraAnimation) {
                    requestAnimationFrame(updateCamera);
                    return;
                }

                resolve();
            };

            requestAnimationFrame(updateCamera);
        });
    }

    moveCameraDialog(
        from: THREE.Vector3,
        to: THREE.Vector3,
        time: number,
        lookAt: THREE.Vector3
    ): Promise<void> {
        this.advanceDialogueCamera = false;

        return new Promise((resolve) => {
            if (time <= 0) {
                this.camera.camera.position.copy(to);
                this.camera.camera.lookAt(lookAt);
                resolve();
                return;
            }

            const startTime = performance.now();
            const startPosition = from.clone();
            const targetPosition = to.clone();

            this.camera.camera.position.copy(startPosition);
            this.camera.camera.lookAt(lookAt);

            const updateCamera = (currentTime: number) => {
                // Stop immediately if requested
                if (this.advanceDialogueCamera) {
                    // console.log("1 ### Camera move event completed.");
                    resolve();
                    return;
                }

                const elapsedSeconds = (currentTime - startTime) / 1000;
                const progress = Math.min(elapsedSeconds / time, 1);

                this.camera.camera.position.lerpVectors(
                    startPosition,
                    targetPosition,
                    progress
                );

                if (progress < 1 && !this.advanceDialogueCamera) {
                    requestAnimationFrame(updateCamera);
                    return;
                }

                // console.log("2 ### Camera move event completed.");
                resolve();
            };

            requestAnimationFrame(updateCamera);
        });
    }

    moveCamera(
        from: THREE.Vector3,
        to: THREE.Vector3,
        time: number,
        lookAt: THREE.Vector3
    ): Promise<void> {
        this.skipCameraAnimation = false;

        return new Promise((resolve) => {
            if (time <= 0) {
                this.camera.camera.position.copy(to);
                this.camera.camera.lookAt(lookAt);
                resolve();
                return;
            }

            const startTime = performance.now();
            const startPosition = from.clone();
            const targetPosition = to.clone();

            this.camera.camera.position.copy(startPosition);
            this.camera.camera.lookAt(lookAt);

            const updateCamera = (currentTime: number) => {
                const elapsedSeconds = (currentTime - startTime) / 1000;
                const progress = Math.min(elapsedSeconds / time, 1);

                this.camera.camera.position.lerpVectors(
                    startPosition,
                    targetPosition,
                    progress
                );

                if (progress < 1 && !this.skipCameraAnimation) {
                    requestAnimationFrame(updateCamera);
                    return;
                }

                resolve();
            };

            requestAnimationFrame(updateCamera);
        });
    }

    moveCameraAndLookAt(
        from: THREE.Vector3,
        to: THREE.Vector3,
        time: number,
        lookAtStart: THREE.Vector3,
        lookAtEnd: THREE.Vector3
    ): Promise<void> {
        this.skipCameraAnimation = false;
        this.camera.orbitControls.enabled = false;

        return new Promise((resolve) => {
            if (time <= 0) {
                this.camera.camera.position.copy(to);
                this.camera.camera.lookAt(lookAtEnd);
                resolve();
                return;
            }

            const startTime = performance.now();
            const startPosition = from.clone();
            const targetPosition = to.clone();
            const startLookAt = lookAtStart.clone();
            const targetLookAt = lookAtEnd.clone();
            const currentLookAt = new THREE.Vector3();

            const updateCamera = (currentTime: number) => {
                const elapsedSeconds = (currentTime - startTime) / 1000;
                const progress = Math.min(elapsedSeconds / time, 1);

                this.camera.camera.position.lerpVectors(
                    startPosition,
                    targetPosition,
                    progress
                );
                currentLookAt.lerpVectors(startLookAt, targetLookAt, progress);
                this.camera.camera.lookAt(currentLookAt);

                if (progress < 1 && !this.skipCameraAnimation) {
                    requestAnimationFrame(updateCamera);
                    return;
                }

                resolve();
            };

            requestAnimationFrame(updateCamera);
        });
    }

    // for testing. need to be replaces with dialogue system
    waitForMouseClick(): Promise<void> {
        return new Promise((resolve) => {
            window.addEventListener('pointerdown', () => resolve(), {
                once: true,
            });
        });
    }

    stopCurrentDialogueCamera(): void {
        this.advanceDialogueCamera = true;
    }

    continueDialogue(): void {
        this.onDialogChange?.({ isOpen: false, message: '' });

        if (this.dialogResolver) {
            const resolve = this.dialogResolver;
            this.dialogResolver = null;
            resolve();
        }
    }

    showDialog(message: string = ''): Promise<void> {
        this.onDialogChange?.({ isOpen: true, message });

        const { promise, resolve } = Promise.withResolvers<void>();
        this.dialogResolver = resolve;
        return promise;
    }

    startCutscene(): void {
        this.inCutscene = true;
        this.camera.orbitControls.enabled = false;

        // backup last camera position to return to after cutscene.
        this.camPositionBackup = this.camera.camera.position.clone();

        this.releaseAllKeys();
    }

    endCutscene(): void {
        this.resetModelPosition();
        this.player.controls.requestedAnimation = null;
        this.inCutscene = false;
        this.camera.orbitControls.enabled = true;
    }

    transformModelForCutscene(position: THREE.Vector3Like): void {
        const worldPosition = new THREE.Vector3().copy(position);
        this.player.group.worldToLocal(worldPosition);
        this.player.model?.position.copy(worldPosition);
    }

    resetModelPosition(): void {
        this.player.model?.position.setScalar(0);
    }

    // ==================================================
    // CUTSCENES
    // ==================================================

    async GameIntro(): Promise<void> {
        this.startCutscene();

        await this.moveCameraAndLookAt(
            new THREE.Vector3(14, 6, 4),
            new THREE.Vector3(14, 6, 4),
            3,
            new THREE.Vector3(4, 0, 0),
            new THREE.Vector3(4, 0, 0)
        );

        await this.moveCameraAndLookAt(
            new THREE.Vector3(14, 6, 4),
            new THREE.Vector3(18, 6, 4),
            7,
            new THREE.Vector3(4, 0, 0),
            new THREE.Vector3(18, 6, -10)
        );

        this.transformModelForCutscene({ x: 16, y: 0, z: 14 });

        await this.moveCameraAndLookAt(
            new THREE.Vector3(15, 0.2, 17),
            new THREE.Vector3(17, 0.2, 17),
            6,
            new THREE.Vector3(15, 7, 0),
            new THREE.Vector3(17, 7, 0)
        );

        //this.transformModelForCutscene({ x: 10, y: 0, z: 10 });

        this.moveCameraDialog(
            new THREE.Vector3(16.3, 1.1, 13),
            new THREE.Vector3(15.7, 1.1, 13),
            20,
            new THREE.Vector3(16.3, 1.1, 14)
        );

        this.player.controls.requestedAnimation = PlayerState.Angry;
        await this.showDialog('Oh no... my black hole is getting closer!');
        await this.showDialog(
            'I don’t have much time left. I need to finish my evaluation.'
        );
        this.player.controls.requestedAnimation = PlayerState.ArmStretch;
        await this.showDialog(
            'Just a few final preparations, then I can begin the evaluation!'
        );

        this.stopCurrentDialogueCamera();

        await this.returnCameraToPlayer(1.0, true);

        this.endCutscene();
    }

    async blackHoleCutscene(showIntroCutscene: boolean = false): Promise<void> {
        this.startCutscene();

        this.player.controls.requestedAnimation = PlayerState.Falling;

        this.transformModelForCutscene({ x: 16, y: 15, z: -5 });

        const continueAfterBlackHole = this.showDialog(
            'OH NO... THE BLACK HOLE IS PULLING ME IN!'
        );

        await this.moveCameraAndLookAt(
            new THREE.Vector3(15.5, 11, -5),
            new THREE.Vector3(16, 14, -5),
            7,
            new THREE.Vector3(16, 15, -5),
            new THREE.Vector3(16, 15, -5)
        );

        await continueAfterBlackHole;

        this.resetModelPosition();
        this.player.PlayerToStartPosition();
        this.resetGameState();

        this.moveCameraDialog(
            new THREE.Vector3(16.3, 1.1, 13),
            new THREE.Vector3(15.7, 1.1, 13),
            20,
            new THREE.Vector3(16.3, 1.1, 14)
        );

        this.player.controls.requestedAnimation = PlayerState.Angry;
        await this.showDialog('Uff... I just thought I got black-holed...');
        await this.showDialog('...That felt way too real.');
        await this.showDialog(
            'Whatever it was, I better not let it happen again.'
        );
        this.player.controls.requestedAnimation = PlayerState.ArmStretch;
        await this.showDialog('I need to finish. Now!');

        this.stopCurrentDialogueCamera();

        await this.returnCameraToPlayer(1.0);

        await this.onGameReset?.();
        this.endCutscene();

        if (showIntroCutscene) {
            await this.GameIntro();
        }
    }

    async openFrontDoorCutscene(): Promise<void> {
        this.startCutscene();

        this.moveCameraDialog(
            new THREE.Vector3(9.78, 2, 2.61),
            new THREE.Vector3(11.26, 2, 2.62),
            10,
            new THREE.Vector3(9.78, 1, -0.48)
        );

        await this.showDialog(
            'There it is 🔑! I found my lost campus token. Now I can finally unlock the frontdoor.'
        );
        this.stopCurrentDialogueCamera();
        await this.returnCameraToPlayer(1);
        this.endCutscene();
    }

    async openEventSpaceDoorACutscene(): Promise<void> {
        this.startCutscene();

        await this.moveCameraDialog(
            new THREE.Vector3(13.49, 5.72, -16.93),
            new THREE.Vector3(14.01, 5.72, -15.61),
            4,
            new THREE.Vector3(15.53, 5, -17.62)
        );

        this.stopCurrentDialogueCamera();
        await this.returnCameraToPlayer(0.1);
        this.endCutscene();
    }

    async openEventSpaceDoorBCutscene(): Promise<void> {
        this.startCutscene();

        await this.moveCameraDialog(
            new THREE.Vector3(15.93, 5.73, -6),
            new THREE.Vector3(17.29, 5.73, -6),
            4,
            new THREE.Vector3(15.93, 5, -8)
        );

        this.stopCurrentDialogueCamera();
        await this.returnCameraToPlayer(0.01);
        this.endCutscene();
    }

    async evaluationCutscene(): Promise<void> {
        this.startCutscene();

        await this.moveCameraDialog(
            new THREE.Vector3(5, 5.72, -15.04),
            new THREE.Vector3(5, 5.72, -13.29),
            5,
            new THREE.Vector3(7.94, 5, -15.04)
        );

        this.stopCurrentDialogueCamera();
        await this.returnCameraToPlayer(0.5);
        this.endCutscene();
    }

    // ==================================================
    //
    // ==================================================

    async playDialogInteraction(
        message: string,
        animation: PlayerAnimationState
    ): Promise<void> {
        this.startCutscene();
        this.player.controls.requestedAnimation = animation;
        await this.showDialog(message);
        this.endCutscene();
    }

    async caseInteraction(
        type: string,
        message: string,
        animation: PlayerAnimationState
    ): Promise<void> {
        this.startCutscene();
        this.player.controls.requestedAnimation = animation;
        await this.showDialog(message);
        this.endCutscene();

        this.questState.set(type, true);
        this.onQuestInteraction?.(type);
    }

    async preparationsCompleted(): Promise<void> {
        await this.playDialogInteraction(
            'Everything is coming together. Now I just need to book my evaluation!',
            PlayerState.Strong
        );

        this.interactionManager.evaluatingStudentQuest.unlock();
    }

    async handleInteraction(interaction: Interaction): Promise<void> {
        //console.log(`Interaction triggered: ${interaction.typeID}`);
        const completeQuest = this.caseInteraction.bind(this);
        const playDialog = this.playDialogInteraction.bind(this);

        if (
            await this.interactionManager.lostTokenQuest.handleInteraction(
                interaction,
                () =>
                    this.interactionManager.frontDoorQuest.interaction.enableInteraction()
            )
        ) {
            const questId = QUESTS.FIND_LOST_DROPPED_TOKEN_QUEST_ID.id;
            this.questState.set(questId, true);
            this.onQuestInteraction?.(questId);
            await this.openFrontDoorCutscene();
            return;
        }

        if (
            await this.interactionManager.frontDoorQuest.handleInteraction(
                interaction,
                completeQuest
            )
        ) {
            return;
        }

        if (
            await this.interactionManager.eventSpaceQuest.handleInteraction(
                interaction,
                playDialog
            )
        ) {
            return;
        }

        const preparationQuest = this.interactionManager.preparationQuests.get(
            interaction.typeID
        );
        let onPreparationHandled: (() => void) | undefined;
        if (interaction.typeID === QUESTS.RUBBER_DUCK_QUEST_ID.id) {
            onPreparationHandled = () => this.onQuestDuckFound?.();
        } else if (interaction.typeID === QUESTS.COMPUTER_LOGIN_QUEST_ID.id) {
            onPreparationHandled = () => this.onQuestLogin?.();
        }

        if (
            preparationQuest !== undefined &&
            (await preparationQuest.handleInteraction(
                interaction,
                completeQuest,
                onPreparationHandled
            ))
        ) {
            if ([...this.questState.values()].every(Boolean)) {
                await this.preparationsCompleted();
            }
            return;
        }

        if (
            await this.interactionManager.evaluatingStudentQuest.handleInteraction(
                interaction,
                playDialog,
                completeQuest,
                () => this.onQuestEvaluator?.(),
                () =>
                    this.interactionManager.startEvaluationQuest.interaction.enableInteraction()
            )
        ) {
            return;
        }

        await this.interactionManager.startEvaluationQuest.handleInteraction(
            interaction,
            completeQuest,
            () => this.onQuestStartEvaluation?.(),
            async () => {
                await this.evaluationCutscene();
            },
            () => {
                this.interactionManager.eventSpaceQuest.disableInteractions();
                this.onQuestFinished?.();
            }
        );
    }

    // Callback
    // TODO: If Questlog Id is enum, than change also here?
    onQuestInteraction?: (questId: string) => void;
    onQuestFinished?: () => void;
    onQuestDuckFound?: () => void;
    onQuestEvaluator?: () => void;
    onQuestLogin?: () => void;
    onQuestStartEvaluation?: () => void;

    /** ===================================================
    // TODO: TESTING FUNCTIONS. Delete if not needed anymore
    // ===================================================

    async CutscenePositionTest(): Promise<void> {
        this.startCutscene();

        this.transformModelForCutscene({ x: 10, y: 0, z: 5 });
        //this.player.controls.requestedAnimation = 'Falling';

        await this.waitForMouseClick();

        this.endCutscene();
    }
    */
}
