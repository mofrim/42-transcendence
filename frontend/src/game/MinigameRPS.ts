import * as THREE from 'three';
import type { Player } from './player';
import type { Remote_Player } from './remote_player';
import { FloatingTextSprite } from './FloatingTextSprite';
import { AnimationFrameSlot } from './AnimationFrameSlot';
import {
    animateMinigamePlayersApart,
    animateMinigameSpriteRight,
    createMinigameOverlay,
    disposeOverlaySprites,
    MINIGAME_ANIMATION_EDGE,
    MINIGAME_OVERLAY_Y,
    MINIGAME_RESULT_ANIMATION_STEP,
    MinigameOverlay,
    setPlayerOverlay,
} from './GameOverlay';
import { createResourceDisposer } from './ResourceDisposer';
import type { Socket } from 'socket.io-client';
import { RPSChoice } from 'ftr-common/sharedTypes';

// TODO: freinds seperate from battle
const BATTLE_PROMPT_TEXT = '⌨️ [B] Battle Challenge   ⌨️ [F] Friend Request';
const BATTLE_PROMPT_SIZE = 20;
const BATTLE_PROMPT_HEIGHT = 1.6;
const BATTLE_RANGE_SQUARED = 4;
const RPS_FAST_ANIMATION_STEP = 0.0075;
const RPS_WINNING_MATCHUPS = [
    [RPSChoice.Rock, RPSChoice.Scissors],
    [RPSChoice.Paper, RPSChoice.Rock],
    [RPSChoice.Scissors, RPSChoice.Paper],
] as const;

export class RPS_Game extends MinigameOverlay {
    socket: Socket;
    player: Player;
    players: Map<string, Remote_Player>;

    inRange: boolean;
    playerInRange: Remote_Player | null;
    battleRequestedPlayer: string;
    private readonly battlePrompt: FloatingTextSprite;
    private readonly onPlayerInRange:
        ((player: Remote_Player) => void) | undefined;
    private hasReportedPlayerInRange: boolean;
    private readonly resourceDisposer: ReturnType<
        typeof createResourceDisposer
    >;
    protected disposed: boolean;

    rpsSprite: Map<string, THREE.Sprite>;

    rps_choiceMade: boolean;
    inBattleMode: boolean;
    inBattleChooseMode: boolean;

    yourChoice: RPSChoice;
    opponentChoice: RPSChoice;

    private readonly animationFrameSlot: AnimationFrameSlot;

    constructor(
        scene: THREE.Scene,
        socket: Socket,
        player: Player,
        players: Map<string, Remote_Player>,
        renderer: THREE.WebGLRenderer,
        onPlayerInRange?: (player: Remote_Player) => void
    ) {
        super();
        this.socket = socket;
        this.player = player;
        this.players = players;

        this.inRange = false;
        this.playerInRange = null;
        this.battleRequestedPlayer = '';
        this.onPlayerInRange = onPlayerInRange;
        this.hasReportedPlayerInRange = false;
        this.resourceDisposer = createResourceDisposer();
        this.disposed = false;
        this.battlePrompt = new FloatingTextSprite(
            BATTLE_PROMPT_TEXT,
            BATTLE_PROMPT_SIZE,
            new THREE.Vector3(0, BATTLE_PROMPT_HEIGHT, 0)
        );
        scene.add(this.battlePrompt);

        this.initializeOverlay(renderer);
        this.rpsSprite = createMinigameOverlay();

        this.rps_choiceMade = false;
        this.inBattleMode = false;
        this.inBattleChooseMode = false;

        this.yourChoice = RPSChoice.None;
        this.opponentChoice = RPSChoice.None;

        this.animationFrameSlot = new AnimationFrameSlot(() => !this.disposed);
    }

