import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import type { Express, Request } from 'express';
import http from 'http';
import { randomUUID } from 'node:crypto';
import { Server } from 'socket.io';
import type { Socket } from 'socket.io';
import { GameManager } from './gameManager.ts';
import { verifyToken } from 'ftr-common/middleware';
import type {
    ChatSendPayload,
    FriendRemoveAcknowledgement,
    FriendRemovePayload,
    FriendRequestAcknowledgement,
    FriendRequestPayload,
    FriendResponseType,
    ReceivedChatPayload,
    RPSBattleChoicePayload,
    RPSRequestDataPayload,
    PlayerMovementPayload,
    PlayerConnectedPayload,
    PlayerUpdatePayload,
    TTTMarkPayload,
} from 'ftr-common/sharedTypes';
import { SPECTATOR_NAME, TTTGameState, TTTMark } from 'ftr-common/sharedTypes';

const PORT = 3000;
const SECRET_KEY: string = process.env['JWT_SECRET'] || 'FooBarBaz';
const app: Express = express();

app.use(cors());

const server: http.Server = app.listen(PORT, (): void => {
    console.log(`listening on port: ${PORT}`);
});
const io = new Server(server, {
    cors: { origin: '*' },
});
io.engine.use(cookieParser());
const gameManager = new GameManager();
const pendingFriendRequests = new Map<string, string>();
const friendsByUser = new Map<number, Set<number>>();

function getAuthenticatedUserId(socket: Socket | undefined): number | null {
    const userId = Number(socket?.data.userId);
    return Number.isSafeInteger(userId) ? userId : null;
}

function getUserRoom(userId: number): string {
    return `user:${userId}`;
}

io.use((socket, next) => {
    const requestedRole = socket.handshake.auth['role'];
    if (requestedRole === 'spectator') {
        next();
        return;
    }

    const token = (socket.request as Request).cookies['token'];
    if (typeof token !== 'string') {
        next(new Error('Unauthorized'));
        return;
    }

    try {
        const authenticatedUserId = verifyToken(token, SECRET_KEY);
        const requestedUserId = socket.handshake.auth['userId'];
        if (
            !Number.isSafeInteger(requestedUserId) ||
            requestedUserId !== authenticatedUserId
        ) {
            next(new Error('Session identity mismatch'));
            return;
        }
        socket.data.userId = authenticatedUserId;
        next();
    } catch {
        next(new Error('Unauthorized'));
    }
});

// TODO add event logging to all loggable socket-events like chat-msg,
// player_connect, etc.

