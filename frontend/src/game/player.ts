import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Capsule } from 'three/addons/math/Capsule.js';
import type { Octree } from 'three/addons/math/Octree.js';
import {
    cleanupPlayerAnimationMixer,
    createPlayerAnimationActions,
    transitionPlayerAnimation,
} from './player_animation.js';
import { PlayerVisibilityTransition } from './PlayerVisibilityTransition.js';
import {
    createPlayerResourceDisposer,
    replacePlayerModelMaterials,
} from './PlayerModelMaterials.js';
import {
    CHAT_BUBBLE_HEIGHT,
    CHAT_BUBBLE_PREFIX,
    CHAT_BUBBLE_SCALE,
    CHAT_BUBBLE_SIZE,
    FloatingTextSprite,
} from './FloatingTextSprite.js';
import { PlayerState } from 'ftr-common/sharedTypes';

const PLAYER_FORWARD = new THREE.Vector3(0, 0, 1);
const COLLISION_STEP_RADIUS_FACTOR = 0.5;
/** ms also 10 Sekunden */
const PLAYER_CHAT_DURATION_MS = 10_000;

export type PlayerAnimationState = ReturnType<typeof transitionPlayerAnimation>;
export class Player {
    static colRad: number = 0.35;
    static colStartY: number = 0.35;
    static colEndY: number = 1;
    static offset: number = 0;

    static readonly playerStartPosition: THREE.Vector3Like = {
        x: 16,
        y: 0,
        z: 14,
    };

    /** ugly random Socket ID strings */
    id: string | undefined;
    model: THREE.Group | null;
    group: THREE.Group;
    private readonly chatBubble: FloatingTextSprite;
    private readonly resourceDisposer: ReturnType<
        typeof createPlayerResourceDisposer
    >;
    private readonly lifecycleController: PlayerVisibilityTransition;
    private chatBubbleTimeout: ReturnType<typeof setTimeout> | null;
    private loadGeneration: number;
    private finalized: boolean;
    /** running idle? */
    stateCurrent: PlayerAnimationState;
    mixer: THREE.AnimationMixer | null;
    actions: ReturnType<typeof createPlayerAnimationActions> | null;
    animations: THREE.AnimationClip[] = [];
    worldOctree: Octree;
    worldOctreeInteractive: Octree;
    playerVelocity: THREE.Vector3;
    playerOnFloor: boolean;
    GRAVITY: number;
    isSpawned: boolean;
    battleRequested: boolean;
    inRPSBattleMode: boolean;
    youSendRPGRequest: boolean;
    playerCollider: Capsule;
    controls: {
        key: [number, number];
        rotate: THREE.Quaternion;
        current: PlayerAnimationState;
        requestedAnimation: PlayerAnimationState | null;
        fadeDuration: number;
        runVelocity: number;
        turnSmoothness: number;
    };

