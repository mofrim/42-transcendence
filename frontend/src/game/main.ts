import * as THREE from 'three';

import { Octree } from 'three/addons/math/Octree.js';

import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FlyControls } from 'three/addons/controls/FlyControls.js';

import { MultiplayerManager } from './multiplayer.js';
import { NPC } from './npc.js';
import { Player } from './player.js';
import { Camera } from './camera.js';
import { TTT_Game } from './ttt_game.js';
import { RPS_Game } from './rps_game.js';
import { createThreeResourceDisposer } from './ThreeResourceDisposer.js';
import { Story_Manager } from './story_manager.js';
import { InteractionManager } from './interaction_manager.js';
import {
    getPlayerModelPath,
    MAP_MODEL_PATH,
    ES_DOOR_A_PATH,
    ES_DOOR_B_PATH,
    CLOUDS_PATH,
    ROCKS_BORDER_PATH,
} from './Assets.js';

import { io } from 'socket.io-client';

import {
    PLAYER_NETWORK_UPDATE_INTERVAL_MS,
    RPSChoice,
    TTTMeshBoard,
    NPCState,
} from 'common/sharedTypes';
import type {
    GLBMesh,
    RPSInvalidPayload,
    RPSDrawPayload,
    RPSWinnerPayload,
    RPSAcceptDeclinePayload,
    RPSRequestDataPayload,
    TTTMarkPayload,
    TTTStartPayload,
    TTTWinPayload,
    TTTDrawPayload,
    ChatSendPayload,
    PlayerConnectedPayload,
    PlayerUpdatePayload,
    ReceivedChatPayload,
    SocketAuth,
    TTTGame,
} from 'common/sharedTypes';

/** event log msgs */
export type GameRuntimeEvent =
    | {
          readonly type: 'player_joined' | 'player_left' | 'player_in_range';
          readonly playerId: string;
          readonly nickname: string;
      }
    | {
          readonly type: 'game_result';
          readonly game: 'Tic-Tac-Toe' | 'Rock-Paper-Scissors';
          readonly outcome: 'won' | 'lost' | 'draw';
          readonly playerNickname: string;
          readonly opponentNickname: string;
      };

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

export type GameResultEvent = Extract<
    GameRuntimeEvent,
    { type: 'game_result' }
>;
type RemotePlayerUpdate = Pick<PlayerUpdatePayload, 'x' | 'y' | 'z' | 'state'>;
export type GameMode = 'player' | 'spectator';

