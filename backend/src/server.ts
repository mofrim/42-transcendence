import http from 'http';
import { Server } from 'socket.io';
import type { Socket } from 'socket.io';
import { GameManager } from './gameManager.ts';
import type {
    RPSBattleChoicePayload,
    RPSRequestDataPayload,
    PlayerUpdatePayload,
    TTTMarkPayload,
} from '@common/types';

import { TTTMark } from '@common/types';

const server = http.createServer();
const gameManager = new GameManager();

const io = new Server(server, {
    cors: { origin: '*' },
});

/* function normalizeCharacter(character: boolean): Character {
    if (typeof character === 'string') {
        const normalizedCharacter = character.toLowerCase();
        return normalizedCharacter !== 'false' && normalizedCharacter !== 'female';
    }

    return character !== false;
} */

io.on('connection', (socket) => {
    //const character = normalizeCharacter(socket.handshake.auth?.character);
    const character = socket.handshake.auth['character'];
    socket.data.character = character;

    //console.log('Character IS:', character);

    console.log('Client connected:', socket.id);
    gameManager.players.set(socket.id, gameManager.createPlayer(socket.id));

    // notify others
    socket.broadcast.emit('player_connected', {
        id: socket.id,
        character,
    });

    // send initial data to the connected client
    socket.emit('initData', gameManager.getMapData());

    // dissconnect and remove player from gameManager
    socket.on('disconnect', () => {
        const playerOneID = gameManager.tttGame.players[0];
        const playerTwoID = gameManager.tttGame.players[1];

        if (playerOneID) {
            const playerOne = gameManager.players.get(playerOneID);
            if (playerOne) {
                playerOne.inGame = false;
                playerOne.gameID = 'none';
            }
        }
        if (playerTwoID) {
            const playerTwo = gameManager.players.get(playerTwoID);
            if (playerTwo) {
                playerTwo.inGame = false;
                playerTwo.gameID = 'none';
            }
        }

        console.log('Client disconnected:', socket.id);
        // Check if the player is still in the Tic Tac Toe game and reset if necessary
        if (gameManager.tttGame.players.includes(socket.id)) {
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
        //console.log("Server datatype: " + data.type);
        switch (data.type) {
            case 'player_update':
                handlePlayerUpdate(socket, data);
                break;

            case 'ttt_mark':
                handleTTTMark(socket, data);
                /* socket.broadcast.emit('update', {
                    type: 'player_update',
                    id: socket.id,
                    x: data.x,
                    y: data.y,
                    z: data.z,
                    state: data.state,
                    character: normalizeCharacter(
                        data.character ?? socket.data.character
                    ),
                }); */
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

function handleGameReset(socket: Socket) {
    playerGameReset(socket.id);
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
    const result = gameManager.rpsChoice(data);

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

    /**
     * The value assigned to 'gameResult' is not used in subsequent statements.
     * eslint(no-useless-assignment)
     * let gameResult = null;
     */

    const rpsGame = gameManager.rpsGame.get(gameID);

    if (!rpsGame) return;

    const PlayerOne = rpsGame.playerOne;
    const PlayerTwo = rpsGame.playerTwo;

    /* if(gameResultCheck == 1){
      gameResult = gameManager.resultInvalid(PlayerOne, PlayerTwo);

      io.emit("update", {
        type: "rps_invalid",
        playerOne: gameResult.playerOne,
        playerTwo: gameResult.playerTwo,
      });

    } */
    if (gameResultCheck == 2) {
        gameResult = gameManager.resultDraw(
            PlayerOne,
            PlayerTwo,
            rpsGame.playerOneChoice
        );

        io.emit('update', {
            type: 'rps_draw',
            playerOne: gameResult.playerOne,
            playerTwo: gameResult.playerTwo,
            choice: gameResult.choice,
        });
    } else if (gameResultCheck == 3) {
        gameResult = gameManager.resultWinner(
            PlayerOne,
            rpsGame.playerOneChoice,
            PlayerTwo,
            rpsGame.playerTwoChoice
        );

        io.emit('update', {
            type: 'rps_winner',
            winner: gameResult.winner,
            winnerChoice: gameResult.winnerChoice,
            loser: gameResult.loser,
            loserChoice: gameResult.loserChoice,
        });
    } else {
        gameResult = gameManager.resultWinner(
            PlayerTwo,
            rpsGame.playerTwoChoice,
            PlayerOne,
            rpsGame.playerOneChoice
        );

        io.emit('update', {
            type: 'rps_winner',
            winner: gameResult.winner,
            winnerChoice: gameResult.winnerChoice,
            loser: gameResult.loser,
            loserChoice: gameResult.loserChoice,
        });
    }

    //console.log("RPS Game ended. GameID: " + gameID + " PlayerOne: " + PlayerOne + " PlayerTwo: " + PlayerTwo);

    //gameManager.removeRPSGame(gameID);
}

function handleRPSAccept(socket: Socket, data: RPSRequestDataPayload) {
    const result = gameManager.rpsAccept(data);

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
    const result = gameManager.rpsDeclined(data);

    if (result == 0) return;

    socket.broadcast.emit('update', {
        type: 'rps_decline',
        id: socket.id,
        requestedPlayerID: data.requestedPlayerID,
    });
}

function handleRPSRequest(socket: Socket, data: RPSRequestDataPayload) {
    //console.log("RPS REQUEST");
    const result = gameManager.rpsRequested(data);
    //console.log("RPS REQUEST result: " + result);
    if (result == 0) {
        return;
    }

    socket.broadcast.emit('update', {
        type: 'rps_request',
        id: socket.id,
        requestedPlayerID: data.requestedPlayerID,
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
    const state = gameManager.startTTTGame(socket.id);
    const player = gameManager.players.get(socket.id);

    if (!player) return;
    if (player.inGame) return;

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
        player.inGame = true;
        player.gameID = 'tttGame';

        io.emit('update', {
            type: 'ttt_playerTwo',
            id: socket.id,
        });

        io.emit('update', {
            type: 'ttt_start',
            playerOne: gameManager.tttGame.players[0],
            playerTwo: gameManager.tttGame.players[1],
        });

        return;
    }

    io.emit('update', {
        type: 'ttt_reset',
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
        io.emit('update', {
            type: 'ttt_win',
            id: socket.id,
            winner: checkWin,
        });

        wait(3000).then(() => {
            const playerOneID = gameManager.tttGame.players[0];
            const playerTwoID = gameManager.tttGame.players[1];

            if (!playerOneID || !playerTwoID) return;

            const playerOne = gameManager.players.get(playerOneID);
            const playerTwo = gameManager.players.get(playerTwoID);

            if (!playerOne || !playerTwo) return;

            playerOne.inGame = false;
            playerOne.gameID = 'none';
            playerTwo.inGame = false;
            playerTwo.gameID = 'none';

            gameManager.tttGame = gameManager.createTTTGame();
        });
        return;
    }

    const checkDraw = gameManager.checkDraw();
    if (checkDraw) {
        console.log('Game is a draw.');
        io.emit('update', {
            type: 'ttt_draw',
        });

        wait(3000).then(() => {
            const playerOneID = gameManager.tttGame.players[0];
            const playerTwoID = gameManager.tttGame.players[1];

            if (!playerOneID || !playerTwoID) return;

            const playerOne = gameManager.players.get(playerOneID);
            const playerTwo = gameManager.players.get(playerTwoID);

            if (!playerOne || !playerTwo) return;

            playerOne.inGame = false;
            playerOne.gameID = 'none';
            playerTwo.inGame = false;
            playerTwo.gameID = 'none';

            gameManager.tttGame = gameManager.createTTTGame();
        });
        return;
    }
}

server.listen(3000, () => {
    console.log('Server listening on port 3000');
});
