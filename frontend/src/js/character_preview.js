import * as THREE from 'three';

import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/** all both gender */
const CHARACTER_PREVIEW_MODELS = {
    true: {
        path: '/glb/Male_Test.glb',
        label: 'Male_Test.glb',
    },
    false: {
        path: '/glb/Female_Test.glb',
        label: 'Female_Test.glb',
    },
};

function normalizeCharacter(character) {
    if (typeof character === 'string') {
        const normalizedCharacter = character.toLowerCase();
        return (
            normalizedCharacter !== 'false' && normalizedCharacter !== 'female'
        );
    }

    return character !== false;
}

function disposeMaterial(material) {
    for (const value of Object.values(material)) {
        if (value && value.isTexture) {
            value.dispose();
        }
    }

    material.dispose();
}

function disposeObject(object) {
    object.traverse((child) => {
        if (!child.isMesh) {
            return;
        }

        child.geometry?.dispose();

        if (Array.isArray(child.material)) {
            child.material.forEach(disposeMaterial);
        } else if (child.material) {
            disposeMaterial(child.material);
        }
    });
}

export function createCharacterPreview({ canvas, label }) {
    if (!canvas) {
        return {
            setCharacter() {},
            dispose() {},
        };
    }

    const renderer = new THREE.WebGLRenderer({
        canvas,
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

    const ambientLight = new THREE.HemisphereLight(0xffffff, 0x6f7f91, 2.2);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 3.0);
    keyLight.position.set(3, 4, 5);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xffffff, 1.2);
    fillLight.position.set(-3, 2, 4);
    scene.add(fillLight);

    const loader = new GLTFLoader();
    const box = new THREE.Box3();
    const center = new THREE.Vector3();
    const size = new THREE.Vector3();

    let currentModel = null;
    let currentCharacter = null;
    let disposed = false;
    let frameId = null;
    let loadSerial = 0;
    let rendererWidth = 0;
    let rendererHeight = 0;

    function resizeRenderer() {
        const rect = canvas.getBoundingClientRect();
        const width = Math.max(1, Math.round(rect.width));
        const height = Math.max(1, Math.round(rect.height));

        if (width === rendererWidth && height === rendererHeight) {
            return;
        }

        rendererWidth = width;
        rendererHeight = height;
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
    }

    function clearCurrentModel() {
        if (!currentModel) {
            return;
        }

        scene.remove(currentModel);
        disposeObject(currentModel);
        currentModel = null;
    }

    function centerAndFrameModel(model) {
        box.setFromObject(model);

        if (box.isEmpty()) {
            camera.position.set(0, 1.2, 4);
            camera.lookAt(0, 1, 0);
            return;
        }

        box.getCenter(center);
        box.getSize(size);

        model.position.sub(center);

        const fov = THREE.MathUtils.degToRad(camera.fov);
        const fitHeightDistance = size.y / (2 * Math.tan(fov / 2));
        const fitWidthDistance =
            size.x / (2 * Math.tan(fov / 2) * camera.aspect);
        const distance =
            Math.max(fitHeightDistance, fitWidthDistance, size.z) * 1.3;

        camera.near = Math.max(0.01, distance / 100);
        camera.far = distance * 100;
        camera.position.set(0, 0.04, distance);
        camera.lookAt(0, 0.04, 0);
        camera.updateProjectionMatrix();
    }

    function setCharacter(character) {
        const normalizedCharacter = normalizeCharacter(character);
        const preview = CHARACTER_PREVIEW_MODELS[normalizedCharacter];

        if (currentCharacter === normalizedCharacter) {
            return;
        }

        currentCharacter = normalizedCharacter;

        if (label) {
            label.textContent = preview.label;
        }

        clearCurrentModel();
        const serial = ++loadSerial;

        loader.load(
            preview.path,
            (gltf) => {
                if (disposed || serial !== loadSerial) {
                    disposeObject(gltf.scene);
                    return;
                }

                const model = gltf.scene;
                const pivot = new THREE.Group();

                model.traverse((object) => {
                    if (!object.isMesh) {
                        return;
                    }

                    object.castShadow = false;
                    object.receiveShadow = false;

                    if (object.material?.name === 'Outline') {
                        object.visible = false;
                    }
                });

                pivot.add(model);
                currentModel = pivot;
                scene.add(currentModel);
                resizeRenderer();
                centerAndFrameModel(model);
            },
            undefined,
            (error) => {
                console.error('Character preview failed to load:', error);
            }
        );
    }

    function render() {
        if (disposed) {
            return;
        }

        resizeRenderer();

        if (currentModel) {
            // Drehteller
            currentModel.rotation.y += 0.007;
        }

        renderer.render(scene, camera);
        frameId = requestAnimationFrame(render);
    }

    window.addEventListener('resize', resizeRenderer);
    frameId = requestAnimationFrame(render);

    return {
        setCharacter,
        dispose() {
            disposed = true;
            loadSerial++;

            if (frameId) {
                cancelAnimationFrame(frameId);
            }

            window.removeEventListener('resize', resizeRenderer);
            clearCurrentModel();
            renderer.dispose();
            // Release the character preview immediately after disposing the renderer
            renderer.forceContextLoss?.();
        },
    };
}
