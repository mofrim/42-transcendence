import * as THREE from 'three';

import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

import {
    cleanupPlayerAnimationMixer,
    createPlayerAnimationActions,
    normalizePlayerAnimationState,
    transitionPlayerAnimation,
} from './player_animation.js';
import { getPlayerModelPath } from './Assets.js';
import {
    PlayerVisibilityTransition,
    type PlayerLifecycleState,
} from './PlayerVisibilityTransition.js';
import {
    createPlayerResourceDisposer,
    replacePlayerModelMaterials,
} from './PlayerModelMaterials.js';
import { CanvasTextSprite } from './CanvasTextSprite.js';
import {
    CHAT_BUBBLE_HEIGHT,
    CHAT_BUBBLE_PREFIX,
    CHAT_BUBBLE_SCALE,
    CHAT_BUBBLE_SIZE,
} from './FloatingTextSprite.js';
import { SmootherMovement } from './SmootherMovement.js';
import { PlayerState } from 'ftr-common/sharedTypes';

type PlayerAnimationState = ReturnType<typeof normalizePlayerAnimationState>;
type RemotePlayerState = PlayerState | PlayerAnimationState;
type PlayerAnimationActions = Record<
    PlayerAnimationState,
    THREE.AnimationAction
>;

const PLAYER_FORWARD = new THREE.Vector3(0, 0, 1);
const rotationDirection = new THREE.Vector3();
const REMOTE_PLAYER_LOADER = new GLTFLoader();
const PLAYER_NAME_SIZE = 48;
const PLAYER_NAME_HEIGHT = 1.9;
const PLAYER_NAME_SCALE = 0.3;
const REMOTE_CHAT_DURATION_MS = 30_000;