    /**
     * Selects the nearest remote player in battle range.
     */
    updateCheck(): void {
        if (this.disposed) {
            return;
        }

        const previousPlayer = this.playerInRange;
        let nearestPlayer: Remote_Player | null = null;
        let nearestDistanceSquared = Infinity;

        for (const player of this.players.values()) {
            if (!player.isActive()) {
                continue;
            }

            const distanceSquared =
                this.player.group.position.distanceToSquared(
                    player.group.position
                );

            if (
                distanceSquared < BATTLE_RANGE_SQUARED &&
                distanceSquared < nearestDistanceSquared
            ) {
                nearestDistanceSquared = distanceSquared;
                nearestPlayer = player;
            }
        }

        this.playerInRange = nearestPlayer;
        this.inRange = nearestPlayer !== null;

        if (previousPlayer !== nearestPlayer) {
            this.hasReportedPlayerInRange = false;
        }

        if (!nearestPlayer) {
            this.battlePrompt.hide();
            return;
        }

        if (!this.hasReportedPlayerInRange && this.onPlayerInRange) {
            this.hasReportedPlayerInRange = true;
            this.onPlayerInRange(nearestPlayer);
        }

        this.battlePrompt.follow(nearestPlayer.group);
    }

    BattleRequest(
        requestedPlayerID: string,
        requestedPlayerNickname?: string
    ): void {
        if (!this.player.youSendRPGRequest) {
            this.removeText();
            this.addText(
                requestedPlayerNickname || requestedPlayerID,
                0,
                -0.2,
                50
            );
            this.addText('🪨 Rock 📜 Paper ✂️ Scissors', 0, -0.3, 100);
            this.addText(
                ' challenged by: ' + requestedPlayerNickname,
                0,
                -0.4,
                100
            );
            this.addText('✅ Press ⌨️ [Y] to Accept', 0, -0.5, 100);
            this.addText('❌ Press ⌨️ [X] to Decline', 0, -0.6, 100);
            this.battleRequestedPlayer = requestedPlayerID;
            console.log('Challenged by ' + requestedPlayerID);
        }
    }

    startRPSAnimation(
        playerCharacter: boolean,
        opponentCharacter: boolean
    ): void {
        if (this.disposed) {
            return;
        }

        setPlayerOverlay(
            this.rpsSprite,
            playerCharacter,
            opponentCharacter,
            this.resourceDisposer
        );
        //this.removeText();
        this.animationFrameSlot.cancel();
        this.inBattleMode = true;
        this.player.inRPSBattleMode = true;

        const userASprite = this.rpsSprite.get('UserA');
        const userBSprite = this.rpsSprite.get('UserB');
        const vsSprite = this.rpsSprite.get('VS');
        const beamSprite = this.rpsSprite.get('Beam');
        const introSprites = [
            userASprite,
            userBSprite,
            vsSprite,
            beamSprite,
        ].filter((sprite): sprite is THREE.Sprite => sprite !== undefined);

        this.overlayScene.add(...introSprites);

        userASprite!.position.set(0, MINIGAME_OVERLAY_Y, 0);
        userBSprite!.position.set(0, MINIGAME_OVERLAY_Y, 0);

        animateMinigamePlayersApart(
            () => this.rpsSprite.get('UserA')!,
            () => this.rpsSprite.get('UserB')!,
            RPS_FAST_ANIMATION_STEP,
            -1,
            this.animationFrameSlot,
            () => {
                this.overlayScene.remove(...introSprites);
                this.inGameRPSAnimation();
            }
        );
    }

