import * as THREE from 'three';

import { CanvasTextSprite } from './CanvasTextSprite';

export const CHAT_BUBBLE_HEIGHT = 1.85;
export const CHAT_BUBBLE_PREFIX = '🗨️ ';
export const CHAT_BUBBLE_SCALE = 0.42;
export const CHAT_BUBBLE_SIZE = 42;

/**
 * World-space canvas text that follows a Three.js object with a fixed offset.
 * Text an einem 3D-Objekt as a Sprite, the text automatically faces the active camera.
 */
export class FloatingTextSprite extends CanvasTextSprite {
    private target: THREE.Object3D | null;
    private readonly worldOffset: THREE.Vector3;

    constructor(
        text: string,
        size: number,
        worldOffset: THREE.Vector3Like = new THREE.Vector3()
    ) {
        super(text, size);

        this.target = null;
        this.worldOffset = new THREE.Vector3().copy(worldOffset);
        this.visible = false;

        this.onBeforeRender = (): void => {
            this.updatePosition();
        };
    }

    follow(target: THREE.Object3D): void {
        this.target = target;
        this.visible = true;
        this.updatePosition();
    }

    hide(): void {
        this.target = null;
        this.visible = false;
    }

    setWorldOffset(worldOffset: THREE.Vector3Like): void {
        this.worldOffset.copy(worldOffset);
        this.updatePosition();
    }

    private updatePosition(): void {
        if (!this.target) return;

        this.target.getWorldPosition(this.position).add(this.worldOffset);
    }
}