const RemotePlayerImplementation = class Remote_Player {
    private readonly colAr: THREE.Mesh[];
    private readonly ownedCollisionMeshes: THREE.Mesh[];
    private readonly nameLabel: CanvasTextSprite;
    private readonly chatBubble: CanvasTextSprite;
    private readonly positionInterpolator: SmootherMovement;
    private readonly resourceDisposer: ReturnType<
        typeof createPlayerResourceDisposer
    >;
    private readonly lifecycleController: PlayerVisibilityTransition;
    private chatBubbleTimeout: ReturnType<typeof setTimeout> | null;
    private loadGeneration: number;
    private finalized: boolean;
    private remoteState: RemotePlayerState;
    private battleRequestedState: boolean;
    readonly id: string;
    readonly character: boolean;
    nickname: string;
    model: THREE.Group | null;
    group: THREE.Group;
    stateCurrent: PlayerAnimationState;
    mixer: THREE.AnimationMixer | null;
    actions: Partial<PlayerAnimationActions> | null;
    isSpawned: boolean;

    constructor(
        id: string,
        character: boolean,
        nickname: string,
        mesh_RP: THREE.Mesh | THREE.Mesh[]
    ) {
        if (Array.isArray(mesh_RP)) {
            this.colAr = mesh_RP;
        } else {
            this.colAr = [mesh_RP];
        }
        this.ownedCollisionMeshes = [];

        this.id = id;
        this.character = character;
        this.nickname = nickname;
        this.model = null;
        this.group = new THREE.Group();
        this.nameLabel = new CanvasTextSprite(nickname, PLAYER_NAME_SIZE);
        this.nameLabel.position.set(0, PLAYER_NAME_HEIGHT, 0);
        this.nameLabel.scale.multiplyScalar(PLAYER_NAME_SCALE);
        this.nameLabel.visible = false;
        this.chatBubble = new CanvasTextSprite('', CHAT_BUBBLE_SIZE);
        this.chatBubble.position.set(0, CHAT_BUBBLE_HEIGHT, 0);
        this.chatBubble.scale.multiplyScalar(CHAT_BUBBLE_SCALE);
        this.chatBubble.visible = false;
        this.chatBubbleTimeout = null;
        this.group.add(this.nameLabel, this.chatBubble);
        this.positionInterpolator = new SmootherMovement();

        this.loadGeneration = 0;
        this.finalized = false;
        this.remoteState = PlayerState.Idle;
        this.battleRequestedState = false;
        this.stateCurrent = PlayerState.Idle;
        this.mixer = null;
        this.actions = null;

        this.isSpawned = false;

        this.resourceDisposer = createPlayerResourceDisposer(
            (error: unknown) => {
                console.error('Remote player resource disposal failed:', error);
            }
        );
        this.lifecycleController = new PlayerVisibilityTransition({
            getModel: () => this.model,
            onSpawnComplete: () => {
                this.isSpawned = true;
            },
            finalize: () => this.finalizeRemoteResources(),
            onFinalizeError: (error: unknown) => {
                console.error('Remote player finalization failed:', error);
            },
        });

        this.loadEnemyCharacter(getPlayerModelPath(character));
    }

    animateSpawn(position: THREE.Vector3Like): void {
        if (!this.isActive()) {
            return;
        }

        this.group.position.copy(position);
        this.nameLabel.visible = true;
        this.lifecycleController.startSpawn();
    }

    setNetworkPositionTarget(targetPosition: THREE.Vector3): void {
        if (!this.isActive() || !this.isSpawned) {
            return;
        }

        this.positionInterpolator.setTarget(
            this.group.position,
            targetPosition
        );
    }

    updateNetworkPosition(deltaSeconds: number): void {
        if (!this.isActive() || !this.isSpawned) {
            return;
        }

        this.positionInterpolator.update(this.group.position, deltaSeconds);
    }

    showChatMessage(message: string): void {
        if (!this.isActive()) {
            return;
        }

        const trimmedMessage = message.trim();
        if (!trimmedMessage) {
            return;
        }

        this.clearChatBubbleTimeout();
        this.chatBubble.setText(
            `${CHAT_BUBBLE_PREFIX}${trimmedMessage}`,
            CHAT_BUBBLE_SIZE
        );
        this.chatBubble.visible = true;

        const timeout = setTimeout(() => {
            if (this.chatBubbleTimeout !== timeout) {
                return;
            }
            this.chatBubbleTimeout = null;

            try {
                this.chatBubble.visible = false;
            } catch (error) {
                console.error('Remote player chat bubble hide failed:', error);
            }
        }, REMOTE_CHAT_DURATION_MS);
        this.chatBubbleTimeout = timeout;
    }

    private clearChatBubbleTimeout(): void {
        if (this.chatBubbleTimeout === null) {
            return;
        }

        const chatBubbleTimeout = this.chatBubbleTimeout;
        this.chatBubbleTimeout = null;

        try {
            clearTimeout(chatBubbleTimeout);
        } catch (error) {
            console.error(
                'Remote player chat timeout cancellation failed:',
                error
            );
        }
    }

    private prepareForTermination(): void {
        this.loadGeneration += 1;
        this.isSpawned = false;
        this.battleRequestedState = false;

        const runPreparation = (prepare: () => void): void => {
            try {
                prepare();
            } catch (error) {
                console.error(
                    'Remote player termination preparation failed:',
                    error
                );
            }
        };

        runPreparation(() => {
            this.nameLabel.visible = false;
        });
        runPreparation(() => {
            this.chatBubble.visible = false;
        });
        runPreparation(() => this.clearChatBubbleTimeout());
        runPreparation(() => this.unregisterOwnedCollisionMeshes());
    }

    startDespawn(): Promise<void> {
        if (this.lifecycleController.state === 'active') {
            this.prepareForTermination();
        }

        return this.lifecycleController.startDespawn();
    }

    updateLifecycle(deltaSeconds: number): void {
        this.lifecycleController.update(deltaSeconds);
    }

    forceDispose(): Promise<void> {
        const completion = this.startDespawn();
        this.lifecycleController.forceComplete();
        return completion;
    }

    get lifecycleState(): PlayerLifecycleState {
        return this.lifecycleController.state;
    }

    isActive(): boolean {
        return this.lifecycleController.state === 'active';
    }

    get state(): RemotePlayerState {
        return this.remoteState;
    }

    set state(state: RemotePlayerState) {
        if (!this.isActive()) {
            return;
        }

        this.remoteState = state;
    }

    get battleRequested(): boolean {
        return this.battleRequestedState;
    }

    set battleRequested(battleRequested: boolean) {
        if (!this.isActive() && battleRequested) {
            return;
        }

        this.battleRequestedState = battleRequested;
    }

    private unregisterOwnedCollisionMeshes(): void {
        const ownedMeshes = new Set(this.ownedCollisionMeshes);
        for (let index = this.colAr.length - 1; index >= 0; index -= 1) {
            const mesh = this.colAr[index];
            if (mesh !== undefined && ownedMeshes.has(mesh)) {
                this.colAr.splice(index, 1);
            }
        }
        this.ownedCollisionMeshes.length = 0;
    }

    private finalizeRemoteResources(): void {
        if (this.finalized) {
            return;
        }
        this.finalized = true;

        let finalizationError: unknown = null;
        const runCleanup = (cleanup: () => void): void => {
            try {
                cleanup();
            } catch (error) {
                if (finalizationError === null) {
                    finalizationError = error;
                }
            }
        };

        this.loadGeneration += 1;
        this.clearChatBubbleTimeout();
        runCleanup(() => this.unregisterOwnedCollisionMeshes());

        const mixer = this.mixer;

        if (mixer !== null) {
            cleanupPlayerAnimationMixer(mixer, (error) => {
                if (finalizationError === null) {
                    finalizationError = error;
                }
            });
        }

        runCleanup(() => this.resourceDisposer.disposeObject3D(this.group));

        this.actions = null;
        this.mixer = null;
        this.model = null;
        this.isSpawned = false;
        this.battleRequestedState = false;

        if (finalizationError !== null) {
            throw finalizationError;
        }
    }

    private rejectLoadedModel(model: THREE.Object3D): void {
        this.resourceDisposer.disposeObject3D(model);
    }

    private rollbackLoadedModel(
        model: THREE.Group,
        mixer: THREE.AnimationMixer | null,
        actions: Partial<PlayerAnimationActions> | null
    ): void {
        const runRollback = (rollback: () => void): void => {
            try {
                rollback();
            } catch (error) {
                console.error('Remote player load rollback failed:', error);
            }
        };

        if (mixer !== null) {
            cleanupPlayerAnimationMixer(mixer, (error) => {
                console.error('Remote player load rollback failed:', error);
            });
        }

        if (this.actions === actions) {
            this.actions = null;
        }
        if (this.mixer === mixer) {
            this.mixer = null;
        }
        if (this.model === model) {
            this.model = null;
        }

        runRollback(() => this.unregisterOwnedCollisionMeshes());
        runRollback(() => this.resourceDisposer.disposeObject3D(model));

        this.isSpawned = false;
    }

    private canAcceptLoad(generation: number): boolean {
        return (
            generation === this.loadGeneration &&
            this.lifecycleController.state === 'active' &&
            !this.finalized
        );
    }

    private handleVisualLoadFailure(
        generation: number,
        path: string,
        error: unknown
    ): void {
        if (!this.canAcceptLoad(generation)) {
            return;
        }

        this.isSpawned = false;
        console.error(
            `Remote player model loading failed for "${path}":`,
            error
        );
    }

    private loadEnemyCharacter(path: string): void {
        if (!this.isActive() || this.model !== null) {
            return;
        }

        const generation = this.loadGeneration + 1;
        this.loadGeneration = generation;

        void this.loadEnemyCharacterAsync(path, generation);
    }

    private async loadEnemyCharacterAsync(
        path: string,
        generation: number
    ): Promise<void> {
        let gltf: Awaited<ReturnType<GLTFLoader['loadAsync']>>;
        try {
            gltf = await REMOTE_PLAYER_LOADER.loadAsync(path);
        } catch (error) {
            this.handleVisualLoadFailure(generation, path, error);
            return;
        }

        const loadedModel = gltf.scene;
        if (!this.canAcceptLoad(generation)) {
            this.rejectLoadedModel(loadedModel);
            return;
        }

        let collisionMeshes: THREE.Mesh[];
        try {
            collisionMeshes = replacePlayerModelMaterials(
                loadedModel,
                this.resourceDisposer
            );
        } catch (error) {
            this.rejectLoadedModel(loadedModel);
            this.handleVisualLoadFailure(generation, path, error);
            return;
        }

        if (!this.canAcceptLoad(generation)) {
            this.rejectLoadedModel(loadedModel);
            return;
        }

        let preparedMixer: THREE.AnimationMixer | null = null;
        let preparedActions: Partial<PlayerAnimationActions> | null = null;
        try {
            const mixer = new THREE.AnimationMixer(loadedModel);
            // starts Idle as the active action after initialization
            try {
                preparedActions = createPlayerAnimationActions(
                    mixer,
                    gltf.animations,
                    path
                );
                preparedMixer = mixer;
            } catch (error) {
                cleanupPlayerAnimationMixer(mixer, (cleanupError) => {
                    console.error(
                        'Remote animation rollback failed:',
                        cleanupError
                    );
                });
                console.error(
                    `Remote player animation initialization failed for "${path}":`,
                    error
                );
            }
        } catch (error) {
            console.error(
                `Remote player animation mixer initialization failed for "${path}":`,
                error
            );
        }

        if (!this.canAcceptLoad(generation)) {
            this.rollbackLoadedModel(
                loadedModel,
                preparedMixer,
                preparedActions
            );
            return;
        }

        try {
            loadedModel.rotation.y = Math.PI;
            this.model = loadedModel;
            this.mixer = preparedMixer;
            this.actions = preparedActions;
            this.remoteState = normalizePlayerAnimationState(this.remoteState);
            // Der erste Zustand und Updates während des Spawns werden verworfen
            this.stateCurrent = PlayerState.Idle;
            this.group.add(loadedModel);
            this.colAr.push(...collisionMeshes);
            this.ownedCollisionMeshes.push(...collisionMeshes);
            this.lifecycleController.applyCurrentVisualState();
        } catch (error) {
            this.rollbackLoadedModel(
                loadedModel,
                preparedMixer,
                preparedActions
            );
            this.handleVisualLoadFailure(generation, path, error);
        }
    }

    rotateCharacter(startPos: THREE.Vector3, endPos: THREE.Vector3): void {
        if (!this.isActive()) {
            return;
        }

        rotationDirection.subVectors(endPos, startPos).setY(0);
        if (rotationDirection.lengthSq() === 0) {
            this.group.quaternion.identity();
            return;
        }

        this.group.quaternion.setFromUnitVectors(
            PLAYER_FORWARD,
            rotationDirection.normalize()
        );
    }

    updateAnimation(delta: number): void {
        if (!this.isActive() || !this.mixer || !this.actions) {
            return;
        }

        const fadeDuration = 0.3;
        const nextState = normalizePlayerAnimationState(this.remoteState);
        this.remoteState = nextState;

        // smooth start <-> stop animation
        if (this.stateCurrent !== nextState) {
            this.stateCurrent = transitionPlayerAnimation(
                this.actions,
                this.stateCurrent,
                nextState,
                fadeDuration
            );
        }

        this.mixer.update(delta);
    }

    setNickname(nickname: string): void {
        if (!this.isActive()) {
            return;
        }

        const trimmedNickname = nickname.trim();
        if (!trimmedNickname || trimmedNickname === this.nickname) {
            return;
        }

        this.nickname = trimmedNickname;
        this.nameLabel.setText(trimmedNickname, PLAYER_NAME_SIZE);
    }
};

type RemotePlayerInstance = InstanceType<typeof RemotePlayerImplementation>;

interface RemotePlayerConstructor {
    new (
        id: string,
        character: boolean,
        nickname: string,
        mesh_RP: THREE.Mesh | THREE.Mesh[]
    ): RemotePlayerInstance & { readonly id: string };
}

export type Remote_Player = RemotePlayerInstance;
export const Remote_Player =
    RemotePlayerImplementation as RemotePlayerConstructor;
