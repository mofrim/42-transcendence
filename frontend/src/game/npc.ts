import * as THREE from 'three';

import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/** ohne jump bisher */
type NPCAnimationActions = {
    Idle: THREE.AnimationAction;
    Run: THREE.AnimationAction;
};

export class NPC {
    static gradientTexture = (() => {
        const texture = new THREE.TextureLoader().load(
            '/textures/gradientMaps/twoTone2.jpg'
        );
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
        animation: string
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
        const loader = new GLTFLoader();
        //console.log("Enemy character loading...");

        loader.load(path, (gltf) => {
            this.model = gltf.scene;

            this.group.add(this.model);

            //model.position.set(x, y, z);
            //model.rotation.y = rot;

            this.model.traverse(function (object) {
                if (object instanceof THREE.Mesh) {
                    object.castShadow = true;
                    object.receiveShadow = true;

                    const material =
                        object.material as THREE.MeshStandardMaterial;

                    // console.log("Material name: ", material.name);

                    if (material.name === 'Outline') {
                        // console.log("OUTLINE MESH FOUND");
                        object.material = new THREE.MeshBasicMaterial({
                            color: 0x000000,
                        });
                        object.castShadow = false; // important: prevents shadow artifacts
                        return;
                    }
                    // console.log("Material NOT OUTLINE: ");
                    object.material = new THREE.MeshToonMaterial({
                        color: material.color.clone(),
                        gradientMap: NPC.gradientTexture,
                    });
                }
            });

            const mix = new THREE.AnimationMixer(this.model);

            const clip = gltf.animations.find(
                (clip) => clip.name === animation
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

    rotateCharacter(startPos: THREE.Vector3, endPos: THREE.Vector3): void {
        const rotate = new THREE.Quaternion();
        const up = new THREE.Vector3(0, 1, 0);

        const dir = new THREE.Vector3();
        dir.subVectors(endPos, startPos).normalize();

        const angle = Math.atan2(dir.x, dir.z);
        rotate.setFromAxisAngle(up, angle);

        this.group.quaternion.copy(rotate);
    }

    updateAnimation(delta: number): void {
        this.mixer?.update(delta);
    }
}
