import * as THREE from 'three';

import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { Character } from '@common/types';
import { createThreeResourceDisposer } from './ThreeResourceDisposer.js';

interface CharacterPreviewOptions {
    canvas?: HTMLCanvasElement | null;
    label?: HTMLElement | null;
}

export interface CreateCharPreviewReturnType {
    setCharacter(character: Character): void;
    dispose(): void;
}

/** all both gender */
const CHARACTER_PREVIEW_MODELS = {
    true: {
        path: '/glb/Main_Male.glb',
        label: 'Main_Male.glb',
    },
    false: {
        path: '/glb/Main_Female.glb',
        label: 'Main_Female.glb',
    },
};

const MAX_PREVIEW_FPS = 30;
const PREVIEW_FRAME_INTERVAL = 1 / MAX_PREVIEW_FPS;

export function createCharacterPreview({
    canvas,
    label,
}: CharacterPreviewOptions): CreateCharPreviewReturnType {
    if (!canvas) {
        return {
            setCharacter() {},
            dispose() {},
        };
    }

    const previewCanvas = canvas;

    const renderer = new THREE.WebGLRenderer({
        canvas: previewCanvas,
        antialias: true,
        alpha: true,
    });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.85;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(28, 9 / 16, 0.1, 100);
    const resourceDisposer = createThreeResourceDisposer({
        shouldCloseImageBitmap: () => true,
        onError: (error: unknown) => {
            console.error('Character preview resource disposal failed:', error);
        },
    });

    const ambientLight = new THREE.HemisphereLight(0xffffff, 0x6f7f91, 2.2);
    const keyLight = new THREE.DirectionalLight(0xffffff, 3.0);
    keyLight.position.set(3, 4, 5);

    const fillLight = new THREE.DirectionalLight(0xffffff, 1.2);
    fillLight.position.set(-3, 2, 4);
    scene.add(ambientLight, keyLight, fillLight);

    const loader = new GLTFLoader();
    const box = new THREE.Box3();
    const center = new THREE.Vector3();
    const size = new THREE.Vector3();
    const rendererSize = new THREE.Vector2();
    const viewSize = new THREE.Vector2();

    let currentModel: THREE.Group | null = null;
    let currentCharacter: boolean | null = null;
    let disposed = false;
    let loadSerial = 0;
    let lastRenderTime = 0;

    function resizeRenderer(): void {
        const rect = previewCanvas.getBoundingClientRect();
        const width = Math.max(1, Math.round(rect.width));
        const height = Math.max(1, Math.round(rect.height));

        renderer.getSize(rendererSize);
        if (width === rendererSize.x && height === rendererSize.y) {
            return;
        }

        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
    }

    function clearCurrentModel(): void {
        if (!currentModel) {
            return;
        }

        resourceDisposer.disposeObject3D(currentModel);
        currentModel = null;
    }

    function centerAndFrameModel(model: THREE.Object3D): void {
        box.setFromObject(model);

        if (box.isEmpty()) {
            camera.position.set(0, 1.2, 4);
            camera.lookAt(0, 1, 0);
            return;
        }

        box.getCenter(center);
        box.getSize(size);

        model.position.sub(center);

        camera.getViewSize(1, viewSize);
        const fitHeightDistance = size.y / viewSize.y;
        const fitWidthDistance = size.x / viewSize.x;
        const distance =
            Math.max(fitHeightDistance, fitWidthDistance, size.z) * 1.3;

        camera.near = Math.max(0.01, distance / 100);
        camera.far = distance * 100;
        camera.position.set(0, 0.04, distance);
        camera.lookAt(0, 0.04, 0);
        camera.updateProjectionMatrix();
    }

    async function loadCharacterModel(
        path: string,
        serial: number
    ): Promise<void> {
        let gltf: Awaited<ReturnType<GLTFLoader['loadAsync']>>;
        try {
            gltf = await loader.loadAsync(path);
        } catch (error: unknown) {
            console.error('Character preview failed to load:', error);
            return;
        }

        if (disposed || serial !== loadSerial) {
            resourceDisposer.disposeObject3D(gltf.scene);
            return;
        }

        const model = gltf.scene;
        const pivot = new THREE.Group();

        const meshes = model.getObjectsByProperty(
            'isMesh',
            true
        ) as THREE.Mesh[];
        for (const object of meshes) {
            object.castShadow = false;
            object.receiveShadow = false;

            if (
                !Array.isArray(object.material) &&
                object.material.name === 'Outline'
            ) {
                object.visible = false;
            }
        }

        pivot.add(model);
        currentModel = pivot;
        scene.add(currentModel);
        resizeRenderer();
        centerAndFrameModel(model);
    }

    function setCharacter(character: Character): void {
        const preview = character
            ? CHARACTER_PREVIEW_MODELS.true
            : CHARACTER_PREVIEW_MODELS.false;

        if (currentCharacter === character) {
            return;
        }

        currentCharacter = character;

        if (label) {
            label.textContent = preview.label;
        }

        clearCurrentModel();
        const serial = ++loadSerial;

        void loadCharacterModel(preview.path, serial);
    }

    function render(time: number): void {
        if (disposed) {
            return;
        }

        const currentTime = time / 1000;
        if (currentTime - lastRenderTime < PREVIEW_FRAME_INTERVAL) {
            return;
        }
        lastRenderTime = currentTime;

        resizeRenderer();

        if (currentModel) {
            // Drehteller
            currentModel.rotateY(0.007);
        }

        renderer.render(scene, camera);
    }

    renderer.setAnimationLoop(render);

    return {
        setCharacter,
        dispose() {
            disposed = true;
            loadSerial++;
            renderer.setAnimationLoop(null);
            clearCurrentModel();
            renderer.dispose();
            // Release the character preview immediately after disposing the renderer
            renderer.forceContextLoss();
            console.log('characterPreview successfully disposed!');
        },
    };
}
