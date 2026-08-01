import * as THREE from 'three';
import { Player } from './player';
import { Remote_Player } from './remote_player';
import { CanvasTextSprite } from './CanvasTextSprite';
import { FloatingTextSprite } from './FloatingTextSprite';
import type { Socket } from 'socket.io-client';
import { RPSChoice } from '@common/types';

const BATTLE_PROMPT_TEXT = 'Press ⌨️ [B] Battle Challenge';
const BATTLE_PROMPT_SIZE = 20;
const BATTLE_PROMPT_HEIGHT = 1.6;
const BATTLE_RANGE_SQUARED = 4;

export class RPS_Game {
    scene: THREE.Scene;

    socket: Socket;
    player: Player;
    players: Map<string, Remote_Player>;
    renderer: THREE.WebGLRenderer;

    inRange: boolean;
    playerInRange: Remote_Player | null;
    readyForRequest: boolean;
    battleRequestedPlayer: string;
    private readonly battlePrompt: FloatingTextSprite;

    currentTextState: CanvasTextSprite[];
    overlayScene: THREE.Scene;
    overlayCamera: THREE.OrthographicCamera;

    rpsSprite: Map<string, THREE.Mesh>;

    rps_choiceMade: boolean;
    inBattleMode: boolean;
    inBattleChooseMode: boolean;

    yourChoice: RPSChoice;
    opponentChoice: RPSChoice;

    animationLoop: number | null;

    constructor(
        scene: THREE.Scene,
        socket: Socket,
        player: Player,
        players: Map<string, Remote_Player>,
        renderer: THREE.WebGLRenderer
    ) {
        this.scene = scene;
        this.socket = socket;
        this.player = player;
        this.players = players;
        this.renderer = renderer;

        this.inRange = false;
        this.playerInRange = null;
        this.readyForRequest = true;
        this.battleRequestedPlayer = '';
        this.battlePrompt = new FloatingTextSprite(
            BATTLE_PROMPT_TEXT,
            BATTLE_PROMPT_SIZE,
            new THREE.Vector3(0, BATTLE_PROMPT_HEIGHT, 0)
        );
        this.scene.add(this.battlePrompt);

        this.currentTextState = [];
        this.overlayScene = new THREE.Scene();
        this.overlayCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        this.rpsSprite = new Map<string, THREE.Mesh>();

        this.rps_choiceMade = false;
        this.inBattleMode = false;
        this.inBattleChooseMode = false;

        this.yourChoice = RPSChoice.None;
        this.opponentChoice = RPSChoice.None;

        this.animationLoop = null;

        this.rpsSprite.set(
            'Beam',
            this.addRPSSprite('textures/VS_Beam2.jpg', 10, 0.5)
        );
        this.rpsSprite.get('Beam')!.position.set(0, -0.25, 0);

        this.rpsSprite.set(
            'VS',
            this.addRPSSprite('textures/VS_2.png', 0.5, 0.5)
        );
        this.rpsSprite.set(
            'Draw',
            this.addRPSSprite('textures/Draw.png', 0.5, 0.5)
        );
        this.rpsSprite.set(
            'UserA',
            this.addRPSSprite('textures/UserA.png', 1, 1)
        );
        this.rpsSprite.set(
            'UserB',
            this.addRPSSprite('textures/UserB.png', 1, 1)
        );
    }

