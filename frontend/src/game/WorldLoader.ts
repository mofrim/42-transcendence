import * as THREE from 'three';

import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { Octree } from 'three/addons/math/Octree.js';

import { MODEL_DOOR_A, MODEL_DOOR_B } from './Assets.js';
import type { ResourceDisposer } from './ResourceDisposer.js';

import { type GLBMesh, type TTTMeshBoard } from 'ftr-common/sharedTypes';

type WorldLoaderOptions = {
    readonly scene: THREE.Scene;
    readonly worldOctree: Octree;
    readonly colliders: GLBMesh[];
    readonly octreeObjects: THREE.Object3D[];
    readonly tttBoard: TTTMeshBoard;
    readonly doorGroupA: THREE.Group;
    readonly doorGroupB: THREE.Group;
    readonly doorMeshNames: string[];
    readonly gradientTexture: THREE.Texture;
    readonly resourceDisposer: ResourceDisposer;
    readonly isDisposed: () => boolean;
};

export class WorldLoader {
    private readonly loader = new GLTFLoader();
    isEnvironmentLoaded = false;

    private readonly scene: THREE.Scene;
    private readonly worldOctree: Octree;
    private readonly colliders: GLBMesh[];
    private readonly octreeObjects: THREE.Object3D[];
    private readonly tttBoard: TTTMeshBoard;
    private readonly doorGroupA: THREE.Group;
    private readonly doorGroupB: THREE.Group;
    private readonly doorMeshNames: string[];
    private readonly gradientTexture: THREE.Texture;
    private readonly resourceDisposer: ResourceDisposer;
    private readonly isDisposed: () => boolean;

    constructor(options: WorldLoaderOptions) {
        this.scene = options.scene;
        this.worldOctree = options.worldOctree;
        this.colliders = options.colliders;
        this.octreeObjects = options.octreeObjects;
        this.tttBoard = options.tttBoard;
        this.doorGroupA = options.doorGroupA;
        this.doorGroupB = options.doorGroupB;
        this.doorMeshNames = options.doorMeshNames;
        this.gradientTexture = options.gradientTexture;
        this.resourceDisposer = options.resourceDisposer;
        this.isDisposed = options.isDisposed;
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
            }
            if (path === MODEL_DOOR_B) {
                console.log(mesh.name + ' added to groupDoorB');
                this.doorMeshNames.push(mesh.name);
                this.doorGroupB.add(object);
            }

            if (mesh.name.includes('TTT_Board')) {
                if (this.tttBoard.cellCnt >= 9) {
                    throw new Error('ttt game can have only 9 cells!');
                }
                this.tttBoard.cells[this.tttBoard.cellCnt] = mesh;
                this.tttBoard.cellCnt++;
            }

            this.prepareWorldMesh(mesh);
        }

        if (this.isDisposed()) {
            this.resourceDisposer.disposeObject3D(object);
            return null;
        }

        if (path !== MODEL_DOOR_A && path !== MODEL_DOOR_B) {
            this.scene.add(object);
            this.octreeObjects.push(object);
        }

        this.worldOctree.fromGraphNode(object);
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

    private prepareWorldMesh(mesh: GLBMesh): void {
        if (mesh.material.name === 'Glass_mtl') {
            mesh.material = new THREE.MeshToonMaterial({
                color: 0xaaddff,
                transparent: true,
                opacity: 0.3,
            });
            mesh.castShadow = false;
            mesh.receiveShadow = false;
            return;
        }
        if (mesh.material.name === 'Glass_outside') {
            mesh.material = new THREE.MeshToonMaterial({
                color: 0xaaddff,
                transparent: true,
                opacity: 0.8,
            });
            mesh.castShadow = false;
            mesh.receiveShadow = false;
            return;
        }
        if (mesh.material.name === 'Glass_block') {
            mesh.material = new THREE.MeshToonMaterial({
                color: 0xaaddff,
                transparent: false,
            });
            mesh.castShadow = false;
            mesh.receiveShadow = false;
            return;
        }

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
            map: mesh.material.map || null,
            gradientMap: this.gradientTexture,
        });

        mesh.castShadow = castShadow;
        mesh.receiveShadow = true;
    }
}
