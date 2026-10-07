import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import type { Express, Request } from 'express';
import http from 'http';
import { randomUUID } from 'node:crypto';
import { Server } from 'socket.io';
import type { Socket } from 'socket.io';
import { GameManager } from './gameManager.ts';
import { SaveGameBackend } from './SaveGameBackend.ts';
import { verifyToken } from 'ftr-common/middleware';
import type {
    ChatSendPayload,
    FriendRemoveAcknowledgement,
    FriendRemovePayload,
    FriendRequestAcknowledgement,
    FriendRequestPayload,
    FriendResponsePayload,
    FriendStateSnapshot,
    ReceivedChatPayload,
    PlayerConnectedPayload,
    SaveGameSnapshot,
} from 'ftr-common/sharedTypes';
import { API_USER, SPECTATOR_NAME } from 'ftr-common/sharedTypes';
import { Logger, type ILogObj } from 'tslog';
import dotenv from 'dotenv';
import { exit } from 'node:process';
import { UserServiceClient } from './userServiceClient.ts';

// Initialize main tslog-logger
const log = new Logger<ILogObj>({
    name: 'connService',
    minLevel: process.env['NODE_ENV'] === 'development' ? 'DEBUG' : 'INFO',
});

// ---------------------------=[ env parsing... ]=--------------------------- //

if (process.env['NODE_ENV'] === 'development') {
    log.info('loading dev.env...');
    dotenv.config({ path: '../../../dev.env', quiet: true });
}

// enforce config through dotenv only! add any require env-vars here
const REQUIRED_ENV = [
    'CONN_SERVICE_PORT',
    'USER_SERVICE_ADDR',
    'USER_SERVICE_PORT',
    'INTERNAL_JWT_SECRET',
    'JWT_SECRET',
];
if (REQUIRED_ENV.some((v) => process.env[v] === undefined)) {
    log.error(`env not like it should be! exiting...`);
    exit(1);
}

// TS sadly does not realize they were checked for undefness ;(
const PORT: string = process.env['CONN_SERVICE_PORT']!;
const SECRET_KEY: string = process.env['JWT_SECRET']!;
const INTERNAL_SECRET_KEY: string = process.env['INTERNAL_JWT_SECRET']!;

const USER_SERVICE_ENDPOINT =
    process.env['USER_SERVICE_ADDR'] + ':' + process.env['USER_SERVICE_PORT'];

const USER_INTERNAL_ENDPOINT = USER_SERVICE_ENDPOINT + API_USER.rootInternal;

type PendingFriendRequest = {
    readonly requesterUserId: number;
    readonly requesterNickname: string;
    readonly recipientUserId: number;
    readonly recipientNickname: string;
};

const pendingFriendRequests = new Map<number, PendingFriendRequest>();
const friendsByUser = new Map<number, Set<number>>();
const userNicknames = new Map<number, string>();

const gameManager = new GameManager();
const saveGame = new SaveGameBackend();

function getAuthenticatedUserId(socket: Socket | undefined): number | null {
    const userId = Number(socket?.data.userId);
    return Number.isSafeInteger(userId) ? userId : null;
}

function getUserRoom(userId: number): string {
    return `user:${userId}`;
}

// --------------=[ launching the express / socket.io server ]=-------------- //

const app: Express = express();

app.use(cors());

const server: http.Server = app.listen(PORT, (): void => {
    console.log(`listening on port: ${PORT}`);
});
const io = new Server(server, {
    cors: { origin: '*' },
});

io.engine.use(cookieParser());

