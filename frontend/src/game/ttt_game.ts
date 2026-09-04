import * as THREE from 'three';
import { Player } from './player';
import { CanvasTextSprite } from './CanvasTextSprite';
import { AnimationFrameSlot } from './AnimationFrameSlot';
import {
    addOverlayText,
    clearOverlayText,
    createOverlaySprite,
    disposeOverlaySprites,
    resizeOverlay,
} from './GameOverlay';
import { createThreeResourceDisposer } from './ThreeResourceDisposer';
import { TTTMark, TTTMeshBoard } from 'common/sharedTypes';

// Type-only import: exists only during TypeScript compilation, not at runtime.
// The type is removed after compilation, so it must be imported using `import type`.
import type {
    TTTBoard,
    PlayerSlot,
    TTTInitGamePayload,
} from 'common/sharedTypes';

export class TTT_Game {
    board: TTTMeshBoard;
    scene: THREE.Scene;
    renderer: THREE.WebGLRenderer;
    player: Player;
    players: [PlayerSlot, PlayerSlot];

    state: TTTBoard;

    tttCamera: boolean;
    vsAnimationStart: boolean;

    spriteGameText: CanvasTextSprite;
    spriteGameCount: CanvasTextSprite;
    currentTextState: CanvasTextSprite[];

    texX: THREE.Texture;
    texO: THREE.Texture;
    texEmpty: THREE.Texture;

    overlayScene: THREE.Scene;
    overlayCamera: THREE.OrthographicCamera;

    vsSprite: Map<string, THREE.Sprite>;
    private readonly resourceDisposer: ReturnType<
        typeof createThreeResourceDisposer
    >;
    private readonly boardInitFrameSlot: AnimationFrameSlot;
    private readonly animationFrameSlot: AnimationFrameSlot;
    private readonly pendingWaits: Map<
        ReturnType<typeof setTimeout>,
        () => void
    >;
    private disposed: boolean;

    constructor(
        scene: THREE.Scene,
        player: Player,
        board: TTTMeshBoard,
        renderer: THREE.WebGLRenderer
    ) {
        this.board = board;

        this.scene = scene;
        this.renderer = renderer;
        this.renderer.autoClear = false;
        this.player = player;
        this.players = [null, null];

        this.tttCamera = false;

        this.state = [
            TTTMark.Empty,
            TTTMark.Empty,
            TTTMark.Empty,
            TTTMark.Empty,
            TTTMark.Empty,
            TTTMark.Empty,
            TTTMark.Empty,
            TTTMark.Empty,
            TTTMark.Empty,
        ];

        this.vsAnimationStart = false;

        this.spriteGameText = new CanvasTextSprite('Click to Join', 50);
        this.spriteGameCount = new CanvasTextSprite('0/2', 50);
        this.spriteGameText.position.set(24.25, 5.5, -16.13);
        this.spriteGameCount.position.set(24.25, 5.2, -16.13);
        this.scene.add(this.spriteGameText, this.spriteGameCount);

        this.currentTextState = [];

        this.texX = new THREE.TextureLoader().load('textures/X.jpg');
        this.texO = new THREE.TextureLoader().load('textures/O.jpg');
        this.texEmpty = new THREE.TextureLoader().load('textures/Empty.jpg');

        this.overlayScene = new THREE.Scene();
        this.overlayCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

        this.vsSprite = new Map();
        this.resourceDisposer = createThreeResourceDisposer();
        this.boardInitFrameSlot = new AnimationFrameSlot(() => !this.disposed);
        this.animationFrameSlot = new AnimationFrameSlot(() => !this.disposed);
        this.pendingWaits = new Map();
        this.disposed = false;

        //this.vsSprite.set("A", this.addVSSprite('textures/X.jpg'));
        this.vsSprite.set(
            'Beam',
            createOverlaySprite('textures/VS_Beam2.jpg', 10, 0.5)
        );
        this.vsSprite.get('Beam')?.position.set(0, -0.25, 0);

        this.vsSprite.set(
            'VS',
            createOverlaySprite('textures/VS_2.png', 0.5, 0.5)
        );
        this.vsSprite.set(
            'Draw',
            createOverlaySprite('textures/Draw.png', 0.5, 0.5)
        );
        this.vsSprite.set(
            'UserA',
            createOverlaySprite('textures/UserA.png', 1, 1)
        );
        this.vsSprite.set(
            'UserB',
            createOverlaySprite('textures/UserB.png', 1, 1)
        );

        console.log('TTT Game initialized.');
    }