    inGameRPSAnimation(): void {
        if (this.disposed) {
            return;
        }

        this.inBattleChooseMode = true;

        const userASprite = this.rpsSprite.get('UserA');
        const beamSprite = this.rpsSprite.get('Beam');
        const choiceSprites = [userASprite, beamSprite].filter(
            (sprite): sprite is THREE.Sprite => sprite !== undefined
        );

        this.overlayScene.add(...choiceSprites);

        this.addText('Press ⌨️ [1] - 🪨 Rock    ', -0.2, -0.1, 100);
        this.addText('Press ⌨️ [2] - 📜 Paper   ', 0, -0.25, 100);
        this.addText('Press ⌨️ [3] - ✂️ Scissors', 0.2, -0.4, 100);

        userASprite!.position.set(
            -MINIGAME_ANIMATION_EDGE,
            MINIGAME_OVERLAY_Y,
            0
        );

        animateMinigameSpriteRight(
            () => this.rpsSprite.get('UserA')!,
            RPS_FAST_ANIMATION_STEP,
            MINIGAME_ANIMATION_EDGE,
            this.animationFrameSlot,
            () => {
                console.log('RPS Choice Animation Ended');
                this.overlayScene.remove(...choiceSprites);
                this.removeText();

                this.socket.emit('update', {
                    type: 'rps_invalid',
                });
            },
            () => {
                if (this.rps_choiceMade) {
                    this.removeText();
                }
            }
        );
    }

    /** will be called from main */
    solutionRPSAnimation(): void {
        if (this.disposed) {
            return;
        }

        this.animationFrameSlot.cancel();
        console.log('RPS Solution Animation Start');

        const userASprite = this.rpsSprite.get('UserA');
        const userBSprite = this.rpsSprite.get('UserB');
        const beamSprite = this.rpsSprite.get('Beam');
        const solutionSprites = [userASprite, userBSprite, beamSprite].filter(
            (sprite): sprite is THREE.Sprite => sprite !== undefined
        );

        this.overlayScene.add(...solutionSprites);

        userASprite!.position.set(0, MINIGAME_OVERLAY_Y, 0);
        userBSprite!.position.set(0, MINIGAME_OVERLAY_Y, 0);

        this.verifyRPSWinner();

        if (
            this.yourChoice !== RPSChoice.None &&
            this.opponentChoice !== RPSChoice.None
        ) {
            this.addText('You chose: ' + this.yourChoice, -0.3, -0.1, 75);
            this.addText(
                'Opponent chose: ' + this.opponentChoice,
                0.3,
                -0.35,
                75
            );
        }

        animateMinigamePlayersApart(
            () => this.rpsSprite.get('UserA')!,
            () => this.rpsSprite.get('UserB')!,
            MINIGAME_RESULT_ANIMATION_STEP,
            -1,
            this.animationFrameSlot,
            () => {
                this.overlayScene.remove(...solutionSprites);

                this.removeText();
                this.resetRPSGame();

                this.socket.emit('update', {
                    type: 'game_reset',
                });
            }
        );
    }

    verifyRPSWinner(): void {
        if (
            this.yourChoice === RPSChoice.None ||
            this.opponentChoice === RPSChoice.None
        ) {
            this.addText('Invalid Round...', 0, -0.225, 125);
            console.log('No Winner. Choices not made yet!');
            return;
        }

        if (this.yourChoice === this.opponentChoice)
            this.addText("🤝 It's a draw!", 0, -0.225, 125);
        else if (
            RPS_WINNING_MATCHUPS.some(
                ([yourChoice, opponentChoice]) =>
                    this.yourChoice === yourChoice &&
                    this.opponentChoice === opponentChoice
            )
        )
            this.addText('🏆 You win!', 0, -0.225, 100);
        else this.addText('You lose!', 0, -0.225, 100);
    }

    resetRPSGame(): void {
        this.rps_choiceMade = false;
        this.yourChoice = RPSChoice.None;
        this.opponentChoice = RPSChoice.None;
        this.inBattleMode = false;
        this.player.inRPSBattleMode = false;
        this.inBattleChooseMode = false;
        this.player.youSendRPGRequest = false;
    }

    render(): void {
        this.renderOverlay();
    }

    dispose(): void {
        if (this.disposed) {
            return;
        }

        this.disposed = true;
        this.animationFrameSlot.cancel();
        this.removeText();

        this.battlePrompt.hide();
        this.resourceDisposer.disposeObject3D(this.battlePrompt);

        disposeOverlaySprites(this.rpsSprite, this.resourceDisposer);
        this.overlayScene.clear();
        this.playerInRange = null;
        this.inRange = false;
        this.hasReportedPlayerInRange = false;
    }
}
