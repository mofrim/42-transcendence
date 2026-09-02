import express from 'express';
import cors from 'cors';
import type { Express } from 'express';
import http from 'http';
import { Server } from 'socket.io';
import type { Socket } from 'socket.io';
import { GameManager } from './gameManager.ts';

import type {
    RPSBattleChoicePayload,
    RPSRequestDataPayload,
    PlayerUpdatePayload,
    TTTMarkPayload,
} from 'common/sharedTypes';

import { TTTGameState, TTTMark } from 'common/sharedTypes';

const PORT = 3000;
const app: Express = express();

app.use(cors());

const server: http.Server = app.listen(PORT, (): void => {
    console.log(`listening on port: ${PORT}`);
});

const io = new Server(server, {
    cors: { origin: '*' },
});

const gameManager = new GameManager();

// TODO add event logging to all loggable socket-events like chat-msg,
// player_connect, etc.

io.on('connection', (socket) => {
    const character = socket.handshake.auth['character'];
    const nickname = socket.handshake.auth['nickname'];

    // if required data was not given disconnect client again
    if (character == null || nickname == null) {
        console.log(
            `disconnecting client: ${JSON.stringify(socket.conn.remoteAddress)}`
        );
        socket.disconnect(true);
        return;
    }

    socket.data.character = character;

    /**
     * need to sync all existing players data on join with the new client,
     * or he will not see nickname of existing players
     */
    gameManager.players.forEach((existingPlayer, playerId) => {
        const existingSocket = io.sockets.sockets.get(playerId);
        if (!existingSocket) return;

        socket.emit('player_connected', {
            id: playerId,
            character: existingSocket.data.character,
            nickname: existingPlayer.nickname,
        });
    });

    // the only other action preformed currently by the backend apart from
    // handling ttt and rps game
    socket.broadcast.emit('player_connected', {
        id: socket.id,
        character,
        nickname,
    });
    console.log('Client connected:', socket.id);

    gameManager.players.set(
        socket.id,
        gameManager.createPlayer(socket.id, nickname)
    );

    // send initial data to the connected client
    socket.emit('initData', gameManager.getMapData());

    // TTT-Disconnect
    // dissconnect and remove player from gameManager
    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
        // Check if the player is still in the Tic Tac Toe game and reset if necessary
        if (gameManager.tttGame.players.includes(socket.id)) {
            const [playerOneID, playerTwoID] = gameManager.tttGame.players;

            for (const playerID of [playerOneID, playerTwoID]) {
                if (!playerID) continue;

                const tttPlayer = gameManager.players.get(playerID);
                if (!tttPlayer) continue;

                tttPlayer.inGame = false;
                tttPlayer.gameID = null;
            }

            console.log('Player still exists after disconnect: ' + socket.id);
            gameManager.tttGame = gameManager.createTTTGame();
            io.emit('update', {
                type: 'ttt_reset',
            });
        }

        playerGameReset(socket.id);

        gameManager.removePlayer(socket.id);

        socket.broadcast.emit('player_disconnected', socket.id);
    });

    socket.on('update', (data) => {
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

function handlePlayerUpdate(socket: Socket, data: PlayerUpdatePayload) {
    const player = gameManager.players.get(socket.id);
    if (!player) {
        console.log('Player not found for id: ' + socket.id);
        return;
    }

    gameManager.updatePlayer(socket.id, data.x, data.y, data.z, data.state);

    socket.broadcast.emit('update', {
        type: 'player_update',
        id: socket.id,
        x: data.x,
        y: data.y,
        z: data.z,
        state: data.state,
        // Das Backend entfernte character aus normalen Positionsupdates
        character: socket.data.character,
    });
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
    const player = gameManager.players.get(socket.id);

    if (!player) return;

    const gameID = player.gameID;

    if (!gameID) return;

    const rpsGame = gameManager.rpsGame.get(gameID);

    if (!rpsGame) return;

    const playerOne = rpsGame.playerOne;
    const playerTwo = rpsGame.playerTwo;

    io.emit('update', {
        type: 'rps_invalid',
        playerOne: playerOne,
        playerTwo: playerTwo,
    });
    //gameManager.removeRPSGame(gameID);
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
