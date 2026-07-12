import * as THREE from 'three';

import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

import {
    createPlayerAnimationActions,
    normalizePlayerAnimationState,
    transitionPlayerAnimation,
} from './player_animation.js';

export class Remote_Player {
    static gradientTexture = (() => {
        const texture = new THREE.TextureLoader().load(
            '/textures/gradientMaps/twoTone2.jpg'
        );
        texture.minFilter = THREE.NearestFilter;
        texture.magFilter = THREE.NearestFilter;
        return texture;
    })();

    constructor(path, id, scene, defaultAnim = 0, mesh_RP) {
        this.colAr = mesh_RP;

        this.scene = scene;
        this.id = id;
        this.model = null;
        this.group = new THREE.Group();
        this.state = 'Idle';
        this.stateCurrent = 'Idle';
        this.mixer = null;
        this.actions = null;

        this.isLoaded = false;
        this.startSpawn = false;
        this.isSpawned = false;

        this.battleRequested = false;

        this.loadEnemyCharacter(path, defaultAnim);
    }

    async animateSpawn(x, startY, z) {
        if (this.startSpawn) {
            return;
        }
        //console.log("Animating spawn " + this.id);
        this.startSpawn = true;

        let spawnY = 1.5 + startY;

        this.group.position.x = x;
        this.group.position.y = startY;
        this.group.position.z = z;

        let sv = 0;
        let av = 0;
        //console.log("Animating spawn...");
        const loop = () => {
            if (spawnY > 0.14) {
                if (!this.isLoaded || !this.model) {
                    requestAnimationFrame(loop);
                    return;
                }

                spawnY -= 0.14;
                this.group.position.y = spawnY;
                //console.log("spawnY: " + this.group.position.y.toFixed(4));
                if (sv < 1) sv += 0.07;
                av += 0.05;
                this.group.scale.set(sv, 1, sv);

                this.model.traverse((child) => {
                    if (child.isMesh) {
                        child.material.transparent = true;
                        child.material.opacity = av;
                    }
                });
                requestAnimationFrame(loop);
            } else {
                this.model.traverse((child) => {
                    if (child.isMesh) {
                        child.material.transparent = true;
                        child.material.opacity = 1;
                    }
                });
                this.group.position.y = startY;
                this.group.scale.set(1, 1, 1);
                this.isSpawned = true;
            }
        };
        loop();
    }

    async animateDeSpawn() {
        let sv = 1;
        let av = 1;
        const loop = () => {
            if (sv > 0) {
                if (!this.isLoaded || !this.model) {
                    requestAnimationFrame(loop);
                    return;
                }

                this.group.position.y += 0.1;
                sv -= 0.07;
                av -= 0.005;
                //console.log("group spawnY: " + this.group.position.y);
                this.group.scale.set(sv, 1, sv);
                this.model.traverse((child) => {
                    if (child.isMesh) {
                        child.material.transparent = true;
                        child.material.opacity = av;
                    }
                });
                requestAnimationFrame(loop);
            } else {
                //console.log("AAAAAAAAAAAAAAAAAAAAAAAAA " + sv);
                /*
                this.model.traverse((child) => {
                    if (child.isMesh) {
                        child.material.transparent = true;
                        child.material.opacity = 0;
                    }
                });
                this.group.scale.set(0, 1, 0); */

                if (this.mixer) this.mixer.stopAllAction();

                if (this.group) {
                    this.group.traverse((obj) => {
                        if (obj.isMesh) {
                            obj.geometry?.dispose();
                            if (obj.material) {
                                if (Array.isArray(obj.material)) {
                                    obj.material.forEach((m) => m.dispose());
                                } else {
                                    obj.material.dispose();
                                }
                            }
                        }
                    });
                }

                if (this.group) this.scene.remove(this.group);

                this.actions = {};
                this.mixer = null;
                this.model = null;
                this.group = null;
            }
        };
        loop();
    }

