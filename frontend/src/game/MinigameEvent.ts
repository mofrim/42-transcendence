import type { MultiplayerManager } from './multiplayer.js';
import type { Player } from './player.js';
import type { RPS_Game } from './rps_game.js';
import type { TTT_Game } from './ttt_game.js';

import {
    EventType,
    RPSChoice,
    type EventData,
    type GameEvent,
    type RPSDrawPayload,
    type RPSInvalidPayload,
    type RPSRequestDataPayload,
    type RPSWinnerPayload,
    type TTTDrawPayload,
    type TTTGame,
    type TTTMarkPayload,
    type TTTStartPayload,
    type TTTWinPayload,
} from 'ftr-common/sharedTypes';

type NamedPlayer = {
    readonly id: string;
    readonly nickname: string;
};

type ActiveTTTPlayers = {
    readonly playerOne: NamedPlayer;
    readonly playerTwo: NamedPlayer;
};

type MinigameEventOptions = {
    readonly localNickname: string;
    readonly localCharacter: boolean;
    readonly getSocketId: () => string | undefined;
    readonly getPlayer: () => Player | null;
    readonly getMultiplayer: () => MultiplayerManager | null;
    readonly getTTTGame: () => TTT_Game | null;
    readonly getRPSGame: () => RPS_Game | null;
    readonly onGameEvent: ((event: GameEvent) => void) | undefined;
};

export class MinigameEvent {
    private activeTTTPlayers: ActiveTTTPlayers | null = null;

    readonly handlers = {
        onInitData: (data: TTTGame): void => {
            this.options.getTTTGame()?.initGame({ game: data });
        },
        onTTTPlayerOne: (id: string): void => {
            this.options.getTTTGame()?.setPlayerOne(id);
        },
        onTTTPlayerTwo: (id: string): void => {
            this.options.getTTTGame()?.setPlayerTwo(id);
        },
        onTTTStart: this.handleTTTStart.bind(this),
        onTTTReset: (): void => {
            this.options.getTTTGame()?.resetGame();
            this.reset();
        },
        onTTTMark: this.handleTTTUpdate.bind(this),
        onTTTWin: this.handleTTTWin.bind(this),
        onTTTDraw: this.handleTTTDraw.bind(this),
        onRPSRequest: this.handleRPSRequest.bind(this),
        onRPSAccept: this.handleRPSAccept.bind(this),
        onRPSDecline: this.handleRPSDecline.bind(this),
        onRPSWinner: this.handleRPSWinner.bind(this),
        onRPSDraw: this.handleRPSDraw.bind(this),
        onRPSInvalid: this.handleRPSInvalid.bind(this),
        onDisconnect: (): void => {
            void this.options.getTTTGame()?.endGame();
        },
    };

    constructor(private readonly options: MinigameEventOptions) {}

    reset(): void {
        this.activeTTTPlayers = null;
    }

    resolvePlayerNickname(playerId: string, fallbackNickname?: string): string {
        const multiplayer = this.options.getMultiplayer();
        if (multiplayer) {
            return multiplayer.resolvePlayerNickname(
                playerId,
                fallbackNickname
            );
        }

        const player = this.options.getPlayer();
        if (
            playerId === player?.id ||
            playerId === this.options.getSocketId()
        ) {
            return this.options.localNickname;
        }

        const fallback = fallbackNickname?.trim();
        if (fallback) {
            return fallback;
        }

        return playerId;
    }

    private handleRPSInvalid(data: RPSInvalidPayload): void {
        const player = this.options.getPlayer();
        if (!player) return;
        const playerId = player.id;
        if (playerId === undefined) return;
        if ([data.playerOne, data.playerTwo].includes(playerId)) {
            console.log('Invalid RPS choice received.');
            const rpsGame = this.options.getRPSGame();
            if (!rpsGame) return;
            rpsGame.yourChoice = RPSChoice.None;
            rpsGame.opponentChoice = RPSChoice.None;
            rpsGame.solutionRPSAnimation();
        }
    }

    private handleRPSDraw(data: RPSDrawPayload): void {
        console.log('RPS Draw: ' + data.playerOne + ' and ' + data.playerTwo);
        const player = this.options.getPlayer();
        if (!player) return;
        const playerId = player.id;
        if (playerId === undefined) return;

        if ([data.playerOne, data.playerTwo].includes(playerId)) {
            console.log('The RPS game ended in a draw!');
            const rpsGame = this.options.getRPSGame();
            if (!rpsGame) return;
            rpsGame.yourChoice = data.choice;
            rpsGame.opponentChoice = data.choice;

            let opponentId = data.playerOne;
            if (data.playerOne === playerId) {
                opponentId = data.playerTwo;
            }
            this.emitLocalGameResult(
                'Rock-Paper-Scissors',
                'draw',
                this.resolvePlayerNickname(opponentId)
            );

            rpsGame.solutionRPSAnimation();
        }
    }

    private handleRPSWinner(data: RPSWinnerPayload): void {
        const player = this.options.getPlayer();
        const rpsGame = this.options.getRPSGame();
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

        this.emitLocalGameResult(
            'Rock-Paper-Scissors',
            outcome,
            this.resolvePlayerNickname(opponentId)
        );
        rpsGame.yourChoice = yourChoice;
        rpsGame.opponentChoice = opponentChoice;
        rpsGame.solutionRPSAnimation();
    }