    /**
     * Selects the nearest remote player in battle range.
     */
    updateCheck(): void {
        let nearestPlayer: Remote_Player | null = null;
        let nearestDistanceSquared = Infinity;

        for (const player of this.players.values()) {
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

        if (!nearestPlayer) {
            this.battlePrompt.hide();
            return;
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

    async startRPSAnimation(): Promise<void> {
        this.inBattleMode = true;
        this.player.inRPSBattleMode = true;

        const userASprite = this.rpsSprite.get('UserA');
        const userBSprite = this.rpsSprite.get('UserB');
        const vsSprite = this.rpsSprite.get('VS');
        const beamSprite = this.rpsSprite.get('Beam');

        if (userASprite) this.overlayScene.add(userASprite);
        if (userBSprite) this.overlayScene.add(userBSprite);
        if (vsSprite) this.overlayScene.add(vsSprite);
        if (beamSprite) this.overlayScene.add(beamSprite);

        const yp = 0.025;
        this.rpsSprite.get('UserA')!.position.set(0, yp, 0);
        this.rpsSprite.get('UserB')!.position.set(0, yp, 0);

        const loop = () => {
            const posA = this.rpsSprite.get('UserA')!.position.x;
            const posB = this.rpsSprite.get('UserB')!.position.x;

            this.rpsSprite.get('UserA')!.position.set(posA - 0.0075, yp, 0);
            this.rpsSprite.get('UserB')!.position.set(posB + 0.0075, yp, 0);

            if (posB < 0.75 && posA > -0.75) {
                requestAnimationFrame(loop);
            } else {
                if (userASprite) this.overlayScene.remove(userASprite);
                if (userBSprite) this.overlayScene.remove(userBSprite);
                if (vsSprite) this.overlayScene.remove(vsSprite);
                if (beamSprite) this.overlayScene.remove(beamSprite);

                this.inGameRPSAnimation();
            }
        };
        loop();
    }

    async inGameRPSAnimation(): Promise<void> {
        this.inBattleChooseMode = true;

        const userASprite = this.rpsSprite.get('UserA');
        const beamSprite = this.rpsSprite.get('Beam');

        if (userASprite) this.overlayScene.add(userASprite);
        if (beamSprite) this.overlayScene.add(beamSprite);

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
                this.animationLoop = requestAnimationFrame(loop);
            } else {
                console.log('RPS Choice Animation Ended');
                if (userASprite) this.overlayScene.remove(userASprite);
                if (beamSprite) this.overlayScene.remove(beamSprite);
                this.removeText();

                this.socket.emit('update', {
                    type: 'rps_invalid',
                });
            }
        };
        loop();
    }

    /** will be called from main */
    async solutionRPSAnimation(): Promise<void> {
        //this.removeText();
        console.log('RPS Solution Animation Start');

        const userASprite = this.rpsSprite.get('UserA');
        const userBSprite = this.rpsSprite.get('UserB');
        const beamSprite = this.rpsSprite.get('Beam');

        if (userASprite) this.overlayScene.add(userASprite);
        if (userBSprite) this.overlayScene.add(userBSprite);
        if (beamSprite) this.overlayScene.add(beamSprite);

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
                requestAnimationFrame(loop);
            } else {
                if (userASprite) this.overlayScene.remove(userASprite);
                if (userBSprite) this.overlayScene.remove(userBSprite);
                if (beamSprite) this.overlayScene.remove(beamSprite);

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

    onResize(): void {
        const aspect = window.innerWidth / window.innerHeight;

        this.overlayCamera.left = -aspect;
        this.overlayCamera.right = aspect;
        this.overlayCamera.top = 1;
        this.overlayCamera.bottom = -1;

        this.overlayCamera.updateProjectionMatrix();

        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    render(): void {
        this.onResize();
        this.renderer.render(this.overlayScene, this.overlayCamera);
    }

    addRPSSprite(path: string, x: number, y: number): THREE.Mesh {
        const texture = new THREE.TextureLoader().load(path);
        const material = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            depthTest: false,
            depthWrite: false,
        });
        const geometry = new THREE.PlaneGeometry(x, y);
        const mesh = new THREE.Mesh(geometry, material);

        return mesh;
    }

    removeText(): void {
        for (const textSprite of this.currentTextState) {
            this.overlayScene.remove(textSprite);
            textSprite.dispose();
        }

        this.currentTextState.length = 0;
    }

    addText(text: string, px: number, py: number, size: number): void {
        const textSprite = new CanvasTextSprite(text, size);
        const scaleFactor = 0.2;
        textSprite.scale.set(
            textSprite.scale.x * scaleFactor,
            textSprite.scale.y * scaleFactor,
            1
        );
        textSprite.position.set(px, py, 0);

        this.currentTextState.push(textSprite);
        this.overlayScene.add(textSprite);
    }
}
