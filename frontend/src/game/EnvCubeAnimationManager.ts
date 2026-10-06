import * as THREE from 'three';
import { EnvCubeAnimation } from './EnvCubeAnimation';

export class EnvCubeAnimationManager {
    private animations: EnvCubeAnimation[] = [];

    constructor(private scene: THREE.Scene) {
        this.addAnimation(new THREE.Vector3(45, -5, -25));
        this.addAnimation(new THREE.Vector3(50, -5, 15));
        this.addAnimation(new THREE.Vector3(-15, -5, -25));
        this.addAnimation(new THREE.Vector3(20, -5, 30));
        this.addAnimation(new THREE.Vector3(0, -5, 25));
        this.addAnimation(new THREE.Vector3(-20, -5, 10));
        this.addAnimation(new THREE.Vector3(55, -5, -5));
        this.addAnimation(new THREE.Vector3(42, -5, 25));
        this.addAnimation(new THREE.Vector3(-10, -5, -35));
        this.addAnimation(new THREE.Vector3(25, -5, -40));
        this.addAnimation(new THREE.Vector3(10, -5, -35));
        this.addAnimation(new THREE.Vector3(-20, -5, 25));
        this.addAnimation(new THREE.Vector3(50, -5, -30));
        this.addAnimation(new THREE.Vector3(5, -5, 30));
    }

    private addAnimation(startPosition: THREE.Vector3) {
        const animation = new EnvCubeAnimation(this.scene, startPosition, 5);

        this.animations.push(animation);
    }

    update(deltaTime: number) {
        for (const animation of this.animations) {
            animation.update(deltaTime);
        }
    }
}
