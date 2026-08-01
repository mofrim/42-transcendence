import * as THREE from 'three';

const TEXT_SPRITE_WIDTH = 2048;
const TEXT_SPRITE_HEIGHT = 256;
const TEXT_LINE_HEIGHT_FACTOR = 1.2;

/**
 * Three.js sprite backed by a canvas texture.
 * Supports updating multiline text without duplicating canvas drawing logic.
 */
export class CanvasTextSprite extends THREE.Sprite {
    private readonly canvas: HTMLCanvasElement;
    private readonly context: CanvasRenderingContext2D;

    constructor(text: string, size: number) {
        const canvas = document.createElement('canvas');
        canvas.width = TEXT_SPRITE_WIDTH;
        canvas.height = TEXT_SPRITE_HEIGHT;

        const context = canvas.getContext('2d');
        if (!context) {
            throw new Error('Failed to get 2D canvas context');
        }

        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            depthWrite: false,
        });

        super(material);

        this.canvas = canvas;
        this.context = context;

        this.context.fillStyle = 'white';
        this.context.textAlign = 'center';
        this.context.textBaseline = 'middle';
        this.context.lineWidth = 8;
        this.context.strokeStyle = 'black';

        this.scale.set(this.canvas.width / this.canvas.height, 1, 1);
        this.setText(text, size);
    }

    setText(text: string, size: number): void {
        this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.context.font = `${size}px Segoe UI Black`;

        const lines = text.split('\n');
        const lineHeight = size * TEXT_LINE_HEIGHT_FACTOR;
        const firstLineY =
            this.canvas.height / 2 - ((lines.length - 1) * lineHeight) / 2;

        lines.forEach((line, index) => {
            const y = firstLineY + index * lineHeight;
            this.context.strokeText(line, this.canvas.width / 2, y);
            this.context.fillText(line, this.canvas.width / 2, y);
        });

        const texture = this.material.map;
        if (texture) {
            texture.needsUpdate = true;
        }
    }

    dispose(): void {
        this.material.map?.dispose();
        this.material.dispose();
    }
}