io.use((socket, next) => {
    const requestedRole = socket.handshake.auth['role'];
    if (requestedRole === 'spectator') {
        next();
        return;
    }

    const token = (socket.request as Request).cookies['token'];
    if (typeof token !== 'string') {
        log.error('Received invalid token:', token);
        next(new Error('Unauthorized'));
        return;
    }

    try {
        const authenticatedUserId = verifyToken(token, SECRET_KEY, log);
        const requestedUserId = socket.handshake.auth['userId'];
        if (
            !Number.isSafeInteger(requestedUserId) ||
            requestedUserId !== authenticatedUserId
        ) {
            log.error('requested & authenticated UID mismatch or invalid UID');
            next(new Error('Session identity mismatch'));
            return;
        }
        socket.data.userId = authenticatedUserId;
        next();
    } catch (err) {
        log.error('Token verification failed:', err);
        next(new Error('Unauthorized'));
    }
});

// ------------=[ this is where all events handling is defined ]=------------ //

io.on('connection', async (socket) => {
    const requestedRole = socket.handshake.auth['role'];
    let authenticatedPlayerUserId: number | null = null;

    if (
        requestedRole !== undefined &&
        requestedRole !== 'player' &&
        requestedRole !== 'spectator'
    ) {
        log.info(
            `disconnecting client: ${JSON.stringify(socket.conn.remoteAddress)}`
        );
        socket.disconnect(true);
        return;
    }

    const isSpectator = requestedRole === 'spectator';
    const character = socket.handshake.auth['character'];
    const nickname = socket.handshake.auth['nickname'];

    // if required data was not given disconnect client again
    if (!isSpectator && (character == null || nickname == null)) {
        console.log(
            `disconnecting client: ${JSON.stringify(socket.conn.remoteAddress)}`
        );
        socket.disconnect(true);
        return;
    }

    if (isSpectator) {
        socket.data.role = 'spectator';
        socket.data.nickname = SPECTATOR_NAME;
    } else {
        const userId = getAuthenticatedUserId(socket);
        if (userId === null) {
            socket.disconnect(true);
            return;
        }
        authenticatedPlayerUserId = userId;
        socket.data.role = 'player';
        socket.data.nickname = nickname;
        socket.data.character = character;
        const normalizedNickname = String(nickname).trim();
        if (normalizedNickname.length > 0) {
            userNicknames.set(userId, normalizedNickname);
        }
        socket.join(getUserRoom(userId));
        socket.on('friend_sync', (acknowledge: unknown) => {
            acknowledgeFriend(acknowledge, getFriendStateSnapshot(userId));
        });
    }

    /**
     * need to sync all existing players data on join with the new client,
     * or he will not see nickname of existing players
     */
    gameManager.players.forEach((existingPlayer, playerId) => {
        const existingSocket = io.sockets.sockets.get(playerId);
        if (!existingSocket) return;

        const connectedPlayer: PlayerConnectedPayload = {
            id: playerId,
            character: existingSocket.data.character,
            nickname: existingPlayer.nickname,
            isInitialSnapshot: true,
            ...existingPlayer.position,
            state: existingPlayer.state,
        };
        socket.emit('player_connected', connectedPlayer);
    });

    socket.on('chat_message', (data: unknown) => {
        if (typeof data !== 'object' || data === null || Array.isArray(data)) {
            return;
        }

        const chatData = data as Partial<ChatSendPayload>;

        if (typeof chatData.message !== 'string') {
            return;
        }

        const message = chatData.message.trim();

        if (message.length === 0 || message.length > 500) {
            return;
        }

        const canonicalPayload: ReceivedChatPayload = {
            messageId: randomUUID(),
            senderId: socket.id,
            senderName: socket.data.nickname,
            message,
        };

        io.emit('chat_message', canonicalPayload);
    });

    // send initial data to the connected client
    socket.emit('initData', gameManager.tttGame);

    if (isSpectator) {
        console.log('Spectator connected:', socket.id);
        return;
    }

    if (authenticatedPlayerUserId === null) {
        socket.disconnect(true);
        return;
    }
    const playerUserId = authenticatedPlayerUserId;
    const playerData = gameManager.createPlayer(socket.id, nickname);

    const connectedPlayer: PlayerConnectedPayload = {
        id: socket.id,
        character,
        nickname,
        isInitialSnapshot: false,
    };

    // -----------------=[ Game-State persistence logic ]=------------------- //

    const restoredSaveGame = saveGame.connect(playerUserId, socket.id);
    const userService = new UserServiceClient(
        playerUserId,
        USER_INTERNAL_ENDPOINT,
        INTERNAL_SECRET_KEY,
        log
    );

    await userService.updateUserPresence(true);

    if (restoredSaveGame) {
        Object.assign(playerData.position, restoredSaveGame.position);
        Object.assign(connectedPlayer, restoredSaveGame.position, {
            state: playerData.state,
        });
        log.info('Restored player state from SaveGame');
    } else {
        // NOTE: if no SaveGame found (null) try to get player position from
        // DB... All of this is a little bit hacky as it would be a reasonable
        // refac to use _only_ the DB for storing state. But this is where we
        // are now :/
        try {
            const userData = await userService.getUserState();

            if (userData !== undefined) {
                const pos = userData.position;
                const bhTimer = userData.blackholeTimer;
                let restoredBlackHoleTimer: number | undefined;
                if (bhTimer !== 0) {
                    restoredBlackHoleTimer = bhTimer;
                }
                // unfortunately need to create an initial SaveGame in order to
                // easily hook into propagation of the restored state.
                saveGame.getOrCreateSave(
                    playerUserId,
                    pos,
                    restoredBlackHoleTimer
                );
                Object.assign(playerData.position, pos);
                Object.assign(connectedPlayer, pos, {
                    state: playerData.state,
                });
            }
            log.info('Restored player state from DB!');
        } catch {
            log.error('Failed getting player pos from DB');
        }
    }

    gameManager.players.set(socket.id, playerData);

    socket.broadcast.emit('player_connected', connectedPlayer);
    console.log('Client connected:', socket.id);

    socket.on('save_game_restore', (acknowledge: unknown) => {
        if (typeof acknowledge !== 'function') {
            return;
        }
        const snapshot = saveGame.getSnapshot(playerUserId, socket.id);
        if (snapshot === null) {
            return;
        }
        acknowledge(snapshot);
    });

    // disconnect and remove player from gameManager
    socket.on('disconnect', async () => {
        log.info('Client disconnected:', socket.id);

        // get latest saveGameSnap for disconnecting user.. process it later.
        const snapshot: SaveGameSnapshot | null = saveGame.getSnapshot(
            playerUserId,
            socket.id
        );

        const shouldMarkOffline = !saveGame.disconnect(
            playerUserId,
            socket.id,
            gameManager.players.get(socket.id)?.position
        );
        if (gameManager.resetPlayerGame(socket.id)) {
            io.emit('update', {
                type: 'ttt_reset',
            });
        }

        gameManager.players.delete(socket.id);

        socket.broadcast.emit('player_disconnected', socket.id);

        if (shouldMarkOffline) {
            await userService.updateUserPresence(false);
        }

        // sync playerData to DB on disco...
        //
        // NOTE: in order to avoid cheating and/or users messing with this data
        // the requests to backend services should only be made **inside** the
        // backend so they are not visible and callable from frontend! this
        // would have been secure backend-design!!!
        // However, this means the backend needs some at least authenticated
        // connection to backend services, or we just expose some services,
        // which are not proxied which are backend-internal
        //
        // TODO maybe also move quests syncing to backend correspondingly

        if (snapshot !== null) {
            try {
                await userService.updateUserState(
                    snapshot.position,
                    snapshot.blackHoleSecondsRemaining
                );
                log.info('Snapshot stored in DB for UID', socket.data.userId);
            } catch {
                log.error(
                    'Storing snapshot in DB failed for UID',
                    socket.data.userId
                );
            }
        }
    });

    // NEXT
    // NOTE: from an anti-cheat / backend-frontend trust-design - perspective it
    // would be the correct workflow to let the Quests emit update events which
    // then would be collected here and corresponding action be taken like
    // toggling quest-status etc.
    socket.on('update', (data, acknowledge) => {
        switch (data.type) {
            case 'player_update': {
                const playerUpdate = gameManager.handlePlayerUpdate(
                    socket.id,
                    data
                );
                if (!playerUpdate) {
                    break;
                }
                const userId = getAuthenticatedUserId(socket);
                if (userId !== null) {
                    saveGame.updatePosition(userId, socket.id, playerUpdate);
                }
                socket.broadcast.volatile.emit('update', playerUpdate);
                break;
            }
            case 'save_game_timer':
                saveGame.SaveGameBlackholeTimer(
                    getAuthenticatedUserId(socket),
                    socket.id,
                    gameManager.players.get(socket.id)?.position,
                    data
                );
                break;
            case 'save_game_quest_status':
                saveGame.SaveGameQuestStatus(
                    getAuthenticatedUserId(socket),
                    socket.id,
                    gameManager.players.get(socket.id)?.position,
                    data
                );
                break;
            case 'black_hole_timeout':
                saveGame.clearForBlackHoleTimeout(playerUserId, socket.id);
                break;
            case 'save_game_restart':
                saveGame.restartAfterBlackHole(
                    playerUserId,
                    socket.id,
                    gameManager.players.get(socket.id)?.position
                );
                break;

            case 'ttt_mark':
                for (const update of gameManager.handleTTTMark(
                    socket.id,
                    data
                )) {
                    io.emit('update', update);
                }
                break;

            case 'ttt_update':
                socket.broadcast.emit('update', {
                    type: 'ttt_update',
                    id: socket.id,
                    board: data.board,
                });
                break;
            case 'ttt_start':
                for (const update of gameManager.handleTTTStart(socket.id)) {
                    io.emit('update', update);
                }
                break;
            case 'ttt_leave': {
                const update = gameManager.handleTTTLeave(socket.id);
                if (update) {
                    io.emit('update', update);
                }
                break;
            }

            case 'rps_request': {
                const update = gameManager.handleRPSRequest(socket.id, data);
                if (update) {
                    socket.broadcast.emit('update', update);
                }
                break;
            }
            case 'rps_accept':
            case 'rps_decline': {
                const update = gameManager.handleRPSResponse(socket.id, data);
                if (update) {
                    socket.broadcast.emit('update', update);
                }
                break;
            }
            case 'rps_choice': {
                const update = gameManager.handleRPSChoice(socket.id, data);
                if (!update) {
                    break;
                }
                if (update.type === 'rps_draw') {
                    io.to([update.playerOne, update.playerTwo]).emit(
                        'update',
                        update
                    );
                } else {
                    io.to([update.winner, update.loser]).emit('update', update);
                }
                break;
            }
            case 'rps_invalid': {
                const update = gameManager.handleRPSInvalid(socket.id);
                if (update) {
                    io.to([update.playerOne, update.playerTwo]).emit(
                        'update',
                        update
                    );
                }
                break;
            }
            case 'friend_request':
                handleFriendRequest(socket, data, acknowledge);
                break;
            case 'friend_accept':
            case 'friend_decline':
                handleFriendResponse(socket, data, acknowledge);
                break;
            case 'friend_remove':
                handleFriendRemove(socket, data, acknowledge);
                break;
            case 'game_reset':
                if (gameManager.resetPlayerGame(socket.id)) {
                    io.emit('update', {
                        type: 'ttt_reset',
                    });
                }
                break;
            default:
                console.log('Unknown data type:', data.type);
        }
    });
});

