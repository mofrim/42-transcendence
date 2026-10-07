import * as THREE from 'three';
import { Octree } from 'three/addons/math/Octree.js';
import {
    createMultiplayerRuntimeActions,
    MultiplayerManager,
} from './multiplayer.js';
import { NPCManager } from './npc.js';
import { Player } from './player.js';
import { Camera } from './camera.js';
import { TTT_Game } from './MinigameTTT.js';
import { RPS_Game } from './MinigameRPS.js';
import { createResourceDisposer } from './ResourceDisposer.js';
import { Story_Manager } from './story_manager.js';
import { InteractionManager } from './interaction_manager.js';
import { Input } from './Input.js';
import { TokenQuestFrontdesk } from './QuestToken.js';
import {
    isLostTokenQuestCompleted,
    shouldEnableFrontDoorQuest,
} from './QuestTokenState.js';
import { addBlackhole } from './QuestBlackHole.js';
import { WorldLoader } from './WorldLoader.js';
import { RenderLoop } from './RenderLoop.js';
import { MinigameEvent } from './MinigameEvent.js';
import { EnvCubeAnimationManager } from './EnvCubeAnimationManager.js';
import { FriendInteraction } from '../ui/ingame/FriendRequest.js';
import {
    getPlayerModelPath,
    IMG_DISPLAY_BOOKING,
    IMG_DISPLAY_EVAL,
    IMG_DISPLAY_GRAPH,
    IMG_DISPLAY_INTRA,
    IMG_GRADIENT,
    MODEL_CLOUDS,
    MODEL_DISPLAY,
    MODEL_DOOR_A,
    MODEL_DOOR_B,
    MODEL_DOOR_MAIN,
    MODEL_DUCK_DOWN,
    MODEL_DUCK_UP,
    MODEL_MAP,
    MODEL_ROCKS,
} from './Assets.js';
import { io } from 'socket.io-client';
import {
    TTTMeshBoard,
    GameEvent,
    EventType,
    User,
    type DialogState,
    type FriendRequestChangeHandler,
    type FriendStateSnapshotHandler,
    type GLBMesh,
    type ReceivedChatPayload,
    type SaveGameSnapshot,
    type SocketAuth,
} from 'ftr-common/sharedTypes';

