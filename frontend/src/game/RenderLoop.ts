import * as THREE from 'three';

import { FlyControls } from 'three/addons/controls/FlyControls.js';
import type { Socket } from 'socket.io-client';

import type { Camera } from './camera.js';
import type { Input } from './Input.js';
import type { InteractionManager } from './interaction_manager.js';
import type { MultiplayerManager } from './multiplayer.js';
import type { NPCManager } from './npc.js';
import type { Player } from './player.js';
import type { ResourceDisposer } from './ResourceDisposer.js';
import type { RPS_Game } from './MinigameRPS.js';
import type { Story_Manager } from './story_manager.js';
import type { TTT_Game } from './MinigameTTT.js';
import type { WorldLoader } from './WorldLoader.js';

import {
    EventType,
    type GameEvent,
    type GLBMesh,
} from 'ftr-common/sharedTypes';

type RenderLoopOptions = {
    readonly renderer: THREE.WebGLRenderer;
    readonly scene: THREE.Scene;
    readonly socket: Socket;
    readonly input: Input;
    readonly npcManager: NPCManager;
    readonly followGroup: THREE.Group;
    readonly texture: THREE.Texture;
    readonly colliders: GLBMesh[];
    readonly remoteMeshes: THREE.Mesh[];
    readonly resourceDisposer: ResourceDisposer;
    readonly isSpectator: boolean;
    readonly getWorldLoader: () => WorldLoader;
    readonly getPlayer: () => Player | null;
    readonly getMultiplayer: () => MultiplayerManager | null;
    readonly getCamera: () => Camera | null;
    readonly getTTTGame: () => TTT_Game | null;
    readonly getRPSGame: () => RPS_Game | null;
    readonly getStoryManager: () => Story_Manager | null;
    readonly getInteractionManager: () => InteractionManager | null;
    readonly isLocalPlayerDespawning: () => boolean;
    readonly stopLocalInput: () => void;
    readonly clearRuntimeState: () => void;
    readonly onGameEvent: ((event: GameEvent) => void) | undefined;
};

export class RenderLoop {
    private readonly timer = new THREE.Timer();
    private readonly previousPlayerPosition = new THREE.Vector3();
    private readonly playerMovementDelta = new THREE.Vector3();
    private activeCamera: THREE.PerspectiveCamera | null = null;
    private spectatorControls: FlyControls | null = null;
    private disposePromise: Promise<void> | null = null;
    private disposed = false;

    constructor(private readonly options: RenderLoopOptions) {}

    get isDisposed(): boolean {
        return this.disposed;
    }

    start(createPlayerCamera: () => THREE.PerspectiveCamera): void {
        const { renderer } = this.options;

        this.timer.connect(document);
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 0.5;
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFShadowMap;

        if (this.options.isSpectator) {
            this.activeCamera = new THREE.PerspectiveCamera(
                60,
                window.innerWidth / window.innerHeight,
                0.1,
                100
            );
            this.activeCamera.position.set(0, 2, -5);
            this.activeCamera.lookAt(0, 1, 0);
            this.spectatorControls = new FlyControls(
                this.activeCamera,
                renderer.domElement
            );
            this.spectatorControls.movementSpeed = 15;
            this.spectatorControls.rollSpeed = THREE.MathUtils.degToRad(60);
            this.spectatorControls.dragToLook = true;
        } else {
            this.activeCamera = createPlayerCamera();
        }

        renderer.setAnimationLoop(this.animate);
        window.addEventListener('resize', this.onWindowResize);

        if (!this.options.isSpectator) {
            this.options.input.connect();
        }
    }

