import {
    TTTGameState,
    RPSChoice,
    RPSGameState,
    PlayerState,
    TTTMark,
} from 'ftr-common/sharedTypes';
import type {
    RPSGame,
    TTTGame,
    PlayerData,
    PlayerPosition,
    RPSRequestDataPayload,
    RPSBattleChoicePayload,
} from 'ftr-common/sharedTypes';

/** winning conditions states for Tic Tac Toe */
const TTT_WINNING_LINES = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
] as const;

const RPS_WINNING_CHOICES = new Map<RPSChoice, RPSChoice>([
    [RPSChoice.Rock, RPSChoice.Scissors],
    [RPSChoice.Paper, RPSChoice.Rock],
    [RPSChoice.Scissors, RPSChoice.Paper],
]);

export class GameManager {
    players: Map<string, PlayerData>;
    tttGame: TTTGame;
    rpsGame: Map<string, RPSGame>;

    constructor() {
        this.players = new Map();
        this.tttGame = this.createTTTGame();
        this.rpsGame = new Map();
    }

    createPlayer(id: string, nickname: string): PlayerData {
        return {
            id,
            nickname,
            position: { x: 0, y: 0, z: 0 },
            state: PlayerState.Idle,
            gameID: null,
            inGame: false,
        };
    }

    updatePlayer(
        id: string,
        position: PlayerPosition,
        state: PlayerState
    ): boolean {
        const player = this.players.get(id);
        if (!player) {
            return false;
        }

        Object.assign(player.position, position);
        player.state = state;
        return true;
    }

    // ====================================================================================================
    // Rock Paper Scissors Game
    // ====================================================================================================

    removeRPSGame(gameID: string): void {
        const rpsGame = this.rpsGame.get(gameID);

        if (!rpsGame) return;

        for (const playerId of [rpsGame.playerOne, rpsGame.playerTwo]) {
            if (!playerId) {
                continue;
            }
            const player = this.players.get(playerId);
            if (!player) {
                continue;
            }
            player.gameID = null;
            player.inGame = false;
        }

        this.rpsGame.delete(gameID);
    }

    rpsRequested(data: RPSRequestDataPayload): number {
        if (data.id === data.requestedPlayerID) {
            return 0;
        }

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
        const rpsGame: RPSGame = {
            gameID,
            playerOne: data.id,
            playerTwo: data.requestedPlayerID,
            playerOneChoice: RPSChoice.None,
            playerTwoChoice: RPSChoice.None,
            state: RPSGameState.Requested,
        };

        playerRequested.gameID = gameID;
        playerRequested.inGame = true;
        playerThis.gameID = gameID;
        playerThis.inGame = true;

        this.rpsGame.set(gameID, rpsGame);

        // RPS Game Requested
        return 1;
    }

    rpsRespond(data: RPSRequestDataPayload): number {
        if (data.type !== 'rps_accept' && data.type !== 'rps_decline') {
            return 0;
        }

        const playerThis = this.players.get(data.id);
        const playerOther = this.players.get(data.requestedPlayerID);

        if (!playerThis || !playerOther || !playerThis.gameID) {
            return 0;
        }

        const gameID = playerThis.gameID;
        const rpsGame = this.rpsGame.get(gameID);

        if (!rpsGame) {
            return 0;
        }
        if (rpsGame.state !== RPSGameState.Requested) {
            return 0;
        }
        if (playerOther.gameID !== gameID) {
            return 0;
        }

        const playersMatch =
            (rpsGame.playerOne === data.id &&
                rpsGame.playerTwo === data.requestedPlayerID) ||
            (rpsGame.playerTwo === data.id &&
                rpsGame.playerOne === data.requestedPlayerID);

        if (!playersMatch) {
            return 0;
        }

        if (data.type === 'rps_accept') {
            rpsGame.state = RPSGameState.InGame;
        } else {
            this.removeRPSGame(gameID);
        }

        return 1;
    }