io.on('connection', (socket) => {
    const requestedRole = socket.handshake.auth['role'];

    if (
        requestedRole !== undefined &&
        requestedRole !== 'player' &&
        requestedRole !== 'spectator'
    ) {
        console.log(
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
        socket.data.role = 'player';
        socket.data.nickname = nickname;
        socket.data.character = character;
        socket.join(getUserRoom(userId));
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
    socket.emit('initData', gameManager.getMapData());

    if (isSpectator) {
        console.log('Spectator connected:', socket.id);
        return;
    }

    // the only other action preformed currently by the backend apart from
    // handling ttt and rps game
    const connectedPlayer: PlayerConnectedPayload = {
        id: socket.id,
        character,
        nickname,
        isInitialSnapshot: false,
    };
    socket.broadcast.emit('player_connected', connectedPlayer);
    console.log('Client connected:', socket.id);

    gameManager.players.set(
        socket.id,
        gameManager.createPlayer(socket.id, nickname)
    );

    // TTT-Disconnect
    // dissconnect and remove player from gameManager
    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
        clearPendingFriendRequests(socket.id);
        const userId = getAuthenticatedUserId(socket);
        if (userId !== null) {
            clearFriendships(userId);
        }
        playerGameReset(socket.id);

        gameManager.removePlayer(socket.id);

        socket.broadcast.emit('player_disconnected', socket.id);
    });

    socket.on('update', (data, acknowledge) => {
        switch (data.type) {
            case 'player_update':
                handlePlayerUpdate(socket, data);
                break;

            case 'ttt_mark':
                handleTTTMark(socket, data);
                break;

            case 'ttt_update':
                socket.broadcast.emit('update', {
                    type: 'ttt_update',
                    id: socket.id,
                    board: data.board,
                });
                break;
            case 'ttt_start':
                handleTTTStart(socket);
                break;
            case 'ttt_leave':
                handleTTTLeave(socket);
                break;

            case 'rps_request':
                handleRPSRequest(socket, data);
                break;
            case 'rps_accept':
                handleRPSAccept(socket, data);
                break;
            case 'rps_decline':
                handleRPSDecline(socket, data);
                break;
            case 'rps_choice':
                handleRPSChoice(socket, data);
                break;
            case 'rps_invalid':
                handleRPSInvalid(socket);
                break;
            case 'friend_request':
                handleFriendRequest(socket, data, acknowledge);
                break;
            case 'friend_accept':
            case 'friend_decline':
                handleFriendResponse(socket, data, data.type, acknowledge);
                break;
            case 'friend_remove':
                handleFriendRemove(socket, data, acknowledge);
                break;
            case 'game_reset':
                handleGameReset(socket);
                break;
            default:
                console.log('Unknown data type:', data.type);
        }
    });
});

// -----------------=[ helper functions for game management ]=--------------- //

// TODO refactor this and move all helper-functions into gameManager class.

function handleRPSRequest(socket: Socket, data: RPSRequestDataPayload) {
    //console.log("RPS REQUEST");
    const result = gameManager.rpsRequested({
        ...data,
        id: socket.id,
    });
    //console.log("RPS REQUEST result: " + result);
    if (result == 0) {
        return;
    }

    // use server-stored nicknames only for visible RPS text while retaining socket IDs for game logic.
    const requestingPlayer = gameManager.players.get(socket.id);

    if (!requestingPlayer) {
        return;
    }
    socket.broadcast.emit('update', {
        type: 'rps_request',
        id: socket.id,
        requestedPlayerID: data.requestedPlayerID,
        nickname: requestingPlayer.nickname,
    });
}

type FriendAcknowledgement =
    boolean | FriendRequestAcknowledgement | FriendRemoveAcknowledgement;

function acknowledgeFriend(
    acknowledge: unknown,
    result: FriendAcknowledgement
): void {
    if (typeof acknowledge === 'function') {
        acknowledge(result);
    }
}

function hasPendingFriendRequest(playerId: string): boolean {
    if (pendingFriendRequests.has(playerId)) {
        return true;
    }

    for (const requesterId of pendingFriendRequests.values()) {
        if (requesterId === playerId) {
            return true;
        }
    }

    return false;
}

function areFriends(firstUserId: number, secondUserId: number): boolean {
    return friendsByUser.get(firstUserId)?.has(secondUserId) ?? false;
}

function addFriendship(firstUserId: number, secondUserId: number): void {
    const firstUserFriends =
        friendsByUser.get(firstUserId) ?? new Set<number>();
    friendsByUser.set(firstUserId, firstUserFriends);
    firstUserFriends.add(secondUserId);
    const secondUserFriends =
        friendsByUser.get(secondUserId) ?? new Set<number>();
    friendsByUser.set(secondUserId, secondUserFriends);
    secondUserFriends.add(firstUserId);
}

function removeFriendship(firstUserId: number, secondUserId: number): void {
    const firstUserFriends = friendsByUser.get(firstUserId);
    firstUserFriends?.delete(secondUserId);
    if (firstUserFriends?.size === 0) {
        friendsByUser.delete(firstUserId);
    }
    const secondUserFriends = friendsByUser.get(secondUserId);
    secondUserFriends?.delete(firstUserId);
    if (secondUserFriends?.size === 0) {
        friendsByUser.delete(secondUserId);
    }
}