type FriendAcknowledgement =
    | boolean
    | FriendRequestAcknowledgement
    | FriendRemoveAcknowledgement
    | FriendStateSnapshot;

function acknowledgeFriend(
    acknowledge: unknown,
    result: FriendAcknowledgement
): void {
    if (typeof acknowledge === 'function') {
        acknowledge(result);
    }
}

function areFriends(firstUserId: number, secondUserId: number): boolean {
    return friendsByUser.get(firstUserId)?.has(secondUserId) ?? false;
}

function addFriendship(firstUserId: number, secondUserId: number): void {
    for (const [userId, friendUserId] of [
        [firstUserId, secondUserId],
        [secondUserId, firstUserId],
    ] as const) {
        const friends = friendsByUser.get(userId) ?? new Set<number>();
        friendsByUser.set(userId, friends);
        friends.add(friendUserId);
    }
}

function removeFriendship(firstUserId: number, secondUserId: number): void {
    for (const [userId, friendUserId] of [
        [firstUserId, secondUserId],
        [secondUserId, firstUserId],
    ] as const) {
        const friends = friendsByUser.get(userId);
        friends?.delete(friendUserId);
        if (friends?.size === 0) {
            friendsByUser.delete(userId);
        }
    }
}

function getPendingFriendRequestSnapshot(
    userId: number
): FriendStateSnapshot['pendingRequest'] {
    const incomingRequest = pendingFriendRequests.get(userId);
    if (incomingRequest !== undefined) {
        return {
            direction: 'incoming',
            playerId: String(incomingRequest.requesterUserId),
            nickname: incomingRequest.requesterNickname,
        };
    }

    for (const request of pendingFriendRequests.values()) {
        if (request.requesterUserId === userId) {
            return {
                direction: 'outgoing',
                playerId: String(request.recipientUserId),
                nickname: request.recipientNickname,
            };
        }
    }

    return null;
}