    rpsChoice(data: RPSBattleChoicePayload): number {
        const player = this.players.get(data.id);

        if (!player) {
            console.log('Player not found for RPS choice.');
            return 0;
        }

        if (!player.gameID) return 0;

        const rpsGame = this.rpsGame.get(player.gameID);
        //console.log("RPS GAMEID: " + player.gameID + "  Choice made : " + data.choice);
        if (!rpsGame) {
            console.log('RPS game not found for player: ' + player.id);
            return 0;
        }
        if (rpsGame.state !== RPSGameState.InGame) {
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

    /**
     * validate RPS timeouts before invalidating games the client
     * expired choice as a timeout request.
     */
    rpsTimeout(playerID: string): RPSGame | null {
        const player = this.players.get(playerID);

        if (!player || !player.gameID) {
            return null;
        }

        const rpsGame = this.rpsGame.get(player.gameID);

        if (!rpsGame || rpsGame.state !== RPSGameState.InGame) {
            return null;
        }

        let playerChoice: RPSChoice;
        if (rpsGame.playerOne === playerID) {
            playerChoice = rpsGame.playerOneChoice;
        } else if (rpsGame.playerTwo === playerID) {
            playerChoice = rpsGame.playerTwoChoice;
        } else {
            return null;
        }
        if (playerChoice !== RPSChoice.None) {
            return null;
        }
        this.removeRPSGame(rpsGame.gameID);
        return rpsGame;
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
        }
        if (
            RPS_WINNING_CHOICES.get(rpsGame.playerOneChoice) ===
            rpsGame.playerTwoChoice
        ) {
            //console.log("WINNER PLAYER ONE!");
            return 3;
        }
        if (
            RPS_WINNING_CHOICES.get(rpsGame.playerTwoChoice) ===
            rpsGame.playerOneChoice
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
            //this.tttGame.players.push(playerID);
            this.tttGame.players[0] = playerID;
            this.tttGame.state = TTTGameState.WaitingForSecondPlayer;
            return 1;
        } else if (
            this.tttGame.state == TTTGameState.WaitingForSecondPlayer &&
            !this.tttGame.players[1]
        ) {
            if (this.tttGame.players[0] === playerID) return 0;
            console.log('Player 2 joined the game: ' + playerID);
            //this.tttGame.players.push(playerID);
            this.tttGame.players[1] = playerID;
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

    /** Player left the Tic-Tac-Toe game by pressing ESC */
    leaveTTTGame(playerID: string): boolean {
        if (
            this.tttGame.state !== TTTGameState.WaitingForSecondPlayer ||
            this.tttGame.players[0] !== playerID ||
            this.tttGame.players[1] !== null
        ) {
            return false;
        }
        this.tttGame = this.createTTTGame();
        return true;
    }

    resetTTTGameForPlayer(playerID: string): boolean {
        if (!this.tttGame.players.includes(playerID)) {
            return false;
        }

        for (const tttPlayerID of this.tttGame.players) {
            if (tttPlayerID === null) {
                continue;
            }

            const tttPlayer = this.players.get(tttPlayerID);
            if (!tttPlayer) {
                continue;
            }

            tttPlayer.inGame = false;
            tttPlayer.gameID = null;
        }

        this.tttGame = this.createTTTGame();
        return true;
    }

    tttMarkField(playerID: string, field: string): TTTMark {
        //console.log("Current Mark: " + this.tttGame.currentMark);
        if (this.tttGame.state !== TTTGameState.InGame) {
            //console.log("Game not in progress. Cannot mark field.");
            return TTTMark.Empty;
        }

        const isPlayerOne = playerID === this.tttGame.players[0];
        const isPlayerTwo = playerID === this.tttGame.players[1];

        if (!isPlayerOne && !isPlayerTwo) {
            //console.log("Player not in the game." + playerID);
            return TTTMark.Empty;
        }

        //console.log("In Marking: " + field + " by player: " + playerID);
        const fieldIndex = this.tttGame.boardNames.indexOf(field);

        //console.log("Marking now:" + field);
        if (
            fieldIndex === -1 ||
            this.tttGame.board[fieldIndex] !== TTTMark.Empty
        ) {
            //console.log("Field already marked.");
            return TTTMark.Empty;
        }

        if (isPlayerOne) {
            if (this.tttGame.currentMark === TTTMark.X) {
                //console.log("Not your turn.");
                return TTTMark.Empty;
            }
            this.tttGame.currentMark = TTTMark.X;
            this.tttGame.board[fieldIndex] = TTTMark.X;
            return TTTMark.X;
        }

        if (this.tttGame.currentMark === TTTMark.O) {
            return TTTMark.Empty;
        }

        this.tttGame.currentMark = TTTMark.O;
        this.tttGame.board[fieldIndex] = TTTMark.O;
        return TTTMark.O;
    }

    checkWin(): number {
        const board = this.tttGame.board;
        const winningLineIndex = TTT_WINNING_LINES.findIndex(
            ([first, second, third]) => {
                const mark = board[first];
                return (
                    mark !== TTTMark.Empty &&
                    mark === board[second] &&
                    mark === board[third]
                );
            }
        );
        return winningLineIndex + 1;
    }
    /**
     * false: Game still in progress.
     * true: Draw. No Winner
     */
    checkDraw(): boolean {
        return this.tttGame.board.every((field) => field !== TTTMark.Empty);
    }
}
