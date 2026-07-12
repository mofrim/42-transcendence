import * as THREE from 'three';

import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

import {
    createPlayerAnimationActions,
    normalizePlayerAnimationState,
    transitionPlayerAnimation,
} from './player_animation.js';
import type { PlayerState } from './sharedTypes.ts';

type PlayerAnimationState = ReturnType<typeof normalizePlayerAnimationState>;
type RemotePlayerState = PlayerState | PlayerAnimationState;
type PlayerAnimationActions = Record<
    PlayerAnimationState,
    THREE.AnimationAction
>;

function isMesh(object: THREE.Object3D): object is THREE.Mesh {
    return (object as THREE.Mesh).isMesh === true;
}

function getMaterials(mesh: THREE.Mesh): THREE.Material[] {
    return Array.isArray(mesh.material) ? mesh.material : [mesh.material];
}

function getMaterialColor(material: THREE.Material): THREE.Color {
    const color = (material as THREE.Material & { color?: unknown }).color;
    return color instanceof THREE.Color
        ? color.clone()
        : new THREE.Color(0xffffff);
}

const RemotePlayerImplementation = class Remote_Player {
    static gradientTexture: THREE.Texture = (() => {
        const texture = new THREE.TextureLoader().load(
            '/textures/gradientMaps/twoTone2.jpg'
        );
        texture.minFilter = THREE.NearestFilter;
        texture.magFilter = THREE.NearestFilter;
        return texture;
    })();

    private colAr: THREE.Mesh[];
    scene: THREE.Scene;
    id: string | -1;
    model: THREE.Group | null;
    group: THREE.Group;
    state: RemotePlayerState;
    stateCurrent: PlayerAnimationState;
    mixer: THREE.AnimationMixer | null;
    actions: Partial<PlayerAnimationActions> | null;
    isLoaded: boolean;
    startSpawn: boolean;
    isSpawned: boolean;
    battleRequested: boolean;

    constructor(
        path: string,
        id: string,
        scene: THREE.Scene,
        _defaultAnim: number,
        mesh_RP: THREE.Mesh | THREE.Mesh[]
    ) {
        this.colAr = mesh_RP as unknown as THREE.Mesh[];

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

        this.loadEnemyCharacter(path);
    }

    async animateSpawn(x: number, startY: number, z: number): Promise<void> {
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
        const loop = (): void => {
            if (spawnY > 0.14) {
                const model = this.model;
                if (!this.isLoaded || !model) {
                    requestAnimationFrame(loop);
                    return;
                }

                spawnY -= 0.14;
                this.group.position.y = spawnY;
                //console.log("spawnY: " + this.group.position.y.toFixed(4));
                if (sv < 1) sv += 0.07;
                av += 0.05;
                this.group.scale.set(sv, 1, sv);

                model.traverse((child: THREE.Object3D) => {
                    if (isMesh(child)) {
                        getMaterials(child).forEach((material) => {
                            material.transparent = true;
                            material.opacity = av;
                        });
                    }
                });
                requestAnimationFrame(loop);
            } else {
                this.model!.traverse((child: THREE.Object3D) => {
                    if (isMesh(child)) {
                        getMaterials(child).forEach((material) => {
                            material.transparent = true;
                            material.opacity = 1;
                        });
                    }
                });
                this.group.position.y = startY;
                this.group.scale.set(1, 1, 1);
                this.isSpawned = true;
            }
        };
        loop();
    }

    async animateDeSpawn(): Promise<void> {
        let sv = 1;
        let av = 1;
        const loop = (): void => {
            if (sv > 0) {
                const model = this.model;
                if (!this.isLoaded || !model) {
                    requestAnimationFrame(loop);
                    return;
                }

                this.group.position.y += 0.1;
                sv -= 0.07;
                av -= 0.005;
                //console.log("group spawnY: " + this.group.position.y);
                this.group.scale.set(sv, 1, sv);
                model.traverse((child: THREE.Object3D) => {
                    if (isMesh(child)) {
                        getMaterials(child).forEach((material) => {
                            material.transparent = true;
                            material.opacity = av;
                        });
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
                    this.group.traverse((obj: THREE.Object3D) => {
                        if (isMesh(obj)) {
                            obj.geometry?.dispose();
                            getMaterials(obj).forEach((material) =>
                                material.dispose()
                            );
                        }
                    });
                }

                if (this.group) this.scene.remove(this.group);

                this.actions = {};
                this.mixer = null;
                this.model = null;
            }
        };
        loop();
    }

    loadEnemyCharacter(path: string): void {
        const loader = new GLTFLoader();
        //console.log("Enemy character loading...");

        loader.load(path, (gltf) => {
            const model = gltf.scene;
            this.model = model;

            this.group.add(model);

            this.group.scale.set(0, 1, 0);

            //model.position.set(x, y, z);
            //model.rotation.y = rot;
            model.rotation.y = Math.PI;
            //this.colAr.push(this.model);
            model.traverse((object: THREE.Object3D) => {
                if (isMesh(object)) {
                    this.colAr.push(object);

                    object.castShadow = true;
                    object.receiveShadow = true;

                    const sourceMaterial = object.material;
                    const materials = getMaterials(object).map((material) => {
                        if (material.name === 'Outline') {
                            object.castShadow = false;
                            return new THREE.MeshBasicMaterial({
                                color: 0x000000,
                                transparent: true,
                                opacity: 0,
                            });
                        }

                        return new THREE.MeshToonMaterial({
                            color: getMaterialColor(material),
                            gradientMap: Remote_Player.gradientTexture,
                        });
                    });

                    object.material = Array.isArray(sourceMaterial)
                        ? materials
                        : materials[0];

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

            const mixer = new THREE.AnimationMixer(model);
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

    rotateCharacter(startPos: THREE.Vector3, endPos: THREE.Vector3): void {
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

    updateAnimation(delta: number): void {
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

    removePlayer(): void {
        this.id = -1;
    }

    destroy(): void {
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
};

type RemotePlayerInstance = InstanceType<typeof RemotePlayerImplementation>;

interface RemotePlayerConstructor {
    readonly gradientTexture: THREE.Texture;
    new (
        path: string,
        id: string,
        scene: THREE.Scene,
        defaultAnim: number,
        mesh_RP: THREE.Mesh | THREE.Mesh[]
    ): RemotePlayerInstance & { id: string };
}

export type Remote_Player = RemotePlayerInstance;
export const Remote_Player =
    RemotePlayerImplementation as RemotePlayerConstructor;
