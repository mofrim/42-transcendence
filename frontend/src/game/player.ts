import * as THREE from 'three';

import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Capsule } from 'three/addons/math/Capsule.js';
import type { Octree } from 'three/addons/math/Octree.js';

import {
    createPlayerAnimationActions,
    transitionPlayerAnimation,
} from './player_animation.js';
import { FloatingTextSprite } from './FloatingTextSprite.js';

type PlayerAnimationState = ReturnType<typeof transitionPlayerAnimation>;

const WORLD_UP = new THREE.Vector3(0, 1, 0);
const PLAYER_FORWARD = new THREE.Vector3(0, 0, 1);
const COLLISION_STEP_RADIUS_FACTOR = 0.5;
const PLAYER_CHAT_SIZE = 42;
const PLAYER_CHAT_HEIGHT = 2.15;
const PLAYER_CHAT_SCALE = 0.28;
const PLAYER_CHAT_DURATION_MS = 5_000; // ms also 5 Sekunden

export class Player {
    static gradientTexture = (() => {
        const texture = new THREE.TextureLoader().load(
            '/textures/gradientMaps/twoTone2.jpg'
        );
        texture.minFilter = THREE.NearestFilter;
        texture.magFilter = THREE.NearestFilter;
        return texture;
    })();

    static colRad: number = 0.35;
    static colStartY: number = 0.35;
    static colEndY: number = 1;
    static offset: number = 0;

    /** ugly random Socket ID strings */
    id: string | undefined;
    model: THREE.Group | null;
    group: THREE.Group;
    private readonly chatBubble: FloatingTextSprite;
    private chatBubbleTimeout: ReturnType<typeof setTimeout> | null;
    /** running idle? */
    stateCurrent: PlayerAnimationState;
    mixer: THREE.AnimationMixer | null;
    actions: ReturnType<typeof createPlayerAnimationActions> | null;
    worldOctree: Octree;
    playerVelocity: THREE.Vector3;
    playerDirection: THREE.Vector3;
    playerOnFloor: boolean;
    GRAVITY: number;
    spawnY: number;
    isLoaded: boolean;
    isSpawned: boolean;
    battleRequested: boolean;
    inRPSBattleMode: boolean;
    youSendRPGRequest: boolean;
    playerCollider: Capsule;
    controls: {
        key: [number, number];
        rotate: THREE.Quaternion;
        current: PlayerAnimationState;
        fadeDuration: number;
        runVelocity: number;
        turnSmoothness: number;
    };

    constructor(
        path: string,
        id: string | undefined,
        scene: THREE.Scene,
        worldOctree: Octree
    ) {
        // we never want this to happen so this would be an exceptional error.
        // we might even throw here...
        if (id === undefined)
            console.warn('Player ctor called with undefined socket.id');
        this.id = id;

        this.model = null;
        this.group = new THREE.Group();
        this.chatBubble = new FloatingTextSprite(
            '',
            PLAYER_CHAT_SIZE,
            new THREE.Vector3(0, PLAYER_CHAT_HEIGHT, 0)
        );
        this.chatBubble.scale.multiplyScalar(PLAYER_CHAT_SCALE);
        this.chatBubbleTimeout = null;
        this.stateCurrent = 'Idle';
        this.mixer = null;
        this.actions = null;

        scene.add(this.group, this.chatBubble);
        this.worldOctree = worldOctree;
        this.playerVelocity = new THREE.Vector3();
        this.playerDirection = new THREE.Vector3();
        this.playerOnFloor = false;

        this.GRAVITY = 30;

        this.spawnY = 1.5;
        this.isLoaded = false;
        this.isSpawned = false;

        this.battleRequested = false;
        this.inRPSBattleMode = false;
        this.youSendRPGRequest = false;

        this.playerCollider = new Capsule(
            new THREE.Vector3(14.2, Player.colStartY, -9.2),
            new THREE.Vector3(14.2, Player.colEndY, -9.2),
            Player.colRad
        );

        Player.offset = (Player.colEndY - Player.colStartY) / 2 + Player.colRad;
        // apply lift
        //this.playerCollider.translate(new THREE.Vector3(0, Player.offset, 0));

        this.controls = {
            key: [0, 0],
            rotate: new THREE.Quaternion(),
            current: 'Idle',
            fadeDuration: 0.5,
            runVelocity: 15,
            turnSmoothness: 4.0,
        };

        // start with scale 0 for spawn animation
        //this.group.scale.set(0, 1, 0);

        this.loadModel(path);

        this.animateSpawn();
    }

