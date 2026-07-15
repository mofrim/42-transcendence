// ====================================================================================================
// TODO: better create a new folder for sharedTypes for front and backend?
// ====================================================================================================
import {
    TTTGameState,
    RPSChoice,
    RPSGameState,
    PlayerState,
    TTTMark
} from '@common/types';

import type {
    RPSGame,
    TTTGame,
    PlayerData,
    RPSRequestDataPayload,
    RPSBattleChoicePayload,
} from '@common/types';

export class GameManager {
    players: Map<string, PlayerData>;
    tttGame: TTTGame;
    rpsGame: Map<string, RPSGame>;

    constructor() {
        this.players = new Map();
        this.tttGame = this.createTTTGame();
        this.rpsGame = new Map();
    }

    createPlayer(id: string): PlayerData {
        return {
            id: id,
            position: { x: 0, y: 0, z: 0 },
            state: PlayerState.Idle,
            gameID: null,
            inGame: false,
        };
    }

    removePlayer(id: string): void {
        if (this.players.has(id)) this.players.delete(id);
    }

    getMapData(): TTTGame {
        return this.tttGame;
    }

    updatePlayer(
        id: string,
        x: number,
        y: number,
        z: number,
        state: PlayerState
    ): void {
        void id;
        void x;
        void y;
        void z;
        void state;
    }

    // ====================================================================================================
    // Rock Paper Scissors Game
    // ====================================================================================================

    createRPSGame(
        gameID: string,
        playerOne: string,
        playerTwo: string
    ): RPSGame {
        return {
            gameID: gameID,
            playerOne: playerOne,
            playerTwo: playerTwo,
            playerOneChoice: RPSChoice.None,
            playerTwoChoice: RPSChoice.None,
            state: RPSGameState.Requested, // requested, inGame
        };
    }

    removeRPSGame(gameID: string): void {
        const rpsGame = this.rpsGame.get(gameID);

        if (!rpsGame) return;

        const playerOne = rpsGame.playerOne;
        if (playerOne) {
            const player = this.players.get(playerOne);
            if (player) {
                player.gameID = null;
                player.inGame = false;
            }
        }
        const playerTwo = rpsGame.playerTwo;
        if (playerTwo) {
            const player = this.players.get(playerTwo);
            if (player) {
                player.gameID = null;
                player.inGame = false;
            }
        }

        this.rpsGame.delete(gameID);
    }

    rpsRequested(data: RPSRequestDataPayload): number {
        const playerRequested = this.players.get(data.requestedPlayerID);
        const playerThis = this.players.get(data.id);

        //console.log("RPS Game Requested: " + data.id + " requested player: " + data.requestedPlayerID);

        if (!playerRequested || !playerThis) {
            console.log('One of the players not found for RPS game.');
            return 0;
        }
        if (playerRequested.inGame || playerThis.inGame) {
            console.log(
                'One of the players is already in a game: ' +
                playerRequested.inGame +
                ' ' +
                playerThis.inGame +
                '  ' +
                playerRequested.id +
                ' ' +
                playerThis.id
            );
            return 0;
        }

        const gameID = 'rps_' + data.id + '_' + data.requestedPlayerID;
        const rpsGame = this.createRPSGame(
            gameID,
            data.id,
            data.requestedPlayerID
        );

        playerRequested.gameID = gameID;
        playerRequested.inGame = true;
        playerThis.gameID = gameID;
        playerThis.inGame = true;

        this.rpsGame.set(gameID, rpsGame);

        // RPS Game Requested
        return 1;
    }

    rpsDeclined(data: RPSRequestDataPayload): number {
        const playerThis = this.players.get(data.id);

        if (!playerThis) return 0;

        playerThis.gameID = 'none';
        playerThis.inGame = false;

        const playerOther = this.players.get(data.requestedPlayerID);
        if (playerOther) {
            playerOther.gameID = 'none';
            playerOther.inGame = false;
        }

        const rpsGame = this.rpsGame.get(playerThis.gameID);

        if (!rpsGame) return 0;

        this.rpsGame.delete(playerThis.gameID);

        // RPS Game Declined
        return 1;
    }

    rpsAccept(data: RPSRequestDataPayload): number {
        const playerThis = this.players.get(data.id);
        const playerOther = this.players.get(data.requestedPlayerID);

        if (!playerThis || !playerOther) return 0;

        if (!playerThis.gameID) return 0;

        const rpsGame = this.rpsGame.get(playerThis.gameID);

        if (!rpsGame) return 0;

        rpsGame.state = RPSGameState.InGame;
        return 1;
    }

