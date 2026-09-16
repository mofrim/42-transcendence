import * as THREE from 'three';

// import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { Socket } from 'socket.io-client';
import type { Player } from './player.js';
import { Remote_Player } from './remote_player.js';
import { Chat } from './Chat.js';
import {
    createFriendRequestRuntimeActions,
    FriendRequestManager,
    type FriendRequestRuntimeActions,
} from '../ui/ingame/FriendRequest.js';

import {
    EventType,
    PLAYER_NETWORK_UPDATE_INTERVAL_MS,
    PlayerState,
    RPSChoice,
    User,
    type Character,
    type FriendRequestChangeHandler,
    type GameEvent,
    type PlayerConnectedPayload,
    type PlayerMovementPayload,
    type PlayerUpdatePayload,
    type ReceivedChatPayload,
    type RPSDrawPayload,
    type RPSInvalidPayload,
    type RPSRequestDataPayload,
    type RPSWinnerPayload,
    type TTTDrawPayload,
    type TTTGame,
    type TTTMarkPayload,
    type TTTPlayerPayload,
    type TTTStartPayload,
    type TTTWinPayload,
} from 'ftr-common/sharedTypes';

const MIN_POSITION_CHANGE_SQUARED = 0.001 ** 2;
const PLAYER_NETWORK_KEYFRAME_INTERVAL_MS = 1_000;

type RemotePlayerUpdate = Pick<PlayerUpdatePayload, 'x' | 'y' | 'z' | 'state'>;

type TTTResetPayload = {
    readonly type: 'ttt_reset' | 'ttt_left';
};

type MultiplayerSocketUpdate =
    | PlayerUpdatePayload
    | TTTPlayerPayload
    | TTTStartPayload
    | TTTResetPayload
    | TTTMarkPayload
    | TTTWinPayload
    | TTTDrawPayload
    | RPSRequestDataPayload
    | RPSWinnerPayload
    | RPSDrawPayload
    | RPSInvalidPayload;

type MultiplayerGameHandlers = {
    readonly onInitData?: (data: TTTGame) => void;
    readonly onTTTPlayerOne?: (id: string) => void;
    readonly onTTTPlayerTwo?: (id: string) => void;
    readonly onTTTStart?: (data: TTTStartPayload) => void;
    readonly onTTTReset?: () => void;
    readonly onTTTMark?: (data: TTTMarkPayload) => void;
    readonly onTTTWin?: (data: TTTWinPayload) => void;
    readonly onTTTDraw?: (data: TTTDrawPayload) => void;
    readonly onRPSRequest?: (data: RPSRequestDataPayload) => void;
    readonly onRPSAccept?: (data: RPSRequestDataPayload) => void;
    readonly onRPSDecline?: (data: RPSRequestDataPayload) => void;
    readonly onRPSWinner?: (data: RPSWinnerPayload) => void;
    readonly onRPSDraw?: (data: RPSDrawPayload) => void;
    readonly onRPSInvalid?: (data: RPSInvalidPayload) => void;
    readonly onDisconnect?: (reason: string) => void;
};

export type MultiplayerRuntimeActions = FriendRequestRuntimeActions & {
    readonly sendChatMessage: (message: string) => void;
};

type MultiplayerManagerOptions = {
    readonly socket: Socket;
    readonly localPlayer: Player | null;
    readonly user: User;
    readonly onGameEvent: ((event: GameEvent) => void) | undefined;
    readonly onChatMessage:
        ((message: ReceivedChatPayload) => void) | undefined;
    readonly onFriendRequestChange: FriendRequestChangeHandler | undefined;
    readonly gameHandlers?: MultiplayerGameHandlers;
};

export function createMultiplayerRuntimeActions(options: {
    readonly isDisposed: () => boolean;
    readonly getMultiplayer: () => MultiplayerManager | null;
}): MultiplayerRuntimeActions {
    const friendRequestRuntimeActions = createFriendRequestRuntimeActions({
        isDisposed: options.isDisposed,
        removeFriend: (friendPlayerId) => {
            options.getMultiplayer()?.removeFriend(friendPlayerId);
        },
    });

    return {
        ...friendRequestRuntimeActions,
        sendChatMessage(message: string): void {
            if (options.isDisposed()) {
                return;
            }

            options.getMultiplayer()?.sendChatMessage(message);
        },
    };
}

