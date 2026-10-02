import * as THREE from 'three';

import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { Octree } from 'three/addons/math/Octree.js';

import { MODEL_DOOR_A, MODEL_DOOR_B, MODEL_DOOR_MAIN } from './Assets.js';
import type { ResourceDisposer } from './ResourceDisposer.js';

import { type GLBMesh, type TTTMeshBoard } from 'ftr-common/sharedTypes';

type WorldLoaderOptions = {
    readonly scene: THREE.Scene;
    readonly worldOctree: Octree;
    readonly worldOctreeInteractive: Octree;
    readonly colliders: GLBMesh[];
    readonly tttBoard: TTTMeshBoard;
    readonly doorGroupA: THREE.Group;
    readonly doorGroupB: THREE.Group;
    readonly doorGroupMain: THREE.Group;
    readonly gradientTexture: THREE.Texture;
    readonly resourceDisposer: ResourceDisposer;
    readonly isDisposed: () => boolean;
};

export class WorldLoader {
    private readonly loader = new GLTFLoader();
    isEnvironmentLoaded = false;

    private readonly scene: THREE.Scene;
    private readonly worldOctree: Octree;
    private readonly worldOctreeInteractive: Octree;
    private readonly colliders: GLBMesh[];
    private readonly octreeObjects: THREE.Object3D[] = [];
    private readonly tttBoard: TTTMeshBoard;
    private readonly doorGroupA: THREE.Group;
    private readonly doorGroupB: THREE.Group;
    private readonly doorGroupMain: THREE.Group;
    private readonly doorMeshNames: string[] = [];
    private readonly gradientTexture: THREE.Texture;
    private readonly resourceDisposer: ResourceDisposer;
    private readonly isDisposed: () => boolean;
    private eventSpaceDoorsOpenState = false;
    private mainDoorsOpenState = false;

    constructor(options: WorldLoaderOptions) {
        this.scene = options.scene;
        this.worldOctree = options.worldOctree;
        this.worldOctreeInteractive = options.worldOctreeInteractive;
        this.colliders = options.colliders;
        this.tttBoard = options.tttBoard;
        this.doorGroupA = options.doorGroupA;
        this.doorGroupB = options.doorGroupB;
        this.doorGroupMain = options.doorGroupMain;
        this.gradientTexture = options.gradientTexture;
        this.resourceDisposer = options.resourceDisposer;
        this.isDisposed = options.isDisposed;
    }

    get eventSpaceDoorsOpen(): boolean {
        return this.eventSpaceDoorsOpenState;
    }

    get mainDoorsOpen(): boolean {
        return this.mainDoorsOpenState;
    }

    async loadMesh(
        path: string,
        position: [number, number, number] = [0, 0, 0]
    ): Promise<THREE.Object3D | null> {
        const object = await this.loadObject(path, 'Map model');
        if (!object) {
            return null;
        }

        object.position.fromArray(position);
        const meshes = object.getObjectsByProperty('isMesh', true) as GLBMesh[];
        for (const mesh of meshes) {
            if (!mesh.name.includes('NOCOL')) {
                this.colliders.push(mesh);
            }

            if (path === MODEL_DOOR_A) {
                console.log(mesh.name + ' added to groupDoorA');
                this.doorMeshNames.push(mesh.name);
                this.doorGroupA.add(object);
                this.worldOctreeInteractive.fromGraphNode(object);
            }
            if (path === MODEL_DOOR_B) {
                console.log(mesh.name + ' added to groupDoorB');
                this.doorMeshNames.push(mesh.name);
                this.doorGroupB.add(object);
                this.worldOctreeInteractive.fromGraphNode(object);
            }
            if (path === MODEL_DOOR_MAIN) {
                console.log(mesh.name + ' added to groupDoorMain');
                this.doorMeshNames.push(mesh.name);
                this.doorGroupMain.add(object);
                this.worldOctreeInteractive.fromGraphNode(object);
            }

            if (mesh.name.includes('TTT_Board')) {
                if (this.tttBoard.cells.length >= 9) {
                    throw new Error('ttt game can have only 9 cells!');
                }
                this.tttBoard.cells.push(mesh);
            }

            this.prepareWorldMesh(mesh);
        }

        if (this.isDisposed()) {
            this.resourceDisposer.disposeObject3D(object);
            return null;
        }

        if (
            path !== MODEL_DOOR_A &&
            path !== MODEL_DOOR_B &&
            path !== MODEL_DOOR_MAIN
        ) {
            this.scene.add(object);
            this.octreeObjects.push(object);
            this.worldOctree.fromGraphNode(object);
        }

        this.isEnvironmentLoaded = true;

        return object;
    }

    async loadSky(
        path: string,
        position: [number, number, number] = [0, 0, 0]
    ): Promise<void> {
        const object = await this.loadObject(path, 'Sky model');
        if (!object) {
            return;
        }

        object.position.fromArray(position);
        const meshes = object.getObjectsByProperty('isMesh', true) as GLBMesh[];
        for (const mesh of meshes) {
            this.applyOutlinedToonMaterial(mesh, false);
        }

        if (this.isDisposed()) {
            this.resourceDisposer.disposeObject3D(object);
            return;
        }

        this.scene.add(object);
    }

