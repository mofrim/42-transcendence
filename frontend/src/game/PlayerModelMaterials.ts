import * as THREE from 'three';

import {
    createThreeResourceDisposer,
    type ThreeResourceDisposer,
} from './ThreeResourceDisposer';

const PLAYER_GRADIENT_TEXTURE = (() => {
    const texture = new THREE.TextureLoader().load(
        '/textures/gradientMaps/twoTone2.jpg'
    );
    texture.minFilter = THREE.NearestFilter;
    texture.magFilter = THREE.NearestFilter;
    return texture;
})();

export function getPlayerMaterials(
    material: THREE.Material | THREE.Material[]
): THREE.Material[] {
    if (Array.isArray(material)) {
        return material;
    }

    return [material];
}

export function createPlayerResourceDisposer(
    onError?: (error: unknown) => void
): ThreeResourceDisposer {
    const options = {
        shouldDisposeTexture: (texture: THREE.Texture) => {
            return texture !== PLAYER_GRADIENT_TEXTURE;
        },
        shouldCloseImageBitmap: () => true,
    };

    if (onError) {
        return createThreeResourceDisposer({ ...options, onError });
    }

    return createThreeResourceDisposer(options);
}

function createPlayerMaterial(
    source: THREE.Material,
    mesh: THREE.Mesh
): THREE.Material {
    if (source.name === 'Outline') {
        //console.log("OUTLINE MESH FOUND");
        mesh.castShadow = false; // important: prevents shadow artifacts
        return new THREE.MeshBasicMaterial({
            color: 0x000000,
            transparent: true,
            opacity: 1,
        });
    }

    const sourceColor = (source as THREE.Material & { color?: THREE.Color })
        .color;
    let color: THREE.Color | number = 0xffffff;
    if (sourceColor instanceof THREE.Color) {
        color = sourceColor;
    }

    return new THREE.MeshToonMaterial({
        color,
        gradientMap: PLAYER_GRADIENT_TEXTURE,
    });
}

export function replacePlayerModelMaterials(
    model: THREE.Object3D,
    resourceDisposer: ThreeResourceDisposer
): THREE.Mesh[] {
    const originals = new Set<THREE.Material>();
    const replacements = new Set<THREE.Material>();
    const meshes = model.getObjectsByProperty('isMesh', true) as THREE.Mesh[];

    try {
        for (const object of meshes) {
            object.castShadow = true;
            object.receiveShadow = true;

            const source = object.material;
            const sourceMaterials = getPlayerMaterials(source);

            const replacementMaterials = sourceMaterials.map((material) => {
                originals.add(material);
                const replacement = createPlayerMaterial(material, object);
                replacements.add(replacement);
                return replacement;
            });

            if (Array.isArray(source)) {
                object.material = replacementMaterials;
            } else {
                const replacement = replacementMaterials[0];
                if (replacement === undefined) {
                    throw new Error('Missing player replacement material.');
                }
                object.material = replacement;
            }
        }
    } catch (error: unknown) {
        resourceDisposer.disposeMaterial([...replacements]);
        throw error;
    } finally {
        resourceDisposer.disposeMaterial([...originals]);
    }

    return meshes;
}
