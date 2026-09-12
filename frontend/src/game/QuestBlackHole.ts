import * as THREE from 'three';

const COUNTDOWN_FORMAT = new Intl.DurationFormat('en', {
    style: 'digital',
    hoursDisplay: 'auto',
    minutes: '2-digit',
    seconds: '2-digit',
});

/** blackhole timer */
export function formatQuestCountdown(totalSeconds: number): string {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return COUNTDOWN_FORMAT.format({ minutes, seconds });
}

export function addBlackhole(scene: THREE.Scene): void {
    /* const blackholeTex = textureLoader.load('textures/Blackhole.png');
    const material = new THREE.MeshBasicMaterial({
        map: blackholeTex,
        transparent: true,
    });
    const geometry = new THREE.PlaneGeometry(40, 40);
    const plane = new THREE.Mesh(geometry, material);
    plane.rotation.x = Math.PI / 2.3;
    plane.position.set(16, 20, -5);
    scene.add(plane); */

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