    openEventSpaceDoors(): void {
        // TODO: Play door opening animation
        this.doorGroupA.rotation.y = -1.83;
        this.doorGroupB.rotation.y = 1.42;
        this.eventSpaceDoorsOpenState = true;

        this.removeFromColliderAndOctree(this.doorMeshNames);
    }

    async openEventSpaceDoorA(): Promise<void> {
        const doorOpenValue = -1.83;
        const move = 0.01;

        return new Promise((resolve) => {
            let cr = this.doorGroupA.rotation.y;

            const openDoor = () => {
                cr -= move;
                console.log('cr: ' + cr);
                this.doorGroupA.rotation.y = cr;

                if (cr > doorOpenValue) {
                    requestAnimationFrame(openDoor);
                } else {
                    resolve();
                }
            };

            openDoor();
        });
    }

    async openEventSpaceDoorB(): Promise<void> {
        const doorOpenValue = 1.42;
        const move = 0.01;

        return new Promise((resolve) => {
            let cr = this.doorGroupB.rotation.y;

            const openDoor = () => {
                cr += move;
                console.log('cr: ' + cr);
                this.doorGroupB.rotation.y = cr;

                if (cr < doorOpenValue) {
                    requestAnimationFrame(openDoor);
                } else {
                    resolve();
                }
            };

            openDoor();
        });
    }

    openMainDoor(): void {
        this.doorGroupMain.rotation.y = -Math.PI / 2;
        this.mainDoorsOpenState = true;

        this.removeFromColliderAndOctree(this.doorMeshNames);
    }

    resetEventSpaceDoors(): void {
        this.doorGroupA.rotation.set(0, 0, 0);
        this.doorGroupB.rotation.set(0, 0, 0);
        this.doorGroupMain.rotation.set(0, 0, 0);
        this.mainDoorsOpenState = false;
        this.eventSpaceDoorsOpenState = false;

        for (const doorGroup of [
            this.doorGroupA,
            this.doorGroupB,
            this.doorGroupMain,
        ]) {
            const doorMeshes = doorGroup.getObjectsByProperty(
                'isMesh',
                true
            ) as GLBMesh[];
            for (const doorMesh of doorMeshes) {
                if (!this.colliders.includes(doorMesh)) {
                    this.colliders.push(doorMesh);
                }
            }
        }

        this.rebuildWorldOctree(
            this.doorGroupA,
            this.doorGroupB,
            this.doorGroupMain
        );
    }

    private async loadObject(
        path: string,
        errorContext: string
    ): Promise<THREE.Object3D | null> {
        let gltf: Awaited<ReturnType<GLTFLoader['loadAsync']>>;
        try {
            gltf = await this.loader.loadAsync(path);
        } catch (error: unknown) {
            if (!this.isDisposed()) {
                console.error(
                    `${errorContext} loading failed for "${path}":`,
                    error
                );
            }
            return null;
        }

        const object = gltf.scene;
        if (this.isDisposed()) {
            this.resourceDisposer.disposeObject3D(object);
            return null;
        }

        return object;
    }

    private removeFromColliderAndOctree(objects: readonly string[]): void {
        for (const objectName of objects) {
            const index = this.colliders.findIndex(
                (mesh) => mesh.name === objectName
            );
            if (index !== -1) {
                this.colliders.splice(index, 1);
            }
        }

        this.rebuildWorldOctree(this.doorGroupA, this.doorGroupB);
    }

    private rebuildWorldOctree(...additionalObjects: THREE.Object3D[]): void {
        this.worldOctreeInteractive.clear();

        for (const object of additionalObjects) {
            this.worldOctreeInteractive.fromGraphNode(object);
        }
    }

    private prepareWorldMesh(mesh: GLBMesh): void {
        let glassOpacity: number | null = null;

        if (mesh.material.name === 'Glass_mtl') {
            glassOpacity = 0.3;
        } else if (mesh.material.name === 'Glass_outside') {
            glassOpacity = 0.8;
        } else if (mesh.material.name === 'Glass_block') {
            glassOpacity = 1;
        }

        if (glassOpacity !== null) {
            mesh.material = new THREE.MeshToonMaterial({
                color: 0xaaddff,
                transparent: glassOpacity < 1,
                opacity: glassOpacity,
                // GlassOcclusion
                depthWrite: true,
            });
            mesh.castShadow = false;
            mesh.receiveShadow = false;
            return;
        }

        if (
            mesh.material.name !== 'Tile_White' &&
            mesh.material.name !== 'Tile_Dark'
        )
            this.applyOutlinedToonMaterial(mesh, true);
    }

    /** Cartoon Style */
    private applyOutlinedToonMaterial(
        mesh: GLBMesh,
        castShadow: boolean
    ): void {
        // outline
        const edges = new THREE.EdgesGeometry(mesh.geometry, 50);
        const line = new THREE.LineSegments(
            edges,
            new THREE.LineBasicMaterial({ color: 0x000000 })
        );
        mesh.add(line);

        mesh.material = new THREE.MeshToonMaterial({
            color: mesh.material.color,
            map: mesh.material.map,
            gradientMap: this.gradientTexture,
        });

        mesh.castShadow = castShadow;
        mesh.receiveShadow = true;
    }
}
