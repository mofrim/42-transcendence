import * as THREE from 'three';

import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export class Camera {
    camera: THREE.PerspectiveCamera;
    colliders: THREE.Object3D[];
    orbitControls: OrbitControls;
    raycaster: THREE.Raycaster;
    private readonly intersections: THREE.Intersection[];

    constructor(
        window: Window,
        renderer: THREE.WebGLRenderer,
        colliders: THREE.Object3D[]
    ) {
        this.camera = new THREE.PerspectiveCamera(
            60,
            window.innerWidth / window.innerHeight,
            0.1,
            100
        );
        this.camera.position.set(0, 2, -5);

        this.colliders = colliders;
        this.orbitControls = new OrbitControls(
            this.camera,
            renderer.domElement
        );
        this.orbitControls.target.set(0, 1, 0);
        this.orbitControls.enableDamping = true;
        this.orbitControls.enablePan = false;
        this.orbitControls.enableZoom = true;
        this.orbitControls.maxPolarAngle = Math.PI / 2 + 0.15; //PI90 - .05;
        this.orbitControls.update();

        this.raycaster = new THREE.Raycaster();
        this.raycaster.far = 3.0;
        this.intersections = [];
    }

    CamColisionReset(
        delta: number,
        start: THREE.Vector3,
        end: THREE.Vector3,
        direction: THREE.Vector3
    ): void {
        const dist = start.distanceTo(end);
        const camDistance = 3.0;

        const epsilon = 0.05;
        if (Math.abs(dist - camDistance) > epsilon) {
            if (dist < camDistance) {
                this.camera.position.addScaledVector(direction, delta * 2);
            }
            if (dist > camDistance) {
                this.camera.position.addScaledVector(direction, -delta * 2);
            }
        }
    }

    cameraCollisionRaycast(delta: number, group: THREE.Object3D): void {
        this.raycaster.ray.origin
            .copy(group.position)
            .setY(group.position.y + 1);

        // will be the direction vector - pointing from the ray origin to the camera.
        this.raycaster.ray.lookAt(this.camera.position);

        if (this.colliders.length === 0) return;

        // Three.js sorts intersections by distance, closest first.
        this.intersections.length = 0;
        this.raycaster.intersectObjects(
            this.colliders,
            false,
            this.intersections
        );

        const nearestIntersection = this.intersections[0];
        if (!nearestIntersection)
            this.CamColisionReset(
                delta,
                this.raycaster.ray.origin,
                this.camera.position,
                this.raycaster.ray.direction
            );
        else {
            this.raycaster.ray.at(
                nearestIntersection.distance - 0.1,
                this.camera.position
            );
        }
    }
}
