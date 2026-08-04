import * as THREE from 'three';

const DESPAWN_HEIGHT_STEP = 0.1;
const DESPAWN_SCALE_STEP = 0.07;
const DESPAWN_OPACITY_STEP = 0.005;

function getMaterials(mesh: THREE.Mesh): THREE.Material[] {
    return Array.isArray(mesh.material) ? mesh.material : [mesh.material];
}

function setModelOpacity(model: THREE.Object3D, opacity: number): void {
    model.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) {
            return;
        }

        for (const material of getMaterials(child)) {
            material.transparent = true;
            material.opacity = opacity;
        }
    });
}

function animatePlayerDespawn(
    group: THREE.Group,
    getModel: () => THREE.Object3D | null,
    isLoaded: () => boolean
): Promise<void> {
    return new Promise((resolve) => {
        let scale = 1;
        let opacity = 1;

        const loop = (): void => {
            const model = getModel();
            if (!isLoaded() || !model) {
                requestAnimationFrame(loop);
                return;
            }

            if (scale <= 0) {
                resolve();
                return;
            }

            group.position.y += DESPAWN_HEIGHT_STEP;
            scale = Math.max(0, scale - DESPAWN_SCALE_STEP);
            opacity = Math.max(0, opacity - DESPAWN_OPACITY_STEP);
            group.scale.set(scale, 1, scale);
            setModelOpacity(model, opacity);
            requestAnimationFrame(loop);
        };

        loop();
    });
}

function disposePlayerVisuals(group: THREE.Group): void {
    group.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) {
            return;
        }

        object.geometry?.dispose();
        for (const material of getMaterials(object)) {
            material.dispose();
        }
    });

    group.removeFromParent();
}

/** Runs the shared leave animation and releases the player's Three.js resources. */
export async function despawnPlayerVisuals(
    group: THREE.Group,
    getModel: () => THREE.Object3D | null,
    isLoaded: () => boolean,
    mixer: THREE.AnimationMixer | null
): Promise<void> {
    await animatePlayerDespawn(group, getModel, isLoaded);
    mixer?.stopAllAction();
    disposePlayerVisuals(group);
}
