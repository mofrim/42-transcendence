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
import { addBlackhole } from './QuestBlackHole.js';
import { WorldLoader } from './WorldLoader.js';
import { RenderLoop } from './RenderLoop.js';
import { MinigameEvent } from './MinigameEvent.js';
import { EnvCubeAnimationManager } from './EnvCubeAnimationManager.js';
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
    onDialogChange?: (state: { isOpen: boolean; message: string }) => void,
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
    let storyManager: Story_Manager | null = null;
    let interactionManager: InteractionManager | null = null;
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
    // const renderer = new THREE.WebGLRenderer({ antialias: true });
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
    // const texture = new THREE.TextureLoader().load('textures/gradientMaps/twoTone2.jpg');
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
    //const octreeDelete = new Octree();
    //const OctreeSpawn = new Octree();
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

    //let camDistance = 0;

    /* function createSkyBox():void {
        const skyGeometry = new THREE.SphereGeometry(70, 32, 32);
        const skyMaterial = new THREE.MeshBasicMaterial({ color: 0x87CEEB, side: THREE.BackSide });
        const sky = new THREE.Mesh(skyGeometry, skyMaterial);
        scene.add(sky);
    } */

    void init().catch((error: unknown) => {
        if (!renderLoop.isDisposed) {
            console.error('Game runtime initialization failed:', error);
        }
    });

    async function init() {
        //scene = new THREE.Scene();
        scene.background = new THREE.Color(0x999999);
        /* scene.fog = new THREE.Fog( 0x5b6470, 2, 30 ); */

        //followGroup = new THREE.Group();
        scene.add(followGroup);

        // Door A and B positions from Blender 3D scene
        groupDoorA.position.set(15.913, 3.72467, -17.421);
        groupDoorB.position.set(16.0871, 3.72467, -9.1304);
        groupDoorMain.position.set(9.9817, 0.01149, -0.7933);
        scene.add(groupDoorA, groupDoorB, groupDoorMain);

        //dirLight = new THREE.DirectionalLight(0xffffff, 2.5);
        // initial position (local to followGroup) - matches previous values
        //dirLight.position.set( - 2, 5, - 3 );
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

        /** Shadow map size is set to balance between quality and performance. */
        dirLight.shadow.mapSize.setScalar(6144);
        fillLight.shadow.mapSize.setScalar(6144);
        scene.add(dirLight, dirLight.target, fillLight, fillLight.target);

        /* dirLightLow.shadow.mapSize.set( 1024, 1024 );
        followGroup.add( dirLightLow );
        followGroup.add( dirLightLow.target ); */

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
                worldOctreeInteractive
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

        // NOTE uncommented for React! we need the domElement
        // THREE.WebGLRenderer returns for React to handle it.
        //
        //renderer = new THREE.WebGLRenderer({ antialias: true });

        // NOTE uncommented for React!
        //
        // document.body.appendChild(renderer.domElement);

        // NOTE uncommented for React!
        //
        //container.appendChild(renderer.domElement);

        renderLoop.start(() => {
            camera = new Camera(window, renderer, mesh_col);
            return camera.camera;
        });
        //const startV = new THREE.Vector3(0, 1, 0);
        //camDistance = startV.distanceTo(camera.camera.position);
        //console.log("Distance " + camDistance);
        npcManager.initialize();
        const plane = new THREE.Mesh(
            new THREE.BoxGeometry(35, 0.05, 35),
            new THREE.MeshStandardMaterial({ color: 0xffffff })
        );
        plane.position.set(0, -0.025, 0);
        plane.receiveShadow = true;
        //scene.add(plane);
        worldOctree.fromGraphNode(plane);
        if (!isSpectator && player && camera) {
            // Removed the unused TTT button constructor argument
            tttGame = new TTT_Game(scene, player, tttBox, renderer);
            rpsGame = new RPS_Game(
                scene,
                socket,
                player,
                multiplayer.players,
                renderer,
                // Connecting RPS range detection to meet student Quest
                (nearbyPlayer) => {
                    onGameEvent?.({
                        id: 0,
                        eventType: EventType.PlayerInRange,
                        data: {
                            playerId: nearbyPlayer.id,
                            remoteNick: minigameEvent.resolvePlayerNickname(
                                nearbyPlayer.id,
                                nearbyPlayer.nickname
                            ),
                        },
                        logtime: new Date(),
                        user,
                    });
                }
            );
            interactionManager = new InteractionManager(scene, npcManager);
            interactionManager.onInteraction = (interaction) => {
                storyManager?.handleInteraction(interaction);
                //onQuestComplete?.(interaction);

                if (
                    interactionManager?.eventSpaceQuest.interactions.includes(
                        interaction
                    )
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
                onDialogChange,
                resetGameStateAfterBlackHole
            );
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

        // TODO: Need to check with quest state.
        // If duck already found, than show duck_up, else show duck_down.
        duck_down = await worldLoader.loadMesh(MODEL_DUCK_DOWN);
        if (renderLoop.isDisposed) return;
        addBlackhole(scene);
        if (storyManager) {
            await storyManager.GameIntro();
            if (renderLoop.isDisposed) return;
            onGameplayReady?.();
        }
        /* const testCube = new THREE.Mesh(
            new THREE.BoxGeometry(1, 1, 1),
            new THREE.MeshBasicMaterial({ color: 0xff0000 })
        );
        testCube.position.copy(new THREE.Vector3(0, 0.5, 0));
        scene.add(testCube);
        scene.add(new THREE.AmbientLight(0xffffff, 12)); */
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
    // Test function fo spawn and delete
    /* function onDeleteCollision(): void {
        if(!player || !multiplayer) return;

        const result = octreeDelete.capsuleIntersect(player.playerCollider);
        if (result) {
            if (multiplayer.players.get(1)) {
                console.log("DELETE COLLISION");
                multiplayer.players.get(1).removePlayer();
            }
        }
    }
    function onSpawnCollision(): void {
        const result = OctreeSpawn.capsuleIntersect(player.playerCollider);
        if (result) {
            if (multiplayer.players.get(1) === undefined) {
                console.log("SPAWN COLLISION");
                multiplayer.spawnPlayer(1);
            }
        }
    } */
    const multiplayerRuntimeActions = createMultiplayerRuntimeActions({
        isDisposed: () => renderLoop.isDisposed,
        getMultiplayer: () => multiplayer,
    });
    return {
        ...multiplayerRuntimeActions,
        despawnLocalPlayer,
        dispose: () => renderLoop.dispose(),
        continueDialogue(): void {
            storyManager?.continueDialogue();
        },
        triggerBlackHoleCutscene(): void {
            if (renderLoop.isDisposed) {
                return;
            }
            multiplayer?.emitBlackHoleTimeout();
            multiplayer?.emitGameReset();
            storyManager?.blackHoleCutscene();
        },
    };
}