export class MultiplayerManager {
    scene: THREE.Scene;
    mesh_RP: THREE.Mesh[];
    players: Map<string, Remote_Player>;
    private readonly socket: Socket;
    private readonly localPlayer: Player | null;
    private readonly user: User;
    private readonly onGameEvent: ((event: GameEvent) => void) | undefined;
    private readonly gameHandlers: MultiplayerGameHandlers;
    private readonly chat: Chat;
    private readonly friendRequest: FriendRequestManager;
    private readonly departingPlayers: Set<Remote_Player>;
    private readonly knownPlayerNicknames: Map<string, string>;
    private readonly blockedPlayerUpdates: Set<string>;
    private readonly lastSentPlayerPosition: THREE.Vector3;
    private lastSentPlayerState: PlayerMovementPayload['state'] | null;
    private lastPlayerKeyframeMilliseconds: number;
    private playerUpdateIntervalId: number | null;
    private disposePromise: Promise<void> | null;
    private disposed: boolean;
    private readonly desired: THREE.Vector3;

    constructor(
        scene: THREE.Scene,
        mesh_RP: THREE.Mesh[],
        options: MultiplayerManagerOptions
    ) {
        this.scene = scene;
        this.mesh_RP = mesh_RP;
        this.socket = options.socket;
        this.localPlayer = options.localPlayer;
        this.user = options.user;
        this.onGameEvent = options.onGameEvent;
        this.gameHandlers = options.gameHandlers ?? {};

        this.players = new Map<string, Remote_Player>();
        this.departingPlayers = new Set<Remote_Player>();
        this.knownPlayerNicknames = new Map<string, string>();
        this.blockedPlayerUpdates = new Set<string>();
        this.lastSentPlayerPosition = new THREE.Vector3();
        this.lastSentPlayerState = null;
        this.lastPlayerKeyframeMilliseconds = 0;
        this.playerUpdateIntervalId = null;
        this.disposePromise = null;
        this.disposed = false;

        this.desired = new THREE.Vector3();
        this.chat = new Chat({
            socket: this.socket,
            localPlayer: this.localPlayer,
            players: this.players,
            onChatMessage: options.onChatMessage,
            isDisposed: () => this.disposed,
        });
        this.friendRequest = new FriendRequestManager({
            socket: this.socket,
            players: this.players,
            onFriendRequestChange: options.onFriendRequestChange,
            getLocalPlayerId: () => {
                if (this.localPlayer?.id !== undefined) {
                    return this.localPlayer.id;
                }
                return this.socket.id;
            },
            resolvePlayerNickname: (playerId, fallbackNickname) =>
                this.resolvePlayerNickname(playerId, fallbackNickname),
        });

        this.bindSocketEvents();
        if (this.socket.connected) {
            this.handleSocketConnect();
        }
    }

    private readonly handleSocketConnect = (): void => {
        const socketId = this.socket.id;
        if (socketId === undefined) {
            console.error(
                'Socket connected without an ID; local player identity was cleared.'
            );
            if (this.localPlayer) {
                this.localPlayer.id = undefined;
            }
            return;
        }

        console.log('Your Player ID: ' + socketId);
        if (this.localPlayer) {
            this.localPlayer.id = socketId;
        }

        this.lastSentPlayerState = null;
        this.sendLocalPlayerUpdate();
    };

    private readonly handlePlayerConnected = (
        data: string | PlayerConnectedPayload
    ): void => {
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
        if (!id) {
            return;
        }

        this.blockedPlayerUpdates.delete(id);
        this.spawnRemotePlayer(
            id,
            remoteCharacter,
            shouldAnnounceJoin,
            remoteNickname,
            initialUpdate
        );
    };