    constructor(
        path: string,
        id: string | undefined,
        scene: THREE.Scene,
        worldOctree: Octree,
        worldOctreeInteractive: Octree
    ) {
        // we never want this to happen so this would be an exceptional error.
        // we might even throw here...
        if (id === undefined)
            console.warn('Player ctor called with undefined socket.id');
        this.id = id;

        this.model = null;
        this.group = new THREE.Group();
        this.chatBubble = new FloatingTextSprite(
            '',
            CHAT_BUBBLE_SIZE,
            new THREE.Vector3(0, CHAT_BUBBLE_HEIGHT, 0)
        );
        this.chatBubble.scale.multiplyScalar(CHAT_BUBBLE_SCALE);
        this.chatBubbleTimeout = null;
        this.loadGeneration = 0;
        this.finalized = false;
        this.stateCurrent = PlayerState.Idle;
        this.mixer = null;
        this.actions = null;
        this.animations = [];

        this.worldOctree = worldOctree;
        this.worldOctreeInteractive = worldOctreeInteractive;
        this.playerVelocity = new THREE.Vector3();
        this.playerOnFloor = false;

        this.GRAVITY = 30;

        this.isSpawned = false;

        this.battleRequested = false;
        this.inRPSBattleMode = false;
        this.youSendRPGRequest = false;

        this.playerCollider = new Capsule(
            new THREE.Vector3(0, Player.colStartY, 0),
            new THREE.Vector3(0, Player.colEndY, 0),
            Player.colRad
        );

        // apply lift
        //this.playerCollider.translate(new THREE.Vector3(0, Player.offset, 0));
        // start with scale 0 for spawn animation
        //this.group.scale.set(0, 1, 0);
        this.PlayerToStartPosition();
        Player.offset = (Player.colEndY - Player.colStartY) / 2 + Player.colRad;

        this.controls = {
            key: [0, 0],
            rotate: new THREE.Quaternion(),
            current: PlayerState.Idle,
            requestedAnimation: null,
            fadeDuration: 0.5,
            runVelocity: 15,
            turnSmoothness: 4.0,
        };

        this.resourceDisposer = createPlayerResourceDisposer(
            (error: unknown) => {
                this.reportLifecycleError(
                    'Player resource disposal failed:',
                    error
                );
            }
        );
        this.lifecycleController = new PlayerVisibilityTransition({
            getModel: () => this.model,
            onSpawnComplete: () => {
                this.isSpawned = true;
            },
            finalize: () => this.finalizePlayerResources(),
            onFinalizeError: (error: unknown) => {
                this.reportLifecycleError('Player finalization failed:', error);
            },
        });

        scene.add(this.group, this.chatBubble);

        this.loadModel(path);

        //if(sv > 0.2)
        //if(sv < 0.9)
        //else
        //    sv = 1;
        // value just for spawn animation
        this.lifecycleController.startSpawn();
    }

    /** change Players position - update playerCollider */
    setPlayerPosition(position: THREE.Vector3Like): void {
        this.playerCollider.start.copy(position);
        this.playerCollider.start.y += Player.colStartY;
        this.playerCollider.end.copy(position);
        this.playerCollider.end.y += Player.colEndY;
    }

    PlayerToStartPosition(): void {
        this.playerVelocity.setScalar(0);
        this.playerOnFloor = false;
        this.setPlayerPosition(Player.playerStartPosition);
    }