function getFriendStateSnapshot(userId: number): FriendStateSnapshot {
    const friends = Array.from(
        friendsByUser.get(userId) ?? [],
        (friendUserId) => ({
            playerId: String(friendUserId),
            nickname: userNicknames.get(friendUserId) ?? String(friendUserId),
        })
    );

    return {
        friends,
        pendingRequest: getPendingFriendRequestSnapshot(userId),
    };
}

function emitFriendState(userId: number): void {
    io.to(getUserRoom(userId)).emit(
        'friend_state',
        getFriendStateSnapshot(userId)
    );
}

function handleFriendRequest(
    socket: Socket,
    data: FriendRequestPayload,
    acknowledge: unknown
): void {
    const requestedPlayerId = data.requestedPlayerID;
    const requestingUserId = getAuthenticatedUserId(socket);
    let requestedUserId: number | null = null;
    if (typeof requestedPlayerId === 'string') {
        requestedUserId = getAuthenticatedUserId(
            io.sockets.sockets.get(requestedPlayerId)
        );
    }
    if (
        typeof requestedPlayerId !== 'string' ||
        requestedPlayerId === socket.id ||
        !gameManager.players.has(requestedPlayerId) ||
        requestingUserId === null ||
        requestedUserId === null
    ) {
        acknowledgeFriend(acknowledge, {
            accepted: false,
            reason: 'invalid_target',
        });
        return;
    }

    if (requestingUserId === requestedUserId) {
        acknowledgeFriend(acknowledge, {
            accepted: false,
            reason: 'same_account',
        });
        return;
    }

    const requestingPlayer = gameManager.players.get(socket.id);
    const requestedPlayer = gameManager.players.get(requestedPlayerId);
    if (!requestingPlayer || !requestedPlayer) {
        acknowledgeFriend(acknowledge, {
            accepted: false,
            reason: 'invalid_target',
        });
        return;
    }
    if (areFriends(requestingUserId, requestedUserId)) {
        acknowledgeFriend(acknowledge, {
            accepted: false,
            reason: 'already_friends',
        });
        return;
    }

    const existingRequest = pendingFriendRequests.get(requestedUserId);
    if (existingRequest?.requesterUserId === requestingUserId) {
        acknowledgeFriend(acknowledge, {
            accepted: false,
            reason: 'duplicate',
        });
        return;
    }

    if (
        getPendingFriendRequestSnapshot(requestingUserId) !== null ||
        getPendingFriendRequestSnapshot(requestedUserId) !== null
    ) {
        acknowledgeFriend(acknowledge, {
            accepted: false,
            reason: 'duplicate_request',
        });
        return;
    }

    const pendingRequest: PendingFriendRequest = {
        requesterUserId: requestingUserId,
        requesterNickname: requestingPlayer.nickname,
        recipientUserId: requestedUserId,
        recipientNickname: requestedPlayer.nickname,
    };

    pendingFriendRequests.set(requestedUserId, pendingRequest);
    const payload: FriendRequestPayload = {
        type: 'friend_request',
        id: socket.id,
        requestedPlayerID: requestedPlayerId,
        friendUserId: requestingUserId,
        nickname: requestingPlayer.nickname,
    };
    acknowledgeFriend(acknowledge, {
        accepted: true,
        friendUserId: requestedUserId,
    });
    io.to(getUserRoom(requestedUserId)).emit('update', payload);
    emitFriendState(requestingUserId);
}

