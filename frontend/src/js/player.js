import * as THREE from 'three';

import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Capsule } from 'three/addons/math/Capsule.js';

import {
    createPlayerAnimationActions,
    transitionPlayerAnimation,
} from './player_animation.js';

export class Player {
    static gradientTexture = (() => {
        const texture = new THREE.TextureLoader().load(
            '/textures/gradientMaps/twoTone2.jpg'
        );
        texture.minFilter = THREE.NearestFilter;
        texture.magFilter = THREE.NearestFilter;
        return texture;
    })();

    static colRad = 0.35;
    static colStartY = 0.35;
    static colEndY = 1;
    static offset = 0;

    constructor(path, id, scene, worldOctree, defaultAnim = 0) {
        this.spawnTime = performance.now();

        this.scene = scene;
        this.id = id;
        this.model = null;
        this.group = new THREE.Group();
        this.state = 'Idle';
        this.stateCurrent = 'Idle';
        this.mixer = null;
        this.actions = null;

        this.scene.add(this.group);
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

        this.lowestY =
            Math.min(this.playerCollider.start.y, this.playerCollider.end.y) -
            this.playerCollider.radius;
        //console.log("Lowest Y 1: " + this.lowestY.toFixed(4));

        Player.offset = (Player.colEndY - Player.colStartY) / 2 + Player.colRad;
        // apply lift
        //this.playerCollider.translate(new THREE.Vector3(0, Player.offset, 0));

        this.lowestY =
            Math.min(this.playerCollider.start.y, this.playerCollider.end.y) -
            this.playerCollider.radius;
        //console.log("Lowest Y 2: " + this.lowestY.toFixed(4));

        this.controls = {
            key: [0, 0],
            up: new THREE.Vector3(0, 1, 0),
            rotate: new THREE.Quaternion(),
            current: 'Idle',
            fadeDuration: 0.5,
            runVelocity: 15,
            turnSmoothness: 4.0,
        };

        // start with scale 0 for spawn animation
        //this.group.scale.set(0, 1, 0);

        this.loadModel(path, defaultAnim);

        this.animateSpawn();
    }

    async animateSpawn() {
        //console.log("Animating spawn..." + this.spawnTime);
        //const start = performance.now();
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
                    if (child.isMesh) {
                        child.material.transparent = true;
                        child.material.opacity = av;
                    }
                });
                requestAnimationFrame(loop);
            } else {
                this.spawnY = 0;
                this.model.traverse((child) => {
                    if (child.isMesh) {
                        child.material.transparent = true;
                        child.material.opacity = 1;
                    }
                });
                this.group.scale.set(1, 1, 1);
                this.GRAVITY = 30;
                this.isSpawned = true;
            }
        };
        loop();
    }

    static loader = new GLTFLoader();

    loadModel(path, defaultAnim = 0) {
        //const loader = new GLTFLoader();
        Player.loader.load(path, (gltf) => {
            this.model = gltf.scene;

            this.group.add(this.model);
            //this.model.rotation.y = Math.PI;
            this.group.rotation.y = Math.PI;

            this.model.traverse(function (object) {
                if (object.isMesh) {
                    object.castShadow = true;
                    object.receiveShadow = true;

                    if (object.material.name === 'Outline') {
                        //console.log("OUTLINE MESH FOUND");
                        object.material = new THREE.MeshBasicMaterial({
                            color: 0x000000,
                            transparent: true,
                            opacity: 0,
                        });
                        object.castShadow = false; // important: prevents shadow artifacts
                        return;
                    } else {
                        object.material = new THREE.MeshToonMaterial({
                            color: object.material.color.clone(),
                            gradientMap: Player.gradientTexture,
                        });

                        /* object.material = new THREE.MeshToonMaterial({
                            color: 0xffffff,
                            gradientMap: Player.gradientTexture,
                            transparent: true,
                            opacity: 0
                        }); */
                    }
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
                this.stateCurrent = 'Idle';
                this.isLoaded = true;
            } catch (error) {
                console.error(
                    `Player animation initialization failed for "${path}":`,
                    error
                );
            }
        });
    }

    getForwardVector(camera) {
        camera.getWorldDirection(this.playerDirection);
        this.playerDirection.y = 0;
        this.playerDirection.normalize();
        return this.playerDirection;
    }

    getSideVector(camera) {
        camera.getWorldDirection(this.playerDirection);
        this.playerDirection.y = 0;
        this.playerDirection.normalize();
        this.playerDirection.cross(camera.up);

        return this.playerDirection;
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

    //let count = 0;
    updateCharacter(delta) {
        const fade = this.controls.fadeDuration;
        const key = this.controls.key;
        const up = this.controls.up;
        const rotate = this.controls.rotate;
        const active = key[0] === 0 && key[1] === 0 ? false : true;
        const play = active ? 'Run' : 'Idle';
        // Zustandsübergänge können den Renderloop abbrechen
        this.controls.current = play;

        // change animation
        if (
            this.isLoaded &&
            this.mixer !== null &&
            this.actions !== null &&
            this.stateCurrent !== play
        ) {
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
        this.playerCollider.translate(deltaPosition);
        this.playerCollisions();
        const newPos = new THREE.Vector3()
            .addVectors(this.playerCollider.start, this.playerCollider.end)
            .multiplyScalar(0.5);
        newPos.y -= Player.offset;

        //camera.position.add( newPos.clone().sub(this.group.position) );
        this.group.position.copy(newPos);

        if (this.group.position.y < -0.01) {
            this.group.position.set(
                this.group.position.x,
                0,
                this.group.position.z
            );
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
            const dir = deltaPosition.normalize();
            const angle = this.unwrapRad(Math.atan2(dir.x, dir.z));
            rotate.setFromAxisAngle(up, angle);

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
        if (this.isLoaded && this.mixer && this.actions) {
            this.mixer.update(delta);
        }

        this.lowestY =
            Math.min(this.playerCollider.start.y, this.playerCollider.end.y) -
            this.playerCollider.radius;
        //console.log("Lowest Y 4: " + this.lowestY.toFixed(4));
    }

    unwrapRad(r) {
        return Math.atan2(Math.sin(r), Math.cos(r));
    }
}