    // FIXME clarify EventData for this event!
    private readonly handlePlayerDisconnected = (id: string): void => {
        console.log('someone left:', id);
        const disconnectedPlayer = this.players.get(id);
        this.onGameEvent?.({
            eventType: EventType.PlayerLeft,
            data: {
                playerId: id,
                playerNickname: this.resolvePlayerNickname(
                    id,
                    disconnectedPlayer?.nickname
                ),
            },
            logtime: new Date(),
            user: this.user,
        });

        this.blockedPlayerUpdates.add(id);
        void this.removePlayer(id);
    };

    private readonly handleSocketDisconnect = (reason: string): void => {
        if (this.localPlayer) {
            this.localPlayer.id = undefined;
        }

        for (const id of this.players.keys()) {
            this.blockedPlayerUpdates.add(id);
        }
        void this.removeAllPlayers();
        this.gameHandlers.onDisconnect?.(reason);
        console.log('Server Disconnect:', reason);
    };

    private readonly handleInitData = (data: TTTGame): void => {
        console.log('Received initData from server.');
        this.gameHandlers.onInitData?.(data);
    };

    private readonly handleSocketUpdate = (
        data: MultiplayerSocketUpdate
    ): void => {
        switch (data.type) {
            case 'player_update':
                this.handlePlayerUpdate(data);
                break;
            case 'ttt_playerOne':
                this.gameHandlers.onTTTPlayerOne?.(data.id);
                break;
            case 'ttt_playerTwo':
                this.gameHandlers.onTTTPlayerTwo?.(data.id);
                break;
            case 'ttt_start':
                this.gameHandlers.onTTTStart?.(data);
                break;
            case 'ttt_reset':
            case 'ttt_left':
                this.gameHandlers.onTTTReset?.();
                break;
            case 'ttt_mark':
                this.gameHandlers.onTTTMark?.(data);
                break;
            case 'ttt_win':
                this.gameHandlers.onTTTWin?.(data);
                break;
            case 'ttt_draw':
                this.gameHandlers.onTTTDraw?.(data);
                break;
            case 'rps_request':
                this.gameHandlers.onRPSRequest?.(data);
                break;
            case 'rps_accept':
                this.gameHandlers.onRPSAccept?.(data);
                break;
            case 'rps_decline':
                this.gameHandlers.onRPSDecline?.(data);
                break;
            case 'rps_winner':
                this.gameHandlers.onRPSWinner?.(data);
                break;
            case 'rps_draw':
                this.gameHandlers.onRPSDraw?.(data);
                break;
            case 'rps_invalid':
                this.gameHandlers.onRPSInvalid?.(data);
                break;
        }
    };

    private bindSocketEvents(): void {
        this.socket.on('connect', this.handleSocketConnect);
        this.socket.on('player_connected', this.handlePlayerConnected);
        this.chat.bindSocketEvents();
        this.socket.on('player_disconnected', this.handlePlayerDisconnected);
        this.socket.on('disconnect', this.handleSocketDisconnect);
        this.socket.on('initData', this.handleInitData);
        this.socket.on('update', this.handleSocketUpdate);
    }

    private unbindSocketEvents(): void {
        this.socket.off('connect', this.handleSocketConnect);
        this.socket.off('player_connected', this.handlePlayerConnected);
        this.chat.unbindSocketEvents();
        this.socket.off('player_disconnected', this.handlePlayerDisconnected);
        this.socket.off('disconnect', this.handleSocketDisconnect);
        this.socket.off('initData', this.handleInitData);
        this.socket.off('update', this.handleSocketUpdate);
    }

    private sendLocalPlayerUpdate(): void {
        const player = this.localPlayer;
        if (
            this.disposed ||
            !player ||
            !this.socket.connected ||
            !player.isSpawned
        ) {
            return;
        }

        const position = player.group.position;
        const state = player.controls.current;
        const positionChanged =
            this.lastSentPlayerPosition.distanceToSquared(position) >
            MIN_POSITION_CHANGE_SQUARED;
        const stateChanged = this.lastSentPlayerState !== state;
        const nowMilliseconds = performance.now();
        const keyframeDue =
            nowMilliseconds - this.lastPlayerKeyframeMilliseconds >=
            PLAYER_NETWORK_KEYFRAME_INTERVAL_MS;

        if (!positionChanged && !stateChanged && !keyframeDue) {
            return;
        }

        const payload: PlayerMovementPayload = {
            type: 'player_update',
            x: position.x,
            y: position.y,
            z: position.z,
            state,
        };

        if (stateChanged || keyframeDue) {
            this.socket.emit('update', payload);
            this.lastPlayerKeyframeMilliseconds = nowMilliseconds;
        } else {
            this.socket.volatile.emit('update', payload);
        }

        this.lastSentPlayerPosition.copy(position);
        this.lastSentPlayerState = state;
    }