    initGame(data: TTTInitGamePayload): void {
        // `data.game != null` checks for !== null and !== undefined because
        // null != undefined is false (but null === unedfined too)!
        // it's the idiomatic way for checking external JSON-data (like from
        // some API) for undefinedness
        if (data.game != null) {
            if (data.game.players[0]) {
                this.spriteGameCount.setText('1/2', 50);
                this.players[0] = data.game.players[0];
            }
            if (data.game.players[1]) {
                this.spriteGameCount.setText('2/2', 50);
                this.spriteGameText.setText('IN GAME', 50);
                this.players[1] = data.game.players[1];
            }
        }

        this.waitforInitMesh(data);
    }

    waitforInitMesh(data: TTTInitGamePayload): void {
        const loop = () => {
            //console.log("Waiting for board to be ready...");
            if (!this.board.cells[0]) {
                this.boardInitFrameSlot.request(loop);
            } else {
                let index = 0;
                if (data.game) {
                    if (index < this.board.size) {
                        for (const box of data.game.board) {
                            if (box === TTTMark.X)
                                this.board.getCell(index).material.map =
                                    this.texX;
                            else if (box === TTTMark.O)
                                this.board.getCell(index).material.map =
                                    this.texO;
                            index++;
                            //console.log("# Initializing board: " + box);
                        }
                    }
                }
            }
        };
        loop();
    }

    startVSAnimation(): void {
        if (this.disposed) {
            return;
        }

        this.animationFrameSlot.cancel();
        this.removeText();
        this.vsAnimationStart = false;

        const userASprite = this.vsSprite.get('UserA');
        const userBSprite = this.vsSprite.get('UserB');
        const vsSprite = this.vsSprite.get('VS');
        const beamSprite = this.vsSprite.get('Beam');
        //this.overlayScene.add(mesh);

        if (!userASprite || !userBSprite || !vsSprite || !beamSprite) return;

        this.overlayScene.add(userASprite, userBSprite, vsSprite, beamSprite);

        const yp = 0.025;
        userASprite.position.set(0, yp, 0);
        userBSprite.position.set(0, yp, 0);

        const loop = () => {
            const posA = userASprite.position.x;
            const posB = userBSprite.position.x;

            userASprite.position.set(posA + 0.005, yp, 0);
            userBSprite.position.set(posB - 0.005, yp, 0);

            if (posA < 0.75 && posB > -0.75) {
                this.animationFrameSlot.request(loop);
            } else {
                this.overlayScene.remove(
                    userASprite,
                    userBSprite,
                    vsSprite,
                    beamSprite
                );

                this.removeText();
                if (this.player.id === this.players[0]) {
                    this.addText('You are ❌. You go first', 0, -0.5, 75);
                } else {
                    this.addText('You are ⭕. You go second', 0, -0.5, 75);
                }

                this.tttCamera = true;
            }
        };
        loop();
    }

    winAnimation(user: string): void {
        if (this.disposed) {
            return;
        }

        this.animationFrameSlot.cancel();
        this.vsAnimationStart = false;
        console.log('Animating win...');

        const userSprite = this.vsSprite.get(user);
        const beamSprite = this.vsSprite.get('Beam');

        if (!userSprite || !beamSprite) return;

        this.overlayScene.add(userSprite, beamSprite);

        const yp = 0.025;
        userSprite.position.set(-0.75, yp, 0);

        const loop = () => {
            const posA = userSprite.position.x;

            userSprite.position.set(posA + 0.003, yp, 0);

            if (posA < 0) {
                this.animationFrameSlot.request(loop);
            } else {
                this.removeText();

                //console.log("Animation finished.");
                this.overlayScene.remove(
                    userSprite,
                    beamSprite,
                    this.spriteGameText
                );

                //this.endGame();
                this.tttCamera = false;
            }
        };
        loop();
    }

