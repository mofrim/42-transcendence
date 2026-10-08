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
import {
    RPSChoice,
    type EventDataMiniGameResult,
} from 'ftr-common/sharedTypes';

const BATTLE_PROMPT_TEXT = '⌨️ [B] Battle Challenge';
const BATTLE_PROMPT_SIZE = 20;
const BATTLE_PROMPT_HEIGHT = 1.6;
const RPS_FAST_ANIMATION_STEP = 0.0075;

export class RPS_Game extends MinigameOverlay {
    player: Player;

    /** Opponent socket ID, retained from the invitation until the round ends. */
    battleRequestedPlayer: string;
    private readonly battlePrompt: FloatingTextSprite;
    private readonly getNearbyPlayer: () => Remote_Player | null;
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
        player: Player,
        renderer: THREE.WebGLRenderer,
        getNearbyPlayer: () => Remote_Player | null
    ) {
        super();
        this.player = player;

        this.battleRequestedPlayer = '';
        this.getNearbyPlayer = getNearbyPlayer;
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

        const nearbyPlayer = this.getNearbyPlayer();
        if (!nearbyPlayer) {
            this.battlePrompt.hide();
            return;
        }

        this.battlePrompt.follow(nearbyPlayer.group);
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
        opponentCharacter: boolean,
        opponentPlayerId: string
    ): void {
        if (this.disposed) {
            return;
        }

        this.battleRequestedPlayer = opponentPlayerId;
        setPlayerOverlay(
            this.rpsSprite,
            playerCharacter,
            opponentCharacter,
            this.resourceDisposer
        );
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
            }
        );
    }

    /** will be called from main */
    solutionRPSAnimation(outcome?: EventDataMiniGameResult['outcome']): void {
        if (this.disposed) {
            return;
        }

        this.animationFrameSlot.cancel();
        this.inBattleChooseMode = false;
        this.removeText();
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

        this.showRPSResult(outcome);

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
            () => this.resetRPSGame()
        );
    }

    private showRPSResult(outcome?: EventDataMiniGameResult['outcome']): void {
        if (outcome === undefined) {
            this.addText('Invalid Round...', 0, -0.225, 125);
            console.log('No Winner. Choices not made yet!');
            return;
        }

        if (outcome === 'draw') {
            this.addText("🤝 It's a draw!", 0, -0.225, 125);
        } else if (outcome === 'won') {
            this.addText('🏆 You win!', 0, -0.225, 100);
        } else {
            this.addText('You lose!', 0, -0.225, 100);
        }
    }

    resetRPSGame(): void {
        if (this.disposed) {
            return;
        }

        this.animationFrameSlot.cancel();
        this.removeText();
        this.overlayScene.clear();
        this.rps_choiceMade = false;
        this.yourChoice = RPSChoice.None;
        this.opponentChoice = RPSChoice.None;
        this.inBattleMode = false;
        this.player.inRPSBattleMode = false;
        this.inBattleChooseMode = false;
        this.player.youSendRPGRequest = false;
        this.player.battleRequested = false;
        this.battleRequestedPlayer = '';
    }

    render(): void {
        this.renderOverlay();
    }

    dispose(): void {
        if (this.disposed) {
            return;
        }

        this.resetRPSGame();
        this.disposed = true;

        this.battlePrompt.hide();
        this.resourceDisposer.disposeObject3D(this.battlePrompt);

        disposeOverlaySprites(this.rpsSprite, this.resourceDisposer);
    }
}