    /** print player chat bubble */
    showChatMessage(message: string): void {
        const trimmedMessage = message.trim();
        if (!trimmedMessage) return;

        this.chatBubble.setText(`🗨️ ${trimmedMessage}`, PLAYER_CHAT_SIZE);
        this.chatBubble.follow(this.group);

        if (this.chatBubbleTimeout !== null) {
            clearTimeout(this.chatBubbleTimeout);
        }

        this.chatBubbleTimeout = setTimeout(() => {
            this.chatBubble.hide();
            this.chatBubbleTimeout = null;
        }, PLAYER_CHAT_DURATION_MS);
    }

    animateSpawn() {
        let sv = 0;
        let av = 0;
        const loop = () => {
            if (this.spawnY > 0) {
                if (!this.isLoaded || !this.model) {
                    requestAnimationFrame(loop);
                    return;
                }

                //if(sv > 0.2)
                this.spawnY -= 0.1;
                //if(sv < 0.9)
                sv += 0.07;
                av += 0.005;
                //else
                //    sv = 1;
                this.group.scale.set(sv, 1, sv);
                this.model.traverse((child) => {
                    if (child instanceof THREE.Mesh) {
                        const material = child.material as THREE.Material;
                        material.transparent = true;
                        material.opacity = av;
                    }
                });
                requestAnimationFrame(loop);
            } else {
                this.spawnY = 0;
                this.model!.traverse((child) => {
                    if (child instanceof THREE.Mesh) {
                        const material = child.material as THREE.Material;
                        material.transparent = true;
                        material.opacity = 1;
                    }
                });
                this.group.scale.setScalar(1);
                this.isSpawned = true;
            }
        };
        loop();
    }

    static loader = new GLTFLoader();

    loadModel(path: string) {
        //const loader = new GLTFLoader();
        Player.loader.load(path, (gltf) => {
            this.model = gltf.scene;

            this.group.add(this.model);
            //this.model.rotation.y = Math.PI;
            this.group.rotation.y = Math.PI;

            this.model.traverse(function (object) {
                if (object instanceof THREE.Mesh) {
                    object.castShadow = true;
                    object.receiveShadow = true;
                    const material =
                        object.material as THREE.MeshStandardMaterial;

                    if (material.name === 'Outline') {
                        //console.log("OUTLINE MESH FOUND");
                        object.material = new THREE.MeshBasicMaterial({
                            color: 0x000000,
                            transparent: true,
                            opacity: 0,
                        });
                        object.castShadow = false; // important: prevents shadow artifacts
                        return;
                    }

                    object.material = new THREE.MeshToonMaterial({
                        color: material.color.clone(),
                        gradientMap: Player.gradientTexture,
                    });

                    /* object.material = new THREE.MeshToonMaterial({
                            color: 0xffffff,
                            gradientMap: Player.gradientTexture,
                            transparent: true,
                            opacity: 0
                        }); */
                }
            });

            const mixer = new THREE.AnimationMixer(this.model);

            try {
                const actions = createPlayerAnimationActions(
                    mixer,
                    gltf.animations,
                    path
                );

                this.mixer = mixer;
                this.actions = actions;
                this.isLoaded = true;
            } catch (error) {
                console.error(
                    `Player animation initialization failed for "${path}":`,
                    error
                );
            }
        });
    }

    getForwardVector(camera: THREE.Camera) {
        return camera
            .getWorldDirection(this.playerDirection)
            .projectOnPlane(WORLD_UP)
            .normalize();
    }

    getSideVector(camera: THREE.Camera) {
        return this.getForwardVector(camera).cross(camera.up);
    }

    playerCollisions() {
        const result = this.worldOctree.capsuleIntersect(this.playerCollider);
        this.playerOnFloor = false;
        if (result) {
            // determine if the surface we bumped into is something we can stand on
            this.playerOnFloor = result.normal.y >= 0.15; // allow slopes up to ~81° but ignore sheer vertical walls
            if (!this.playerOnFloor) {
                //console.log("WALL COLLISION");
                this.playerVelocity.addScaledVector(
                    result.normal,
                    -result.normal.dot(this.playerVelocity)
                );
            }
            if (result.depth >= 1e-10) {
                //console.log("FLOOR COLLISION " + result.depth);
                this.playerCollider.translate(
                    result.normal.multiplyScalar(result.depth)
                );
            }
        }
    }