    drawAnimation(): void {
        if (this.disposed) {
            return;
        }

        this.animationFrameSlot.cancel();
        this.vsAnimationStart = false;
        console.log('Animating Draw...');

        const drawSprite = this.vsSprite.get('Draw');
        const beamSprite = this.vsSprite.get('Beam');

        if (!drawSprite || !beamSprite) return;

        this.overlayScene.add(drawSprite, beamSprite);

        drawSprite.scale.set(0.5, 0.5, 0);
        drawSprite.position.set(0, -0.2, 0);

        const loop = () => {
            const scaleX = drawSprite.scale.x;
            drawSprite.scale.set(scaleX + 0.015, scaleX + 0.015, 1);

            if (scaleX < 2) {
                this.animationFrameSlot.request(loop);
            } else {
                this.removeText();

                //console.log("Animation finished.");
                this.overlayScene.remove(
                    drawSprite,
                    beamSprite,
                    this.spriteGameText
                );

                //this.endGame();
                this.tttCamera = false;
            }
        };
        loop();
    }

    render(): void {
        if (this.disposed) {
            return;
        }

        resizeOverlay(this.overlayCamera, this.renderer);

        if (this.vsAnimationStart) {
            this.startVSAnimation();
        }

        this.renderer.render(this.overlayScene, this.overlayCamera);
    }

    setPlayerOne(playerID: string): void {
        this.players[0] = playerID;
        console.log('First Player added to game.' + playerID);
        this.spriteGameCount.setText('1/2', 50);
        if (this.player.id === playerID)
            this.addText(
                'You joined the game.\nWaiting for another player…\nor press ⌨️ [ESC]ape',
                0,
                -0.5,
                75
            );
    }

    setPlayerTwo(playerID: string): void {
        console.log('Second Player added to game.' + playerID);
        this.players[1] = playerID;
    }

    startGame(
        playerOne: string,
        playerTwo: string,
        playerOneNickname: string,
        playerTwoNickname: string
    ): void {
        console.log(
            'Players: ' +
                playerOneNickname +
                ' (' +
                playerOne +
                ')' +
                ' and ' +
                playerTwoNickname +
                ' (' +
                playerTwo +
                ')'
        );
        if (playerOne !== this.players[0] || playerTwo !== this.players[1]) {
            console.log('Player IDs do not match. Cannot start game.');
            return;
        }

        this.clearBoard();
        console.log('TTT GAME START!');
        console.log(
            'Player 1: ' + playerOneNickname + ' (' + this.players[0] + ')'
        );
        console.log(
            'Player 2: ' + playerTwoNickname + ' (' + this.players[1] + ')'
        );
        this.spriteGameCount.setText('2/2', 50);
        this.spriteGameText.setText(
            'IN GAME\n' + playerOneNickname + ' VS ' + playerTwoNickname,
            50
        );

        if (this.player.id !== playerOne && this.player.id !== playerTwo)
            return;

        this.startVSAnimation();
    }

