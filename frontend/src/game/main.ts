import * as THREE from 'three';

import { Octree } from 'three/addons/math/Octree.js';

import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

import { MultiplayerManager } from './multiplayer.js';
// 'NPC' is defined but never used.
// import { NPC } from './npc.js';
import { Player } from './player.js';
import { normalizePlayerNickname } from './PlayerIdentity.js';
import { Camera } from './camera.js';
import { TTT_Game } from './ttt_game.js';
import { RPS_Game } from './rps_game.js';

import { io } from 'socket.io-client';

import { PlayerState, RPSChoice, TTTMeshBoard } from '@common/types';
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
    PlayerUpdatePayload,
} from '@common/types';

/** all both gender */

function whichCharacterModelPath(character: boolean): string {
    if (character === true) {
        return '/glb/Male_Test.glb';
    }
    return '/glb/Female_Test.glb';
}

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
          readonly outcome: 'won' | 'lost';
          readonly playerNickname: string;
          readonly opponentNickname: string;
      };

export type GameRuntime = {
    readonly showLocalChatMessage: (message: string) => void;
};

type NamedPlayer = {
    readonly id: string;
    readonly nickname: string;
};

type ActiveTTTPlayers = {
    readonly playerOne: NamedPlayer;
    readonly playerTwo: NamedPlayer;
};

type GameResultEvent = Extract<GameRuntimeEvent, { type: 'game_result' }>;

/* const PLAYER_CHARACTER_MODELS = {
    true: '/glb/Male_Test.glb',
    false: '/glb/Female_Test.glb',
};

function normalizeCharacter(character: boolean): boolean {
    if (typeof character === 'string') {
        const normalizedCharacter = character.toLowerCase();
        return normalizedCharacter !== false && normalizedCharacter !== true;
    }

    return character !== false;
} */

