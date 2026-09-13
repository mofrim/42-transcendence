import * as THREE from 'three';

import { getPlayerImagePath, IMG_DRAW, IMG_VS, IMG_VS_BEAM } from './Assets.js';
import { AnimationFrameSlot } from './AnimationFrameSlot';
import { CanvasTextSprite } from './CanvasTextSprite';
import type { ResourceDisposer } from './ResourceDisposer';

const OVERLAY_TEXT_SCALE = 0.2;
const OVERLAY_SIZE = new THREE.Vector2();
const OVERLAY_TEXTURE_LOADER = new THREE.TextureLoader();
export const MINIGAME_OVERLAY_Y = 0.025;
export const MINIGAME_ANIMATION_EDGE = 0.75;
export const MINIGAME_RESULT_ANIMATION_STEP = 0.003;

export function animateMinigamePlayersApart(
    getUserASprite: () => THREE.Sprite,
    getUserBSprite: () => THREE.Sprite,
    animationStep: number,
    userADirection: -1 | 1,
    animationFrameSlot: AnimationFrameSlot,
    onComplete: () => void
): void {
    const userAStep = animationStep * userADirection;
    const userBStep = -userAStep;

    const loop = () => {
        const userASprite = getUserASprite();
        const userBSprite = getUserBSprite();
        const posA = userASprite.position.x;
        const posB = userBSprite.position.x;

        userASprite.position.set(posA + userAStep, MINIGAME_OVERLAY_Y, 0);
        userBSprite.position.set(posB + userBStep, MINIGAME_OVERLAY_Y, 0);

        if (
            userADirection * posA < MINIGAME_ANIMATION_EDGE &&
            userADirection * posB > -MINIGAME_ANIMATION_EDGE
        ) {
            animationFrameSlot.request(loop);
        } else {
            onComplete();
        }
    };
    loop();
}

export function animateMinigameSpriteRight(
    getSprite: () => THREE.Sprite,
    animationStep: number,
    stopX: number,
    animationFrameSlot: AnimationFrameSlot,
    onComplete: () => void,
    onStep?: () => void
): void {
    const loop = () => {
        const sprite = getSprite();
        const posX = sprite.position.x;

        sprite.position.set(posX + animationStep, MINIGAME_OVERLAY_Y, 0);
        if (onStep) {
            onStep();
        }

        if (posX < stopX) {
            animationFrameSlot.request(loop);
        } else {
            onComplete();
        }
    };
    loop();
}

export function createOverlaySprite(
    path: string,
    width: number,
    height: number
): THREE.Sprite {
    const texture = OVERLAY_TEXTURE_LOADER.load(path);
    const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthTest: false,
        depthWrite: false,
    });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(width, height, 1);
    return sprite;
}

/** same VS Gamestart Overlay for both minigames TTT + RPS */
export function createMinigameOverlay(): Map<string, THREE.Sprite> {
    const beam = createOverlaySprite(IMG_VS_BEAM, 10, 0.5);
    beam.position.set(0, -0.25, 0);

    return new Map<string, THREE.Sprite>([
        ['Beam', beam],
        ['VS', createOverlaySprite(IMG_VS, 0.5, 0.5)],
        ['Draw', createOverlaySprite(IMG_DRAW, 0.5, 0.5)],
    ]);
}

/** Match minigame user sprites with the selected characters. */
export function setPlayerOverlay(
    sprites: Map<string, THREE.Sprite>,
    playerCharacter: boolean,
    opponentCharacter: boolean,
    resourceDisposer: ResourceDisposer
): void {
    const players = [
        ['UserA', playerCharacter],
        ['UserB', opponentCharacter],
    ] as const;

    for (const [key, character] of players) {
        resourceDisposer.disposeObject3D(sprites.get(key));
        sprites.set(
            key,
            createOverlaySprite(getPlayerImagePath(character), 1, 1)
        );
    }
}

export function resizeOverlay(
    camera: THREE.OrthographicCamera,
    renderer: THREE.WebGLRenderer
): void {
    renderer.getSize(OVERLAY_SIZE);
    if (OVERLAY_SIZE.y <= 0) {
        return;
    }

    const aspect = OVERLAY_SIZE.x / OVERLAY_SIZE.y;
    if (
        camera.left === -aspect &&
        camera.right === aspect &&
        camera.top === 1 &&
        camera.bottom === -1
    ) {
        return;
    }

    camera.left = -aspect;
    camera.right = aspect;
    camera.top = 1;
    camera.bottom = -1;
    camera.updateProjectionMatrix();
}

export function clearOverlayText(textSprites: CanvasTextSprite[]): void {
    for (const textSprite of textSprites) {
        textSprite.removeFromParent();
        textSprite.dispose();
    }

    textSprites.length = 0;
}

export function addOverlayText(
    scene: THREE.Scene,
    textSprites: CanvasTextSprite[],
    text: string,
    x: number,
    y: number,
    size: number
): void {
    const textSprite = new CanvasTextSprite(text, size);
    textSprite.scale.multiplyScalar(OVERLAY_TEXT_SCALE).setZ(1);
    textSprite.position.set(x, y, 0);

    textSprites.push(textSprite);
    scene.add(textSprite);
}

export abstract class MinigameOverlay {
    currentTextState!: CanvasTextSprite[];
    overlayScene!: THREE.Scene;
    overlayCamera!: THREE.OrthographicCamera;
    renderer!: THREE.WebGLRenderer;

    protected abstract disposed: boolean;

    protected initializeOverlay(renderer: THREE.WebGLRenderer): void {
        this.currentTextState = [];
        this.overlayScene = new THREE.Scene();
        this.overlayCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        this.renderer = renderer;
    }

    protected renderOverlay(): void {
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
}

export function disposeOverlaySprites(
    sprites: Map<string, THREE.Sprite>,
    resourceDisposer: ResourceDisposer
): void {
    resourceDisposer.disposeObject3D([...sprites.values()]);
    sprites.clear();
}
