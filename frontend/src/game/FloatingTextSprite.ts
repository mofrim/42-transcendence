import * as THREE from 'three';

import { CanvasTextSprite } from './CanvasTextSprite';

export const CHAT_BUBBLE_HEIGHT = 1.85;

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
        worldOffset: THREE.Vector3 = new THREE.Vector3()
    ) {
        super(text, size);

        this.target = null;
        this.worldOffset = worldOffset.clone();
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

    setWorldOffset(x: number, y: number, z: number): void {
        this.worldOffset.set(x, y, z);
        this.updatePosition();
    }

    private updatePosition(): void {
        if (!this.target) return;

        this.target.getWorldPosition(this.position).add(this.worldOffset);
    }
}