export function startGame(
    whichCharacter: boolean = true,
    nickname: string,
    serverUrl: string | null = null,
    renderer: THREE.WebGLRenderer,
    onGameEvent?: (event: GameRuntimeEvent) => void
): GameRuntime {
    // ============================================================================
    // SERVER CONNECTION
    // ============================================================================

    console.log('character: ' + whichCharacter);

    /* const character = normalizeCharacter(whichCharacter);
    const playerModelPath = PLAYER_CHARACTER_MODELS[character]; */
    const character = whichCharacter;
    const localNickname = normalizePlayerNickname(nickname);
    const playerModelPath = whichCharacterModelPath(whichCharacter);
    const selectedSocketServerUrl =
        typeof serverUrl === 'string' ? serverUrl.trim() : '';

    const socketServerUrl =
        selectedSocketServerUrl ||
        import.meta.env['VITE_SOCKET_SERVER_URL'] ||
        'http://localhost:3000';

    const socket = io(socketServerUrl, {
        auth: {
            character: whichCharacter,
            // Login-Nickname Socket.IO-Handshake
            nickname: localNickname,
        },
    });

    let player: Player | null = null;
    let multiplayer: MultiplayerManager | null = null;
    let camera: Camera | null = null;
    let tttGame: TTT_Game | null = null;
    let rpsGame: RPS_Game | null = null;
    let activeTTTPlayers: ActiveTTTPlayers | null = null;
    const knownPlayerNicknames = new Map<string, string>();

    socket.on('connect', () => {
        console.log('Your Player ID: ' + socket.id);
        if (player) {
            // FIXME thing about cases where socket.id could be undefined and
            // add error logging + more sophisticated handling here
            if (socket.id === undefined) {
                console.error('socket connect: undefined socket.id!');
            } else {
                console.log(
                    `socket connect: setting player.id to ${socket.id}`
                );
                player.id = socket.id;
            }
            //tttGame.playerID = socket.id;
        }
    });

    socket.on('player_connected', (data) => {
        let id: string;
        let remoteCharacter = true;
        let remoteNickname: string | undefined;

        if (typeof data === 'string') {
            id = data;
        } else {
            id = data.id;
            remoteCharacter = data.character;
            if (typeof data.nickname === 'string') {
                remoteNickname = data.nickname;
            }
        }

        console.log('someone joined:', id);
        if (id) spawnRemotePlayer(id, remoteCharacter, remoteNickname);
    });

    socket.on('player_disconnected', (id) => {
        console.log('someone left:', id);
        const disconnectedPlayer = multiplayer?.players.get(id);
        onGameEvent?.({
            type: 'player_left',
            playerId: id,
            nickname: resolvePlayerNickname(id, disconnectedPlayer?.nickname),
        });

        if (!multiplayer) return;
        if (disconnectedPlayer) disconnectedPlayer.removePlayer();
    });

    socket.on('disconnect', (reason) => {
        if (!multiplayer) return;
        for (const [id, _player] of multiplayer.players) {
            void _player;
            const disconnectedPlayer = multiplayer.players.get(id);
            if (disconnectedPlayer) disconnectedPlayer.removePlayer();
        }
        if (!tttGame) return;
        tttGame.endGame();
        console.log('Server Disconnect:', reason);
    });

    socket.on('initData', (data) => {
        console.log('Received initData from server.');
        if (!tttGame) return;
        tttGame.initGame(data);
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
                if (tttGame) void tttGame.endGame();
                activeTTTPlayers = null;
                break;
            case 'ttt_left': // pressed ESC
                if (tttGame) tttGame.resetGame();
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

    function emitPosition(
        x: number,
        y: number,
        z: number,
        state: PlayerState,
        character: boolean
    ) {
        //console.log("Received data:" + type);
        socket.emit('update', {
            type: 'player_update',
            x,
            y,
            z,
            state,
            character,
        });
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
            if (!rpsGame.animationLoop) return;
            cancelAnimationFrame(rpsGame.animationLoop);
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

            if (!rpsGame.animationLoop) return;
            cancelAnimationFrame(rpsGame.animationLoop);
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

            if (!rpsGame.animationLoop) return;
            cancelAnimationFrame(rpsGame.animationLoop);
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

            if (!rpsGame.animationLoop) return;
            cancelAnimationFrame(rpsGame.animationLoop);
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
        rpsGame.readyForRequest = true;

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
        rpsGame.readyForRequest = true;
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
        tttGame.startGame(
            data.playerOne,
            data.playerTwo,
            data.playerOneNickname,
            data.playerTwoNickname
        );
    }

    function handleTTTwin(data: TTTWinPayload) {
        if (!tttGame) return;
        const localPlayerId = player?.id;
        if (localPlayerId && activeTTTPlayers) {
            const localIsPlayerOne =
                activeTTTPlayers.playerOne.id === localPlayerId;
            const localIsPlayerTwo =
                activeTTTPlayers.playerTwo.id === localPlayerId;

            if (localIsPlayerOne || localIsPlayerTwo) {
                let opponent = activeTTTPlayers.playerOne;
                if (localIsPlayerOne) {
                    opponent = activeTTTPlayers.playerTwo;
                }

                let outcome: GameResultEvent['outcome'] = 'lost';
                if (data.id === localPlayerId) {
                    outcome = 'won';
                }

                emitLocalGameResult('Tic-Tac-Toe', outcome, opponent.nickname);
            }
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
        remoteNickname?: string
    ): void {
        if (!multiplayer) {
            return;
        }
        const isNewPlayer = !multiplayer.players.has(id);
        const resolvedNickname = resolvePlayerNickname(id, remoteNickname);
        multiplayer.spawnPlayer(id, remoteCharacter, resolvedNickname);

        if (!isNewPlayer) {
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
        // check if existing player/client, if not spawn new player
        if (multiplayer.players.get(data.id)) {
            //console.log("other player:", data.id, data.x.toFixed(4), data.y.toFixed(4), data.z.toFixed(4), data.state);
            multiplayer.updateMultiplayerID(
                data.id,
                data.x,
                data.y,
                data.z,
                data.state
            );
        } else {
            console.log('new player joined:', data.id);
            //multiplayer.spawnPlayer(data.id, normalizeCharacter(data.character));
            spawnRemotePlayer(data.id, data.character);
        }
    }

    // ============================================================================
    // GAME SETUP
    // ============================================================================

    const scene = new THREE.Scene();
    // const renderer = new THREE.WebGLRenderer({ antialias: true });
    const followGroup = new THREE.Group();
    const timer = new THREE.Timer();
    const dirLight = new THREE.DirectionalLight(0xffffff, 2.5);

    const npcs = new Map();

    //const keyStates = {};
    const keyStates: Record<string, boolean> = {};

    const controls = {
        key: [0, 0] as [number, number],
    };

    const worldOctree = new Octree();
    //const octreeDelete = new Octree();
    //const OctreeSpawn = new Octree();

    const mesh_col: GLBMesh[] = [];
    const mesh_RP: GLBMesh[] = [];
    const tttBox: TTTMeshBoard = new TTTMeshBoard();

    //let camDistance = 0;

    init();

    function init() {
        //timer = new THREE.Timer();
        timer.connect(document);

        //scene = new THREE.Scene();
        scene.background = new THREE.Color(0x999999);
        /* scene.fog = new THREE.Fog( 0x5b6470, 2, 30 ); */

        //followGroup = new THREE.Group();
        scene.add(followGroup);

        //dirLight = new THREE.DirectionalLight(0xffffff, 2.5);
        // initial position (local to followGroup) - matches previous values
        //dirLight.position.set( - 2, 5, - 3 );
        dirLight.position.set(-25, 15, -15);
        dirLight.castShadow = true;
        const cam = dirLight.shadow.camera;
        cam.top = cam.right = 115;
        cam.bottom = cam.left = -115;
        cam.near = 1;
        cam.far = 50;

        /** Shadow map size is set to balance between quality and performance. */
        dirLight.shadow.mapSize.set(6144, 6144);
        scene.add(dirLight);
        scene.add(dirLight.target);

        /* dirLightLow.shadow.mapSize.set( 1024, 1024 );
        followGroup.add( dirLightLow );
        followGroup.add( dirLightLow.target ); */

        // add a small ambient light to lift shadows slightly
        const ambientLight = new THREE.AmbientLight(0xffffff, 2.0);
        scene.add(ambientLight);

        //player = new Player('glb/MainCharacterTest.glb', socket.id, scene, worldOctree);
        console.log('Player model path: ' + playerModelPath);
        fetch(playerModelPath).then((res) => console.log('exists:', res.ok));
        player = new Player(playerModelPath, socket.id, scene, worldOctree);
        multiplayer = new MultiplayerManager(scene, mesh_RP);
        multiplayer.initMultiplayerTest();

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

        camera = new Camera(window, renderer, mesh_col);
        renderer.setAnimationLoop(animate);

        //const startV = new THREE.Vector3(0, 1, 0);
        //camDistance = startV.distanceTo(camera.camera.position);
        //console.log("Distance " + camDistance);

        // EVENTS
        // TODO React: handle them in React, maybe.

        window.addEventListener('resize', onWindowResize);
        document.addEventListener('keydown', onKeyDown);
        document.addEventListener('keyup', onKeyUp);
        document.addEventListener('click', onClick);

        //initNPC();

        const plane = new THREE.Mesh(
            new THREE.BoxGeometry(35, 0.05, 35),
            new THREE.MeshStandardMaterial({ color: 0xffffff })
        );
        plane.position.set(0, -0.025, 0);

        plane.receiveShadow = true;
        //scene.add(plane);
        worldOctree.fromGraphNode(plane);

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

        /* const testCube = new THREE.Mesh(
            new THREE.BoxGeometry(1, 1, 1),
            new THREE.MeshBasicMaterial({ color: 0xff0000 })
        );

        testCube.position.copy(new THREE.Vector3(0, 0.5, 0));
        scene.add(testCube);

        scene.add(new THREE.AmbientLight(0xffffff, 12)); */
    }

    const texture = new THREE.TextureLoader().load(
        'textures/gradientMaps/twoTone2.jpg'
    );
    const loader = new GLTFLoader();

    loadMesh('glb/42WOB_v3.glb', [0, 0, 0]);
    // const texture = new THREE.TextureLoader().load('textures/gradientMaps/twoTone2.jpg');

    texture.minFilter = THREE.NearestFilter;
    texture.magFilter = THREE.NearestFilter;

    function loadMesh(path: string, pos: [number, number, number] = [0, 0, 0]) {
        loader.load(path, (gltf) => {
            const obj = gltf.scene;

            //console.log("Adding collider for: " + obj.name);

            obj.position.set(...pos);
            obj.traverse((child) => {
                if (child instanceof THREE.Mesh) {
                    if (!child.name.includes('NOCOL')) {
                        //console.log("Adding collider for: " + child.name);
                        mesh_col.push(child);
                    }

                    if (child.name.includes('TTT_Board')) {
                        if (tttBox.cellCnt >= 9)
                            throw new Error('ttt game can have only 9 cells!');
                        tttBox.cells[tttBox.cellCnt] = child;
                        tttBox.cellCnt++;
                    }
                    child.scale.set(1.15, 1.15, 1.15);

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
                        const edges = new THREE.EdgesGeometry(
                            child.geometry,
                            50
                        );
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
            });
            scene.add(obj);
            //mesh_col.push(obj);

            worldOctree.fromGraphNode(obj);
        });
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
    //loadMesh('glb/42WOB_v3.glb', [0,0,0]);
    //loadMeshTitel('glb/Titelscreen_01.glb', [0,0,0]);
    //loadMesh('glb/Floor.glb', [0,0,0]);

    //tttGame.board = tttBox;

    /** error TS6133: 'initNPC' is declared but its value is never read.
    function initNPC(): void {

        const npc1 = new NPC('glb/SpidermanMeme.glb', 2, scene, 1);
        const npc2 = new NPC('glb/SpidermanMeme.glb', 3, scene, 1);
        const npc3 = new NPC('glb/SpidermanMeme.glb', 4, scene, 1);


        npc1.group.position.set(5.5, -0.1, 5);
        npc2.group.position.set(7, -0.1, 6.5);
        npc3.group.position.set(5.5, -0.1, 8);

        npc1.rotateCharacter(npc1.group.position, npc2.group.position);
        npc2.rotateCharacter(npc2.group.position, npc3.group.position);
        npc3.rotateCharacter(npc3.group.position, npc1.group.position);

        scene.add(npc1.group, npc2.group, npc3.group);

        npcs.set(npc1.id, npc1);
        npcs.set(npc2.id, npc2);
        npcs.set(npc3.id, npc3);
    }
    */

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
            player.playerVelocity.add(
                player
                    .getForwardVector(camera.camera)
                    .multiplyScalar(speedDelta)
            );
        }
        if (keyStates['KeyS'] || keyStates['ArrowDown']) {
            player.playerVelocity.add(
                player
                    .getForwardVector(camera.camera)
                    .multiplyScalar(-speedDelta)
            );
        }
        if (keyStates['KeyA'] || keyStates['ArrowLeft']) {
            player.playerVelocity.add(
                player.getSideVector(camera.camera).multiplyScalar(-speedDelta)
            );
        }
        if (keyStates['KeyD'] || keyStates['ArrowRight']) {
            player.playerVelocity.add(
                player.getSideVector(camera.camera).multiplyScalar(speedDelta)
            );
        }
    }

    function getTTTField(event: MouseEvent): THREE.Vector2 {
        const mousePosition = new THREE.Vector2();

        mousePosition.x = (event.clientX / window.innerWidth) * 2 - 1;
        mousePosition.y = -(event.clientY / window.innerHeight) * 2 + 1;

        return mousePosition;
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

        if (rpsGame.playerInRange) {
            emitBattleRequest(rpsGame.playerInRange.id);
        }
    }

    /** player leave Tic-Tac-Toe game */
    function onPressEscape(_event: KeyboardEvent) {
        void _event;

        if (!player || !tttGame) {
            return;
        }
        if (tttGame.players[0] !== player.id || tttGame.players[1] !== null) {
            return;
        }
        emitTTTLeave();
    }

    function onClick(event: MouseEvent): void {
        const mousePosition = getTTTField(event);

        const raycaster = new THREE.Raycaster();
        raycaster.far = 50.0;

        if (!camera) return;

        raycaster.setFromCamera(mousePosition, camera.camera);
        const hits = raycaster.intersectObjects(mesh_col, false);

        //console.log("hits.length: " + hits.length );

        // FIXME silenced noUncheckedIndexedAccess here
        if (hits.length > 0) {
            //console.log("Clicked on TTT box:" + hits[0].object.name);
            //console.log("Clicked on: " + hits[0].object.name );
            if (hits[0]!.object.name.includes('TTT_Board')) {
                //tttGame.markField(hits[0].object.name, socket.id);
                emitTTTmark(hits[0]!.object.name);
                //console.log("Clicked on TTT box:" + hits[0].object.name);
            } else if (hits[0]!.object.name.includes('TTT_Start')) {
                //tttGame.startGame(socket.id);
                emitTTTstart();
                //console.log("Clicked on TTT box:" + hits[0].object.name);
            }

            // handle tic tac toe box click, e.g. send move to server
        }

        // const hitsRP = raycaster.intersectObjects(mesh_RP, true);
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
        if (!player) return;

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
        }
    }

    function onKeyUp(event: KeyboardEvent) {
        if (!player) return;

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
        }
    }

    function onWindowResize() {
        if (!camera) return;

        camera.camera.aspect = window.innerWidth / window.innerHeight;
        camera.camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }

    function animate() {
        if (
            !player ||
            !camera ||
            !renderer ||
            !scene ||
            !tttGame ||
            !rpsGame ||
            !multiplayer
        )
            return;

        timer.update();
        /** begrenze Frame-Zeit */
        const delta = Math.min(timer.getDelta(), 0.05);

        keyControls(delta);

        const prevPosition = new THREE.Vector3();
        prevPosition.copy(player.group.position);

        player.updateCharacter(delta);

        const deltaC = player.group.position.clone().sub(prevPosition);
        camera.camera.position.add(deltaC);

        if (tttGame.tttCamera)
            camera.orbitControls.target
                .copy(player.group.position)
                .add({ x: 0, y: 1.75, z: 0 });
        else
            camera.orbitControls.target
                .copy(player.group.position)
                .add({ x: 0, y: 1, z: 0 });
        followGroup.position.copy(player.group.position);
        camera.orbitControls.update();

        // onDeleteCollision();
        // onSpawnCollision();

        camera.cameraCollisionRaycast(delta, player.group);

        renderer.clear();
        renderer.render(scene, camera.camera);
        tttGame.render();
        rpsGame.render();

        multiplayer.updateMultiplayer(delta);

        // TODO !!! player.controls.current needs to be PlayerState
        if (player.isSpawned) {
            const state = player.controls.current as PlayerState;
            emitPosition(
                player.group.position.x,
                player.group.position.y,
                player.group.position.z,
                state,
                character
            );
        }

        rpsGame.updateCheck();

        for (const [_id, player] of npcs) {
            void _id;
            player.updateAnimation(delta);
        }
    }

    return {
        showLocalChatMessage(message: string): void {
            player?.showChatMessage(message);
        },
    };
}
