import * as THREE from 'three';

import { CanvasTextSprite } from './CanvasTextSprite';
import type { ThreeResourceDisposer } from './ThreeResourceDisposer';

const OVERLAY_TEXT_SCALE = 0.2;
const OVERLAY_SIZE = new THREE.Vector2();

export function createOverlaySprite(
    path: string,
    width: number,
    height: number
): THREE.Sprite {
    const texture = new THREE.TextureLoader().load(path);
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
    textSprite.scale.multiplyScalar(OVERLAY_TEXT_SCALE);
    textSprite.scale.z = 1;
    textSprite.position.set(x, y, 0);

    textSprites.push(textSprite);
    scene.add(textSprite);
}

export function disposeOverlaySprites(
    sprites: Map<string, THREE.Sprite>,
    resourceDisposer: ThreeResourceDisposer
): void {
    for (const sprite of sprites.values()) {
        resourceDisposer.disposeObject3D(sprite);
    }
    sprites.clear();
}
