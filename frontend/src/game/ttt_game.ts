import * as THREE from 'three';
import { Player } from './player';
import { CanvasTextSprite } from './CanvasTextSprite';
import { TTTMark, TTTMeshBoard } from '@common/types';

// Type-only import: exists only during TypeScript compilation, not at runtime.
// The type is removed after compilation, so it must be imported using `import type`.
import type { TTTBoard, PlayerSlot, TTTInitGamePayload } from '@common/types';

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

    vsSprite: Map<string, THREE.Mesh>;

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

        //this.vsSprite.set("A", this.addVSSprite('textures/X.jpg'));
        this.vsSprite.set(
            'Beam',
            this.addVSSprite('textures/VS_Beam2.jpg', 10, 0.5)
        );
        this.vsSprite.get('Beam')?.position.set(0, -0.25, 0);

        this.vsSprite.set(
            'VS',
            this.addVSSprite('textures/VS_2.png', 0.5, 0.5)
        );
        this.vsSprite.set(
            'Draw',
            this.addVSSprite('textures/Draw.png', 0.5, 0.5)
        );
        this.vsSprite.set(
            'UserA',
            this.addVSSprite('textures/UserA.png', 1, 1)
        );
        this.vsSprite.set(
            'UserB',
            this.addVSSprite('textures/UserB.png', 1, 1)
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

    async waitforInitMesh(data: TTTInitGamePayload) {
        const loop = () => {
            //console.log("Waiting for board to be ready...");
            this.wait(10);
            if (!this.board.cells[0]) {
                requestAnimationFrame(loop);
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

    addVSSprite(path: string, x: number, y: number): THREE.Mesh {
        const texture = new THREE.TextureLoader().load(path);
        const material = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            depthTest: false,
            depthWrite: false,
        });
        const geometry = new THREE.PlaneGeometry(x, y);
        const mesh = new THREE.Mesh(geometry, material);
        //this.overlayScene.add(mesh);

        return mesh;
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

    async startVSAnimation(): Promise<void> {
        this.removeText();
        this.vsAnimationStart = false;

        const userASprite = this.vsSprite.get('UserA');
        const userBSprite = this.vsSprite.get('UserB');
        const vsSprite = this.vsSprite.get('VS');
        const beamSprite = this.vsSprite.get('Beam');

        if (!userASprite || !userBSprite || !vsSprite || !beamSprite) return;

        this.overlayScene.add(userASprite);
        this.overlayScene.add(userBSprite);
        this.overlayScene.add(vsSprite);
        this.overlayScene.add(beamSprite);

        const yp = 0.025;
        userASprite.position.set(0, yp, 0);
        userBSprite.position.set(0, yp, 0);

        const loop = () => {
            const posA = userASprite.position.x;
            const posB = userBSprite.position.x;

            userASprite.position.set(posA + 0.005, yp, 0);
            userBSprite.position.set(posB - 0.005, yp, 0);

            if (posA < 0.75 && posB > -0.75) {
                requestAnimationFrame(loop);
            } else {
                this.overlayScene.remove(userASprite);
                this.overlayScene.remove(userBSprite);
                this.overlayScene.remove(vsSprite);
                this.overlayScene.remove(beamSprite);

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

    async winAnimation(user: string): Promise<void> {
        this.vsAnimationStart = false;
        console.log('Animating win...');

        const userSprite = this.vsSprite.get(user);
        const beamSprite = this.vsSprite.get('Beam');

        if (!userSprite || !beamSprite) return;

        this.overlayScene.add(userSprite);
        this.overlayScene.add(beamSprite);

        const yp = 0.025;
        userSprite.position.set(-0.75, yp, 0);

        const loop = () => {
            const posA = userSprite.position.x;

            userSprite.position.set(posA + 0.003, yp, 0);

            if (posA < 0) {
                requestAnimationFrame(loop);
            } else {
                this.removeText();

                //console.log("Animation finished.");
                this.overlayScene.remove(userSprite);
                this.overlayScene.remove(beamSprite);

                this.overlayScene.remove(this.spriteGameText);

                //this.endGame();
                this.tttCamera = false;
            }
        };
        loop();
    }

    async drawAnimation(): Promise<void> {
        this.vsAnimationStart = false;
        console.log('Animating Draw...');

        const drawSprite = this.vsSprite.get('Draw');
        const beamSprite = this.vsSprite.get('Beam');

        if (!drawSprite || !beamSprite) return;

        this.overlayScene.add(drawSprite);
        this.overlayScene.add(beamSprite);

        drawSprite.scale.set(0.5, 0.5, 0);
        drawSprite.position.set(0, -0.2, 0);

        const loop = () => {
            const scaleX = drawSprite.scale.x;
            drawSprite.scale.set(scaleX + 0.015, scaleX + 0.015, 1);

            if (scaleX < 2) {
                requestAnimationFrame(loop);
            } else {
                this.removeText();

                //console.log("Animation finished.");
                this.overlayScene.remove(drawSprite);
                this.overlayScene.remove(beamSprite);

                this.overlayScene.remove(this.spriteGameText);

                this.tttCamera = false;
                //this.endGame();
            }
        };
        loop();
    }

    render(): void {
        this.onResize();

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
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    async endGame(): Promise<void> {
        await this.wait(4242);
        this.resetGame();
    }

    resetGame(): void {
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
        for (const box of this.board.cells)
            box.material.color = new THREE.Color(0xffffff);
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
            this.board.getCell(0).material.color = new THREE.Color(0xff0000);
            this.board.getCell(1).material.color = new THREE.Color(0xff0000);
            this.board.getCell(2).material.color = new THREE.Color(0xff0000);
        } else if (winnerID == 2) {
            this.board.getCell(3).material.color = new THREE.Color(0xff0000);
            this.board.getCell(4).material.color = new THREE.Color(0xff0000);
            this.board.getCell(5).material.color = new THREE.Color(0xff0000);
        } else if (winnerID == 3) {
            this.board.getCell(6).material.color = new THREE.Color(0xff0000);
            this.board.getCell(7).material.color = new THREE.Color(0xff0000);
            this.board.getCell(8).material.color = new THREE.Color(0xff0000);
        } else if (winnerID == 4) {
            this.board.getCell(0).material.color = new THREE.Color(0xff0000);
            this.board.getCell(3).material.color = new THREE.Color(0xff0000);
            this.board.getCell(6).material.color = new THREE.Color(0xff0000);
        } else if (winnerID == 5) {
            this.board.getCell(1).material.color = new THREE.Color(0xff0000);
            this.board.getCell(4).material.color = new THREE.Color(0xff0000);
            this.board.getCell(7).material.color = new THREE.Color(0xff0000);
        } else if (winnerID == 6) {
            this.board.getCell(2).material.color = new THREE.Color(0xff0000);
            this.board.getCell(5).material.color = new THREE.Color(0xff0000);
            this.board.getCell(8).material.color = new THREE.Color(0xff0000);
        } else if (winnerID == 7) {
            this.board.getCell(0).material.color = new THREE.Color(0xff0000);
            this.board.getCell(4).material.color = new THREE.Color(0xff0000);
            this.board.getCell(8).material.color = new THREE.Color(0xff0000);
        } else if (winnerID == 8) {
            this.board.getCell(2).material.color = new THREE.Color(0xff0000);
            this.board.getCell(4).material.color = new THREE.Color(0xff0000);
            this.board.getCell(6).material.color = new THREE.Color(0xff0000);
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
        this.removeText();
        this.drawAnimation();
        this.spriteGameText.setText('FINISH', 50);
    }

    checkDraw(): boolean {
        for (const field of this.state) {
            if (field === '') {
                //console.log("Not finished yet");
                return false;
            }
        }
        console.log('No Winner :(');
        return true;
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