    dispose(): Promise<void> {
        if (this.disposePromise) {
            return this.disposePromise;
        }

        this.disposed = true;
        this.options.stopLocalInput();

        this.options.renderer.setAnimationLoop(null);
        window.removeEventListener('resize', this.onWindowResize);
        this.options.input.dispose();

        const multiplayerDisposePromise = this.options
            .getMultiplayer()
            ?.dispose();
        this.options.socket.removeAllListeners();
        this.options.socket.disconnect();

        this.disposePromise = (async () => {
            this.options.getRPSGame()?.dispose();
            this.options.getTTTGame()?.dispose();
            this.spectatorControls?.dispose();
            this.options.getCamera()?.orbitControls.dispose();
            this.timer.dispose();

            const player = this.options.getPlayer();
            await Promise.all([
                player?.forceDispose(),
                multiplayerDisposePromise,
            ]);

            this.options.resourceDisposer.disposeObject3D(this.options.scene);
            this.options.resourceDisposer.disposeTexture(this.options.texture);
            this.options.scene.clear();
            this.options.colliders.length = 0;
            this.options.remoteMeshes.length = 0;
            this.activeCamera = null;
            this.spectatorControls = null;
            this.options.clearRuntimeState();
        })();

        return this.disposePromise;
    }

    private readonly onWindowResize = (): void => {
        if (!this.activeCamera) {
            return;
        }

        this.activeCamera.aspect = window.innerWidth / window.innerHeight;
        this.activeCamera.updateProjectionMatrix();
        this.options.renderer.setSize(window.innerWidth, window.innerHeight);
    };

    private readonly animate = (): void => {
        if (this.disposed) {
            return;
        }

        const multiplayer = this.options.getMultiplayer();
        if (
            !this.activeCamera ||
            !multiplayer ||
            (!this.options.isSpectator &&
                !this.options.getWorldLoader().isEnvironmentLoaded)
        ) {
            return;
        }

        this.timer.update();
        const lifecycleDelta = this.timer.getDelta();
        /** begrenze Frame-Zeit nur für Bewegung und Physik */
        const delta = Math.min(lifecycleDelta, 0.05);

        if (this.options.isSpectator) {
            this.spectatorControls?.update(delta);
        } else {
            const player = this.options.getPlayer();
            const camera = this.options.getCamera();
            const tttGame = this.options.getTTTGame();
            const rpsGame = this.options.getRPSGame();
            const storyManager = this.options.getStoryManager();
            const interactionManager = this.options.getInteractionManager();

            if (
                !player ||
                !camera ||
                !tttGame ||
                !rpsGame ||
                !storyManager ||
                !interactionManager
            ) {
                return;
            }

            player.updateLifecycle(lifecycleDelta);
            this.options.input.update(delta);

            this.previousPlayerPosition.copy(player.group.position);
            player.updateCharacter(delta);

            if (!storyManager.inCutscene) {
                this.playerMovementDelta.subVectors(
                    player.group.position,
                    this.previousPlayerPosition
                );
                camera.camera.position.add(this.playerMovementDelta);

                if (tttGame.tttCamera) {
                    camera.orbitControls.target
                        .copy(player.group.position)
                        .setY(player.group.position.y + 1.75);
                } else {
                    camera.orbitControls.target
                        .copy(player.group.position)
                        .setY(player.group.position.y + 1);
                }
                this.options.followGroup.position.copy(player.group.position);
                camera.orbitControls.update();
                camera.cameraCollisionRaycast(delta, player.group);
            }
        }

        this.options.renderer.clear();
        this.options.renderer.render(this.options.scene, this.activeCamera);
        this.options.getTTTGame()?.render();
        this.options.getRPSGame()?.render();

        multiplayer.updateMultiplayer(delta, lifecycleDelta);

        const player = this.options.getPlayer();
        const rpsGame = this.options.getRPSGame();
        const interactionManager = this.options.getInteractionManager();
        if (
            !this.options.isSpectator &&
            player &&
            rpsGame &&
            interactionManager
        ) {
            if (!this.options.isLocalPlayerDespawning()) {
                rpsGame.updateCheck();
            }

            const interactionInZone = interactionManager.update(
                player.group.position
            );
            const completedEventSpaceQuestId =
                interactionManager.eventSpaceQuest.updateTraversal(
                    interactionInZone,
                    this.options.getWorldLoader().eventSpaceDoorsOpen
                );
            if (completedEventSpaceQuestId !== null) {
                this.options.onGameEvent?.({
                    eventType: EventType.QuestCompleted,
                    data: {
                        questId: completedEventSpaceQuestId,
                    },
                    logtime: new Date(),
                });
            }
        }

        this.options.npcManager.updateAnimations(delta);
    };
}
