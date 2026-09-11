import * as THREE from 'three';
import { Player } from './player';
import { CanvasTextSprite } from './CanvasTextSprite';
import { AnimationFrameSlot } from './AnimationFrameSlot';
import {
    addOverlayText,
    clearOverlayText,
    createMinigameOverlay,
    disposeOverlaySprites,
    resizeOverlay,
    setPlayerOverlay,
} from './GameOverlay';
import { createThreeResourceDisposer } from './ThreeResourceDisposer';
import { IMG_EMPTY, IMG_O, IMG_X } from './Assets.js';
import { TTTGameState, TTTMark, TTTMeshBoard } from 'ftr-common/sharedTypes';

// Type-only import: exists only during TypeScript compilation, not at runtime.
// The type is removed after compilation, so it must be imported using `import type`.
import type {
    TTTBoard,
    PlayerSlot,
    TTTInitGamePayload,
} from 'ftr-common/sharedTypes';

const TTT_TEXTURE_LOADER = new THREE.TextureLoader();

type TTTLifecycleState = 'idle' | 'active' | 'finished';

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
    private lifecycleState: TTTLifecycleState;
    private generation: number;
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

        this.texX = TTT_TEXTURE_LOADER.load(IMG_X);
        this.texO = TTT_TEXTURE_LOADER.load(IMG_O);
        this.texEmpty = TTT_TEXTURE_LOADER.load(IMG_EMPTY);

        this.overlayScene = new THREE.Scene();
        this.overlayCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

        this.vsSprite = createMinigameOverlay();
        this.resourceDisposer = createThreeResourceDisposer();
        this.boardInitFrameSlot = new AnimationFrameSlot(() => !this.disposed);
        this.animationFrameSlot = new AnimationFrameSlot(() => !this.disposed);
        this.pendingWaits = new Map();
        this.lifecycleState = 'idle';
        this.generation = 0;
        this.disposed = false;

        console.log('TTT Game initialized.');
    }

    initGame(data: TTTInitGamePayload): void {
        if (this.disposed) {
            return;
        }

        const game = data.game;
        this.generation++;
        this.lifecycleState = 'idle';
        this.cancelTransientAnimation();
        this.tttCamera = false;
        this.removeText();
        this.spriteGameText.setText('Click to Join', 50);
        this.syncPlayerSlot(game.players[0], game.players[1], true);

        if (
            game.state === TTTGameState.InGame &&
            game.players[0] !== null &&
            game.players[1] !== null
        ) {
            this.lifecycleState = 'active';
            this.spriteGameText.setText('IN GAME', 50);
        } else if (game.state === TTTGameState.Finished) {
            this.lifecycleState = 'finished';
            this.spriteGameText.setText('FINISH', 50);
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
                            const cell = this.board.getCell(index);
                            cell.material.color.set(0xffffff);
                            if (box === TTTMark.X)
                                cell.material.map = this.texX;
                            else if (box === TTTMark.O)
                                cell.material.map = this.texO;
                            else cell.material.map = this.texEmpty;
                            cell.material.needsUpdate = true;
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
        if (this.disposed || this.lifecycleState !== 'active') {
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

        drawSprite.scale.setScalar(0.5).setZ(0);
        drawSprite.position.set(0, -0.2, 0);

        const loop = () => {
            const scaleX = drawSprite.scale.x;
            drawSprite.scale.setScalar(scaleX + 0.015).setZ(1);

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

    private updateSharedReserveUI(): void {
        if (this.lifecycleState === 'active') {
            this.spriteGameCount.setText('2/2', 50);
            return;
        }

        if (this.lifecycleState === 'finished') {
            return;
        }

        const reservedSlots = this.players.filter(
            (player) => player !== null
        ).length;
        this.spriteGameCount.setText(`${reservedSlots}/2`, 50);
    }

    private syncPlayerSlot(
        playerOne: PlayerSlot,
        playerTwo: PlayerSlot,
        authoritative: boolean
    ): boolean {
        if (this.disposed) {
            return false;
        }

        if (!authoritative && this.lifecycleState !== 'idle') {
            if (
                playerOne !== null &&
                this.players[0] !== null &&
                playerOne !== this.players[0]
            ) {
                return false;
            }
            if (
                playerTwo !== null &&
                this.players[1] !== null &&
                playerTwo !== this.players[1]
            ) {
                return false;
            }
        }

        if (authoritative) {
            this.players = [playerOne, playerTwo];
        } else {
            if (playerOne !== null) {
                this.players[0] = playerOne;
            }
            if (playerTwo !== null) {
                this.players[1] = playerTwo;
            }
        }

        this.updateSharedReserveUI();
        return true;
    }

    private isLocalParticipant(): boolean {
        if (this.player.id === undefined) {
            return false;
        }
        return this.players.includes(this.player.id);
    }

    private cancelTransientAnimation(): void {
        this.animationFrameSlot.cancel();
        this.vsAnimationStart = false;
        this.overlayScene.remove(...this.vsSprite.values());
    }

    setPlayerOne(playerID: string): void {
        const alreadyKnown = this.players[0] === playerID;
        const synchronized = this.syncPlayerSlot(
            playerID,
            this.players[1],
            false
        );
        if (!synchronized) {
            return;
        }

        console.log('First Player added to game.' + playerID);
        if (
            this.lifecycleState === 'idle' &&
            !alreadyKnown &&
            this.player.id === playerID
        )
            this.addText(
                'You joined the game.\nWaiting for another player…\nor press ⌨️ [ESC]ape',
                0,
                -0.5,
                75
            );
    }

    setPlayerTwo(playerID: string): void {
        const synchronized = this.syncPlayerSlot(
            this.players[0],
            playerID,
            false
        );
        if (!synchronized) {
            return;
        }

        console.log('Second Player added to game.' + playerID);
    }

    startGame(
        playerOne: string,
        playerTwo: string,
        playerOneNickname: string,
        playerTwoNickname: string,
        playerCharacter: boolean,
        opponentCharacter: boolean
    ): boolean {
        if (this.disposed || this.lifecycleState !== 'idle') {
            return false;
        }

        if (!playerOne || !playerTwo || playerOne === playerTwo) {
            return false;
        }

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
        this.syncPlayerSlot(playerOne, playerTwo, true);

        this.generation++;
        this.lifecycleState = 'active';
        this.clearBoard();
        console.log('TTT GAME START!');
        console.log(
            'Player 1: ' + playerOneNickname + ' (' + this.players[0] + ')'
        );
        console.log(
            'Player 2: ' + playerTwoNickname + ' (' + this.players[1] + ')'
        );
        this.spriteGameText.setText(
            'IN GAME\n' + playerOneNickname + ' VS ' + playerTwoNickname,
            50
        );

        if (!this.isLocalParticipant()) {
            return true;
        }

        setPlayerOverlay(
            this.vsSprite,
            playerCharacter,
            opponentCharacter,
            this.resourceDisposer
        );

        this.startVSAnimation();
        return true;
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
        const generation = this.generation;
        await this.wait(4242);
        if (this.disposed) {
            return;
        }
        if (generation !== this.generation) {
            return;
        }
        this.resetGame();
    }

    resetGame(): void {
        if (this.disposed) {
            return;
        }

        this.generation++;
        this.lifecycleState = 'idle';
        this.cancelTransientAnimation();
        this.clearBoard();

        console.log('TTT GAME END!!!');

        this.tttCamera = false;

        this.spriteGameText.setText('Click to Join', 50);
        this.spriteGameCount.setText('0/2', 50);

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
        if (this.disposed || this.lifecycleState !== 'active') {
            return;
        }

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
        if (this.disposed || this.lifecycleState !== 'active') {
            return;
        }

        this.lifecycleState = 'finished';
        if (this.isLocalParticipant()) {
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
        if (this.disposed || this.lifecycleState !== 'active') {
            return;
        }

        this.lifecycleState = 'finished';
        this.spriteGameText.setText('FINISH', 50);
        if (!this.isLocalParticipant()) {
            return;
        }

        this.removeText();
        this.drawAnimation();
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
