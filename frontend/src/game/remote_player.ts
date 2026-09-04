import * as THREE from 'three';

import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

import {
    cleanupPlayerAnimationMixer,
    createPlayerAnimationActions,
    normalizePlayerAnimationState,
    transitionPlayerAnimation,
} from './player_animation.js';
import {
    PlayerVisibilityTransition,
    type PlayerLifecycleState,
} from './PlayerVisibilityTransition.js';
import {
    createPlayerResourceDisposer,
    replacePlayerModelMaterials,
} from './PlayerModelMaterials.js';
import { FloatingTextSprite } from './FloatingTextSprite.js';
import { PlayerState } from 'common/sharedTypes';

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

const RemotePlayerImplementation = class Remote_Player {
    private readonly colAr: THREE.Mesh[];
    private readonly ownedCollisionMeshes: THREE.Mesh[];
    private readonly nameLabel: FloatingTextSprite;
    private readonly resourceDisposer: ReturnType<
        typeof createPlayerResourceDisposer
    >;
    private readonly lifecycleController: PlayerVisibilityTransition;
    private loadGeneration: number;
    private finalized: boolean;
    private remoteState: RemotePlayerState;
    private battleRequestedState: boolean;
    readonly id: string;
    nickname: string;
    model: THREE.Group | null;
    group: THREE.Group;
    stateCurrent: PlayerAnimationState;
    mixer: THREE.AnimationMixer | null;
    actions: Partial<PlayerAnimationActions> | null;
    isSpawned: boolean;

    constructor(
        path: string,
        id: string,
        nickname: string,
        scene: THREE.Scene,
        mesh_RP: THREE.Mesh | THREE.Mesh[]
    ) {
        if (Array.isArray(mesh_RP)) {
            this.colAr = mesh_RP;
        } else {
            this.colAr = [mesh_RP];
        }
        this.ownedCollisionMeshes = [];

        this.id = id;
        this.nickname = nickname;
        this.model = null;
        this.group = new THREE.Group();
        this.nameLabel = new FloatingTextSprite(
            nickname,
            PLAYER_NAME_SIZE,
            new THREE.Vector3(0, PLAYER_NAME_HEIGHT, 0)
        );
        this.nameLabel.scale.multiplyScalar(PLAYER_NAME_SCALE);
        scene.add(this.nameLabel);

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

        this.loadEnemyCharacter(path);
    }

    animateSpawn(x: number, startY: number, z: number): void {
        if (!this.isActive()) {
            return;
        }

        //console.log("Animating spawn " + this.id);
        //console.log("Animating spawn...");
        this.group.position.set(x, startY, z);
        //console.log("spawnY: " + this.group.position.y.toFixed(4));
        this.nameLabel.follow(this.group);
        this.lifecycleController.startSpawn();
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

        runPreparation(() => this.nameLabel.hide());
        runPreparation(() => this.unregisterOwnedCollisionMeshes());
    }

    startDespawn(): Promise<void> {
        // console.log("DESTROY");
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
        runCleanup(() => this.unregisterOwnedCollisionMeshes());

        const model = this.model;
        const mixer = this.mixer;

        if (mixer !== null) {
            cleanupPlayerAnimationMixer(mixer, (error) => {
                if (finalizationError === null) {
                    finalizationError = error;
                }
            });
        }

        if (model !== null) {
            runCleanup(() => this.resourceDisposer.disposeObject3D(model));
        }

        runCleanup(() => this.nameLabel.hide());
        runCleanup(() => this.resourceDisposer.disposeObject3D(this.nameLabel));
        runCleanup(() => this.group.removeFromParent());

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
        //console.log("Enemy character loading...");
        let gltf: Awaited<ReturnType<GLTFLoader['loadAsync']>>;
        try {
            gltf = await REMOTE_PLAYER_LOADER.loadAsync(path);
        } catch (error) {
            this.handleVisualLoadFailure(generation, path, error);
            return;
        }

        const loadedModel = gltf.scene;
        //model.position.set(x, y, z);
        //model.rotation.y = rot;
        //this.colAr.push(this.model);
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
            /* object.material = new THREE.MeshToonMaterial({
                        color: object.material.color.clone(),
                        gradientMap: Remote_Player.gradientTexture,
                            transparent: true,
                            opacity: 0
                    }); */

            /* object.material = new THREE.MeshToonMaterial({
                        color: 0xffffff,
                        gradientMap: Remote_Player.gradientTexture,
                            transparent: true,
                            opacity: 0
                    }); */
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
        path: string,
        id: string,
        nickname: string,
        scene: THREE.Scene,
        mesh_RP: THREE.Mesh | THREE.Mesh[]
    ): RemotePlayerInstance & { readonly id: string };
}

export type Remote_Player = RemotePlayerInstance;
export const Remote_Player =
    RemotePlayerImplementation as RemotePlayerConstructor;