function clearFriendships(userId: number): void {
    const friends = friendsByUser.get(userId);
    if (!friends) {
        return;
    }
    for (const friendId of friends) {
        friendsByUser.get(friendId)?.delete(userId);
    }
    friendsByUser.delete(userId);
}

function handleFriendRequest(
    socket: Socket,
    data: FriendRequestPayload,
    acknowledge: unknown
): void {
    const requestedPlayerId = data.requestedPlayerID;
    const requestingUserId = getAuthenticatedUserId(socket);
    const requestedUserId =
        typeof requestedPlayerId === 'string'
            ? getAuthenticatedUserId(io.sockets.sockets.get(requestedPlayerId))
            : null;
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
    if (!requestingPlayer) {
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

    if (pendingFriendRequests.get(requestedPlayerId) === socket.id) {
        acknowledgeFriend(acknowledge, {
            accepted: false,
            reason: 'duplicate',
        });
        return;
    }

    if (
        hasPendingFriendRequest(socket.id) ||
        hasPendingFriendRequest(requestedPlayerId)
    ) {
        acknowledgeFriend(acknowledge, {
            accepted: false,
            reason: 'duplicate_request',
        });
        return;
    }

    pendingFriendRequests.set(requestedPlayerId, socket.id);
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
    io.to(requestedPlayerId).emit('update', payload);
}

function handleFriendResponse(
    socket: Socket,
    data: FriendRequestPayload,
    responseType: FriendResponseType,
    acknowledge: unknown
): void {
    const requesterId = data.requestedPlayerID;
    if (
        typeof requesterId !== 'string' ||
        pendingFriendRequests.get(socket.id) !== requesterId
    ) {
        acknowledgeFriend(acknowledge, false);
        return;
    }

    pendingFriendRequests.delete(socket.id);

    const respondingPlayer = gameManager.players.get(socket.id);
    const respondingUserId = getAuthenticatedUserId(socket);
    const requesterUserId = getAuthenticatedUserId(
        io.sockets.sockets.get(requesterId)
    );
    if (
        !respondingPlayer ||
        !gameManager.players.has(requesterId) ||
        respondingUserId === null ||
        requesterUserId === null
    ) {
        acknowledgeFriend(acknowledge, false);
        return;
    }
    if (responseType === 'friend_accept') {
        addFriendship(respondingUserId, requesterUserId);
    }
    const payload: FriendRequestPayload = {
        type: responseType,
        id: socket.id,
        requestedPlayerID: requesterId,
        friendUserId: respondingUserId,
        nickname: respondingPlayer.nickname,
    };
    io.to(requesterId).emit('update', payload);
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

function clearPendingFriendRequests(playerId: string): void {
    pendingFriendRequests.delete(playerId);

    for (const [recipientId, requesterId] of pendingFriendRequests) {
        if (requesterId === playerId) {
            pendingFriendRequests.delete(recipientId);
        }
    }
}

function handlePlayerUpdate(socket: Socket, data: PlayerMovementPayload) {
    const player = gameManager.players.get(socket.id);
    if (!player) {
        console.log('Player not found for id: ' + socket.id);
        return;
    }

    gameManager.updatePlayer(socket.id, data.x, data.y, data.z, data.state);

    const playerUpdate: PlayerUpdatePayload = {
        type: 'player_update',
        id: socket.id,
        x: data.x,
        y: data.y,
        z: data.z,
        state: data.state,
    };

    socket.broadcast.volatile.emit('update', playerUpdate);
}

function handleTTTStart(socket: Socket) {
    const player = gameManager.players.get(socket.id);

    if (!player) return;
    if (player.inGame) return;

    const state = gameManager.startTTTGame(socket.id);

    if (state == 0) return;

    if (state == 1) {
        player.inGame = true;
        player.gameID = 'tttGame';

        io.emit('update', {
            type: 'ttt_playerOne',
            id: socket.id,
        });
        return;
    }

    if (state == 2) {
        const playerOneID = gameManager.tttGame.players[0];
        const playerTwoID = gameManager.tttGame.players[1];

        if (!playerOneID || !playerTwoID) return;

        const playerOne = gameManager.players.get(playerOneID);
        const playerTwo = gameManager.players.get(playerTwoID);

        if (!playerOne || !playerTwo) return;

        player.inGame = true;
        player.gameID = 'tttGame';

        io.emit('update', {
            type: 'ttt_playerTwo',
            id: socket.id,
        });

        io.emit('update', {
            type: 'ttt_start',
            playerOne: playerOneID,
            playerTwo: playerTwoID,
            playerOneNickname: playerOne.nickname,
            playerTwoNickname: playerTwo.nickname,
        });

        return;
    }

    io.emit('update', {
        type: 'ttt_reset',
    });
}

/** Lobby canceln Tic-Tac-Toe-Reset */
function handleTTTLeave(socket: Socket): void {
    const player = gameManager.players.get(socket.id);

    if (!player || !gameManager.leaveTTTGame(socket.id)) return;

    player.inGame = false;
    player.gameID = null;

    io.emit('update', {
        type: 'ttt_left',
    });
}

function wait(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function handleTTTMark(socket: Socket, data: TTTMarkPayload) {
    const result = gameManager.tttMarkField(socket.id, data.fieldName);

    if (result == TTTMark.Empty) {
        console.log('Nothing marked: ' + socket.id);
        return;
    }

    //console.log("Marked field: " + result + " by player: " + socket.id);
    if (result == TTTMark.X || result == TTTMark.O) {
        io.emit('update', {
            type: 'ttt_mark',
            id: socket.id,
            fieldName: data.fieldName,
            mark: result,
        });
    }

    const checkWin = gameManager.checkWin();
    if (checkWin >= 1 && checkWin <= 8) {
        // use server-stored nicknames only for visible TTT text while retaining socket IDs for game logic.
        const winner = gameManager.players.get(socket.id);

        if (!winner) {
            return;
        }

        const finishedGame = gameManager.tttGame;
        finishedGame.state = TTTGameState.Finished;

        io.emit('update', {
            type: 'ttt_win',
            id: socket.id,
            winner: checkWin,
            nickname: winner.nickname,
        });

        wait(3000).then(() => {
            if (gameManager.tttGame !== finishedGame) return;

            const playerOneID = finishedGame.players[0];
            const playerTwoID = finishedGame.players[1];

            if (!playerOneID || !playerTwoID) return;

            const playerOne = gameManager.players.get(playerOneID);
            const playerTwo = gameManager.players.get(playerTwoID);

            if (!playerOne || !playerTwo) return;

            playerOne.inGame = false;
            playerOne.gameID = null;
            playerTwo.inGame = false;
            playerTwo.gameID = null;

            gameManager.tttGame = gameManager.createTTTGame();
        });
        return;
    }

    const checkDraw = gameManager.checkDraw();
    if (checkDraw) {
        const finishedGame = gameManager.tttGame;
        finishedGame.state = TTTGameState.Finished;

        console.log('Game is a draw.');
        io.emit('update', {
            type: 'ttt_draw',
        });

        wait(3000).then(() => {
            if (gameManager.tttGame !== finishedGame) return;

            const playerOneID = finishedGame.players[0];
            const playerTwoID = finishedGame.players[1];

            if (!playerOneID || !playerTwoID) return;

            const playerOne = gameManager.players.get(playerOneID);
            const playerTwo = gameManager.players.get(playerTwoID);

            if (!playerOne || !playerTwo) return;

            playerOne.inGame = false;
            playerOne.gameID = null;
            playerTwo.inGame = false;
            playerTwo.gameID = null;

            gameManager.tttGame = gameManager.createTTTGame();
        });
        return;
    }
}

function playerGameReset(playerID: string) {
    if (gameManager.resetTTTGameForPlayer(playerID)) {
        io.emit('update', {
            type: 'ttt_reset',
        });
        return;
    }

    const player = gameManager.players.get(playerID);

    if (!player) return;

    const gameID = player.gameID;

    if (!gameID) return;

    const rpsGame = gameManager.rpsGame.get(gameID);

    if (!rpsGame) return;

    gameManager.removeRPSGame(gameID);
}

function handleGameReset(socket: Socket) {
    playerGameReset(socket.id);
}

function handleRPSInvalid(socket: Socket) {
    const timedOutGame = gameManager.rpsTimeout(socket.id);

    if (!timedOutGame) return;

    io.to([timedOutGame.playerOne, timedOutGame.playerTwo]).emit('update', {
        type: 'rps_invalid',
        playerOne: timedOutGame.playerOne,
        playerTwo: timedOutGame.playerTwo,
    });
}

function handleRPSChoice(socket: Socket, data: RPSBattleChoicePayload): void {
    const result = gameManager.rpsChoice({
        ...data,
        id: socket.id,
    });

    if (!result || result == 0) {
        console.log('RPS choice failed for player: ' + socket.id);
        return;
    }

    const player = gameManager.players.get(socket.id);

    if (!player) return;

    const gameID = player.gameID;

    if (!gameID) return;

    const gameResultCheck = gameManager.verifyRPSGame(gameID);

    if (!gameResultCheck) return;

    if (gameResultCheck < 2 || gameResultCheck > 4) return;

    const rpsGame = gameManager.rpsGame.get(gameID);

    if (!rpsGame) return;

    const PlayerOne = rpsGame.playerOne;
    const PlayerTwo = rpsGame.playerTwo;

    if (gameResultCheck === 2) {
        const { playerOne, playerTwo, choice } = gameManager.resultDraw(
            PlayerOne,
            PlayerTwo,
            rpsGame.playerOneChoice
        );

        io.to([PlayerOne, PlayerTwo]).emit('update', {
            type: 'rps_draw',
            playerOne: playerOne,
            playerTwo: playerTwo,
            choice: choice,
        });
    } else {
        let winner = PlayerOne;
        let winnerChoice = rpsGame.playerOneChoice;
        let loser = PlayerTwo;
        let loserChoice = rpsGame.playerTwoChoice;

        if (gameResultCheck === 4) {
            winner = PlayerTwo;
            winnerChoice = rpsGame.playerTwoChoice;
            loser = PlayerOne;
            loserChoice = rpsGame.playerOneChoice;
        }

        const gameResult = gameManager.resultWinner(
            winner,
            winnerChoice,
            loser,
            loserChoice
        );

        io.to([PlayerOne, PlayerTwo]).emit('update', {
            type: 'rps_winner',
            winner: gameResult.winner,
            winnerChoice: gameResult.winnerChoice,
            loser: gameResult.loser,
            loserChoice: gameResult.loserChoice,
        });
    }

    gameManager.removeRPSGame(gameID);
}

function handleRPSAccept(socket: Socket, data: RPSRequestDataPayload) {
    const result = gameManager.rpsAccept({
        ...data,
        id: socket.id,
    });

    if (result == 0) return;

    socket.broadcast.emit('update', {
        type: 'rps_accept',
        id: socket.id,
        requestedPlayerID: data.requestedPlayerID,
    });

    /* console.log("START");
    wait(2500).then(() => {
      console.log("END");
    }); */
}

function handleRPSDecline(socket: Socket, data: RPSRequestDataPayload) {
    const result = gameManager.rpsDeclined({
        ...data,
        id: socket.id,
    });

    if (result == 0) return;

    socket.broadcast.emit('update', {
        type: 'rps_decline',
        id: socket.id,
        requestedPlayerID: data.requestedPlayerID,
    });
}