function handleFriendResponse(
    socket: Socket,
    data: FriendResponsePayload,
    acknowledge: unknown
): void {
    const respondingUserId = getAuthenticatedUserId(socket);
    const requesterUserId = data.friendUserId;
    if (
        respondingUserId === null ||
        !Number.isSafeInteger(requesterUserId) ||
        requesterUserId === respondingUserId
    ) {
        acknowledgeFriend(acknowledge, false);
        return;
    }

    const pendingRequest = pendingFriendRequests.get(respondingUserId);
    const respondingPlayer = gameManager.players.get(socket.id);
    if (
        pendingRequest === undefined ||
        pendingRequest.requesterUserId !== requesterUserId ||
        !respondingPlayer ||
        pendingRequest.recipientUserId !== respondingUserId
    ) {
        acknowledgeFriend(acknowledge, false);
        return;
    }

    pendingFriendRequests.delete(respondingUserId);

    if (data.type === 'friend_accept') {
        addFriendship(respondingUserId, requesterUserId);
    }

    const respondingUserPayload: FriendResponsePayload = {
        type: data.type,
        id: String(requesterUserId),
        friendUserId: requesterUserId,
        nickname: pendingRequest.requesterNickname,
    };
    io.to(getUserRoom(respondingUserId)).emit('update', respondingUserPayload);

    const payload: FriendResponsePayload = {
        type: data.type,
        id: socket.id,
        friendUserId: respondingUserId,
        nickname: respondingPlayer.nickname,
    };
    io.to(getUserRoom(requesterUserId)).emit('update', payload);
    acknowledgeFriend(acknowledge, true);
}

