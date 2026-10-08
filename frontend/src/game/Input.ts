import * as THREE from 'three';
import { RPSChoice } from 'ftr-common/sharedTypes';
import type { Camera } from './camera.js';
import type { InteractionManager } from './interaction_manager.js';
import type { MultiplayerManager } from './multiplayer.js';
import type { Player } from './player.js';
import type { Remote_Player } from './remote_player.js';
import type { RPS_Game } from './MinigameRPS.js';
import type { Story_Manager } from './story_manager.js';
import type { TTT_Game } from './MinigameTTT.js';

type InputOptions = {
    readonly domElement: HTMLElement;
    readonly colliders: THREE.Object3D[];
    readonly whichCharacter: boolean;
    readonly getPlayer: () => Player | null;
    readonly getCamera: () => Camera | null;
    readonly getMultiplayer: () => MultiplayerManager | null;
    readonly getRPSGame: () => RPS_Game | null;
    readonly getNearbyPlayer: () => Remote_Player | null;
    readonly getTTTGame: () => TTT_Game | null;
    readonly getStoryManager: () => Story_Manager | null;
    readonly getInteractionManager: () => InteractionManager | null;
    readonly isLocalPlayerDespawning: () => boolean;
};

export class Input {
    readonly keyStates: Record<string, boolean> = {};
    readonly keys: [number, number] = [0, 0];

    private readonly domElement: HTMLElement;
    private readonly colliders: THREE.Object3D[];
    private readonly whichCharacter: boolean;
    private readonly getPlayer: () => Player | null;
    private readonly getCamera: () => Camera | null;
    private readonly getMultiplayer: () => MultiplayerManager | null;
    private readonly getRPSGame: () => RPS_Game | null;
    private readonly resolveNearbyPlayer: () => Remote_Player | null;
    private readonly getTTTGame: () => TTT_Game | null;
    private readonly getStoryManager: () => Story_Manager | null;
    private readonly getInteractionManager: () => InteractionManager | null;
    private readonly isLocalPlayerDespawning: () => boolean;
    private readonly movementForward = new THREE.Vector3();
    private readonly movementSide = new THREE.Vector3();
    private readonly tttPointer = new THREE.Vector2();
    private readonly tttRaycaster = new THREE.Raycaster();
    private readonly tttRaycastHits: THREE.Intersection[] = [];
    private connected = false;

    constructor(options: InputOptions) {
        this.domElement = options.domElement;
        this.colliders = options.colliders;
        this.whichCharacter = options.whichCharacter;
        this.getPlayer = options.getPlayer;
        this.getCamera = options.getCamera;
        this.getMultiplayer = options.getMultiplayer;
        this.getRPSGame = options.getRPSGame;
        this.resolveNearbyPlayer = options.getNearbyPlayer;
        this.getTTTGame = options.getTTTGame;
        this.getStoryManager = options.getStoryManager;
        this.getInteractionManager = options.getInteractionManager;
        this.isLocalPlayerDespawning = options.isLocalPlayerDespawning;
        this.tttRaycaster.far = 50.0;
    }

    connect(): void {
        if (this.connected || this.isLocalPlayerDespawning()) {
            return;
        }

        document.addEventListener('keydown', this.onKeyDown);
        document.addEventListener('keyup', this.onKeyUp);
        this.domElement.addEventListener('click', this.onClick);
        this.connected = true;
    }

    dispose(): void {
        if (this.connected) {
            document.removeEventListener('keydown', this.onKeyDown);
            document.removeEventListener('keyup', this.onKeyUp);
            this.domElement.removeEventListener('click', this.onClick);
            this.connected = false;
        }
        this.stop();
    }

    stop(): void {
        this.keys.fill(0);
        for (const code of Object.keys(this.keyStates)) {
            this.keyStates[code] = false;
        }
    }

    update(deltaTime: number): void {
        const player = this.getPlayer();
        const camera = this.getCamera();
        if (!player || !camera || this.isLocalPlayerDespawning()) {
            return;
        }

        const moveForward = this.keyStates['KeyW'] || this.keyStates['ArrowUp'];
        const moveBackward =
            this.keyStates['KeyS'] || this.keyStates['ArrowDown'];
        const moveLeft = this.keyStates['KeyA'] || this.keyStates['ArrowLeft'];
        const moveRight =
            this.keyStates['KeyD'] || this.keyStates['ArrowRight'];

        if (!moveForward && !moveBackward && !moveLeft && !moveRight) {
            return;
        }

        const speedDelta = deltaTime * player.controls.runVelocity;
        const forward = camera.camera
            .getWorldDirection(this.movementForward)
            .projectOnPlane(camera.camera.up)
            .normalize();
        this.movementSide.crossVectors(forward, camera.camera.up);
        if (moveForward) {
            player.playerVelocity.addScaledVector(forward, speedDelta);
        }
        if (moveBackward) {
            player.playerVelocity.addScaledVector(forward, -speedDelta);
        }
        if (moveLeft) {
            player.playerVelocity.addScaledVector(
                this.movementSide,
                -speedDelta
            );
        }
        if (moveRight) {
            player.playerVelocity.addScaledVector(
                this.movementSide,
                speedDelta
            );
        }
    }