export type GameRuntime = {
    readonly sendChatMessage: (message: string) => void;
    readonly updateBlackHoleTimer: (
        secondsRemaining: number,
        completed: boolean
    ) => void;
    readonly updateQuestStatus: (completedQuestIds: readonly string[]) => void;
    readonly removeFriend: (friendPlayerId: string) => void;
    readonly despawnLocalPlayer: () => Promise<void>;
    readonly dispose: () => Promise<void>;
    readonly playIntroCutscene: () => Promise<void>;
    readonly continueDialogue: () => void;
    readonly triggerBlackHoleCutscene: () => void;
};
export type GameMode = NonNullable<SocketAuth['role']>;
export function startGame(
    whichCharacter: boolean = true,
    user: User,
    serverUrl: string,
    renderer: THREE.WebGLRenderer,
    onGameEvent?: (event: GameEvent) => void,
    onDialogChange?: (state: DialogState) => void,
    mode: GameMode = 'player',
    onChatMessage?: (message: ReceivedChatPayload) => void,
    onGameReset?: () => void,
    onGameplayReady?: () => void,
    onFriendRequestChange?: FriendRequestChangeHandler,
    onFriendStateSnapshot?: FriendStateSnapshotHandler,
    onSaveGameRestore?: (snapshot: SaveGameSnapshot | null) => Promise<void>,
    onConnectionChange?: (connected: boolean) => void
): GameRuntime {
    const isSpectator = mode === 'spectator';

    let socketAuth: SocketAuth;

    if (isSpectator) {
        socketAuth = { role: 'spectator' };
    } else {
        socketAuth = {
            role: 'player',
            userId: user.id,
            character: whichCharacter,
            nickname: user.nickname,
        };
    }

    // Establish server connection.
    const socket = io(serverUrl, {
        auth: socketAuth,
        withCredentials: true,
    });

    let player: Player | null = null;
    let multiplayer: MultiplayerManager | null = null;
    let camera: Camera | null = null;
    let tttGame: TTT_Game | null = null;
    let rpsGame: RPS_Game | null = null;
    let friendInteraction: FriendInteraction | null = null;
    let storyManager: Story_Manager | null = null;
    const { promise: storyManagerReady, resolve: resolveStoryManagerReady } =
        Promise.withResolvers<Story_Manager>();
    let interactionManager: InteractionManager | null = null;
    let completedQuestIdsForWorld: readonly string[] = [];
    const {
        promise: initialQuestStateReady,
        resolve: resolveInitialQuestStateReady,
    } = Promise.withResolvers<readonly string[]>();
    let isLocalPlayerDespawning = false;
    let localPlayerDespawnPromise: Promise<void> | null = null;
    const tokenQuestFrontdesk = new TokenQuestFrontdesk(onGameEvent);
    const minigameEvent = new MinigameEvent({
        user,
        localCharacter: whichCharacter,
        getSocketId: () => socket.id,
        getPlayer: () => player,
        getMultiplayer: () => multiplayer,
        getTTTGame: () => tttGame,
        getRPSGame: () => rpsGame,
        onGameEvent,
    });

    // ========================================================================
    // GAME SETUP
    // ========================================================================

    const scene = new THREE.Scene();
    const npcManager = new NPCManager(scene, tokenQuestFrontdesk);
    const runtimeResourceDisposer = createResourceDisposer();
    const followGroup = new THREE.Group();
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.25);
    const fillLight = new THREE.DirectionalLight(0xffffff, 1.25);
    const groupDoorA = new THREE.Group();
    const groupDoorB = new THREE.Group();
    const groupDoorMain = new THREE.Group();
    let duck_down: THREE.Object3D | null = null;
    let duck_up: THREE.Object3D | null = null;
    let display: THREE.Object3D | null = null;
    const textureLoader = new THREE.TextureLoader();
    const texture = textureLoader.load(IMG_GRADIENT);
    texture.minFilter = THREE.NearestFilter;
    texture.magFilter = THREE.NearestFilter;

    function stopLocalInput(): void {
        isLocalPlayerDespawning = true;
        input.stop();
    }

    function despawnLocalPlayer(): Promise<void> {
        if (localPlayerDespawnPromise) {
            return localPlayerDespawnPromise;
        }

        stopLocalInput();

        localPlayerDespawnPromise = (async () => {
            try {
                if (player) {
                    player.controls.key = input.keys;
                    await player.startDespawn();
                }
            } finally {
                await renderLoop.dispose();
            }
        })();
        return localPlayerDespawnPromise;
    }

    const worldOctree = new Octree();
    const worldOctreeInteractive = new Octree();
    const mesh_col: GLBMesh[] = [];
    const mesh_RP: THREE.Mesh[] = [];
    const tttBox: TTTMeshBoard = new TTTMeshBoard();
    const input = new Input({
        domElement: renderer.domElement,
        colliders: mesh_col,
        whichCharacter,
        getPlayer: () => player,
        getCamera: () => camera,
        getMultiplayer: () => multiplayer,
        getRPSGame: () => rpsGame,
        getNearbyPlayer: () => multiplayer?.getNearbyPlayer() ?? null,
        getTTTGame: () => tttGame,
        getStoryManager: () => storyManager,
        getInteractionManager: () => interactionManager,
        isLocalPlayerDespawning: () => isLocalPlayerDespawning,
    });
    const cubeAnimation = new EnvCubeAnimationManager(scene);
    const renderLoop: RenderLoop = new RenderLoop({
        renderer,
        scene,
        socket,
        input,
        npcManager,
        followGroup,
        texture,
        colliders: mesh_col,
        remoteMeshes: mesh_RP,
        resourceDisposer: runtimeResourceDisposer,
        isSpectator,
        getWorldLoader: (): WorldLoader => worldLoader,
        getPlayer: () => player,
        getMultiplayer: () => multiplayer,
        getCamera: () => camera,
        getTTTGame: () => tttGame,
        getRPSGame: () => rpsGame,
        getFriendInteraction: () => friendInteraction,
        getStoryManager: () => storyManager,
        getInteractionManager: () => interactionManager,
        isLocalPlayerDespawning: () => isLocalPlayerDespawning,
        stopLocalInput,
        clearRuntimeState(): void {
            player = null;
            multiplayer = null;
            camera = null;
            tttGame = null;
            rpsGame = null;
            friendInteraction = null;
            minigameEvent.reset();
        },
        onGameEvent,
        onFrameUpdate: (delta) => cubeAnimation.update(delta),
    });
    const worldLoader: WorldLoader = new WorldLoader({
        scene,
        worldOctree,
        worldOctreeInteractive,
        colliders: mesh_col,
        tttBoard: tttBox,
        doorGroupA: groupDoorA,
        doorGroupB: groupDoorB,
        doorGroupMain: groupDoorMain,
        gradientTexture: texture,
        resourceDisposer: runtimeResourceDisposer,
        isDisposed: (): boolean => renderLoop.isDisposed,
    });

    function syncLostTokenQuestStatus(): void {
        if (!interactionManager) {
            return;
        }

        if (isLostTokenQuestCompleted(completedQuestIdsForWorld)) {
            interactionManager.lostTokenQuest.collect();
        } else {
            interactionManager.lostTokenQuest.reset();
        }

        if (shouldEnableFrontDoorQuest(completedQuestIdsForWorld)) {
            interactionManager.frontDoorQuest.interaction.enableInteraction();
        } else {
            interactionManager.frontDoorQuest.interaction.disableInteraction();
        }
    }

    void init().catch((error: unknown) => {
        if (!renderLoop.isDisposed) {
            console.error('Game runtime initialization failed:', error);
        }
    });

    async function init() {
        scene.background = new THREE.Color(0x999999);

        scene.add(followGroup);

        // Door A and B positions from Blender 3D scene
        groupDoorA.position.set(15.913, 3.72467, -17.421);
        groupDoorB.position.set(16.0871, 3.72467, -9.1304);
        groupDoorMain.position.set(9.9817, 0.01149, -0.7933);
        scene.add(groupDoorA, groupDoorB, groupDoorMain);

        dirLight.position.set(15, 30, -5);
        dirLight.target.position.set(50, 0, 5);
        dirLight.castShadow = true;
        fillLight.position.set(15, 30, -5);
        fillLight.target.position.set(50, 0, 5);
        fillLight.castShadow = false;
        const cam = dirLight.shadow.camera;
        cam.top = cam.right = 115;
        cam.bottom = cam.left = -115;
        cam.near = 1;
        cam.far = 50;
        const camFill = fillLight.shadow.camera;
        camFill.top = camFill.right = 115;
        camFill.bottom = camFill.left = -115;
        camFill.near = 1;
        camFill.far = 50;

        // Shadow map size is set to balance between quality and performance.
        dirLight.shadow.mapSize.setScalar(6144);
        fillLight.shadow.mapSize.setScalar(6144);
        scene.add(dirLight, dirLight.target, fillLight, fillLight.target);

        // add a small ambient light to lift shadows slightly
        const ambientLight = new THREE.AmbientLight(0xffffff, 2.0);
        scene.add(ambientLight);

        if (!isSpectator) {
            const playerModelPath = getPlayerModelPath(whichCharacter);
            console.log('Player model path: ' + playerModelPath);
            player = new Player(
                playerModelPath,
                scene,
                worldOctree,
                worldOctreeInteractive,
                user.id
            );
        }
        multiplayer = new MultiplayerManager(scene, mesh_RP, {
            socket,
            localPlayer: player,
            user,
            onGameEvent,
            onChatMessage,
            onFriendRequestChange,
            onFriendStateSnapshot,
            onSaveGameRestore,
            onConnectionChange,
            gameHandlers: minigameEvent.handlers,
        });

        renderLoop.start(() => {
            camera = new Camera(window, renderer, mesh_col);
            return camera.camera;
        });
        npcManager.initialize();
        const plane = new THREE.Mesh(
            new THREE.BoxGeometry(35, 0.05, 35),
            new THREE.MeshStandardMaterial({ color: 0xffffff })
        );
        plane.position.set(0, -0.025, 0);
        plane.receiveShadow = true;
        worldOctree.fromGraphNode(plane);
        if (!isSpectator && player && camera) {
            // Removed the unused TTT button constructor argument
            tttGame = new TTT_Game(scene, player, tttBox, renderer);
            friendInteraction = new FriendInteraction(
                scene,
                () => multiplayer?.getNearbyPlayer() ?? null
            );
            rpsGame = new RPS_Game(
                scene,
                socket,
                player,
                renderer,
                () => multiplayer?.getNearbyPlayer() ?? null
            );

            interactionManager = new InteractionManager(scene, npcManager);
            syncLostTokenQuestStatus();
            interactionManager.onInteraction = async (interaction) => {
                storyManager?.handleInteraction(interaction);
                const completedQuests = new Set(await initialQuestStateReady);

                if (
                    interactionManager?.eventSpaceQuest.interactions.includes(
                        interaction
                    ) &&
                    completedQuests.has('START_EVALUATION')
                ) {
                    worldLoader.openEventSpaceDoors();
                }
                if (
                    interactionManager?.frontDoorQuest.interaction ===
                    interaction
                ) {
                    worldLoader.openMainDoor();
                }
            };
            storyManager = new Story_Manager(
                scene,
                player,
                renderer,
                camera,
                input.keyStates,
                input.keys,
                interactionManager,
                npcManager,
                onDialogChange,
                resetGameStateAfterBlackHole
            );
            resolveStoryManagerReady(storyManager);
            storyManager.onQuestInteraction = (questId) => {
                onGameEvent?.({
                    eventType: EventType.QuestCompleted,
                    data: { questId: questId },
                    logtime: new Date(),
                    user,
                });
                tokenQuestFrontdesk.handleQuestCompletion(questId);
            };
            storyManager.onQuestDuckFound = async () => {
                duck_up = await worldLoader.loadMesh(MODEL_DUCK_UP);
                if (duck_down) {
                    runtimeResourceDisposer.disposeObject3D(duck_down);
                    duck_down = null;
                }
            };
            storyManager.onQuestLogin = async () => {
                display = await worldLoader.loadMesh(MODEL_DISPLAY);
                console.log('Display loaded');
                changeObjectTexture(display, IMG_DISPLAY_INTRA);
            };
            storyManager.onQuestEvaluator = async () => {
                changeObjectTexture(display, IMG_DISPLAY_BOOKING);
            };
            storyManager.onQuestStartEvaluation = async () => {
                changeObjectTexture(display, IMG_DISPLAY_EVAL);
            };
            storyManager.onQuestFinished = async () => {
                console.log('Quest finished');
                changeObjectTexture(display, IMG_DISPLAY_GRAPH);

                worldLoader.openEventSpaceDoorA();
                await storyManager?.openEventSpaceDoorACutscene();
                worldLoader.openEventSpaceDoorB();
                await storyManager?.openEventSpaceDoorBCutscene();
                worldLoader.openEventSpaceDoors();

                interactionManager?.evaluatingStudentQuest.placeEvaluatingStudentAtStartPosition();
            };
        }
        await worldLoader.loadMesh(MODEL_MAP);
        if (renderLoop.isDisposed) return;
        multiplayer.startPlayerUpdateLoop();
        await worldLoader.loadSky(MODEL_CLOUDS);
        if (renderLoop.isDisposed) return;
        await worldLoader.loadSky(MODEL_ROCKS);
        if (renderLoop.isDisposed) return;
        await worldLoader.loadMesh(MODEL_DOOR_A);
        if (renderLoop.isDisposed) return;
        await worldLoader.loadMesh(MODEL_DOOR_B);
        if (renderLoop.isDisposed) return;
        await worldLoader.loadMesh(MODEL_DOOR_MAIN);
        if (renderLoop.isDisposed) return;

        duck_down = await worldLoader.loadMesh(MODEL_DUCK_DOWN);
        if (renderLoop.isDisposed) return;
        addBlackhole(scene);

        if (!isSpectator) {
            const restoredCompletedQuestIds = await initialQuestStateReady;
            if (renderLoop.isDisposed) return;
            await applyQuestStateToWorld(restoredCompletedQuestIds);
            if (renderLoop.isDisposed) return;
        }

        if (storyManager) {
            onGameplayReady?.();
        }
    }

    async function applyQuestStateToWorld(
        completedQuestIds: readonly string[]
    ): Promise<void> {
        const completedQuests = new Set(completedQuestIds);

        // Set the state of the environment based on the completed quests
        if (completedQuests.has('ENTER_CAMPUS_TOKEN')) {
            console.log('[init] opening front doors...');
            worldLoader.openMainDoor();
        }
        if (completedQuests.has('RUBBER_DUCK')) {
            duck_up = await worldLoader.loadMesh(MODEL_DUCK_UP);
            if (duck_down) {
                runtimeResourceDisposer.disposeObject3D(duck_down);
                duck_down = null;
            }
            storyManager?.questState.set('RUBBER_DUCK', true);
            interactionManager?.interactions
                .find((interaction) => interaction.typeID === 'RUBBER_DUCK')
                ?.reset(false);
        }
        if (completedQuests.has('COFFEE')) {
            storyManager?.questState.set('COFFEE', true);
            interactionManager?.interactions
                .find((interaction) => interaction.typeID === 'COFFEE')
                ?.reset(false);
        }
        if (completedQuests.has('PAPER')) {
            storyManager?.questState.set('PAPER', true);
            interactionManager?.interactions
                .find((interaction) => interaction.typeID === 'PAPER')
                ?.reset(false);
        }
        if (completedQuests.has('COMPUTER_LOGIN')) {
            storyManager?.questState.set('COMPUTER_LOGIN', true);
            interactionManager?.interactions
                .find((interaction) => interaction.typeID === 'COMPUTER_LOGIN')
                ?.reset(false);
        }
        const arePreparationQuestsCompleted = [
            ...(storyManager?.questState.values() ?? []),
        ].every(Boolean);
        if (
            arePreparationQuestsCompleted &&
            !completedQuests.has('EVALUATING_STUDENT')
        ) {
            if (!display) {
                display = await worldLoader.loadMesh(MODEL_DISPLAY);
            }
            console.log('Display loaded');
            changeObjectTexture(display, IMG_DISPLAY_INTRA);
            interactionManager?.interactions
                .find(
                    (interaction) => interaction.typeID === 'WHERE_IS_EVALUATOR'
                )
                ?.reset(true);
            storyManager?.interactionManager.evaluatingStudentQuest.unlock();
        }
        if (
            arePreparationQuestsCompleted &&
            completedQuests.has('EVALUATING_STUDENT') &&
            !completedQuests.has('START_EVALUATION')
        ) {
            if (!display) {
                display = await worldLoader.loadMesh(MODEL_DISPLAY);
            }
            changeObjectTexture(display, IMG_DISPLAY_EVAL);
            interactionManager?.interactions
                .find(
                    (interaction) => interaction.typeID === 'START_EVALUATION'
                )
                ?.reset(true);
        }
        if (completedQuests.has('START_EVALUATION')) {
            console.log('[init] opening event space doors...');
            worldLoader.openEventSpaceDoors();
            interactionManager?.interactions
                .find(
                    (interaction) => interaction.typeID === 'EVENT_SPACE_DOOR_A'
                )
                ?.reset(false);
            interactionManager?.interactions
                .find(
                    (interaction) => interaction.typeID === 'EVENT_SPACE_DOOR_B'
                )
                ?.reset(false);
            if (!display) {
                display = await worldLoader.loadMesh(MODEL_DISPLAY);
            }
            console.log('Display loaded');
            changeObjectTexture(display, IMG_DISPLAY_GRAPH);
        }

        if (interactionManager?.interactions) {
            for (const inter of interactionManager.interactions) {
                console.log(inter.typeID);
            }
        } else console.log('No interactions found in interactionManager');
    }

    function changeObjectTexture(
        mesh: THREE.Object3D | null,
        texturePath: string
    ): void {
        if (!mesh) {
            return;
        }
        const meshes = mesh.getObjectsByProperty('isMesh', true) as THREE.Mesh<
            THREE.BufferGeometry,
            THREE.MeshStandardMaterial
        >[];
        for (const child of meshes) {
            const texture = textureLoader.load(texturePath);
            texture.flipY = false;
            child.material.map = texture;
            child.material.needsUpdate = true;
        }
    }

    async function resetGameStateAfterBlackHole(): Promise<void> {
        worldLoader.resetEventSpaceDoors();
        tokenQuestFrontdesk.reset();
        if (!duck_down) {
            duck_down = await worldLoader.loadMesh(MODEL_DUCK_DOWN);
        }
        if (renderLoop.isDisposed) {
            return;
        }
        if (duck_up) {
            runtimeResourceDisposer.disposeObject3D(duck_up);
            duck_up = null;
        }
        multiplayer?.restartSaveGameAfterBlackHole();
        onGameReset?.();
    }
    const multiplayerRuntimeActions = createMultiplayerRuntimeActions({
        isDisposed: () => renderLoop.isDisposed,
        getMultiplayer: () => multiplayer,
    });
    return {
        ...multiplayerRuntimeActions,
        updateQuestStatus(completedQuestIds: readonly string[]): void {
            completedQuestIdsForWorld = completedQuestIds;
            syncLostTokenQuestStatus();
            resolveInitialQuestStateReady([...completedQuestIds]);
            multiplayerRuntimeActions.updateQuestStatus(completedQuestIds);
        },
        despawnLocalPlayer,
        dispose: () => renderLoop.dispose(),
        async playIntroCutscene(): Promise<void> {
            if (renderLoop.isDisposed) {
                return;
            }
            const manager = storyManager ?? (await storyManagerReady);
            if (renderLoop.isDisposed) {
                return;
            }
            await manager.GameIntro();
        },
        continueDialogue(): void {
            storyManager?.continueDialogue();
        },
        triggerBlackHoleCutscene(): void {
            if (renderLoop.isDisposed) {
                return;
            }
            multiplayer?.emitBlackHoleTimeout();
            multiplayer?.emitGameReset();
            void storyManager?.blackHoleCutscene(true).then(() => {
                if (!renderLoop.isDisposed) {
                    onGameplayReady?.();
                }
            });
        },
    };
}
