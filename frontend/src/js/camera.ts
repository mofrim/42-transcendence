import * as THREE from 'three';

import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

type FirstHitRaycaster = THREE.Raycaster & { firstHitOnly: boolean };

export class Camera {
    camera: THREE.PerspectiveCamera;
    colliders: THREE.Object3D[];
    orbitControls: OrbitControls;
    raycaster: FirstHitRaycaster;
    dir: THREE.Vector3;
    rayPos: THREE.Vector3;

    constructor(
        window: Window,
        renderer: THREE.WebGLRenderer,
        colliders: THREE.Object3D[]
    ) {
        this.camera = new THREE.PerspectiveCamera( 60, window.innerWidth / window.innerHeight, 0.1, 100 );
        this.camera.position.set( 0, 2, -5 );

        this.colliders = colliders;
        this.orbitControls = new OrbitControls( this.camera, renderer.domElement );
        this.orbitControls.target.set( 0, 1, 0 );
        this.orbitControls.enableDamping = true;
        this.orbitControls.enablePan = false;
        this.orbitControls.enableZoom = true;
        this.orbitControls.maxPolarAngle =  (Math.PI / 2) + 0.15//PI90 - .05;
        this.orbitControls.update();

        this.raycaster = new THREE.Raycaster() as FirstHitRaycaster;
        this.dir = new THREE.Vector3();
        this.rayPos = new THREE.Vector3();
        this.raycaster.far = 3.0;
    }

    CamColisionReset(
        delta: number,
        start: THREE.Vector3,
        end: THREE.Vector3,
        direction: THREE.Vector3
    ): void {
        const dist = start.distanceTo(end);
        const camDistance = 3.0;

        //console.log("Colliders RESET" );

        const epsilon = 0.05;
        if (Math.abs(dist - camDistance) > epsilon)
        {
            if (dist < camDistance) {
                //console.log("RESET 1");
                this.camera.position.addScaledVector(direction, delta*2);
            }
            if (dist > camDistance) {
                //console.log("RESET 2");
                this.camera.position.addScaledVector(direction, -delta*2);
            }
        }
    }

    CamCollisionAdjust(
        start: THREE.Vector3,
        end: THREE.Vector3,
        direction: THREE.Vector3
    ): void {
        const distHit = start.distanceTo(end);
        const newPos = start.clone().addScaledVector(direction.normalize(), distHit-0.1);
        this.camera.position.copy(newPos);
    }

    cameraCollisionRaycast(delta: number, group: THREE.Object3D): void {
        this.rayPos.copy(group.position);
        this.rayPos.y += 1;

        // will be the direction vector - pointing from rayPos to the camera.
        this.dir.subVectors(this.camera.position, this.rayPos).normalize();
        this.raycaster.set(this.rayPos, this.dir);
        this.raycaster.firstHitOnly = true;

        if(this.colliders.length === 0)
            return;

        const hits = this.raycaster.intersectObjects(this.colliders, false);

        if (hits.length === 0)
            this.CamColisionReset(delta, this.rayPos, this.camera.position, this.dir);
        else{
            this.CamCollisionAdjust(this.rayPos, hits[0].point, this.dir);
            //this.testDirect(this.rayPos, hits[0].point, this.camera.position);
        }

    }

    /* const capsuleMaterial = new THREE.MeshBasicMaterial({color: 0xff0000, wireframe: true});
    const C1 = new THREE.Mesh(new THREE.SphereGeometry(0.10, 8, 8), capsuleMaterial);
    const C2 = new THREE.Mesh(new THREE.SphereGeometry(0.10, 8, 8), capsuleMaterial);
    const C3 = new THREE.Mesh(new THREE.SphereGeometry(0.10, 8, 8), capsuleMaterial);
    const C4 = new THREE.Mesh(new THREE.SphereGeometry(0.10, 8, 8), capsuleMaterial);
    const C5 = new THREE.Mesh(new THREE.SphereGeometry(0.10, 8, 8), capsuleMaterial);
    scene.add(C1, C2, C3, C4, C5); */

    /* testDirect(start, end, camPos){

        dir.subVectors(end, start).normalize();

        C1.position.copy(start);

        C2.position.copy(camPos);

        C3.position.copy(rayPos);
        C3.position.addScaledVector(dir, 1.0);

        C4.position.copy(rayPos);
        C4.position.addScaledVector(dir, 1.5);

        C5.position.copy(end);
    } */
}