    rpsChoice(data: RPSBattleChoicePayload) {
        const player = this.players.get(data.id);

        if (!player) {
            console.log('Player not found for RPS choice.');
            return 0;
        }

        if (!player.gameID) return;

        const rpsGame = this.rpsGame.get(player.gameID);
        //console.log("RPS GAMEID: " + player.gameID + "  Choice made : " + data.choice);
        if (!rpsGame) {
            console.log('RPS game not found for player: ' + player.id);
            return 0;
        }

        if (player.id === rpsGame.playerOne) {
            rpsGame.playerOneChoice = data.choice;
        } else if (player.id === rpsGame.playerTwo) {
            rpsGame.playerTwoChoice = data.choice;
        } else {
            console.log('Player not part of the RPS game: ' + player.id);
            return 0;
        }

        return 1;
    }

    /* resultInvalid(playerOne, playerTwo){
        return {
            playerOne: playerOne,
            playerTwo: playerTwo,
        };
    } */

    resultDraw(playerOneID: string, playerTwoID: string, choice: string) {
        return {
            playerOne: playerOneID,
            playerTwo: playerTwoID,
            choice: choice,
        };
    }

    resultWinner(
        winner: string,
        winnerChoice: RPSChoice,
        loser: string,
        loserChoice: RPSChoice
    ) {
        return {
            winner: winner,
            winnerChoice: winnerChoice,
            loser: loser,
            loserChoice: loserChoice,
        };
    }

    verifyRPSGame(gameID: string) {
        const rpsGame = this.rpsGame.get(gameID);

        if (!rpsGame) {
            //console.log("RPS game not found for gameID: " + gameID);
            return 0;
        }

        if (
            rpsGame.playerOneChoice == RPSChoice.None ||
            rpsGame.playerTwoChoice == RPSChoice.None
        ) {
            //console.log("Invalid Round. Choices not made yet!");
            return 1;
        }
        if (rpsGame.playerOneChoice === rpsGame.playerTwoChoice) {
            //console.log("DRAW!");
            return 2;
        } else if (
            (rpsGame.playerOneChoice === RPSChoice.Rock &&
                rpsGame.playerTwoChoice === RPSChoice.Scissors) ||
            (rpsGame.playerOneChoice === RPSChoice.Paper &&
                rpsGame.playerTwoChoice === RPSChoice.Rock) ||
            (rpsGame.playerOneChoice === RPSChoice.Scissors &&
                rpsGame.playerTwoChoice === RPSChoice.Paper)
        ) {
            //console.log("WINNER PLAYER ONE!");
            return 3;
        } else if (
            (rpsGame.playerTwoChoice === RPSChoice.Rock &&
                rpsGame.playerOneChoice === RPSChoice.Scissors) ||
            (rpsGame.playerTwoChoice === RPSChoice.Paper &&
                rpsGame.playerOneChoice === RPSChoice.Rock) ||
            (rpsGame.playerTwoChoice === RPSChoice.Scissors &&
                rpsGame.playerOneChoice === RPSChoice.Paper)
        ) {
            //console.log("WINNER PLAYER TWO!");
            return 4;
        }

        return 0;
    }

    // ====================================================================================================
    // Tic Tac Toe Game
    // ====================================================================================================

    createTTTGame(): TTTGame {
        console.log('Creating new TTTGame.');
        return {
            players: [null, null],

            // Names need to match the names of the board objects in the scene (Blender file)
            boardNames: [
                'TTT_Board_1001',
                'TTT_Board_2001',
                'TTT_Board_3001',
                'TTT_Board_4001',
                'TTT_Board_5001',
                'TTT_Board_6001',
                'TTT_Board_7001',
                'TTT_Board_8001',
                'TTT_Board_9001',
            ],

            board: [
                TTTMark.Empty,
                TTTMark.Empty,
                TTTMark.Empty,
                TTTMark.Empty,
                TTTMark.Empty,
                TTTMark.Empty,
                TTTMark.Empty,
                TTTMark.Empty,
                TTTMark.Empty,
            ],

            currentMark: TTTMark.O,

            // 0: waiting for first player
            // 1: waiting for second player
            // 2: in game
            // 3: finished
            state: TTTGameState.WaitingForFirstPlayer,
        };
    }

