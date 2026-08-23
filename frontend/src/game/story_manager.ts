import * as THREE from 'three';
import { Player } from './player';
import { Camera } from './camera';
import { Interaction } from './interaction';
import { PlayerState } from '@common/types';

// TODO: move this to sharedTypes.ts
type DialogState = {
    readonly isOpen: boolean;
    readonly message: string;
};

export class Story_Manager {
    scene: THREE.Scene;
    renderer: THREE.WebGLRenderer;
    player: Player;
    camera: Camera;
    inCutscene: boolean = false;
    keyStates: { [key: string]: boolean };
    keys: [number, number];
    skipCameraAnimation: boolean;
    advanceDialogue: boolean;
    advanceDialogueCamera: boolean;
    // private = only Story_Manager should access these values.
    // readonly = callback reference is set once and should not be changed.
    // Keep dialogue handling internal and prevent accidental reassignment.
    private dialogResolver: (() => void) | null;
    private readonly onDialogChange: ((state: DialogState) => void) | undefined;

    onQuestComplete: string | null = null;

    constructor(
        scene: THREE.Scene,
        player: Player,
        renderer: THREE.WebGLRenderer,
        camera: Camera,
        keyStates: { [key: string]: boolean },
        keys: [number, number],
        onDialogChange?: (state: DialogState) => void
    ) {
        this.scene = scene;
        this.player = player;
        this.renderer = renderer;
        this.camera = camera;
        this.inCutscene = false;
        this.keyStates = keyStates;
        this.keys = keys;
        this.onDialogChange = onDialogChange;

        this.onQuestComplete = null;

        this.skipCameraAnimation = false;
        this.advanceDialogue = false;
        this.advanceDialogueCamera = false;
        this.dialogResolver = null;
    }

    releaseAllKeys(): void {
        for (const key in this.keyStates) {
            this.keyStates[key] = false;
        }
        this.keys[0] = 0;
        this.keys[1] = 0;
    }

