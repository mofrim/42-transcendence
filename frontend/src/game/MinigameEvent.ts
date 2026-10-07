import type { MultiplayerManager } from './multiplayer.js';
import type { Player } from './player.js';
import type { RPS_Game } from './MinigameRPS.js';
import type { TTT_Game } from './MinigameTTT.js';

import {
    EventType,
    RPSChoice,
    User,
    type EventDataMiniGameResult,
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
    readonly user: User;
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
            return this.options.user.nickname;
        }

        const fallback = fallbackNickname?.trim();
        if (fallback) {
            return fallback;
        }

        return playerId;
    }

    private getRequestedLocalPlayer(
        data: RPSRequestDataPayload
    ): Player | null {
        const player = this.options.getPlayer();
        if (!player || data.requestedPlayerID !== player.id) {
            return null;
        }
        return player;
    }

    private getOpponentPlayerId(
        playerId: string | undefined,
        playerOne: string,
        playerTwo: string
    ): string | null {
        if (playerId === undefined) {
            return null;
        }
        if (playerId === playerOne) {
            return playerTwo;
        }
        if (playerId === playerTwo) {
            return playerOne;
        }
        return null;
    }

    private handleRPSInvalid(data: RPSInvalidPayload): void {
        const player = this.options.getPlayer();
        if (!player) return;
        const playerId = player.id;
        if (
            this.getOpponentPlayerId(
                playerId,
                data.playerOne,
                data.playerTwo
            ) === null
        )
            return;

        console.log('Invalid RPS choice received.');
        const rpsGame = this.options.getRPSGame();
        if (!rpsGame) return;
        rpsGame.yourChoice = RPSChoice.None;
        rpsGame.opponentChoice = RPSChoice.None;
        rpsGame.solutionRPSAnimation();
    }

    private handleRPSDraw(data: RPSDrawPayload): void {
        console.log('RPS Draw: ' + data.playerOne + ' and ' + data.playerTwo);
        const player = this.options.getPlayer();
        if (!player) return;
        const playerId = player.id;
        const opponentId = this.getOpponentPlayerId(
            playerId,
            data.playerOne,
            data.playerTwo
        );
        if (opponentId === null) return;

        console.log('The RPS game ended in a draw!');
        const rpsGame = this.options.getRPSGame();
        if (!rpsGame) return;
        rpsGame.yourChoice = data.choice;
        rpsGame.opponentChoice = data.choice;

        this.emitLocalGameResult(
            'Rock-Paper-Scissors',
            'draw',
            this.resolvePlayerNickname(opponentId)
        );

        rpsGame.solutionRPSAnimation();
    }

    private handleRPSWinner(data: RPSWinnerPayload): void {
        const player = this.options.getPlayer();
        const rpsGame = this.options.getRPSGame();
        if (!player || !rpsGame) return;
        const playerId = player.id;
        const opponentId = this.getOpponentPlayerId(
            playerId,
            data.winner,
            data.loser
        );
        if (opponentId === null) return;

        let outcome: NonNullable<EventDataMiniGameResult['outcome']>;
        let yourChoice: RPSChoice;
        let opponentChoice: RPSChoice;

        if (data.winner === playerId) {
            console.log('You won the RPS game!');
            outcome = 'won';
            yourChoice = data.winnerChoice;
            opponentChoice = data.loserChoice;
        } else {
            console.log('You lost the RPS game!');
            outcome = 'lost';
            yourChoice = data.loserChoice;
            opponentChoice = data.winnerChoice;
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
        const player = this.getRequestedLocalPlayer(data);
        if (!player) return;

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
        const player = this.getRequestedLocalPlayer(data);
        if (!player) return;

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
        const player = this.getRequestedLocalPlayer(data);
        if (!player) return;

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
        const opponentId = this.getOpponentPlayerId(
            localPlayerId,
            data.playerOne,
            data.playerTwo
        );

        if (opponentId !== null) {
            const opponentPlayer = multiplayer.players.get(opponentId);
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
        if (localPlayerId) {
            let outcome: NonNullable<EventDataMiniGameResult['outcome']> =
                'lost';
            if (data.id === localPlayerId) {
                outcome = 'won';
            }
            this.emitLocalTTTResult(localPlayerId, outcome);
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

        this.emitLocalTTTResult(this.options.getPlayer()?.id, 'draw');

        tttGame.draw();
        tttGame.endGame();
        this.reset();
    }

    private emitLocalTTTResult(
        localPlayerId: string | undefined,
        outcome: NonNullable<EventDataMiniGameResult['outcome']>
    ): void {
        const opponent = this.getActiveTTTOpponent(localPlayerId);
        if (!opponent) return;
        this.emitLocalGameResult('Tic-Tac-Toe', outcome, opponent.nickname);
    }

    private getActiveTTTOpponent(
        localPlayerId: string | undefined
    ): NamedPlayer | null {
        const activePlayers = this.activeTTTPlayers;
        if (!localPlayerId || !activePlayers) {
            return null;
        }

        const opponentId = this.getOpponentPlayerId(
            localPlayerId,
            activePlayers.playerOne.id,
            activePlayers.playerTwo.id
        );
        if (opponentId === activePlayers.playerOne.id) {
            return activePlayers.playerOne;
        }
        if (opponentId === activePlayers.playerTwo.id) {
            return activePlayers.playerTwo;
        }
        return null;
    }

    private emitLocalGameResult(
        game: NonNullable<EventDataMiniGameResult['game']>,
        outcome: NonNullable<EventDataMiniGameResult['outcome']>,
        opponentNickname: string
    ): void {
        this.options.onGameEvent?.({
            eventType: EventType.MiniGameResult,
            data: {
                game,
                outcome,
                opponentNickname,
            },
            logtime: new Date(),
            user: this.options.user,
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
