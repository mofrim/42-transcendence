import * as THREE from 'three';

import { Octree } from 'three/addons/math/Octree.js';

import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FlyControls } from 'three/addons/controls/FlyControls.js';

import { MultiplayerManager } from './multiplayer.js';
import { NPCManager } from './npc.js';
import { Player } from './player.js';
import { Camera } from './camera.js';
import { TTT_Game } from './ttt_game.js';
import { RPS_Game } from './rps_game.js';
import { createThreeResourceDisposer } from './ThreeResourceDisposer.js';
import { Story_Manager } from './story_manager.js';
import { InteractionManager } from './interaction_manager.js';
import { Input } from './Input.js';
import { TokenQuestFrontdesk } from './QuestToken.js';
import { addBlackhole } from './QuestBlackHole.js';
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
    MODEL_DUCK_DOWN,
    MODEL_DUCK_UP,
    MODEL_MAP,
    MODEL_ROCKS,
} from './Assets.js';

import { io } from 'socket.io-client';

import {
    RPSChoice,
    TTTMeshBoard,
    GameEvent,
    EventType,
    type EventData,
    type GLBMesh,
    type RPSInvalidPayload,
    type RPSDrawPayload,
    type RPSWinnerPayload,
    type RPSRequestDataPayload,
    type TTTMarkPayload,
    type TTTStartPayload,
    type TTTWinPayload,
    type TTTDrawPayload,
    type ReceivedChatPayload,
    type SocketAuth,
} from 'ftr-common/sharedTypes';

/** event log msgs */
// export type GameRuntimeEvent =
//     | {
//           readonly type: 'player_joined' | 'player_left' | 'player_in_range';
//           readonly playerId: string;
//           readonly nickname: string;
//       }
//     | {
//           readonly type: 'quest_completed';
//           readonly questId: string;
//       }
//     | {
//           readonly type: 'game_result';
//           readonly game: 'Tic-Tac-Toe' | 'Rock-Paper-Scissors';
//           readonly outcome: 'won' | 'lost' | 'draw';
//           readonly playerNickname: string;
//           readonly opponentNickname: string;
//       };

export type GameRuntime = {
    readonly sendChatMessage: (message: string) => void;
    readonly despawnLocalPlayer: () => Promise<void>;
    readonly dispose: () => Promise<void>;
    readonly continueDialogue: () => void;
    readonly triggerBlackHoleCutscene: () => void;
};

type NamedPlayer = {
    readonly id: string;
    readonly nickname: string;
    onDialogChange?: (state: { isOpen: boolean; message: string }) => void;
};

type ActiveTTTPlayers = {
    readonly playerOne: NamedPlayer;
    readonly playerTwo: NamedPlayer;
};

// export type GameResultEvent = Extract<
//     GameRuntimeEvent,
//     { type: 'game_result' }
// >;

export type GameMode = NonNullable<SocketAuth['role']>;

