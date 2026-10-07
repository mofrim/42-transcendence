import * as THREE from 'three';

export { formatQuestCountdown } from './BlackHoleTimeout.js';

export function addBlackhole(scene: THREE.Scene): void {
    const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(8, 32, 32),
        new THREE.MeshBasicMaterial({ color: 0x000000 })
    );

    const outerSphere = new THREE.Mesh(
        new THREE.SphereGeometry(8.25, 32, 32),
        new THREE.MeshStandardMaterial({
            color: 0xffffff,
            emissive: 0xffffff,
            emissiveIntensity: 5,
            side: THREE.BackSide,
        })
    );

    sphere.position.set(16, 25, -5);
    outerSphere.position.copy(sphere.position);

    scene.add(sphere, outerSphere);
}