    updateCharacter(delta: number) {
        const fade = this.controls.fadeDuration;
        const key = this.controls.key;
        const rotate = this.controls.rotate;
        const active = key[0] !== 0 || key[1] !== 0;
        const play = active ? 'Run' : 'Idle';
        // Zustandsübergänge können den Renderloop abbrechen
        this.controls.current = play;

        // change animation
        if (this.actions !== null && this.stateCurrent !== play) {
            this.stateCurrent = transitionPlayerAnimation(
                this.actions,
                this.stateCurrent,
                play,
                fade
            );
        }

        let damping = Math.exp(-4 * delta) - 1;
        if (!this.playerOnFloor) {
            this.playerVelocity.y -= this.GRAVITY * delta;
            // small air resistance
            damping *= 0.01;
        }
        this.playerVelocity.addScaledVector(this.playerVelocity, damping);
        const deltaPosition = this.playerVelocity.clone().multiplyScalar(delta);
        /** Mehrstufige Treppe */
        const maxCollisionStep =
            this.playerCollider.radius * COLLISION_STEP_RADIUS_FACTOR;
        const collisionSteps = Math.max(
            1,
            Math.ceil(deltaPosition.length() / maxCollisionStep)
        );
        const collisionStep = deltaPosition
            .clone()
            .divideScalar(collisionSteps);

        for (let step = 0; step < collisionSteps; step += 1) {
            this.playerCollider.translate(collisionStep);
            this.playerCollisions();
        }

        // Ersetzt manuelle Capsuleberechnung zuvor lowestY
        this.playerCollider.getCenter(this.group.position);
        this.group.position.y -= Player.offset;

        if (this.group.position.y < -0.01) {
            this.group.position.setY(0);
            this.playerCollider.start.set(
                this.group.position.x,
                this.group.position.y + Player.colStartY,
                this.group.position.z
            );
            this.playerCollider.end.set(
                this.group.position.x,
                this.group.position.y + Player.colEndY,
                this.group.position.z
            );
            this.playerVelocity.set(0, 0, 0);
        }
        if (this.controls.current === 'Idle') {
            this.playerVelocity.set(0, this.playerVelocity.y, 0);
        }

        // value just for spawn animation
        this.group.position.y += this.spawnY;

        // move object
        if (this.controls.current !== 'Idle') {
            /*             let damping = Math.exp( - 4 * delta ) - 1;
            if ( ! this.playerOnFloor ) {
                this.playerVelocity.y -= this.GRAVITY * delta;
                // small air resistance
                damping *= 0.01;
            }
            this.playerVelocity.addScaledVector( this.playerVelocity, damping );
            const deltaPosition = this.playerVelocity.clone().multiplyScalar( delta );
            this.playerCollider.translate( deltaPosition );
            this.playerCollisions();
            const newPos = new THREE.Vector3()
                .addVectors(this.playerCollider.start, this.playerCollider.end)
                .multiplyScalar(0.5) ;
            newPos.y -= Player.offset;

            //camera.position.add( newPos.clone().sub(this.group.position) );
            this.group.position.copy( newPos ); */

            // calculate camera direction and rotate input into world
            const direction = deltaPosition.setY(0);
            if (direction.lengthSq() === 0) {
                rotate.identity();
            } else {
                rotate.setFromUnitVectors(
                    PLAYER_FORWARD,
                    direction.normalize()
                );
            }

            // smooth rotation toward camera/movement direction using slerp
            const t = 1 - Math.exp(-this.controls.turnSmoothness * delta);
            if (
                isFinite(rotate.x) &&
                isFinite(rotate.y) &&
                isFinite(rotate.z) &&
                isFinite(rotate.w)
            ) {
                rotate.normalize();
                this.group.quaternion.normalize();
                this.group.quaternion.slerp(rotate, t);
            } else {
                console.log('ROTATE');
                this.group.quaternion.copy(rotate);
            }
        }
        //console.log(this.group.position);
        if (this.mixer) {
            this.mixer.update(delta);
        }
    }
}