export function startGame(
    whichCharacter: boolean = true,
    localNickname: string,
    serverUrl: string,
    renderer: THREE.WebGLRenderer,
    onGameEvent?: (event: GameEvent) => void,
    onDialogChange?: (state: { isOpen: boolean; message: string }) => void,
    mode: GameMode = 'player',
    onChatMessage?: (message: ReceivedChatPayload) => void,
    onGameReset?: () => void,
    onGameplayReady?: () => void
): GameRuntime {
    // ============================================================================
    // SERVER CONNECTION
    // ============================================================================

    const isSpectator = mode === 'spectator';

    let socketAuth: SocketAuth;

    if (isSpectator) {
        socketAuth = { role: 'spectator' };
    } else {
        socketAuth = {
            role: 'player',
            character: whichCharacter,
            nickname: localNickname,
        };
    }

    /**
     * Use the page origin for the Socket.IO server address and
     * remove the redundant unsanitized pass-through variable.
     * */
    const socket = io(serverUrl, {
        auth: socketAuth,
    });

    let player: Player | null = null;
    let multiplayer: MultiplayerManager | null = null;
    let camera: Camera | null = null;
    let activeCamera: THREE.PerspectiveCamera | null = null;
    let spectatorControls: FlyControls | null = null;
    let tttGame: TTT_Game | null = null;
    let rpsGame: RPS_Game | null = null;
    let storyManager: Story_Manager | null = null;
    let interactionManager: InteractionManager | null = null;
    let activeTTTPlayers: ActiveTTTPlayers | null = null;
    let isLocalPlayerDespawning = false;
    let localPlayerDespawnPromise: Promise<void> | null = null;
    let runtimeDisposePromise: Promise<void> | null = null;
    let runtimeDisposed = false;
    let eventSpaceDoorsOpen = false;
    const tokenQuestFrontdesk = new TokenQuestFrontdesk(onGameEvent);
    const doorMeshesNames: string[] = [];

    function handleRPSInvalid(data: RPSInvalidPayload) {
        if (!player) return;
        if (data.playerOne === player.id || data.playerTwo === player.id) {
            console.log('Invalid RPS choice received.');
            if (!rpsGame) return;
            rpsGame.yourChoice = RPSChoice.None;
            rpsGame.opponentChoice = RPSChoice.None;
            //rpsGame.playChoiceAnimation = false;
            //rpsGame.solutionRPSAnimation();
            rpsGame.solutionRPSAnimation();
        }
    }

    function handleRPSDraw(data: RPSDrawPayload) {
        console.log('RPS Draw: ' + data.playerOne + ' and ' + data.playerTwo);
        if (!player) return;

        if (data.playerOne === player.id || data.playerTwo === player.id) {
            console.log('The RPS game ended in a draw!');
            if (!rpsGame) return;
            rpsGame.yourChoice = data.choice;
            rpsGame.opponentChoice = data.choice;

            let opponentId = data.playerOne;
            if (data.playerOne === player.id) {
                opponentId = data.playerTwo;
            }
            emitLocalGameResult(
                'Rock-Paper-Scissors',
                'draw',
                resolvePlayerNickname(opponentId)
            );

            rpsGame.solutionRPSAnimation();
            /* if(rpsGame.playChoiceAnimation == false)
                rpsGame.solutionRPSAnimation();
            else
                rpsGame.playChoiceAnimation = false; */
        }
    }

    function handleRPSWinner(data: RPSWinnerPayload) {
        if (!player || !rpsGame) return;

        let outcome: NonNullable<EventData['outcome']>;
        let opponentId: string;
        let yourChoice: RPSChoice;
        let opponentChoice: RPSChoice;

        if (data.winner === player.id) {
            console.log('You won the RPS game!');
            outcome = 'won';
            opponentId = data.loser;
            yourChoice = data.winnerChoice;
            opponentChoice = data.loserChoice;
        } else if (data.loser === player.id) {
            console.log('You lost the RPS game!');
            outcome = 'lost';
            opponentId = data.winner;
            yourChoice = data.loserChoice;
            opponentChoice = data.winnerChoice;
        } else {
            return;
        }

        emitLocalGameResult(
            'Rock-Paper-Scissors',
            outcome,
            resolvePlayerNickname(opponentId)
        );
        rpsGame.yourChoice = yourChoice;
        rpsGame.opponentChoice = opponentChoice;
        rpsGame.solutionRPSAnimation();
    }
    /* function handleChoice(data){
        if(data.requestedPlayerID !== player.id)
            return;

        rpsGame.opponentChoice = data.choice;
        console.log("Player " + data.id + " made a choice: " + data.choice);
    } */

    function handleRPSAccept(data: RPSRequestDataPayload) {
        if (!player) return;
        if (data.requestedPlayerID !== player.id) return;
        if (!rpsGame) return;
        player.battleRequested = false;
        if (!multiplayer) return;
        const opponentPlayer = multiplayer.players.get(data.id);
        if (!opponentPlayer) return;
        opponentPlayer.battleRequested = false;
        console.log('Battle accepted from player ' + data.id);
        rpsGame.startRPSAnimation(whichCharacter, opponentPlayer.character);
    }

    function handleRPSDecline(data: RPSRequestDataPayload) {
        if (!player) return;

        if (data.requestedPlayerID !== player.id) return;

        if (!rpsGame) return;
        player.battleRequested = false;
        player.youSendRPGRequest = false;
        if (!multiplayer) return;
        const opponentPlayer = multiplayer.players.get(data.id);
        if (!opponentPlayer) return;
        opponentPlayer.battleRequested = false;
        console.log('Battle declined from player ' + data.id);
    }

    function handleRPSRequest(data: RPSRequestDataPayload) {
        //console.log("Marking 2: " + data.board);
        if (!player) return;
        if (data.requestedPlayerID !== player.id) return;

        player.battleRequested = true;

        if (!rpsGame) return;
        rpsGame.BattleRequest(
            data.id,
            // Send server-stored nicknames to the minigame event
            resolvePlayerNickname(data.id, data.nickname)
        );
        //console.log("You accepted a battle with player " + rpsGame.playerInRange.id);
    }

    function handleTTTupdate(data: TTTMarkPayload) {
        //console.log("Marking 2: " + data.board);
        if (!tttGame) return;
        tttGame.markField(data.fieldName, data.id, data.mark);
    }

    function handleTTTstart(data: TTTStartPayload) {
        if (!tttGame || !player || !multiplayer) return;

        const localPlayerID = player.id ?? socket.id;
        let opponentCharacter = whichCharacter;
        if (data.playerOne === localPlayerID) {
            const opponentPlayer = multiplayer.players.get(data.playerTwo);
            if (!opponentPlayer) return;
            opponentCharacter = opponentPlayer.character;
        } else if (data.playerTwo === localPlayerID) {
            const opponentPlayer = multiplayer.players.get(data.playerOne);
            if (!opponentPlayer) return;
            opponentCharacter = opponentPlayer.character;
        }

        const accepted = tttGame.startGame(
            data.playerOne,
            data.playerTwo,
            data.playerOneNickname,
            data.playerTwoNickname,
            whichCharacter,
            opponentCharacter
        );
        if (!accepted) return;

        activeTTTPlayers = {
            playerOne: createNamedPlayer(
                data.playerOne,
                data.playerOneNickname
            ),
            playerTwo: createNamedPlayer(
                data.playerTwo,
                data.playerTwoNickname
            ),
        };
    }

    function getActiveTTTOpponent(
        localPlayerId: string | undefined
    ): NamedPlayer | null {
        if (!localPlayerId || !activeTTTPlayers) {
            return null;
        }
        if (activeTTTPlayers.playerOne.id === localPlayerId) {
            return activeTTTPlayers.playerTwo;
        }
        if (activeTTTPlayers.playerTwo.id === localPlayerId) {
            return activeTTTPlayers.playerOne;
        }
        return null;
    }

    function handleTTTwin(data: TTTWinPayload) {
        if (!tttGame) return;
        const localPlayerId = player?.id;
        const opponent = getActiveTTTOpponent(localPlayerId);
        if (localPlayerId && opponent) {
            let outcome: EventData['outcome'] = 'lost';
            if (data.id === localPlayerId) {
                outcome = 'won';
            }

            emitLocalGameResult('Tic-Tac-Toe', outcome, opponent.nickname);
        }
        tttGame.drawWin(data.winner);
        tttGame.winner(
            data.id,
            // Send server-stored nicknames to the minigame event
            data.nickname
        );
        tttGame.endGame();
        activeTTTPlayers = null;
    }

    function handleTTTdraw(_data: TTTDrawPayload) {
        if (!tttGame) return;
        void _data;

        const opponent = getActiveTTTOpponent(player?.id);
        if (opponent) {
            emitLocalGameResult('Tic-Tac-Toe', 'draw', opponent.nickname);
        }

        tttGame.draw();
        tttGame.endGame();
        activeTTTPlayers = null;
    }

    function emitLocalGameResult(
        game: EventData['game'],
        outcome: EventData['outcome'],
        opponentNickname: string
    ): void {
        onGameEvent?.({
            eventType: EventType.GameResult,
            data: {
                game: game!,
                outcome: outcome!,
                playerNickname: localNickname,
                opponentNickname: opponentNickname,
            },
            logtime: new Date(),
        });
    }

    function resolvePlayerNickname(
        playerId: string,
        fallbackNickname?: string
    ): string {
        if (multiplayer) {
            return multiplayer.resolvePlayerNickname(
                playerId,
                fallbackNickname
            );
        }

        if (playerId === player?.id || playerId === socket.id) {
            return localNickname;
        }

        const fallback = fallbackNickname?.trim();
        if (fallback) {
            return fallback;
        }

        return playerId;
    }

    function createNamedPlayer(
        playerId: string,
        fallbackNickname?: string
    ): NamedPlayer {
        return {
            id: playerId,
            nickname: resolvePlayerNickname(playerId, fallbackNickname),
        };
    }

    // ============================================================================
    // GAME SETUP
    // ============================================================================

    const scene = new THREE.Scene();
    const npcManager = new NPCManager(scene, tokenQuestFrontdesk);
    // const renderer = new THREE.WebGLRenderer({ antialias: true });
    const runtimeResourceDisposer = createThreeResourceDisposer();
    const followGroup = new THREE.Group();
    const timer = new THREE.Timer();
    const previousPlayerPosition = new THREE.Vector3();
    const playerMovementDelta = new THREE.Vector3();
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.25);
    const fillLight = new THREE.DirectionalLight(0xffffff, 1.25);

    const groupDoorA = new THREE.Group();
    const groupDoorB = new THREE.Group();

    let duck_down: THREE.Object3D | null = null;
    let duck_up: THREE.Object3D | null = null;
    let display: THREE.Object3D | null = null;

    let envLoaded: boolean = false;
    const textureLoader = new THREE.TextureLoader();
    const texture = textureLoader.load(IMG_GRADIENT);
    const loader = new GLTFLoader();
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
                await disposeRuntime();
            }
        })();

        return localPlayerDespawnPromise;
    }

    /** ThreeJS Cleanup */
    function disposeRuntime(): Promise<void> {
        if (runtimeDisposePromise) {
            return runtimeDisposePromise;
        }

        runtimeDisposed = true;
        stopLocalInput();

        renderer.setAnimationLoop(null);
        window.removeEventListener('resize', onWindowResize);
        input.dispose();

        const multiplayerDisposePromise = multiplayer?.dispose();
        socket.removeAllListeners();
        socket.disconnect();

        runtimeDisposePromise = (async () => {
            rpsGame?.dispose();
            tttGame?.dispose();
            spectatorControls?.dispose();
            camera?.orbitControls.dispose();
            timer.dispose();

            const completions: Promise<void>[] = [];
            if (player) {
                completions.push(player.forceDispose());
            }
            if (multiplayerDisposePromise) {
                completions.push(multiplayerDisposePromise);
            }
            await Promise.all(completions);

            runtimeResourceDisposer.disposeObject3D(scene);
            runtimeResourceDisposer.disposeTexture(texture);
            scene.clear();
            mesh_col.length = 0;
            mesh_RP.length = 0;
            player = null;
            multiplayer = null;
            camera = null;
            activeCamera = null;
            spectatorControls = null;
            tttGame = null;
            rpsGame = null;
            activeTTTPlayers = null;
        })();

        return runtimeDisposePromise;
    }

    const worldOctree = new Octree();
    //const octreeDelete = new Octree();
    //const OctreeSpawn = new Octree();

    const mesh_col: GLBMesh[] = [];
    const mesh_Octree: THREE.Object3D[] = [];
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

    //let camDistance = 0;

    /* function createSkyBox():void {
        const skyGeometry = new THREE.SphereGeometry(70, 32, 32);
        const skyMaterial = new THREE.MeshBasicMaterial({ color: 0x87CEEB, side: THREE.BackSide });
        const sky = new THREE.Mesh(skyGeometry, skyMaterial);
        scene.add(sky);
    } */

    void init().catch((error: unknown) => {
        if (!runtimeDisposed) {
            console.error('Game runtime initialization failed:', error);
        }
    });

    async function init() {
        //timer = new THREE.Timer();
        timer.connect(document);

        //scene = new THREE.Scene();
        scene.background = new THREE.Color(0x999999);
        /* scene.fog = new THREE.Fog( 0x5b6470, 2, 30 ); */

        //followGroup = new THREE.Group();
        scene.add(followGroup);

        // Door A and B positions from Blender 3D scene
        groupDoorA.position.set(15.913, 3.72467, -17.421);
        groupDoorB.position.set(16.0871, 3.72467, -9.1304);
        scene.add(groupDoorA, groupDoorB);

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
            player = new Player(playerModelPath, socket.id, scene, worldOctree);
        }
        multiplayer = new MultiplayerManager(scene, mesh_RP, {
            socket,
            localPlayer: player,
            localNickname,
            onGameEvent,
            onChatMessage,
            gameHandlers: {
                onInitData(data): void {
                    tttGame?.initGame({ game: data });
                },
                onTTTPlayerOne(id): void {
                    tttGame?.setPlayerOne(id);
                },
                onTTTPlayerTwo(id): void {
                    tttGame?.setPlayerTwo(id);
                },
                onTTTStart: handleTTTstart,
                onTTTReset(): void {
                    tttGame?.resetGame();
                    activeTTTPlayers = null;
                },
                onTTTMark: handleTTTupdate,
                onTTTWin: handleTTTwin,
                onTTTDraw: handleTTTdraw,
                onRPSRequest: handleRPSRequest,
                onRPSAccept: handleRPSAccept,
                onRPSDecline: handleRPSDecline,
                onRPSWinner: handleRPSWinner,
                onRPSDraw: handleRPSDraw,
                onRPSInvalid: handleRPSInvalid,
                onDisconnect(): void {
                    tttGame?.endGame();
                },
            },
        });

        // NOTE uncommented for React! we need the domElement
        // THREE.WebGLRenderer returns for React to handle it.
        //
        //renderer = new THREE.WebGLRenderer({ antialias: true });

        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(window.innerWidth, window.innerHeight);

        // NOTE uncommented for React!
        //
        // document.body.appendChild(renderer.domElement);

        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 0.5;
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFShadowMap;

        // NOTE uncommented for React!
        //
        //container.appendChild(renderer.domElement);

        if (isSpectator) {
            activeCamera = new THREE.PerspectiveCamera(
                60,
                window.innerWidth / window.innerHeight,
                0.1,
                100
            );
            activeCamera.position.set(0, 2, -5);
            activeCamera.lookAt(0, 1, 0);
            spectatorControls = new FlyControls(
                activeCamera,
                renderer.domElement
            );
            spectatorControls.movementSpeed = 15;
            spectatorControls.rollSpeed = Math.PI / 3;
            spectatorControls.dragToLook = true;
        } else {
            camera = new Camera(window, renderer, mesh_col);
            activeCamera = camera.camera;
        }
        renderer.setAnimationLoop(animate);

        //const startV = new THREE.Vector3(0, 1, 0);
        //camDistance = startV.distanceTo(camera.camera.position);
        //console.log("Distance " + camDistance);

        window.addEventListener('resize', onWindowResize);
        if (!isSpectator) {
            input.connect();
        }

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
                            nickname: resolvePlayerNickname(
                                nearbyPlayer.id,
                                nearbyPlayer.nickname
                            ),
                        },
                        logtime: new Date(),
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
                    openDoors();
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
                });
                tokenQuestFrontdesk.handleQuestCompletion(questId);
            };
            storyManager.onQuestDuckFound = async () => {
                duck_up = await loadMesh(MODEL_DUCK_UP, [0, 0, 0]);
                if (duck_down) {
                    runtimeResourceDisposer.disposeObject3D(duck_down);
                    duck_down = null;
                }
            };
            storyManager.onQuestLogin = async () => {
                display = await loadMesh(MODEL_DISPLAY, [0, 0, 0]);
                changeObjectTexture(display, IMG_DISPLAY_INTRA);
            };
            storyManager.onQuestEvaluator = async () => {
                changeObjectTexture(display, IMG_DISPLAY_BOOKING);
            };
            storyManager.onQuestStartEvaluation = async () => {
                changeObjectTexture(display, IMG_DISPLAY_EVAL);
            };
            storyManager.onQuestFinished = () => {
                console.log('Quest finished');
                changeObjectTexture(display, IMG_DISPLAY_GRAPH);
                openDoors();
            };
        }

        await loadMesh(MODEL_MAP, [0, 0, 0]);
        if (runtimeDisposed) return;
        multiplayer.startPlayerUpdateLoop();
        await loadMeshSky(MODEL_CLOUDS, [0, 0, 0]);
        if (runtimeDisposed) return;
        await loadMeshSky(MODEL_ROCKS, [0, 0, 0]);
        if (runtimeDisposed) return;
        await loadMesh(MODEL_DOOR_A, [0, 0, 0]);
        if (runtimeDisposed) return;
        await loadMesh(MODEL_DOOR_B, [0, 0, 0]);
        if (runtimeDisposed) return;

        // TODO: Need to check with quest state.
        // If duck already found, than show duck_up, else show duck_down.
        duck_down = await loadMesh(MODEL_DUCK_DOWN, [0, 0, 0]);
        if (runtimeDisposed) return;

        addBlackhole(scene);

        if (storyManager) {
            await storyManager.GameIntro();
            if (runtimeDisposed) return;
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

    async function loadMesh(
        path: string,
        pos: [number, number, number] = [0, 0, 0]
    ): Promise<THREE.Object3D | null> {
        let gltf: Awaited<ReturnType<GLTFLoader['loadAsync']>>;
        try {
            gltf = await loader.loadAsync(path);
        } catch (error: unknown) {
            if (!runtimeDisposed) {
                console.error(`Map model loading failed for "${path}":`, error);
            }
            return null;
        }

        const obj = gltf.scene;

        if (runtimeDisposed) {
            runtimeResourceDisposer.disposeObject3D(obj);
            return null;
        }

        //console.log("Adding collider for: " + obj.name);

        obj.position.fromArray(pos);
        const meshes = obj.getObjectsByProperty('isMesh', true) as GLBMesh[];
        for (const child of meshes) {
            if (!child.name.includes('NOCOL')) {
                //console.log("Adding collider for: " + child.name);
                mesh_col.push(child);
            }

            // Add Doors to group so we can open/close them
            if (path === MODEL_DOOR_A) {
                console.log(child.name + ' added to groupDoorA');
                doorMeshesNames.push(child.name);
                groupDoorA.add(obj);
            }
            if (path === MODEL_DOOR_B) {
                console.log(child.name + ' added to groupDoorB');
                doorMeshesNames.push(child.name);
                groupDoorB.add(obj);
            }

            if (child.name.includes('TTT_Board')) {
                if (tttBox.cellCnt >= 9)
                    throw new Error('ttt game can have only 9 cells!');
                tttBox.cells[tttBox.cellCnt] = child;
                tttBox.cellCnt++;
            }
            // child.scale.setScalar(1.15);

            if (child.material.name === 'Glass_mtl') {
                child.material = new THREE.MeshToonMaterial({
                    color: 0xaaddff,
                    transparent: true,
                    opacity: 0.3,
                });
                child.castShadow = false;
                child.receiveShadow = false;
            } else if (child.material.name === 'Glass_outside') {
                child.material = new THREE.MeshToonMaterial({
                    color: 0xaaddff,
                    transparent: true,
                    opacity: 0.8,
                });
                child.castShadow = false;
                child.receiveShadow = false;
            } else if (child.material.name === 'Glass_block') {
                child.material = new THREE.MeshToonMaterial({
                    color: 0xaaddff,
                    transparent: false,
                });
                child.castShadow = false;
                child.receiveShadow = false;
            } else {
                // outline
                const edges = new THREE.EdgesGeometry(child.geometry, 50);
                const line = new THREE.LineSegments(
                    edges,
                    new THREE.LineBasicMaterial({ color: 0x000000 })
                );
                child.add(line);

                child.material = new THREE.MeshToonMaterial({
                    color: child.material.color,
                    map: child.material.map || null,
                    gradientMap: texture,
                });

                child.castShadow = true;
                child.receiveShadow = true;
            }
        }
        if (runtimeDisposed) {
            runtimeResourceDisposer.disposeObject3D(obj);
            return null;
        }

        if (path !== MODEL_DOOR_A && path !== MODEL_DOOR_B) {
            scene.add(obj);
            mesh_Octree.push(obj);
        }

        worldOctree.fromGraphNode(obj);
        //mesh_col.push(obj);

        //worldOctree.fromGraphNode(obj);

        envLoaded = true;

        return obj;
    }

    async function loadMeshSky(
        path: string,
        pos: [number, number, number] = [0, 0, 0]
    ): Promise<void> {
        let gltf: Awaited<ReturnType<GLTFLoader['loadAsync']>>;
        try {
            gltf = await loader.loadAsync(path);
        } catch (error: unknown) {
            if (!runtimeDisposed) {
                console.error(`Sky model loading failed for "${path}":`, error);
            }
            return;
        }

        const obj = gltf.scene;

        if (runtimeDisposed) {
            runtimeResourceDisposer.disposeObject3D(obj);
            return;
        }

        obj.position.fromArray(pos);
        const meshes = obj.getObjectsByProperty('isMesh', true) as GLBMesh[];
        for (const child of meshes) {
            // child.scale.setScalar(1.15);

            // outline
            const edges = new THREE.EdgesGeometry(child.geometry, 50);
            const line = new THREE.LineSegments(
                edges,
                new THREE.LineBasicMaterial({ color: 0x000000 })
            );
            child.add(line);

            child.material = new THREE.MeshToonMaterial({
                color: child.material.color,
                map: child.material.map || null,
                gradientMap: texture,
            });

            child.castShadow = false;
            child.receiveShadow = true;
        }
        if (runtimeDisposed) {
            runtimeResourceDisposer.disposeObject3D(obj);
            return;
        }

        scene.add(obj);
    }

    /* function loadMeshTitel(path, pos = [0, 0, 0]) {
        loader.load(path, (gltf) => {
            const obj = gltf.scene;

            //console.log("Adding collider for: " + obj.name);

            obj.position.set(...pos);
            obj.traverse((child) => {
                if (child.isMesh) {
                    child.scale.set(1.15, 1.15, 1.15);


                    if (child.material.name === "Glass_mtl") {
                        child.material = new THREE.MeshToonMaterial({
                            color: 0xaaddff,
                            transparent: true,
                            opacity: 0.3
                        });
                        child.castShadow = false;
                        child.receiveShadow = false;

                    }
                    else if (child.material.name === "Glass_outside") {
                        child.material = new THREE.MeshToonMaterial({
                            color: 0xaaddff,
                            transparent: true,
                            opacity: 0.8
                        });
                        child.castShadow = false;
                        child.receiveShadow = false;

                    }
                    else if (child.material.name === "Glass_block") {
                        child.material = new THREE.MeshToonMaterial({
                            color: 0xaaddff,
                            transparent: true,
                            opacity: 1
                        });
                        child.castShadow = false;
                        child.receiveShadow = false;

                    }
                    else {
                        // outline
                        const edges = new THREE.EdgesGeometry(child.geometry, 50);
                        const line = new THREE.LineSegments(
                            edges,
                            new THREE.LineBasicMaterial({ color: 0x000000 })
                        );
                        child.add(line);

                        child.material = new THREE.MeshToonMaterial({
                            color: child.material.color,
                            map: child.material.map || null,
                            gradientMap: texture
                        });

                        child.castShadow = true;
                        child.receiveShadow = true;
                    }

                }
            });
            scene.add(obj);

            worldOctree.fromGraphNode(obj);
        });
    } */
    //loadMesh(MAP, [0,0,0]);

    //tttGame.board = tttBox;

    function openDoors(): void {
        // TODO: Play door opening animation
        groupDoorA.rotation.y = -1.83;
        groupDoorB.rotation.y = 1.42;
        eventSpaceDoorsOpen = true;

        removefromColliderAndOctree(doorMeshesNames);
    }

    function resetDoorsState(): void {
        groupDoorA.rotation.set(0, 0, 0);
        groupDoorB.rotation.set(0, 0, 0);
        eventSpaceDoorsOpen = false;

        for (const doorGroup of [groupDoorA, groupDoorB]) {
            const doorMeshes = doorGroup.getObjectsByProperty(
                'isMesh',
                true
            ) as GLBMesh[];
            for (const doorMesh of doorMeshes) {
                if (!mesh_col.includes(doorMesh)) {
                    mesh_col.push(doorMesh);
                }
            }
        }

        worldOctree.clear();
        for (const mesh of mesh_Octree) {
            worldOctree.fromGraphNode(mesh);
        }
        worldOctree.fromGraphNode(groupDoorA);
        worldOctree.fromGraphNode(groupDoorB);
    }

    async function resetGameStateAfterBlackHole(): Promise<void> {
        resetDoorsState();
        tokenQuestFrontdesk.reset();

        if (!duck_down) {
            duck_down = await loadMesh(MODEL_DUCK_DOWN, [0, 0, 0]);
        }
        if (runtimeDisposed) {
            return;
        }

        if (duck_up) {
            runtimeResourceDisposer.disposeObject3D(duck_up);
            duck_up = null;
        }

        onGameReset?.();
    }

    function removefromColliderAndOctree(objects: string[]): void {
        for (const obj of objects) {
            const index = mesh_col.findIndex((mesh) => mesh.name === obj);
            if (index !== -1) {
                mesh_col.splice(index, 1);
                // console.log(`Removed ${obj} from collider meshes.`);
            }
        }

        // TODO: NOT VERY EFFICIENT
        // But can not remove single mesh from octree, so we have to clear and re-add all meshes
        worldOctree.clear();
        for (const mesh of mesh_Octree) {
            worldOctree.fromGraphNode(mesh);
        }
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

    function onWindowResize() {
        if (!activeCamera) return;

        activeCamera.aspect = window.innerWidth / window.innerHeight;
        activeCamera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }

    function animate() {
        if (runtimeDisposed) {
            return;
        }

        if (!activeCamera || !multiplayer || (!isSpectator && !envLoaded))
            return;

        timer.update();
        const lifecycleDelta = timer.getDelta();
        /** begrenze Frame-Zeit nur für Bewegung und Physik */
        const delta = Math.min(lifecycleDelta, 0.05);

        if (isSpectator) {
            spectatorControls?.update(delta);
        } else {
            if (
                !player ||
                !camera ||
                !tttGame ||
                !rpsGame ||
                !storyManager ||
                !interactionManager
            )
                return;

            player.updateLifecycle(lifecycleDelta);

            input.update(delta);

            previousPlayerPosition.copy(player.group.position);

            player.updateCharacter(delta);

            // update camera and character only while not in cutscene. Otherwise Cutscene animation
            if (!storyManager.inCutscene) {
                playerMovementDelta.subVectors(
                    player.group.position,
                    previousPlayerPosition
                );
                camera.camera.position.add(playerMovementDelta);

                if (tttGame.tttCamera)
                    camera.orbitControls.target
                        .copy(player.group.position)
                        .setY(player.group.position.y + 1.75);
                else
                    camera.orbitControls.target
                        .copy(player.group.position)
                        .setY(player.group.position.y + 1);
                followGroup.position.copy(player.group.position);
                camera.orbitControls.update();

                // onDeleteCollision();
                // onSpawnCollision();

                camera.cameraCollisionRaycast(delta, player.group);
            }
        }

        renderer.clear();
        renderer.render(scene, activeCamera);
        tttGame?.render();
        rpsGame?.render();

        multiplayer.updateMultiplayer(delta, lifecycleDelta);

        if (!isSpectator && player && rpsGame && interactionManager) {
            if (!isLocalPlayerDespawning) {
                rpsGame.updateCheck();
            }

            const interactionInZone = interactionManager.update(
                player.group.position
            );
            const completedEventSpaceQuestId =
                interactionManager.eventSpaceQuest.updateTraversal(
                    interactionInZone,
                    eventSpaceDoorsOpen
                );
            if (completedEventSpaceQuestId !== null) {
                onGameEvent?.({
                    eventType: EventType.QuestCompleted,
                    data: {
                        questId: completedEventSpaceQuestId,
                    },
                    logtime: new Date(),
                });
            }
        }

        npcManager.updateAnimations(delta);
    }

    function sendChatMessage(message: string): void {
        if (runtimeDisposed) {
            return;
        }

        multiplayer?.sendChatMessage(message);
    }

    return {
        sendChatMessage,
        despawnLocalPlayer,
        dispose: disposeRuntime,
        continueDialogue(): void {
            storyManager?.continueDialogue();
        },
        triggerBlackHoleCutscene(): void {
            if (runtimeDisposed) {
                return;
            }

            multiplayer?.emitGameReset();

            storyManager?.blackHoleCutscene();
        },
    };
}