export function startGame(
    whichCharacter: boolean = true,
    localNickname: string,
    serverUrl: string,
    renderer: THREE.WebGLRenderer,
    onGameEvent?: (event: GameRuntimeEvent) => void,
    onDialogChange?: (state: { isOpen: boolean; message: string }) => void,
    mode: GameMode = 'player',
    onChatMessage?: (message: ReceivedChatPayload) => void
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
    let playerUpdateIntervalId: number | null = null;
    const knownPlayerNicknames = new Map<string, string>();
    const blockedPlayerUpdates = new Set<string>();
    const doorMeshesNames: string[] = [];

    socket.on('connect', () => {
        const socketId = socket.id;
        if (socketId === undefined) {
            console.error(
                'Socket connected without an ID; local player identity was cleared.'
            );
            if (player) {
                player.id = undefined;
            }
            return;
        }

        console.log('Your Player ID: ' + socketId);
        if (player) {
            player.id = socketId;
        }
    });

    socket.on('player_connected', (data: string | PlayerConnectedPayload) => {
        let id: string;
        let remoteCharacter = true;
        let remoteNickname: string | undefined;
        let initialUpdate: RemotePlayerUpdate | undefined;
        let shouldAnnounceJoin = true;

        if (typeof data === 'string') {
            id = data;
        } else {
            id = data.id;
            remoteCharacter = data.character;
            shouldAnnounceJoin = !data.isInitialSnapshot;
            if (typeof data.nickname === 'string') {
                remoteNickname = data.nickname;
            }
            if (
                typeof data.x === 'number' &&
                typeof data.y === 'number' &&
                typeof data.z === 'number' &&
                data.state !== undefined
            ) {
                initialUpdate = {
                    x: data.x,
                    y: data.y,
                    z: data.z,
                    state: data.state,
                };
            }
        }

        console.log('someone joined:', id);
        if (id) {
            blockedPlayerUpdates.delete(id);
            spawnRemotePlayer(
                id,
                remoteCharacter,
                shouldAnnounceJoin,
                remoteNickname,
                initialUpdate
            );
        }
    });

    socket.on('chat_message', (data: ReceivedChatPayload) => {
        if (runtimeDisposed) {
            return;
        }

        onChatMessage?.(data);
        if (data.senderId === socket.id) {
            player?.showChatMessage(data.message);
        }
    });

    socket.on('player_disconnected', (id) => {
        console.log('someone left:', id);
        const disconnectedPlayer = multiplayer?.players.get(id);
        onGameEvent?.({
            type: 'player_left',
            playerId: id,
            nickname: resolvePlayerNickname(id, disconnectedPlayer?.nickname),
        });

        blockedPlayerUpdates.add(id);
        if (!multiplayer) return;
        void multiplayer.removePlayer(id);
    });

    socket.on('disconnect', (reason) => {
        if (player) {
            player.id = undefined;
        }
        if (!multiplayer) return;
        for (const id of multiplayer.players.keys()) {
            blockedPlayerUpdates.add(id);
        }
        void multiplayer.removeAllPlayers();
        if (!tttGame) return;
        tttGame.endGame();
        console.log('Server Disconnect:', reason);
    });

    socket.on('initData', (data: TTTGame) => {
        console.log('Received initData from server.');
        if (!tttGame) return;
        tttGame.initGame({ game: data });
    });

    socket.on('update', (data) => {
        //console.log("Received data:" + data.type + ":", data.state);
        //console.log("Received data:" + data.type);
        switch (data.type) {
            case 'player_update':
                //console.log("Received player update:");
                handlePlayer(data);
                break;

            case 'ttt_playerOne':
                if (tttGame) tttGame.setPlayerOne(data.id);
                break;
            case 'ttt_playerTwo':
                if (tttGame) tttGame.setPlayerTwo(data.id);
                break;
            case 'ttt_start':
                handleTTTstart(data);
                break;
            case 'ttt_reset':
            case 'ttt_left': // pressed ESC
                tttGame?.resetGame();
                activeTTTPlayers = null;
                break;
            case 'ttt_mark':
                //console.log("Marking: " + data.board);
                handleTTTupdate(data);
                break;
            case 'ttt_win':
                //console.log("Marking: " + data.board);
                handleTTTwin(data);
                break;
            case 'ttt_draw':
                //console.log("Marking: " + data.board);
                handleTTTdraw(data);
                break;

            case 'rps_request':
                //console.log("RPS UPDATE");
                handleRPSRequest(data);
                break;
            case 'rps_accept':
                //console.log("RPS UPDATE");
                handleRPSAccept(data);
                break;
            case 'rps_decline':
                //console.log("RPS UPDATE");
                handleRPSDecline(data);
                break;

            case 'rps_winner':
                //console.log("RPS Winner: " + data.winner);
                handleRPSWinner(data);
                break;
            case 'rps_draw':
                //console.log("RPS Draw: " + data.playerOne + " and " + data.playerTwo);
                handleRPSDraw(data);
                break;
            case 'rps_invalid':
                //console.log("RPS Invalid: " + data.playerOne + " and " + data.playerTwo);
                handleRPSInvalid(data);
                break;

            /* case "rps_choice":
                //console.log("RPS UPDATE");
                handleChoice(data);
                break; */
        }
    });

    /* function emitInitMap() {
        console.log("Emitting initData to server.");

        socket.emit("update", {
            type: "initData",
            id: socket.id
        });
    } */

    function sendLocalPlayerUpdate(): void {
        if (
            runtimeDisposed ||
            isSpectator ||
            !socket.connected ||
            !envLoaded ||
            !player ||
            !player.isSpawned
        ) {
            return;
        }

        const { x, y, z } = player.group.position;
        socket.emit('update', {
            type: 'player_update',
            x,
            y,
            z,
            state: player.controls.current,
            character: whichCharacter,
        });
    }

    function startPlayerUpdateLoop(): void {
        if (isSpectator || playerUpdateIntervalId !== null) {
            return;
        }

        playerUpdateIntervalId = window.setInterval(
            sendLocalPlayerUpdate,
            PLAYER_NETWORK_UPDATE_INTERVAL_MS
        );
    }

    function stopPlayerUpdateLoop(): void {
        if (playerUpdateIntervalId === null) {
            return;
        }

        window.clearInterval(playerUpdateIntervalId);
        playerUpdateIntervalId = null;
    }

    function emitBattleRequest(reqID: string) {
        //console.log("Received data:" + type);
        socket.emit('update', {
            type: 'rps_request',
            id: socket.id,
            requestedPlayerID: reqID,
        });
    }

    function emitBattleAccept(reqID: string) {
        //console.log("Received data:" + type);
        socket.emit('update', {
            type: 'rps_accept',
            id: socket.id,
            requestedPlayerID: reqID,
        });
    }

    function emitBattleDecline(reqID: string) {
        //console.log("Received data:" + type);
        socket.emit('update', {
            type: 'rps_decline',
            id: socket.id,
            requestedPlayerID: reqID,
        });
    }

    /* function emitRPSInvalid() {
        socket.emit("update", {
            type: "rps_invalid",
        });
    } */

    /* function emitBattleChoice(reqID, choice) {
        //console.log("Received data:" + type);
        socket.emit("update", {
            type: "rps_choice",
            id: socket.id,
            requestedPlayerID: reqID,
            choice: choice,
        });
    } */
    function emitBattleChoice(choice: RPSChoice) {
        //console.log("Received data:" + type);
        socket.emit('update', {
            type: 'rps_choice',
            id: socket.id,
            choice: choice,
        });
    }

    function emitTTTmark(obj: string) {
        //console.log("Received data:" + type);
        socket.emit('update', {
            type: 'ttt_mark',
            fieldName: obj,
        });
    }

    function emitTTTstart() {
        //console.log("Received data:" + type);
        socket.emit('update', {
            type: 'ttt_start',
        });
    }

    function emitTTTLeave() {
        socket.emit('update', {
            type: 'ttt_leave',
        });
    }

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

            rpsGame.solutionRPSAnimation();
            /* if(rpsGame.playChoiceAnimation == false)
                rpsGame.solutionRPSAnimation();
            else
                rpsGame.playChoiceAnimation = false; */
        }
    }

    function handleRPSWinner(data: RPSWinnerPayload) {
        if (!player || !rpsGame) return;
        if (data.winner === player.id) {
            console.log('You won the RPS game!');
            emitLocalGameResult(
                'Rock-Paper-Scissors',
                'won',
                resolvePlayerNickname(data.loser)
            );
            rpsGame.yourChoice = data.winnerChoice;
            rpsGame.opponentChoice = data.loserChoice;

            rpsGame.solutionRPSAnimation();
            /* rpsGame.playChoiceAnimation = false;
            rpsGame.solutionRPSAnimation(); */
        } else if (data.loser === player.id) {
            console.log('You lost the RPS game!');
            emitLocalGameResult(
                'Rock-Paper-Scissors',
                'lost',
                resolvePlayerNickname(data.winner)
            );

            rpsGame.yourChoice = data.loserChoice;
            rpsGame.opponentChoice = data.winnerChoice;

            rpsGame.solutionRPSAnimation();
            /* rpsGame.playChoiceAnimation = false;
            rpsGame.solutionRPSAnimation(); */
        }
    }
    /* function handleChoice(data){
        if(data.requestedPlayerID !== player.id)
            return;

        rpsGame.opponentChoice = data.choice;
        console.log("Player " + data.id + " made a choice: " + data.choice);
    } */

    function handleRPSAccept(data: RPSAcceptDeclinePayload) {
        if (!player) return;
        if (data.requestedPlayerID !== player.id) return;
        if (!rpsGame) return;
        player.battleRequested = false;
        if (!multiplayer) return;
        const opponentPlayer = multiplayer.players.get(data.id);
        if (!opponentPlayer) return;
        opponentPlayer.battleRequested = false;
        console.log('Battle accepted from player ' + data.id);
        rpsGame.startRPSAnimation();
    }

    function handleRPSDecline(data: RPSAcceptDeclinePayload) {
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
        if (!tttGame) return;
        const accepted = tttGame.startGame(
            data.playerOne,
            data.playerTwo,
            data.playerOneNickname,
            data.playerTwoNickname
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
            let outcome: GameResultEvent['outcome'] = 'lost';
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
        game: GameResultEvent['game'],
        outcome: GameResultEvent['outcome'],
        opponentNickname: string
    ): void {
        onGameEvent?.({
            type: 'game_result',
            game,
            outcome,
            playerNickname: localNickname,
            opponentNickname,
        });
    }

    function resolvePlayerNickname(
        playerId: string,
        fallbackNickname?: string
    ): string {
        if (playerId === player?.id || playerId === socket.id) {
            return localNickname;
        }

        const fallback = fallbackNickname?.trim();
        if (fallback) {
            knownPlayerNicknames.set(playerId, fallback);
            return fallback;
        }

        return (
            knownPlayerNicknames.get(playerId) ||
            multiplayer?.players.get(playerId)?.nickname ||
            playerId
        );
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

    /** player joined leaved notification */
    function spawnRemotePlayer(
        id: string,
        remoteCharacter: boolean,
        shouldAnnounceJoin: boolean,
        remoteNickname?: string,
        initialUpdate?: RemotePlayerUpdate
    ): void {
        if (!multiplayer) {
            return;
        }
        const isNewPlayer = !multiplayer.players.has(id);
        const resolvedNickname = resolvePlayerNickname(id, remoteNickname);
        multiplayer.spawnPlayer(id, remoteCharacter, resolvedNickname);

        const remotePlayer = multiplayer.players.get(id);
        if (initialUpdate && remotePlayer?.isActive()) {
            multiplayer.multiplayerMovement(
                remotePlayer,
                initialUpdate.x,
                initialUpdate.y,
                initialUpdate.z,
                initialUpdate.state
            );
        }

        if (!isNewPlayer || !shouldAnnounceJoin) {
            return;
        }
        onGameEvent?.({
            type: 'player_joined',
            playerId: id,
            nickname: resolvedNickname,
        });
    }

    function handlePlayer(data: PlayerUpdatePayload) {
        if (!multiplayer) return;
        if (blockedPlayerUpdates.has(data.id)) return;

        // check if existing player/client, if not spawn new player
        const remotePlayer = multiplayer.players.get(data.id);
        if (remotePlayer?.isActive()) {
            //console.log("other player:", data.id, data.x.toFixed(4), data.y.toFixed(4), data.z.toFixed(4), data.state);
            multiplayer.multiplayerMovement(
                remotePlayer,
                data.x,
                data.y,
                data.z,
                data.state
            );
        } else {
            console.log('new player joined:', data.id);
            //multiplayer.spawnPlayer(data.id, normalizeCharacter(data.character));
            spawnRemotePlayer(data.id, data.character, true, undefined, data);
        }
    }

    // ============================================================================
    // GAME SETUP
    // ============================================================================

    const scene = new THREE.Scene();
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

    const npcs = new Map();

    let envLoaded: boolean = false;
    const textureLoader = new THREE.TextureLoader();
    const texture = textureLoader.load('textures/gradientMaps/twoTone2.jpg');
    const loader = new GLTFLoader();
    // const texture = new THREE.TextureLoader().load('textures/gradientMaps/twoTone2.jpg');
    texture.minFilter = THREE.NearestFilter;
    texture.magFilter = THREE.NearestFilter;

    //const keyStates = {};
    const keyStates: Record<string, boolean> = {};

    const controls = {
        key: [0, 0] as [number, number],
    };

    function stopLocalInput(): void {
        isLocalPlayerDespawning = true;
        controls.key[0] = 0;
        controls.key[1] = 0;
        for (const code of Object.keys(keyStates)) {
            keyStates[code] = false;
        }
    }

    function despawnLocalPlayer(): Promise<void> {
        if (localPlayerDespawnPromise) {
            return localPlayerDespawnPromise;
        }

        stopLocalInput();

        localPlayerDespawnPromise = (async () => {
            try {
                if (player) {
                    player.controls.key = controls.key;
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
        document.removeEventListener('keydown', onKeyDown);
        document.removeEventListener('keyup', onKeyUp);
        renderer.domElement.removeEventListener('click', onClick);

        stopPlayerUpdateLoop();
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
            if (multiplayer) {
                completions.push(multiplayer.dispose());
            }
            await Promise.all(completions);

            runtimeResourceDisposer.disposeObject3D(scene);
            runtimeResourceDisposer.disposeTexture(texture);
            scene.clear();
            mesh_col.length = 0;
            mesh_RP.length = 0;
            knownPlayerNicknames.clear();
            blockedPlayerUpdates.clear();

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
    const tttPointer = new THREE.Vector2();
    const tttRaycaster = new THREE.Raycaster();
    const tttRaycastHits: THREE.Intersection[] = [];
    tttRaycaster.far = 50.0;

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
        scene.add(groupDoorA);
        scene.add(groupDoorB);

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
            //player = new Player('glb/MainCharacterTest.glb', socket.id, scene, worldOctree);
            console.log('Player model path: ' + playerModelPath);
            player = new Player(playerModelPath, socket.id, scene, worldOctree);
        }
        multiplayer = new MultiplayerManager(scene, mesh_RP);

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
            document.addEventListener('keydown', onKeyDown);
            document.addEventListener('keyup', onKeyUp);
            // Three.js-Raytracing clicks
            renderer.domElement.addEventListener('click', onClick);
        }

        initNPC();

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
                        type: 'player_in_range',
                        playerId: nearbyPlayer.id,
                        nickname: resolvePlayerNickname(
                            nearbyPlayer.id,
                            nearbyPlayer.nickname
                        ),
                    });
                }
            );

            interactionManager = new InteractionManager(scene);

            interactionManager.onInteraction = (interaction) => {
                storyManager?.handleInteraction(interaction);
                //onQuestComplete?.(interaction);

                if (
                    interaction.typeID === 'ES_DOOR_A' ||
                    interaction.typeID === 'ES_DOOR_B'
                ) {
                    openDoors();
                }
            };

            storyManager = new Story_Manager(
                scene,
                player,
                renderer,
                camera,
                keyStates,
                controls.key,
                interactionManager,
                onDialogChange
            );

            storyManager.onQuestInteraction = (interaction) => {
                console.log('Quest interaction:', interaction);
            };
            storyManager.onQuestFinished = () => {
                console.log('Quest finished');
                openDoors();
            };
        }

        await loadMesh(MAP_MODEL_PATH, [0, 0, 0]);
        if (runtimeDisposed) return;
        startPlayerUpdateLoop();
        await loadMeshSky(CLOUDS_PATH, [0, 0, 0]);
        if (runtimeDisposed) return;
        await loadMeshSky(ROCKS_BORDER_PATH, [0, 0, 0]);
        if (runtimeDisposed) return;
        await loadMesh(ES_DOOR_A_PATH, [0, 0, 0]);
        if (runtimeDisposed) return;
        await loadMesh(ES_DOOR_B_PATH, [0, 0, 0]);
        if (runtimeDisposed) return;

        storyManager?.GameIntro();
        /* const testCube = new THREE.Mesh(
            new THREE.BoxGeometry(1, 1, 1),
            new THREE.MeshBasicMaterial({ color: 0xff0000 })
        );

        testCube.position.copy(new THREE.Vector3(0, 0.5, 0));
        scene.add(testCube);

        scene.add(new THREE.AmbientLight(0xffffff, 12)); */
    }

    const blackholeTex = textureLoader.load('textures/Blackhole.png');
    const material = new THREE.MeshBasicMaterial({
        map: blackholeTex,
        transparent: true,
    });
    const geometry = new THREE.PlaneGeometry(40, 40);
    const plane = new THREE.Mesh(geometry, material);
    plane.rotation.x = Math.PI / 2.3;
    plane.position.set(16, 20, -5);
    scene.add(plane);

    async function loadMesh(
        path: string,
        pos: [number, number, number] = [0, 0, 0]
    ): Promise<void> {
        let gltf: Awaited<ReturnType<GLTFLoader['loadAsync']>>;
        try {
            gltf = await loader.loadAsync(path);
        } catch (error: unknown) {
            if (!runtimeDisposed) {
                console.error(`Map model loading failed for "${path}":`, error);
            }
            return;
        }

        const obj = gltf.scene;

        if (runtimeDisposed) {
            runtimeResourceDisposer.disposeObject3D(obj);
            return;
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
            if (path === ES_DOOR_A_PATH) {
                console.log(child.name + ' added to groupDoorA');
                doorMeshesNames.push(child.name);
                groupDoorA.add(obj);
            }
            if (path === ES_DOOR_B_PATH) {
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
            return;
        }

        if (path !== ES_DOOR_A_PATH && path !== ES_DOOR_B_PATH) {
            scene.add(obj);
            mesh_Octree.push(obj);
        }

        worldOctree.fromGraphNode(obj);
        //mesh_col.push(obj);

        //worldOctree.fromGraphNode(obj);

        envLoaded = true;
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
    //loadMesh('glb/42Sign.glb', [0,1,0]);
    //loadMesh(MAP_MODEL_PATH, [0,0,0]);
    //loadMeshTitel('glb/Titelscreen_01.glb', [0,0,0]);
    //loadMesh('glb/Floor.glb', [0,0,0]);

    //tttGame.board = tttBox;

    function openDoors(): void {
        // TODO: Play door opening animation
        groupDoorA.rotation.y = -1.83;
        groupDoorB.rotation.y = 1.42;

        removefromColliderAndOctree(doorMeshesNames);
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

    function initNPC(): void {
        // NPCs at the entrance of the 42WOB building
        const entry1 = new NPC('glb/NPC_Man_1.glb', 2, scene, NPCState.Nod);
        const entry2 = new NPC('glb/NPC_Man_1.glb', 3, scene, NPCState.Talking_2);
        const entry3 = new NPC('glb/NPC_Man_1.glb', 4, scene, NPCState.Nod);

        entry1.group.position.set(6.5, 0, 1);
        entry2.group.position.set(8, 0, 1.5);
        entry3.group.position.set(6.5, 0, 2.5);

        entry1.rotateCharacter(entry1.group.position, entry2.group.position);
        entry2.rotateCharacter(entry2.group.position, entry3.group.position);
        entry3.rotateCharacter(entry3.group.position, entry2.group.position);

        scene.add(entry1.group, entry2.group, entry3.group);

        npcs.set(entry1.id, entry1);
        npcs.set(entry2.id, entry2);
        npcs.set(entry3.id, entry3);

        const frontdesk = new NPC('glb/NPC_Man_1.glb', 5, scene, NPCState.Standing);
        frontdesk.group.position.set(12.1, 0, -5.8);
        frontdesk.rotateCharacter(frontdesk.group.position, new THREE.Vector3(frontdesk.group.position.x, frontdesk.group.position.y, frontdesk.group.position.z+1));
        scene.add(frontdesk.group);
        npcs.set(frontdesk.id, frontdesk);

        // NPCs 1Floor doing the Spiderman meme
        /* const spider1 = new NPC('glb/SpidermanMeme.glb', 2, scene, 1);
        const spider2 = new NPC('glb/SpidermanMeme.glb', 3, scene, 1);
        const spider3 = new NPC('glb/SpidermanMeme.glb', 4, scene, 1);
        spider2.group.position.set(9.5, 3.71-0.1, -7.3);
        spider3.group.position.set(9.5, 3.71-0.1, -5.6);
        spider1.group.position.set(11.3, 3.71-0.1, -6.5);

        spider1.rotateCharacter(spider1.group.position, spider3.group.position);
        spider2.rotateCharacter(spider2.group.position, spider1.group.position);
        spider3.rotateCharacter(spider3.group.position, spider2.group.position);

        scene.add(spider1.group, spider2.group, spider3.group);

        npcs.set(spider1.id, spider1);
        npcs.set(spider2.id, spider2);
        npcs.set(spider3.id, spider3); */
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

    function keyControls(deltaTime: number): void {
        if (!player || !camera) return;

        // gives a bit of air control
        const speedDelta = deltaTime * player.controls.runVelocity;
        if (keyStates['KeyW'] || keyStates['ArrowUp']) {
            player.playerVelocity.addScaledVector(
                player.getForwardVector(camera.camera),
                speedDelta
            );
        }
        if (keyStates['KeyS'] || keyStates['ArrowDown']) {
            player.playerVelocity.addScaledVector(
                player.getForwardVector(camera.camera),
                -speedDelta
            );
        }
        if (keyStates['KeyA'] || keyStates['ArrowLeft']) {
            player.playerVelocity.addScaledVector(
                player.getSideVector(camera.camera),
                -speedDelta
            );
        }
        if (keyStates['KeyD'] || keyStates['ArrowRight']) {
            player.playerVelocity.addScaledVector(
                player.getSideVector(camera.camera),
                speedDelta
            );
        }
    }

    function onPressAccept(_event: KeyboardEvent) {
        void _event;

        if (!player || !rpsGame) return;

        if (player.battleRequested) {
            player.battleRequested = false;
            if (rpsGame.playerInRange)
                rpsGame.playerInRange.battleRequested = false;
            rpsGame.removeText();
            if (rpsGame.battleRequestedPlayer) {
                console.log(
                    'Sending accept request to player ' +
                        rpsGame.battleRequestedPlayer
                );
                console.log('BATTLE START!');
                emitBattleAccept(rpsGame.battleRequestedPlayer);
                rpsGame.startRPSAnimation();
            } else console.log('Player ID empty, cannot send accept request.');
        } else {
            console.log('No battle request to accept.');
        }
    }

    function onPressDecline(_event: KeyboardEvent) {
        void _event;

        if (!player || !rpsGame) return;

        if (player.battleRequested) {
            player.battleRequested = false;
            if (rpsGame.playerInRange)
                rpsGame.playerInRange.battleRequested = false;
            rpsGame.removeText();
            if (rpsGame.battleRequestedPlayer) {
                console.log(
                    'Sending decline request to player ' +
                        rpsGame.battleRequestedPlayer
                );
                console.log('BATTLE DECLINED!');
                emitBattleDecline(rpsGame.battleRequestedPlayer);
            } else console.log('Player ID empty, cannot send decline request.');
        } else {
            console.log('No battle request to decline.');
        }
    }

    function rockKey(_event: KeyboardEvent) {
        void _event;

        if (!player || !rpsGame) return;

        if (rpsGame.rps_choiceMade) return;
        if (!player.inRPSBattleMode) return;
        if (!rpsGame.inBattleChooseMode) return;

        console.log('Rock key pressed');

        rpsGame.rps_choiceMade = true;
        //rpsGame.yourChoice = "rock";
        emitBattleChoice(RPSChoice.Rock);
    }

    function paperKey(_event: KeyboardEvent) {
        void _event;

        if (!player || !rpsGame) return;

        if (rpsGame.rps_choiceMade) return;
        if (!player.inRPSBattleMode) return;
        if (!rpsGame.inBattleChooseMode) return;

        console.log('Paper key pressed');

        rpsGame.rps_choiceMade = true;
        //rpsGame.yourChoice = "paper";
        emitBattleChoice(RPSChoice.Paper);
    }

    function scissorsKey(_event: KeyboardEvent) {
        void _event;

        if (!player || !rpsGame) return;

        if (rpsGame.rps_choiceMade) return;
        if (!player.inRPSBattleMode) return;
        if (!rpsGame.inBattleChooseMode) return;

        console.log('Scissors key pressed');

        rpsGame.rps_choiceMade = true;
        //rpsGame.yourChoice = "scissors";
        emitBattleChoice(RPSChoice.Scissors);
    }

    function onPressB(_event: KeyboardEvent) {
        void _event;

        if (!rpsGame) return;

        if (!rpsGame.inRange) {
            console.log('No player in range to interact with.');
            return;
        }

        const nearbyPlayer = rpsGame.playerInRange;
        if (
            !nearbyPlayer ||
            !nearbyPlayer.isActive() ||
            multiplayer?.players.get(nearbyPlayer.id) !== nearbyPlayer
        ) {
            return;
        }

        emitBattleRequest(nearbyPlayer.id);
    }

    /** player leave Tic-Tac-Toe game & end cutscene */
    function onPressEscape(_event: KeyboardEvent) {
        void _event;

        if (storyManager) storyManager.skipCameraAnimation = true;

        if (!player || !tttGame) {
            return;
        }
        if (tttGame.players[0] !== player.id || tttGame.players[1] !== null) {
            return;
        }
        emitTTTLeave();
    }

    function onClick(event: MouseEvent): void {
        if (isLocalPlayerDespawning) return;

        tttPointer.set(
            THREE.MathUtils.mapLinear(
                event.clientX,
                0,
                window.innerWidth,
                -1,
                1
            ),
            THREE.MathUtils.mapLinear(
                event.clientY,
                0,
                window.innerHeight,
                1,
                -1
            )
        );

        if (!camera) return;

        tttRaycaster.setFromCamera(tttPointer, camera.camera);
        tttRaycastHits.length = 0;
        tttRaycaster.intersectObjects(mesh_col, false, tttRaycastHits);

        //console.log("hits.length: " + hits.length );

        const firstHit = tttRaycastHits[0];
        if (firstHit) {
            //console.log("Clicked on TTT box:" + hits[0].object.name);
            console.log('Clicked on: ' + firstHit.object.name);
            if (firstHit.object.name.includes('TTT_Board')) {
                //tttGame.markField(hits[0].object.name, socket.id);
                emitTTTmark(firstHit.object.name);
                //console.log("Clicked on TTT box:" + hits[0].object.name);
            } else if (firstHit.object.name.includes('TTT_Start')) {
                //tttGame.startGame(socket.id);
                emitTTTstart();
                //console.log("Clicked on TTT box:" + hits[0].object.name);
            }

            // handle tic tac toe box click, e.g. send move to server
        }

        // const hitsRP = tttRaycaster.intersectObjects(mesh_RP, true);
        // console.log("hitsRP.length: " + hitsRP.length , " , mesh_RP length: " + mesh_RP.length);

        /* mesh_RP.forEach((o) => {
            console.log(o.name, o.isMesh);
        }); */

        /* if (hitsRP.length > 0) {
            const hit = hits[0];
            console.log("Clicked on PLAYER:" + hits[0].object.name);
        } */
    }

    function onKeyDown(event: KeyboardEvent) {
        if (!player || isLocalPlayerDespawning) return;

        if (storyManager && storyManager.inCutscene) return;

        keyStates[event.code] = true;
        const key: [number, number] = controls.key;
        player.controls.key = key;
        //console.log("Key pressed: " + event.code);
        switch (event.code) {
            // movement keys
            case 'ArrowUp':
            case 'KeyW':
                key[0] = -1;
                break;
            case 'ArrowDown':
            case 'KeyS':
                key[0] = 1;
                break;
            case 'ArrowLeft':
            case 'KeyA':
                key[1] = -1;
                break;
            case 'ArrowRight':
            case 'KeyD':
                key[1] = 1;
                break;

            // TODO: TESTS - REMOVE IF NOT NEEDED ANYMORE
            case 'KeyO':
                DebugCutscene();
                break;
            case 'KeyP':
                posPrintDebug();
                break;
        }
    }

    function onKeyUp(event: KeyboardEvent) {
        if (!player || isLocalPlayerDespawning) return;

        keyStates[event.code] = false;
        const key: [number, number] = controls.key;
        player.controls.key = key;
        switch (event.code) {
            // movement keys
            case 'ArrowUp':
            case 'KeyW':
                key[0] = key[0] < 0 ? 0 : key[0];
                break;
            case 'ArrowDown':
            case 'KeyS':
                key[0] = key[0] > 0 ? 0 : key[0];
                break;
            case 'ArrowLeft':
            case 'KeyA':
                key[1] = key[1] < 0 ? 0 : key[1];
                break;
            case 'ArrowRight':
            case 'KeyD':
                key[1] = key[1] > 0 ? 0 : key[1];
                break;

            case 'Escape':
                onPressEscape(event);
                break;

            // battle request keys
            case 'KeyB':
                onPressB(event);
                break;
            case 'KeyZ':
            case 'KeyY':
                onPressAccept(event);
                break;
            case 'KeyX':
                onPressDecline(event);
                break;

            case 'Numpad1':
            case 'Digit1':
                rockKey(event);
                break;
            case 'Numpad2':
            case 'Digit2':
                paperKey(event);
                break;
            case 'Numpad3':
            case 'Digit3':
                scissorsKey(event);
                break;

            case 'KeyE':
                interactionManager?.OnActivatePress(player.group.position);
                break;
        }
    }

    function DebugCutscene() {
        if (!player) return;

        if (storyManager) storyManager.blackHoleCutscene();
    }

    function posPrintDebug() {
        if (!player) return;

        // if (storyManager) storyManager.GameIntro();

        console.log(
            'Player position: x=' +
                player.group.position.x.toFixed(2) +
                ', y=' +
                player.group.position.y.toFixed(2) +
                ', z=' +
                player.group.position.z.toFixed(2)
        );
    }

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

            keyControls(delta);

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

            interactionManager.update(player.group.position);
        }

        for (const [_id, player] of npcs) {
            void _id;
            player.updateAnimation(delta);
        }
    }

    function sendChatMessage(message: string): void {
        if (runtimeDisposed) {
            return;
        }

        const payload: ChatSendPayload = { message };
        socket.emit('chat_message', payload);
    }

    return {
        sendChatMessage,
        despawnLocalPlayer,
        dispose: disposeRuntime,
        continueDialogue(): void {
            storyManager?.continueDialogue();
        },
        triggerBlackHoleCutscene(): void {
            storyManager?.blackHoleCutscene();
        },
    };
}