    wait(ms: number): Promise<void> {
        if (this.disposed) {
            return Promise.resolve();
        }

        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                this.pendingWaits.delete(timeout);
                resolve();
            }, ms);
            this.pendingWaits.set(timeout, resolve);
        });
    }

    async endGame(): Promise<void> {
        await this.wait(4242);
        if (!this.disposed) {
            this.resetGame();
        }
    }

    resetGame(): void {
        if (this.disposed) {
            return;
        }

        this.clearBoard();

        console.log('TTT GAME END!!!');

        this.tttCamera = false;

        this.spriteGameText.setText('Click to Join', 50);
        this.spriteGameCount.setText('0/2', 50);

        if (
            this.player.id !== undefined &&
            this.players.includes(this.player.id)
        )
            this.removeText();
        this.players = [null, null];
        for (const box of this.board.cells) box.material.color.set(0xffffff);
    }

    clearBoard() {
        for (const box of this.board.cells) {
            box.material.map = this.texEmpty;
            box.material.needsUpdate = true;
        }

        this.state = [
            TTTMark.Empty,
            TTTMark.Empty,
            TTTMark.Empty,
            TTTMark.Empty,
            TTTMark.Empty,
            TTTMark.Empty,
            TTTMark.Empty,
            TTTMark.Empty,
            TTTMark.Empty,
        ];
    }

    drawWin(winnerID: number): void {
        if (winnerID == 1) {
            this.board.getCell(0).material.color.set(0xff0000);
            this.board.getCell(1).material.color.set(0xff0000);
            this.board.getCell(2).material.color.set(0xff0000);
        } else if (winnerID == 2) {
            this.board.getCell(3).material.color.set(0xff0000);
            this.board.getCell(4).material.color.set(0xff0000);
            this.board.getCell(5).material.color.set(0xff0000);
        } else if (winnerID == 3) {
            this.board.getCell(6).material.color.set(0xff0000);
            this.board.getCell(7).material.color.set(0xff0000);
            this.board.getCell(8).material.color.set(0xff0000);
        } else if (winnerID == 4) {
            this.board.getCell(0).material.color.set(0xff0000);
            this.board.getCell(3).material.color.set(0xff0000);
            this.board.getCell(6).material.color.set(0xff0000);
        } else if (winnerID == 5) {
            this.board.getCell(1).material.color.set(0xff0000);
            this.board.getCell(4).material.color.set(0xff0000);
            this.board.getCell(7).material.color.set(0xff0000);
        } else if (winnerID == 6) {
            this.board.getCell(2).material.color.set(0xff0000);
            this.board.getCell(5).material.color.set(0xff0000);
            this.board.getCell(8).material.color.set(0xff0000);
        } else if (winnerID == 7) {
            this.board.getCell(0).material.color.set(0xff0000);
            this.board.getCell(4).material.color.set(0xff0000);
            this.board.getCell(8).material.color.set(0xff0000);
        } else if (winnerID == 8) {
            this.board.getCell(2).material.color.set(0xff0000);
            this.board.getCell(4).material.color.set(0xff0000);
            this.board.getCell(6).material.color.set(0xff0000);
        }
    }

    winner(playerID: string, playerNickname?: string): void {
        if (
            this.player.id !== undefined &&
            this.players.includes(this.player.id)
        ) {
            this.removeText();
            this.spriteGameText.setText('FINISH', 50);

            if (this.player.id === playerID) {
                this.winAnimation('UserA');
                this.addText('🏆 You Win!', 0, -0.5, 75);
            } else {
                this.winAnimation('UserB');
                this.addText(
                    (playerNickname || playerID) + ' is the winner…',
                    0,
                    -0.5,
                    75
                );
            }

            console.log('Player 1 wins!');
        }
    }

    draw(): void {
        //console.log("Not finished yet");
        this.removeText();
        this.drawAnimation();
        this.spriteGameText.setText('FINISH', 50);
    }

    markField(fieldName: string, playerID: string, mark: TTTMark): void {
        const isExpectedPlayerMark =
            (playerID === this.players[0] && mark === TTTMark.X) ||
            (playerID === this.players[1] && mark === TTTMark.O);

        if (!isExpectedPlayerMark) return;

        console.log('In Marking: ' + fieldName + ' by player: ' + playerID);

        if (
            this.player.id !== undefined &&
            this.players.includes(this.player.id)
        ) {
            this.removeText();

            if (this.player.id === this.players[0] && mark === TTTMark.X)
                this.addText('Waiting…', 0, -0.5, 75);
            else if (this.player.id === this.players[0] && mark === TTTMark.O)
                this.addText('Your Turn with ❌ !', 0, -0.5, 75);

            if (this.player.id === this.players[1] && mark === TTTMark.O)
                this.addText('Waiting…', 0, -0.5, 75);
            else if (this.player.id === this.players[1] && mark === TTTMark.X)
                this.addText('Your Turn with ⭕ !', 0, -0.5, 75);
        }

        for (const box of this.board.cells) {
            if (box.name === fieldName) {
                //console.log("Marking now:" + fieldName);
                if (mark === TTTMark.O) box.material.map = this.texO;
                else box.material.map = this.texX;
                box.material.needsUpdate = true;
            }
        }
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
        this.boardInitFrameSlot.cancel();
        this.animationFrameSlot.cancel();

        for (const [timeout, resolve] of this.pendingWaits) {
            clearTimeout(timeout);
            resolve();
        }
        this.pendingWaits.clear();

        this.removeText();
        this.resourceDisposer.disposeObject3D([
            this.spriteGameText,
            this.spriteGameCount,
        ]);

        for (const cell of this.board.cells) {
            if (
                cell.material.map === this.texX ||
                cell.material.map === this.texO ||
                cell.material.map === this.texEmpty
            ) {
                cell.material.map = null;
            }
        }
        this.resourceDisposer.disposeTexture([
            this.texX,
            this.texO,
            this.texEmpty,
        ]);

        disposeOverlaySprites(this.vsSprite, this.resourceDisposer);
        this.overlayScene.clear();
    }
}
