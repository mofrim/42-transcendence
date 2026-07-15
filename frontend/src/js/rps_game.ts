import * as THREE from 'three';
import { Player } from './player';
import { Remote_Player } from './remote_player';
import type { Socket } from 'socket.io-client';
import { RPSChoice } from '@common/types';

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
    spritePlayer: THREE.Sprite;

    minDist: number;

    currentTextState: THREE.Sprite[];
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
        this.spritePlayer = new THREE.Sprite();

        this.minDist = Infinity;

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

    // TODO: better add this sprite to each player and update it in the player class instead of here
    // this adds the "Press B" Sprite to a remote player
    updateCheck(): void {
        this.minDist = Infinity;

        for (const player of this.players.values()) {
            const dist = this.player.group.position.distanceToSquared(
                player.group.position
            );

            if (dist < 4) {
                if (dist < this.minDist) {
                    this.minDist = dist;
                    this.playerInRange = player;
                }
                this.inRange = true;
            }
        }

        if (this.minDist === Infinity) {
            this.inRange = false;
            this.playerInRange = null;
            if (this.spritePlayer)
                this.updateSpriteText(this.spritePlayer, '', 20);
        } else {
            const pos = this.playerInRange!.group.position;

            this.updateSpriteText(this.spritePlayer, 'Press B', 20);
            this.spritePlayer.position.set(pos.x, pos.y + 1.6, pos.z);
        }
    }

    BattleRequest(requestedPlayerID: string): void {
        if (!this.player.youSendRPGRequest) {
            this.removeText();
            this.addText(requestedPlayerID, 0, -0.2, 50);
            this.addText('Rock Paper Scissors Battle Requested!', 0, -0.3, 100);
            this.addText('Y - Accept ', 0, -0.5, 100);
            this.addText('X - Decline', 0, -0.6, 100);
            this.battleRequestedPlayer = requestedPlayerID;
            console.log('Battle requested: ' + requestedPlayerID);
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

        this.addText('1 - Rock!    ', -0.2, -0.1, 100);
        this.addText('2 - Paper!   ', 0, -0.25, 100);
        this.addText('3 - Scissors!', 0.2, -0.4, 100);

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

    // will be called from main
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
            this.addText("It's a draw!", 0, -0.225, 125);
        else if (
            (this.yourChoice === RPSChoice.Rock &&
                this.opponentChoice === RPSChoice.Scissors) ||
            (this.yourChoice === RPSChoice.Paper &&
                this.opponentChoice === RPSChoice.Rock) ||
            (this.yourChoice === RPSChoice.Scissors &&
                this.opponentChoice === RPSChoice.Paper)
        )
            this.addText('You win!', 0, -0.225, 100);
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

    // TODO: better create a sprite class ---------------------------------------

    makeSprite(text: string, size: number): THREE.Sprite {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) {
            throw new Error('Failed to get 2D canvas context');
        }

        canvas.width = 2048;
        canvas.height = 256;

        ctx.font = size + 'px Segoe UI Black';
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.lineWidth = 8; // outline thickness
        ctx.strokeStyle = 'black'; // outline color
        ctx.strokeText(text, canvas.width / 2, canvas.height / 2);

        ctx.fillStyle = 'white';
        ctx.fillText(text, canvas.width / 2, canvas.height / 2);

        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({ map: texture });
        material.transparent = true;
        material.depthWrite = false;
        material.depthTest = true;
        const sprite = new THREE.Sprite(material);
        sprite.scale.set(canvas.width / canvas.height, 1, 1);

        this.scene.add(sprite);

        return sprite;
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

    updateSpriteText(sprite: THREE.Sprite, text: string, size: number): void {
        const canvas = sprite.material.map?.image as HTMLCanvasElement;

        if (!canvas) return;

        const ctx = canvas.getContext('2d');

        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.font = size + 'px Segoe UI Black';
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.lineWidth = 8; // outline thickness
        ctx.strokeStyle = 'black'; // outline color
        ctx.strokeText(text, canvas.width / 2, canvas.height / 2);

        ctx.fillText(text, canvas.width / 2, canvas.height / 2);

        sprite.material.map!.needsUpdate = true;
    }

    removeText(): void {
        if (this.currentTextState) {
            this.currentTextState.forEach((textSprite) => {
                this.overlayScene.remove(textSprite);
            });
            this.currentTextState = [];
        }
    }

    // FIXME silenced noUncheckedIndexedAccess here
    addText(text: string, px: number, py: number, size: number): void {
        this.currentTextState.push(this.makeSprite(text, size));
        const scaleFactor = 0.2;
        this.currentTextState[this.currentTextState.length - 1]!.scale.set(
            this.currentTextState[this.currentTextState.length - 1]!.scale.x *
            scaleFactor,
            this.currentTextState[this.currentTextState.length - 1]!.scale.y *
            scaleFactor,
            1
        );
        this.currentTextState[this.currentTextState.length - 1]!.position.set(
            px,
            py,
            0
        );
        this.overlayScene.add(
            this.currentTextState[this.currentTextState.length - 1]!
        );
    }
}