    /** print player chat bubble */
    showChatMessage(message: string): void {
        if (!this.isActive()) {
            return;
        }
        const trimmedMessage = message.trim();
        if (!trimmedMessage) {
            return;
        }
        this.chatBubble.setText(
            `${CHAT_BUBBLE_PREFIX}${trimmedMessage}`,
            CHAT_BUBBLE_SIZE
        );
        this.chatBubble.follow(this.group);
        this.clearChatBubbleTimeout();
        const timeout = setTimeout(() => {
            if (this.chatBubbleTimeout !== timeout) {
                return;
            }
            this.chatBubbleTimeout = null;
            try {
                this.chatBubble.hide();
            } catch (error) {
                this.reportLifecycleError(
                    'Player chat bubble hide failed:',
                    error
                );
            }
        }, PLAYER_CHAT_DURATION_MS);
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
            this.reportLifecycleError(
                'Player chat timeout cancellation failed:',
                error
            );
        }
    }

    private reportLifecycleError(message: string, error: unknown): void {
        try {
            console.error(message, error);
        } catch {
            // Lifecycle progress and cleanup must not depend on error reporting.
        }
    }

    private prepareForTermination(): void {
        this.loadGeneration += 1;
        this.isSpawned = false;
        const runPreparation = (prepare: () => void): void => {
            try {
                prepare();
            } catch (error) {
                this.reportLifecycleError(
                    'Player termination preparation failed:',
                    error
                );
            }
        };
        runPreparation(() => {
            this.controls.key = [0, 0];
        });
        runPreparation(() => this.playerVelocity.setScalar(0));
        runPreparation(() => this.chatBubble.hide());
        runPreparation(() => this.clearChatBubbleTimeout());
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

    isActive(): boolean {
        return this.lifecycleController.state === 'active';
    }

    private finalizePlayerResources(): void {
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
        this.clearChatBubbleTimeout();
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
        runCleanup(() => this.chatBubble.hide());
        runCleanup(() =>
            this.resourceDisposer.disposeObject3D(this.chatBubble)
        );
        runCleanup(() => this.group.removeFromParent());
        this.actions = null;
        this.mixer = null;
        this.model = null;
        this.isSpawned = false;
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
        actions: ReturnType<typeof createPlayerAnimationActions> | null
    ): void {
        const runRollback = (rollback: () => void): void => {
            try {
                rollback();
            } catch (error) {
                this.reportLifecycleError(
                    'Player model load rollback failed:',
                    error
                );
            }
        };

        if (mixer !== null) {
            cleanupPlayerAnimationMixer(mixer, (error) => {
                this.reportLifecycleError(
                    'Player model load rollback failed:',
                    error
                );
            });
        }

        const ownsModel = this.model === model;
        if (this.actions === actions) {
            this.actions = null;
        }
        if (this.mixer === mixer) {
            this.mixer = null;
        }
        if (ownsModel) {
            this.model = null;
            this.isSpawned = false;
        }
        runRollback(() => this.resourceDisposer.disposeObject3D(model));
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
        this.reportLifecycleError(
            `Player model loading failed for "${path}":`,
            error
        );
    }

    static loader = new GLTFLoader();

    loadModel(path: string): void {
        //const loader = new GLTFLoader();
        if (!this.isActive() || this.finalized || this.model !== null) {
            return;
        }

        const generation = this.loadGeneration + 1;
        this.loadGeneration = generation;

        void this.loadModelAsync(path, generation);
    }

    private async loadModelAsync(
        path: string,
        generation: number
    ): Promise<void> {
        let gltf: Awaited<ReturnType<GLTFLoader['loadAsync']>>;
        try {
            gltf = await Player.loader.loadAsync(path);
        } catch (error) {
            this.handleVisualLoadFailure(generation, path, error);
            return;
        }

        const loadedModel = gltf.scene;
        if (!this.canAcceptLoad(generation)) {
            this.rejectLoadedModel(loadedModel);
            return;
        }

        try {
            replacePlayerModelMaterials(loadedModel, this.resourceDisposer);
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
        let preparedActions: ReturnType<
            typeof createPlayerAnimationActions
        > | null;
        try {
            const mixer = new THREE.AnimationMixer(loadedModel);
            preparedMixer = mixer;
            preparedActions = createPlayerAnimationActions(
                mixer,
                gltf.animations,
                path
            );
        } catch (error) {
            if (preparedMixer !== null) {
                cleanupPlayerAnimationMixer(
                    preparedMixer,
                    (cleanupError, operation) => {
                        let message =
                            'Player animation uncache rollback failed:';
                        if (operation === 'stopAllAction') {
                            message = 'Player animation stop rollback failed:';
                        }
                        this.reportLifecycleError(message, cleanupError);
                    }
                );
            }
            preparedMixer = null;
            preparedActions = null;
            this.reportLifecycleError(
                `Player animation initialization failed for "${path}":`,
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
            //this.model.rotation.y = Math.PI;
            this.group.rotation.y = Math.PI;
            this.model = loadedModel;
            this.mixer = preparedMixer;
            this.actions = preparedActions;
            this.group.add(loadedModel);
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

    playerCollisions() {
        this.playerOnFloor = false;

        const resultStatic = this.worldOctree.capsuleIntersect(
            this.playerCollider
        );
        if (resultStatic) this.handleCollision(resultStatic);

        const resultInteractive = this.worldOctreeInteractive.capsuleIntersect(
            this.playerCollider
        );
        if (resultInteractive) this.handleCollision(resultInteractive);
    }

    handleCollision(result: any) {
        if (result) {
            // determine if the surface we bumped into is something we can stand on
            this.playerOnFloor = result.normal.y >= 0.15; // allow slopes up to ~81° but ignore sheer vertical walls
            if (!this.playerOnFloor) {
                //console.log("WALL COLLISION");
                this.playerVelocity.projectOnPlane(result.normal);
            }
            if (result.depth >= 1e-10) {
                //console.log("FLOOR COLLISION " + result.depth);
                this.playerCollider.translate(
                    result.normal.multiplyScalar(result.depth)
                );
            }
        }
    }

    updateCharacter(delta: number) {
        if (!this.isActive()) {
            return;
        }

        const fade = this.controls.fadeDuration;
        const key = this.controls.key;
        const rotate = this.controls.rotate;
        const active = key[0] !== 0 || key[1] !== 0;
        const play =
            this.controls.requestedAnimation ??
            (active ? PlayerState.Run : PlayerState.Idle);

        // Zustandsübergänge können den Renderloop abbrechen
        this.controls.current = play;

        // change animation
        if (this.actions !== null && this.stateCurrent !== play) {
            this.stateCurrent = transitionPlayerAnimation(
                this.actions,
                this.stateCurrent,
                play,
                fade
            );
        }

        let damping = THREE.MathUtils.damp(1, 0, 4, delta) - 1;
        if (!this.playerOnFloor) {
            this.playerVelocity.y -= this.GRAVITY * delta;
            // small air resistance
            damping *= 0.01;
        }
        this.playerVelocity.multiplyScalar(1 + damping);
        const deltaPosition = this.playerVelocity.clone().multiplyScalar(delta);
        /** Mehrstufige Treppe */
        const maxCollisionStep =
            this.playerCollider.radius * COLLISION_STEP_RADIUS_FACTOR;
        const collisionSteps = Math.max(
            1,
            Math.ceil(deltaPosition.length() / maxCollisionStep)
        );
        const collisionStep = deltaPosition
            .clone()
            .divideScalar(collisionSteps);

        for (let step = 0; step < collisionSteps; step += 1) {
            this.playerCollider.translate(collisionStep);
            this.playerCollisions();
        }

        // Ersetzt manuelle Capsuleberechnung zuvor lowestY
        this.playerCollider.getCenter(this.group.position);
        this.group.position.y -= Player.offset;

        if (this.group.position.y < -0.01) {
            this.group.position.setY(0);
            this.setPlayerPosition(this.group.position);
            this.playerVelocity.setScalar(0);
        }
        if (this.controls.current === PlayerState.Idle) {
            this.playerVelocity.set(0, this.playerVelocity.y, 0);
        }

        // move object
        // TODO: only if not idle for performance ?
        if (active) {
            /*             let damping = Math.exp( - 4 * delta ) - 1;
            if ( ! this.playerOnFloor ) {
                this.playerVelocity.y -= this.GRAVITY * delta;
                // small air resistance
                damping *= 0.01;
            }
            this.playerVelocity.addScaledVector( this.playerVelocity, damping );
            const deltaPosition = this.playerVelocity.clone().multiplyScalar( delta );
            this.playerCollider.translate( deltaPosition );
            this.playerCollisions();
            const newPos = new THREE.Vector3()
                .addVectors(this.playerCollider.start, this.playerCollider.end)
                .multiplyScalar(0.5) ;
            newPos.y -= Player.offset;

            //camera.position.add( newPos.clone().sub(this.group.position) );
            this.group.position.copy( newPos ); */

            // calculate camera direction and rotate input into world
            const direction = deltaPosition.setY(0);
            if (direction.lengthSq() === 0) {
                rotate.identity();
            } else {
                rotate.setFromUnitVectors(
                    PLAYER_FORWARD,
                    direction.normalize()
                );
            }

            // smooth rotation toward camera/movement direction using slerp
            const t = THREE.MathUtils.damp(
                0,
                1,
                this.controls.turnSmoothness,
                delta
            );
            if (
                isFinite(rotate.x) &&
                isFinite(rotate.y) &&
                isFinite(rotate.z) &&
                isFinite(rotate.w)
            ) {
                rotate.normalize();
                this.group.quaternion.normalize();
                this.group.quaternion.slerp(rotate, t);
            } else {
                console.log('ROTATE');
                this.group.quaternion.copy(rotate);
            }
        }
        //console.log(this.group.position);
        if (this.mixer) {
            this.mixer.update(delta);
        }
    }
}
