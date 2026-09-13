import * as THREE from 'three';
import { Player } from './player';
import { Remote_Player } from './remote_player';
import { CanvasTextSprite } from './CanvasTextSprite';
import { FloatingTextSprite } from './FloatingTextSprite';
import { AnimationFrameSlot } from './AnimationFrameSlot';
import {
    addOverlayText,
    clearOverlayText,
    createMinigameOverlay,
    disposeOverlaySprites,
    resizeOverlay,
    setPlayerOverlay,
} from './GameOverlay';
import { createResourceDisposer } from './ResourceDisposer';
import type { Socket } from 'socket.io-client';
import { RPSChoice } from 'ftr-common/sharedTypes';

const BATTLE_PROMPT_TEXT = 'Press ⌨️ [B] Battle Challenge';
const BATTLE_PROMPT_SIZE = 20;
const BATTLE_PROMPT_HEIGHT = 1.6;
const BATTLE_RANGE_SQUARED = 4;

export class RPS_Game {
    socket: Socket;
    player: Player;
    players: Map<string, Remote_Player>;
    renderer: THREE.WebGLRenderer;

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
    private disposed: boolean;

    currentTextState: CanvasTextSprite[];
    overlayScene: THREE.Scene;
    overlayCamera: THREE.OrthographicCamera;

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
        this.socket = socket;
        this.player = player;
        this.players = players;
        this.renderer = renderer;

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

        this.currentTextState = [];
        this.overlayScene = new THREE.Scene();
        this.overlayCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
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

        const yp = 0.025;
        this.rpsSprite.get('UserA')!.position.set(0, yp, 0);
        this.rpsSprite.get('UserB')!.position.set(0, yp, 0);

        const loop = () => {
            const posA = this.rpsSprite.get('UserA')!.position.x;
            const posB = this.rpsSprite.get('UserB')!.position.x;

            this.rpsSprite.get('UserA')!.position.set(posA - 0.0075, yp, 0);
            this.rpsSprite.get('UserB')!.position.set(posB + 0.0075, yp, 0);

            if (posB < 0.75 && posA > -0.75) {
                this.animationFrameSlot.request(loop);
            } else {
                this.overlayScene.remove(...introSprites);

                this.inGameRPSAnimation();
            }
        };
        loop();
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

        const yp = 0.025;
        this.rpsSprite.get('UserA')!.position.set(-0.75, yp, 0);

        const loop = () => {
            const posA = this.rpsSprite.get('UserA')!.position.x;

            this.rpsSprite.get('UserA')!.position.set(posA + 0.0075, yp, 0);

            if (this.rps_choiceMade) this.removeText();

            if (posA < 0.75) {
                this.animationFrameSlot.request(loop);
            } else {
                console.log('RPS Choice Animation Ended');
                this.overlayScene.remove(...choiceSprites);
                this.removeText();

                this.socket.emit('update', {
                    type: 'rps_invalid',
                });
            }
        };
        loop();
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

        const yp = 0.025;
        this.rpsSprite.get('UserA')!.position.set(0, yp, 0);
        this.rpsSprite.get('UserB')!.position.set(0, yp, 0);

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

        const loop = () => {
            const posA = this.rpsSprite.get('UserA')!.position.x;
            const posB = this.rpsSprite.get('UserB')!.position.x;

            this.rpsSprite.get('UserA')!.position.set(posA - 0.003, yp, 0);
            this.rpsSprite.get('UserB')!.position.set(posB + 0.003, yp, 0);

            if (posB < 0.75 && posA > -0.75) {
                this.animationFrameSlot.request(loop);
            } else {
                this.overlayScene.remove(...solutionSprites);

                this.removeText();
                this.resetRPSGame();

                this.socket.emit('update', {
                    type: 'game_reset',
                });
            }
        };
        loop();
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
            (this.yourChoice === RPSChoice.Rock &&
                this.opponentChoice === RPSChoice.Scissors) ||
            (this.yourChoice === RPSChoice.Paper &&
                this.opponentChoice === RPSChoice.Rock) ||
            (this.yourChoice === RPSChoice.Scissors &&
                this.opponentChoice === RPSChoice.Paper)
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
        if (this.disposed) {
            return;
        }

        resizeOverlay(this.overlayCamera, this.renderer);
        this.renderer.render(this.overlayScene, this.overlayCamera);
    }

    removeText(): void {
        clearOverlayText(this.currentTextState);
    }

    addText(text: string, px: number, py: number, size: number): void {
        if (this.disposed) {
            return;
        }

        addOverlayText(
            this.overlayScene,
            this.currentTextState,
            text,
            px,
            py,
            size
        );
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