    private handleRPSAccept(data: RPSRequestDataPayload): void {
        const player = this.options.getPlayer();
        if (!player) return;
        if (data.requestedPlayerID !== player.id) return;

        const rpsGame = this.options.getRPSGame();
        if (!rpsGame) return;
        player.battleRequested = false;

        const multiplayer = this.options.getMultiplayer();
        if (!multiplayer) return;
        const opponentPlayer = multiplayer.players.get(data.id);
        if (!opponentPlayer) return;
        opponentPlayer.battleRequested = false;
        console.log('Battle accepted from player ' + data.id);
        rpsGame.startRPSAnimation(
            this.options.localCharacter,
            opponentPlayer.character
        );
    }

    private handleRPSDecline(data: RPSRequestDataPayload): void {
        const player = this.options.getPlayer();
        if (!player) return;
        if (data.requestedPlayerID !== player.id) return;

        const rpsGame = this.options.getRPSGame();
        if (!rpsGame) return;
        player.battleRequested = false;
        player.youSendRPGRequest = false;

        const multiplayer = this.options.getMultiplayer();
        if (!multiplayer) return;
        const opponentPlayer = multiplayer.players.get(data.id);
        if (!opponentPlayer) return;
        opponentPlayer.battleRequested = false;
        console.log('Battle declined from player ' + data.id);
    }

    private handleRPSRequest(data: RPSRequestDataPayload): void {
        const player = this.options.getPlayer();
        if (!player) return;
        if (data.requestedPlayerID !== player.id) return;

        player.battleRequested = true;

        const rpsGame = this.options.getRPSGame();
        if (!rpsGame) return;
        rpsGame.BattleRequest(
            data.id,
            this.resolvePlayerNickname(data.id, data.nickname)
        );
    }

    private handleTTTUpdate(data: TTTMarkPayload): void {
        this.options
            .getTTTGame()
            ?.markField(data.fieldName, data.id, data.mark);
    }

    private handleTTTStart(data: TTTStartPayload): void {
        const tttGame = this.options.getTTTGame();
        const player = this.options.getPlayer();
        const multiplayer = this.options.getMultiplayer();
        if (!tttGame || !player || !multiplayer) return;

        const localPlayerId = player.id ?? this.options.getSocketId();
        let opponentCharacter = this.options.localCharacter;
        if (data.playerOne === localPlayerId) {
            const opponentPlayer = multiplayer.players.get(data.playerTwo);
            if (!opponentPlayer) return;
            opponentCharacter = opponentPlayer.character;
        } else if (data.playerTwo === localPlayerId) {
            const opponentPlayer = multiplayer.players.get(data.playerOne);
            if (!opponentPlayer) return;
            opponentCharacter = opponentPlayer.character;
        }

        const accepted = tttGame.startGame(
            data.playerOne,
            data.playerTwo,
            data.playerOneNickname,
            data.playerTwoNickname,
            this.options.localCharacter,
            opponentCharacter
        );
        if (!accepted) return;

        this.activeTTTPlayers = {
            playerOne: this.createNamedPlayer(
                data.playerOne,
                data.playerOneNickname
            ),
            playerTwo: this.createNamedPlayer(
                data.playerTwo,
                data.playerTwoNickname
            ),
        };
    }

    private handleTTTWin(data: TTTWinPayload): void {
        const tttGame = this.options.getTTTGame();
        if (!tttGame) return;

        const localPlayerId = this.options.getPlayer()?.id;
        const opponent = this.getActiveTTTOpponent(localPlayerId);
        if (localPlayerId && opponent) {
            let outcome: NonNullable<EventData['outcome']> = 'lost';
            if (data.id === localPlayerId) {
                outcome = 'won';
            }

            this.emitLocalGameResult('Tic-Tac-Toe', outcome, opponent.nickname);
        }

        tttGame.drawWin(data.winner);
        tttGame.winner(data.id, data.nickname);
        tttGame.endGame();
        this.reset();
    }

    private handleTTTDraw(_data: TTTDrawPayload): void {
        const tttGame = this.options.getTTTGame();
        if (!tttGame) return;
        void _data;

        const opponent = this.getActiveTTTOpponent(
            this.options.getPlayer()?.id
        );
        if (opponent) {
            this.emitLocalGameResult('Tic-Tac-Toe', 'draw', opponent.nickname);
        }

        tttGame.draw();
        tttGame.endGame();
        this.reset();
    }

    private getActiveTTTOpponent(
        localPlayerId: string | undefined
    ): NamedPlayer | null {
        if (!localPlayerId || !this.activeTTTPlayers) {
            return null;
        }
        if (this.activeTTTPlayers.playerOne.id === localPlayerId) {
            return this.activeTTTPlayers.playerTwo;
        }
        if (this.activeTTTPlayers.playerTwo.id === localPlayerId) {
            return this.activeTTTPlayers.playerOne;
        }
        return null;
    }

    private emitLocalGameResult(
        game: NonNullable<EventData['game']>,
        outcome: NonNullable<EventData['outcome']>,
        opponentNickname: string
    ): void {
        this.options.onGameEvent?.({
            eventType: EventType.GameResult,
            data: {
                game,
                outcome,
                playerNickname: this.options.localNickname,
                opponentNickname,
            },
            logtime: new Date(),
        });
    }

    private createNamedPlayer(
        playerId: string,
        fallbackNickname?: string
    ): NamedPlayer {
        return {
            id: playerId,
            nickname: this.resolvePlayerNickname(playerId, fallbackNickname),
        };
    }
}