    startPlayerUpdateLoop(): void {
        if (!this.localPlayer || this.playerUpdateIntervalId !== null) {
            return;
        }

        this.playerUpdateIntervalId = window.setInterval(
            () => this.sendLocalPlayerUpdate(),
            PLAYER_NETWORK_UPDATE_INTERVAL_MS
        );
    }

    private stopPlayerUpdateLoop(): void {
        if (this.playerUpdateIntervalId === null) {
            return;
        }

        window.clearInterval(this.playerUpdateIntervalId);
        this.playerUpdateIntervalId = null;
    }

    emitBattleRequest(requestedPlayerId: string): void {
        this.socket.emit('update', {
            type: 'rps_request',
            id: this.socket.id,
            requestedPlayerID: requestedPlayerId,
        });
    }

    emitBattleAccept(requestedPlayerId: string): void {
        this.socket.emit('update', {
            type: 'rps_accept',
            id: this.socket.id,
            requestedPlayerID: requestedPlayerId,
        });
    }

    emitBattleDecline(requestedPlayerId: string): void {
        this.socket.emit('update', {
            type: 'rps_decline',
            id: this.socket.id,
            requestedPlayerID: requestedPlayerId,
        });
    }

    emitFriendRequest(requestedPlayerId: string): void {
        this.friendRequest.sendRequest(requestedPlayerId);
    }

    acceptFriendRequest(): boolean {
        return this.friendRequest.accept();
    }

    declineFriendRequest(): boolean {
        return this.friendRequest.decline();
    }

    removeFriend(friendPlayerId: string): void {
        this.friendRequest.remove(friendPlayerId);
    }

    emitBattleChoice(choice: RPSChoice): void {
        this.socket.emit('update', {
            type: 'rps_choice',
            id: this.socket.id,
            choice,
        });
    }

    emitTTTMark(fieldName: string): void {
        this.socket.emit('update', {
            type: 'ttt_mark',
            fieldName,
        });
    }

    emitTTTStart(): void {
        this.socket.emit('update', {
            type: 'ttt_start',
        });
    }

    emitTTTLeave(): void {
        this.socket.emit('update', {
            type: 'ttt_leave',
        });
    }

    emitGameReset(): void {
        if (!this.socket.connected) {
            return;
        }

        this.socket.emit('update', {
            type: 'game_reset',
        });
    }

    sendChatMessage(message: string): void {
        this.chat.sendMessage(message);
    }

    resolvePlayerNickname(playerId: string, fallbackNickname?: string): string {
        if (playerId === this.localPlayer?.id || playerId === this.socket.id) {
            return this.user.nickname;
        }

        const fallback = fallbackNickname?.trim();
        if (fallback) {
            this.knownPlayerNicknames.set(playerId, fallback);
            return fallback;
        }

        return (
            this.knownPlayerNicknames.get(playerId) ||
            this.players.get(playerId)?.nickname ||
            playerId
        );
    }