    private onPressAccept(): void {
        const multiplayer = this.getMultiplayer();
        if (multiplayer?.acceptFriendRequest()) {
            return;
        }

        const player = this.getPlayer();
        const rpsGame = this.getRPSGame();
        if (!player || !rpsGame) return;
        if (player.battleRequested) {
            player.battleRequested = false;
            const requestedPlayer = multiplayer?.players.get(
                rpsGame.battleRequestedPlayer
            );
            if (requestedPlayer) {
                requestedPlayer.battleRequested = false;
            }
            rpsGame.removeText();
            if (rpsGame.battleRequestedPlayer) {
                const multiplayer = this.getMultiplayer();
                if (!multiplayer) return;
                const opponentPlayer = multiplayer.players.get(
                    rpsGame.battleRequestedPlayer
                );
                if (!opponentPlayer) return;
                console.log(
                    'Sending accept request to player ' +
                        rpsGame.battleRequestedPlayer
                );
                console.log('BATTLE START!');
                multiplayer.emitBattleAccept(rpsGame.battleRequestedPlayer);
                rpsGame.startRPSAnimation(
                    this.whichCharacter,
                    opponentPlayer.character,
                    opponentPlayer.id
                );
            } else console.log('Player ID empty, cannot send accept request.');
        } else {
            console.log('No battle request to accept.');
        }
    }

    private onPressDecline(): void {
        const multiplayer = this.getMultiplayer();
        if (multiplayer?.declineFriendRequest()) {
            return;
        }

        const player = this.getPlayer();
        const rpsGame = this.getRPSGame();
        if (!player || !rpsGame) return;
        if (player.battleRequested) {
            player.battleRequested = false;
            const requestedPlayer = multiplayer?.players.get(
                rpsGame.battleRequestedPlayer
            );
            if (requestedPlayer) {
                requestedPlayer.battleRequested = false;
            }
            rpsGame.removeText();
            if (rpsGame.battleRequestedPlayer) {
                console.log(
                    'Sending decline request to player ' +
                        rpsGame.battleRequestedPlayer
                );
                console.log('BATTLE DECLINED!');
                this.getMultiplayer()?.emitBattleDecline(
                    rpsGame.battleRequestedPlayer
                );
            } else console.log('Player ID empty, cannot send decline request.');
        } else {
            console.log('No battle request to decline.');
        }
    }

    private chooseRPS(choice: RPSChoice): void {
        const player = this.getPlayer();
        const rpsGame = this.getRPSGame();
        if (!player || !rpsGame) return;
        if (rpsGame.rps_choiceMade) return;
        if (!player.inRPSBattleMode) return;
        if (!rpsGame.inBattleChooseMode) return;
        console.log(
            choice.charAt(0).toUpperCase() + choice.slice(1) + ' key pressed'
        );
        rpsGame.rps_choiceMade = true;
        rpsGame.removeText();
        this.getMultiplayer()?.emitBattleChoice(choice);
    }

    private getNearbyPlayer(): Remote_Player | null {
        const multiplayer = this.getMultiplayer();
        if (!multiplayer) {
            return null;
        }
        const nearbyPlayer = this.resolveNearbyPlayer();
        if (
            !nearbyPlayer ||
            !nearbyPlayer.isActive() ||
            multiplayer.players.get(nearbyPlayer.id) !== nearbyPlayer
        ) {
            return null;
        }
        return nearbyPlayer;
    }

    private onPressB(): void {
        const nearbyPlayer = this.getNearbyPlayer();
        const multiplayer = this.getMultiplayer();
        if (!nearbyPlayer || !multiplayer) {
            console.log('No player in range to interact with.');
            return;
        }
        multiplayer.emitBattleRequest(nearbyPlayer.id);
    }

    private onPressF(): void {
        const nearbyPlayer = this.getNearbyPlayer();
        const multiplayer = this.getMultiplayer();
        if (!nearbyPlayer || !multiplayer) {
            console.log('No player in range to interact with.');
            return;
        }
        multiplayer.emitFriendRequest(nearbyPlayer.id);
    }