    returnCameraToPlayer(time: number): Promise<void> {
        return new Promise((resolve) => {
            this.skipCameraAnimation = false;

            const startTime = performance.now();

            const startPosition = this.camera.camera.position.clone();

            const playerTarget = this.player.group.position
                .clone()
                .add(new THREE.Vector3(0, 1, 0));

            const direction = startPosition
                .clone()
                .sub(playerTarget)
                .normalize();

            const endPosition = playerTarget
                .clone()
                .add(direction.multiplyScalar(3));

            const cameraDirection = new THREE.Vector3();
            this.camera.camera.getWorldDirection(cameraDirection);

            const startLookAt = startPosition
                .clone()
                .add(cameraDirection.multiplyScalar(10));

            const endLookAt = playerTarget.clone();

            const updateCamera = (currentTime: number) => {
                const elapsedSeconds = (currentTime - startTime) / 1000;
                const progress = Math.min(elapsedSeconds / time, 1);

                this.camera.camera.position.lerpVectors(
                    startPosition,
                    endPosition,
                    progress
                );

                const currentLookAt = startLookAt
                    .clone()
                    .lerp(endLookAt, progress);

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
                .add(direction.multiplyScalar(10));

            const endLookAt = this.player.group.position
                .clone()
                .add(new THREE.Vector3(0, 1, 0));

            const updateCamera = (currentTime: number) => {
                const elapsedSeconds = (currentTime - startTime) / 1000;
                const progress = Math.min(elapsedSeconds / time, 1);

                const currentLookAt = startLookAt
                    .clone()
                    .lerp(endLookAt, progress);

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

                this.camera.camera.position
                    .copy(startPosition)
                    .lerp(targetPosition, progress);

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

                const currentPosition = startPosition
                    .clone()
                    .lerp(targetPosition, progress);

                this.camera.camera.position.copy(currentPosition);

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

            const updateCamera = (currentTime: number) => {
                const elapsedSeconds = (currentTime - startTime) / 1000;
                const progress = Math.min(elapsedSeconds / time, 1);

                const currentPosition = startPosition
                    .clone()
                    .lerp(targetPosition, progress);
                const currentLookAt = startLookAt
                    .clone()
                    .lerp(targetLookAt, progress);

                this.camera.camera.position.copy(currentPosition);
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

    async showDialog(message: string = ''): Promise<void> {
        this.onDialogChange?.({ isOpen: true, message });

        return new Promise((resolve) => {
            this.dialogResolver = () => {
                resolve();
            };
        });
    }

    startCutscene(): void {
        this.inCutscene = true;
        this.camera.orbitControls.enabled = false;

        this.releaseAllKeys();
    }

    endCutscene(): void {
        this.resetModelPosition();
        this.player.controls.requestedAnimation = null;
        this.inCutscene = false;
        this.camera.orbitControls.enabled = true;
    }

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

        this.transformModelForCutscene(16, 0, 14);

        await this.moveCameraAndLookAt(
            new THREE.Vector3(15, 0.2, 17),
            new THREE.Vector3(17, 0.2, 17),
            6,
            new THREE.Vector3(15, 7, 0),
            new THREE.Vector3(17, 7, 0)
        );

        //this.transformModelForCutscene(10, 0, 10);

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

        await this.returnCameraToPlayer(1.0);

        this.endCutscene();
    }

    transformModelForCutscene(X: number, Y: number, Z: number): void {
        const worldPosition = new THREE.Vector3(X, Y, Z);
        this.player.group.worldToLocal(worldPosition);
        this.player.model?.position.copy(worldPosition);
    }

    resetModelPosition(): void {
        this.player.model?.position.set(0, 0, 0);
    }

    async blackHoleCutscene(): Promise<void> {
        this.startCutscene();

        this.player.controls.requestedAnimation = PlayerState.Falling;

        this.transformModelForCutscene(16, 15, -5);

        this.showDialog('OH NO... THE BLACK HOLE IS PULLING ME IN!');

        await this.moveCameraAndLookAt(
            new THREE.Vector3(15.5, 11, -5),
            new THREE.Vector3(16, 14, -5),
            7,
            new THREE.Vector3(16, 15, -5),
            new THREE.Vector3(16, 15, -5)
        );

        this.resetModelPosition();
        this.player.PlayerToStartPosition();

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

        // TODO: Kompletter Reset? Alle Quests zurücksetzen etc.

        await this.returnCameraToPlayer(1.0);

        this.endCutscene();
    }

    async caseInteraction(type: string, message: string): Promise<void> {
        this.startCutscene();
        this.onQuestComplete = type;
        await this.showDialog(message);
        this.interact();
        this.endCutscene();
    }

    async handleInteraction(interaction: Interaction): Promise<void> {
        //console.log(`Interaction triggered: ${interaction.typeID}`);
        this.onQuestComplete = null;

        switch (interaction.typeID) {
            case 'FIND_RUBBERDUCK':
                this.player.controls.requestedAnimation = PlayerState.Surprised;
                await this.caseInteraction(
                    'FIND_RUBBERDUCK',
                    'Found the duck! One less thing to worry about.'
                );
                break;
            case 'GET_COFFEE':
                this.player.controls.requestedAnimation = PlayerState.Drinking;
                await this.caseInteraction(
                    'GET_COFFEE',
                    'Ahh much better... Now I can finally think!'
                );
                break;
            case 'GET_PAPER':
                this.player.controls.requestedAnimation = PlayerState.ThumbsUp;
                await this.caseInteraction(
                    'GET_PAPER',
                    'I found some paper! Now I can finally take some notes.'
                );
                break;
            case 'LOGIN_COMPUTER':
                this.player.controls.requestedAnimation = PlayerState.ThumbsUp;
                await this.caseInteraction(
                    'LOGIN_COMPUTER',
                    'Great, the computer is ready. Just a few more steps to go!'
                );
                break;
            case 'START_EVALUATION':
                await this.caseInteraction(
                    'START_EVALUATION',
                    "I'm ready to start the evaluation. Let's do this!"
                );
                break;
        }
    }

    interact(): void {
        if (this.onQuestComplete) {
            this.onQuestInteraction?.(this.onQuestComplete);
        }
    }

    // Callback
    // TODO: If Questlog Id is enum, than change also here?
    onQuestInteraction?: (questId: string) => void;

    // ===================================================
    // TESTING FUNCTIONS. Delete if not needed anymore
    // ===================================================

    async CutscenePositionTest(): Promise<void> {
        this.startCutscene();

        this.transformModelForCutscene(10, 0, 5);
        //this.player.controls.requestedAnimation = 'Falling';

        await this.waitForMouseClick();

        this.endCutscene();
    }
}