    private spawnRemotePlayer(
        id: string,
        remoteCharacter: boolean,
        shouldAnnounceJoin: boolean,
        remoteNickname?: string,
        initialUpdate?: RemotePlayerUpdate
    ): void {
        const isNewPlayer = !this.players.has(id);
        const resolvedNickname = this.resolvePlayerNickname(id, remoteNickname);
        this.spawnPlayer(id, remoteCharacter, resolvedNickname);

        const remotePlayer = this.players.get(id);
        if (initialUpdate && remotePlayer?.isActive()) {
            this.multiplayerMovement(
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

        this.onGameEvent?.({
            eventType: EventType.PlayerJoined,
            data: {
                playerId: id,
            },
            logtime: new Date(),
            user: new User({ nickname: resolvedNickname }),
        });
    }

    private handlePlayerUpdate(data: PlayerUpdatePayload): void {
        if (this.blockedPlayerUpdates.has(data.id)) {
            return;
        }

        const remotePlayer = this.players.get(data.id);
        if (!remotePlayer?.isActive()) {
            return;
        }

        this.multiplayerMovement(
            remotePlayer,
            data.x,
            data.y,
            data.z,
            data.state
        );
    }

    multiplayerMovement(
        player: Remote_Player,
        x: number,
        y: number,
        z: number,
        state: PlayerState
    ) {
        //console.log("ID 1 " + playe.id + " to position: " + playe.group.position.y.toFixed(4) + " , y: " + y.toFixed(4));
        //if(player.id == 1)
        //    this.multiplayerMovementTest(player);
        //console.log("ID 1 " + player.id + " to position: " + player.group.position.y.toFixed(4));
        player.state = state;

        if (!player.isSpawned) {
            player.animateSpawn(x, y, z);
            return;
        }

        const pos = player.group.position;

        this.desired.set(x, y, z);

        if (state === PlayerState.Run)
            player.rotateCharacter(this.desired, pos);

        player.setNetworkPositionTarget(this.desired);
    }

    private trackDepartingPlayer(player: Remote_Player): Promise<void> {
        this.departingPlayers.add(player);
        const completion = player.startDespawn();

        void completion.then(() => {
            this.departingPlayers.delete(player);
        });

        return completion;
    }

    removePlayer(id: string): Promise<void> | null {
        const player = this.players.get(id);
        if (!player) {
            return null;
        }

        this.players.delete(id);
        return this.trackDepartingPlayer(player);
    }

    removeAllPlayers(): Promise<void> {
        const completions: Promise<void>[] = [];

        for (const id of this.players.keys()) {
            const completion = this.removePlayer(id);
            if (completion) {
                completions.push(completion);
            }
        }

        return Promise.all(completions).then(() => undefined);
    }

    updateMultiplayer(
        animationDelta: number,
        lifecycleDelta: number = animationDelta
    ): void {
        if (this.disposed) {
            return;
        }

        for (const [id, player] of this.players) {
            if (!player.isActive()) {
                this.players.delete(id);
                this.trackDepartingPlayer(player);
                continue;
            }

            player.updateLifecycle(lifecycleDelta);
            player.updateNetworkPosition(lifecycleDelta);
            player.updateAnimation(animationDelta);
        }

        for (const player of this.departingPlayers) {
            player.updateLifecycle(lifecycleDelta);
            if (player.lifecycleState === 'disposed') {
                this.departingPlayers.delete(player);
            }
        }
    }

    dispose(): Promise<void> {
        if (this.disposePromise) {
            return this.disposePromise;
        }

        this.disposed = true;
        this.stopPlayerUpdateLoop();
        this.unbindSocketEvents();
        this.friendRequest.dispose();
        this.knownPlayerNicknames.clear();
        this.blockedPlayerUpdates.clear();
        const ownedPlayers = new Set<Remote_Player>([
            ...this.players.values(),
            ...this.departingPlayers,
        ]);
        this.players.clear();
        this.departingPlayers.clear();

        this.disposePromise = Promise.all(
            [...ownedPlayers].map((player) => player.forceDispose())
        ).then(() => undefined);

        return this.disposePromise;
    }

    spawnPlayer(
        id: string,
        character: Character = true,
        nickname: string = id
    ): void {
        if (this.disposed) {
            return;
        }

        const existingPlayer = this.players.get(id);
        if (existingPlayer) {
            if (existingPlayer.isActive()) {
                existingPlayer.setNickname(nickname);
                return;
            }

            this.players.delete(id);
            this.trackDepartingPlayer(existingPlayer);
        }

        const newPlayer = new Remote_Player(
            id,
            character,
            nickname,
            this.mesh_RP
        );
        this.players.set(newPlayer.id, newPlayer);
        this.scene.add(newPlayer.group);
    }
}