    private onPressEscape(): void {
        const storyManager = this.getStoryManager();
        if (storyManager) storyManager.skipCameraAnimation = true;
        const player = this.getPlayer();
        const tttGame = this.getTTTGame();
        if (!player || !tttGame) {
            return;
        }
        if (tttGame.players[0] !== player.id || tttGame.players[1] !== null) {
            return;
        }
        this.getMultiplayer()?.emitTTTLeave();
    }

    private readonly onClick = (event: MouseEvent): void => {
        if (
            this.isLocalPlayerDespawning() ||
            this.getStoryManager()?.inCutscene
        ) {
            return;
        }
        this.tttPointer.set(
            THREE.MathUtils.mapLinear(
                event.clientX,
                0,
                window.innerWidth,
                -1,
                1
            ),
            THREE.MathUtils.mapLinear(
                event.clientY,
                0,
                window.innerHeight,
                1,
                -1
            )
        );
        const camera = this.getCamera();
        if (!camera) return;
        this.tttRaycaster.setFromCamera(this.tttPointer, camera.camera);
        this.tttRaycastHits.length = 0;
        this.tttRaycaster.intersectObjects(
            this.colliders,
            false,
            this.tttRaycastHits
        );
        const firstHit = this.tttRaycastHits[0];
        if (!firstHit) return;
        if (firstHit.object.name.includes('TTT_Board')) {
            this.getMultiplayer()?.emitTTTMark(firstHit.object.name);
        } else if (firstHit.object.name.includes('TTT_Start')) {
            this.getMultiplayer()?.emitTTTStart();
        }
    };

    private readonly onKeyDown = (event: KeyboardEvent): void => {
        const player = this.getPlayer();
        if (!player || this.isLocalPlayerDespawning()) return;
        const storyManager = this.getStoryManager();
        if (storyManager?.inCutscene) return;
        this.keyStates[event.code] = true;
        player.controls.key = this.keys;
        switch (event.code) {
            case 'ArrowUp':
            case 'KeyW':
                this.keys[0] = -1;
                break;
            case 'ArrowDown':
            case 'KeyS':
                this.keys[0] = 1;
                break;
            case 'ArrowLeft':
            case 'KeyA':
                this.keys[1] = -1;
                break;
            case 'ArrowRight':
            case 'KeyD':
                this.keys[1] = 1;
                break;
            case 'KeyP':
                if (import.meta.env.MODE !== 'production') {
                    this.posPrintDebug();
                }
                break;
        }
    };

    private readonly onKeyUp = (event: KeyboardEvent): void => {
        const player = this.getPlayer();
        if (!player || this.isLocalPlayerDespawning()) return;
        this.keyStates[event.code] = false;
        player.controls.key = this.keys;
        const storyManager = this.getStoryManager();
        if (storyManager?.inCutscene) {
            if (event.code === 'Escape') {
                storyManager.skipCameraAnimation = true;
            }
            return;
        }
        switch (event.code) {
            case 'ArrowUp':
            case 'KeyW':
                this.keys[0] = Math.max(this.keys[0], 0);
                break;
            case 'ArrowDown':
            case 'KeyS':
                this.keys[0] = Math.min(this.keys[0], 0);
                break;
            case 'ArrowLeft':
            case 'KeyA':
                this.keys[1] = Math.max(this.keys[1], 0);
                break;
            case 'ArrowRight':
            case 'KeyD':
                this.keys[1] = Math.min(this.keys[1], 0);
                break;
            case 'Escape':
                this.onPressEscape();
                break;
            case 'KeyB':
                this.onPressB();
                break;
            case 'KeyF':
                this.onPressF();
                break;
            case 'KeyZ':
            case 'KeyY':
                this.onPressAccept();
                break;
            case 'KeyX':
                this.onPressDecline();
                break;
            case 'Numpad1':
            case 'Digit1':
                this.chooseRPS(RPSChoice.Rock);
                break;
            case 'Numpad2':
            case 'Digit2':
                this.chooseRPS(RPSChoice.Paper);
                break;
            case 'Numpad3':
            case 'Digit3':
                this.chooseRPS(RPSChoice.Scissors);
                break;
            case 'KeyE':
                this.getInteractionManager()?.OnActivatePress(
                    player.group.position
                );
                break;
        }
    };

    /**
     * Log players current position to console.
     *
     * Keep, as it might be useful for further development.
     */
    private posPrintDebug(): void {
        const player = this.getPlayer();
        if (!player) return;

        console.log(
            'Player position: x=' +
                player.group.position.x.toFixed(2) +
                ', y=' +
                player.group.position.y.toFixed(2) +
                ', z=' +
                player.group.position.z.toFixed(2)
        );
    }
}