    loadEnemyCharacter(path, defaultAnim) {
        const loader = new GLTFLoader();
        //console.log("Enemy character loading...");

        loader.load(path, (gltf) => {
            this.model = gltf.scene;

            this.group.add(this.model);

            this.group.scale.set(0, 1, 0);

            //model.position.set(x, y, z);
            //model.rotation.y = rot;
            this.model.rotation.y = Math.PI;
            //this.colAr.push(this.model);
            this.model.traverse((object) => {
                if (object.isMesh) {
                    this.colAr.push(object);

                    object.castShadow = true;
                    object.receiveShadow = true;

                    if (object.material.name === 'Outline') {
                        object.material = new THREE.MeshBasicMaterial({
                            color: 0x000000,
                            transparent: true,
                            opacity: 0,
                        });
                        object.castShadow = false;
                        return;
                    } else {
                        object.material = new THREE.MeshToonMaterial({
                            color: object.material.color.clone(),
                            gradientMap: Remote_Player.gradientTexture,
                        });
                    }

                    /* object.material = new THREE.MeshToonMaterial({
                        color: object.material.color.clone(),
                        gradientMap: Remote_Player.gradientTexture,
                            transparent: true,
                            opacity: 0
                    }); */

                    /* object.material = new THREE.MeshToonMaterial({
                        color: 0xffffff,
                        gradientMap: Remote_Player.gradientTexture,
                            transparent: true,
                            opacity: 0
                    }); */
                }
            });

            const mixer = new THREE.AnimationMixer(this.model);
            // starts Idle as the active action after initialization
            try {
                const actions = createPlayerAnimationActions(
                    mixer,
                    gltf.animations,
                    path
                );

                this.mixer = mixer;
                this.actions = actions;
                this.state = normalizePlayerAnimationState(this.state);
                // Der erste Zustand und Updates während des Spawns werden verworfen
                this.stateCurrent = 'Idle';
                this.isLoaded = true;
            } catch (error) {
                console.error(
                    `Remote player animation initialization failed for "${path}":`,
                    error
                );
            }
        });
    }

    rotateCharacter(startPos, endPos) {
        const rotate = new THREE.Quaternion();
        const up = new THREE.Vector3(0, 1, 0);

        const dir = new THREE.Vector3();
        dir.subVectors(endPos, startPos).normalize();

        const angle = Math.atan2(dir.x, dir.z);
        rotate.setFromAxisAngle(up, angle);

        this.group.quaternion.copy(rotate);
    }

    /* rotateCharacter(dir){
        const angle = this.unwrapRad( Math.atan2( dir.x, dir.z ) );
        rotate.setFromAxisAngle( up, angle );

        this.group.quaternion.copy(rotate);
    } */

    updateAnimation(delta) {
        if (!this.isLoaded || !this.mixer || !this.actions) {
            return;
        }

        const fadeDuration = 0.3;
        const nextState = normalizePlayerAnimationState(this.state);
        this.state = nextState;

        // smooth start <-> stop animation
        if (this.stateCurrent !== nextState) {
            this.stateCurrent = transitionPlayerAnimation(
                this.actions,
                this.stateCurrent,
                nextState,
                fadeDuration
            );
        }

        this.mixer.update(delta);
    }

    removePlayer() {
        this.id = -1;
    }

    destroy() {
        // console.log("DESTROY");

        this.animateDeSpawn();

        /*         if(this.mixer)
            this.mixer.stopAllAction();

        if(this.group){
            this.group.traverse((obj) => {
                if (obj.isMesh) {
                    obj.geometry?.dispose();
                    if (obj.material) {
                        if (Array.isArray(obj.material)) {
                            obj.material.forEach(m => m.dispose());
                        } else {
                            obj.material.dispose();
                        }
                    }
                }
            });
        }

        if(this.group)
            this.scene.remove(this.group);

        this.actions = {};
        this.mixer = null;
        this.model = null;
        this.group = null; */
    }
}