function handleFriendRemove(
    socket: Socket,
    data: FriendRemovePayload,
    acknowledge: unknown
): void {
    const removedUserId = data.friendUserId;
    const requestingUserId = getAuthenticatedUserId(socket);
    if (
        !Number.isSafeInteger(removedUserId) ||
        requestingUserId === null ||
        removedUserId === requestingUserId
    ) {
        acknowledgeFriend(acknowledge, {
            removed: false,
            reason: 'invalid_target',
        });
        return;
    }

    const requestingPlayer = gameManager.players.get(socket.id);
    if (!requestingPlayer) {
        acknowledgeFriend(acknowledge, {
            removed: false,
            reason: 'invalid_target',
        });
        return;
    }

    const friendshipExisted = areFriends(requestingUserId, removedUserId);

    removeFriendship(requestingUserId, removedUserId);
    const requestingUserPayload: FriendRemovePayload = {
        type: 'friend_remove',
        id: socket.id,
        friendUserId: removedUserId,
    };
    socket
        .to(getUserRoom(requestingUserId))
        .emit('update', requestingUserPayload);
    acknowledgeFriend(acknowledge, { removed: true });
    if (!friendshipExisted) {
        return;
    }

    const payload: FriendRemovePayload = {
        type: 'friend_remove',
        id: socket.id,
        friendUserId: requestingUserId,
        nickname: requestingPlayer.nickname,
    };
    io.to(getUserRoom(removedUserId)).emit('update', payload);
}
