import * as THREE from 'three';

import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { NPCState } from 'ftr-common/sharedTypes';
import { IMG_GRADIENT } from './Assets.js';

/** ohne jump bisher */
type NPCAnimationActions = {
    Idle: THREE.AnimationAction;
    Run: THREE.AnimationAction;
};

const NPC_LOADER = new GLTFLoader();

export class NPC {
    static gradientTexture = (() => {
        const texture = new THREE.TextureLoader().load(IMG_GRADIENT);
        texture.minFilter = THREE.NearestFilter;
        texture.magFilter = THREE.NearestFilter;
        return texture;
    })();

    scene: THREE.Scene;
    id: number;
    model: THREE.Group | null;
    group: THREE.Group;
    mixer: THREE.AnimationMixer | null;
    actions: NPCAnimationActions | null;

    constructor(
        path: string,
        id: number,
        scene: THREE.Scene,
        animation: NPCState
    ) {
        this.scene = scene;
        this.id = id;
        this.model = null;
        this.group = new THREE.Group();
        this.mixer = null;
        this.actions = null;

        this.loadEnemyCharacter(path, animation);
    }

    loadEnemyCharacter(path: string, animation: string): void {
        //console.log("Enemy character loading...");

        NPC_LOADER.load(path, (gltf) => {
            this.model = gltf.scene;

            this.group.add(this.model);

            //model.position.set(x, y, z);
            //model.rotation.y = rot;

            const meshes = this.model.getObjectsByProperty(
                'isMesh',
                true
            ) as THREE.Mesh[];
            for (const object of meshes) {
                object.castShadow = true;
                object.receiveShadow = true;

                const material = object.material as THREE.MeshStandardMaterial;

                // console.log("Material name: ", material.name);

                if (material.name === 'Outline') {
                    // console.log("OUTLINE MESH FOUND");
                    object.material = new THREE.MeshBasicMaterial({
                        color: 0x000000,
                    });
                    object.castShadow = false; // important: prevents shadow artifacts
                    continue;
                }
                // console.log("Material NOT OUTLINE: ");
                object.material = new THREE.MeshToonMaterial({
                    color: material.color,
                    gradientMap: NPC.gradientTexture,
                });
            }

            const mix = new THREE.AnimationMixer(this.model);

            /* for (const clip of gltf.animations) {
                console.log("NPC has animation:", clip.name);
            } */

            const clip = THREE.AnimationClip.findByName(
                gltf.animations,
                animation
            );

            if (!clip) {
                console.warn(`NPC Animation "${animation}" not found`);
                return;
            }

            const action = mix.clipAction(clip);

            action.play();

            const random = THREE.MathUtils.randFloat(0.8, 1.2);

            action.setEffectiveTimeScale(random);
            action.setEffectiveWeight(1);

            this.mixer = mix;
        });
    }

    updateAnimation(delta: number): void {
        this.mixer?.update(delta);
    }
}