    startTTTGame(playerID: string): number {
        //console.log("Starting TTTGame for player: " + playerID);

        if (
            this.tttGame.state == TTTGameState.WaitingForFirstPlayer &&
            !this.tttGame.players[0]
        ) {
            console.log('Player 1 joined the game: ' + playerID);
            this.tttGame.players.push(playerID);
            this.tttGame.state = TTTGameState.WaitingForSecondPlayer;
            return 1;
        } else if (
            this.tttGame.state == TTTGameState.WaitingForSecondPlayer &&
            !this.tttGame.players[1]
        ) {
            if (this.tttGame.players[0] === playerID) return 0;
            console.log('Player 2 joined the game: ' + playerID);
            this.tttGame.players.push(playerID);
            this.tttGame.state = TTTGameState.InGame;
            return 2;
        } else if (
            this.tttGame.state == TTTGameState.InGame ||
            this.tttGame.state == TTTGameState.Finished
        ) {
            //console.log("Game already in progress or finished. Player: " + playerID + " cannot join.");
            return 0;
        }

        console.log('Invalid TTTGame. Resetting game.');
        this.tttGame = this.createTTTGame();
        return -1;
    }

    tttMarkField(playerID: string, field: string): TTTMark {
        //console.log("Current Mark: " + this.tttGame.currentMark);
        if (this.tttGame.state !== TTTGameState.InGame) {
            //console.log("Game not in progress. Cannot mark field.");
            return TTTMark.Empty;
        }

        if (!this.tttGame.players.includes(playerID)) {
            //console.log("Player not in the game." + playerID);
            return TTTMark.Empty;
        }

        //console.log("In Marking: " + field + " by player: " + playerID);
        for (const box of this.tttGame.boardNames) {
            if (box === field) {
                //console.log("Marking now:" + field);

                const parts = field.split('TTT_Board_');

                let num: number = 0;

                if (
                    parts.length >= 2 &&
                    parts[1] != undefined &&
                    parts[1].length > 0
                ) {
                    num = Number(parts[1][0]) - 1;
                }

                if (this.tttGame.board[num] !== TTTMark.Empty) {
                    //console.log("Field already marked.");
                    return TTTMark.Empty;
                }

                if (playerID === this.tttGame.players[0]) {
                    if (this.tttGame.currentMark === TTTMark.X) {
                        //console.log("Not your turn.");
                        return TTTMark.Empty;
                    }

                    this.tttGame.currentMark = TTTMark.X;
                    this.tttGame.board[num] = TTTMark.X;

                    return TTTMark.X;
                } else {
                    if (this.tttGame.currentMark === TTTMark.O) {
                        return TTTMark.Empty;
                    }

                    this.tttGame.currentMark = TTTMark.O;
                    this.tttGame.board[num] = TTTMark.O;

                    return TTTMark.O;
                }
            }
        }

        //console.log("Field not found.");
        return TTTMark.Empty;
    }

    checkWin() {
        if (
            this.tttGame.board[0] === this.tttGame.board[1] &&
            this.tttGame.board[1] === this.tttGame.board[2] &&
            this.tttGame.board[0] !== ''
        ) {
            return 1;
        }
        if (
            this.tttGame.board[3] === this.tttGame.board[4] &&
            this.tttGame.board[4] === this.tttGame.board[5] &&
            this.tttGame.board[3] !== ''
        ) {
            return 2;
        }
        if (
            this.tttGame.board[6] === this.tttGame.board[7] &&
            this.tttGame.board[7] === this.tttGame.board[8] &&
            this.tttGame.board[6] !== ''
        ) {
            return 3;
        }

        if (
            this.tttGame.board[0] === this.tttGame.board[3] &&
            this.tttGame.board[3] === this.tttGame.board[6] &&
            this.tttGame.board[0] !== ''
        ) {
            return 4;
        }
        if (
            this.tttGame.board[1] === this.tttGame.board[4] &&
            this.tttGame.board[4] === this.tttGame.board[7] &&
            this.tttGame.board[1] !== ''
        ) {
            return 5;
        }
        if (
            this.tttGame.board[2] === this.tttGame.board[5] &&
            this.tttGame.board[5] === this.tttGame.board[8] &&
            this.tttGame.board[2] !== ''
        ) {
            return 6;
        }

        if (
            this.tttGame.board[0] === this.tttGame.board[4] &&
            this.tttGame.board[4] === this.tttGame.board[8] &&
            this.tttGame.board[0] !== ''
        ) {
            return 7;
        }
        if (
            this.tttGame.board[2] === this.tttGame.board[4] &&
            this.tttGame.board[4] === this.tttGame.board[6] &&
            this.tttGame.board[2] !== ''
        ) {
            return 8;
        }

        return 0;
    }

    checkDraw(): boolean {
        for (const field of this.tttGame.board) {
            if (field === '') {
                // Game still in progress.
                return false;
            }
        }
        // Draw. No Winner
        return true;
    }
}
