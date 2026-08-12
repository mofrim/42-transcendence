import * as THREE from 'three';

import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createThreeResourceDisposer } from './ThreeResourceDisposer.js';

const MAP_MODEL_PATH = '/glb/42WOB_v3.glb';
const MAX_PIXEL_RATIO = 1.5;
const ROTATION_SPEED = THREE.MathUtils.degToRad(1.15);

interface MapPreview {
    dispose(): void;
}

interface MapPreviewOptions {
    canvas?: HTMLCanvasElement | null;
}

const EMPTY_PREVIEW: MapPreview = Object.freeze({
    dispose() {},
});

/**
 * Texture.dispose() releases GPU resources, but Three.js does not close
 * ImageBitmap sources because they may be shared.
 */

/** Applies the main game's glass. */
function configureMapPreviewMesh(mesh: THREE.Mesh): void {
    let materials: THREE.Material[];

    if (Array.isArray(mesh.material)) {
        materials = mesh.material;
    } else {
        materials = [mesh.material];
    }
    let usesGlassMaterial = false;

    for (const material of materials) {
        if (
            material.name === 'Glass_mtl' ||
            material.name === 'Glass_outside' ||
            material.name === 'Glass_block'
        ) {
            material.transparent = true;
            material.opacity = 0.3;
            material.depthWrite = false;
            material.needsUpdate = true;
            usesGlassMaterial = true;
        }
    }

    mesh.castShadow = !usesGlassMaterial;
    mesh.receiveShadow = !usesGlassMaterial;
}

export function createMapPreview({
    canvas,
}: MapPreviewOptions = {}): MapPreview {
    if (
        !canvas ||
        typeof window === 'undefined' ||
        typeof document === 'undefined'
    ) {
        return EMPTY_PREVIEW;
    }

    const previewCanvas = canvas;

    let renderer: THREE.WebGLRenderer;

    try {
        renderer = new THREE.WebGLRenderer({
            canvas: previewCanvas,
            antialias: true,
            alpha: true,
        });
    } catch (error: unknown) {
        console.error('Map preview renderer initialization failed:', error);
        return EMPTY_PREVIEW;
    }

    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.9;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.01, 1_000);
    const resourceDisposer = createThreeResourceDisposer({
        shouldCloseImageBitmap: () => true,
        onError: (error: unknown) => {
            console.error('Map preview resource disposal failed:', error);
        },
    });

    const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x536579, 1.8);
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.6);
    keyLight.position.set(4, 7, 6);
    keyLight.castShadow = true;
    /** Shadow map size is set to balance between quality and performance. */
    keyLight.shadow.mapSize.setScalar(1024);
    const fillLight = new THREE.DirectionalLight(0xbfd8ff, 1.2);
    fillLight.position.set(-5, 3, -2);
    scene.add(hemisphereLight, keyLight, keyLight.target, fillLight);

    const bounds = new THREE.Box3();
    const boundingSphere = new THREE.Sphere();
    const rendererSize = new THREE.Vector2();
    const cameraViewSize = new THREE.Vector2();
    const animationTimer = new THREE.Timer();
    const cameraDirection = new THREE.Vector3(0.75, 0.37, 1).normalize();

    let reducedMotionQuery: MediaQueryList | null = null;
    if (typeof window.matchMedia === 'function') {
        reducedMotionQuery = window.matchMedia(
            '(prefers-reduced-motion: reduce)'
        );
    }

    let pivot: THREE.Group | null = null;
    let modelRadius = 0;
    let disposed = false;
    let animationRunning = false;
    let loadGeneration = 0;
    let prefersReducedMotion = false;
    if (reducedMotionQuery) {
        prefersReducedMotion = reducedMotionQuery.matches;
    }
    let resizeObserver: ResizeObserver | null = null;

    const isActiveGeneration = (generation: number): boolean =>
        !disposed && generation === loadGeneration;

    function frameCamera(): void {
        if (!Number.isFinite(modelRadius) || modelRadius <= 0) {
            camera.near = 0.01;
            camera.far = 1_000;
            camera.position.set(0, 2, 5);
            camera.lookAt(0, 0, 0);
            camera.updateProjectionMatrix();
            return;
        }

        camera.getViewSize(1, cameraViewSize);
        const limitingHalfFov = Math.max(
            0.01,
            Math.atan(Math.min(cameraViewSize.x, cameraViewSize.y) / 2)
        );
        /** die Map etwas näher reingezoomt wird,
         * weil man das Map Objekt hauptsächlich verdeckt hinter dem Loginformular sieht
         * Aber an den Bildschirmrändern noch sehr viel ungenutzter Raum ist */
        const distance = (modelRadius / Math.sin(limitingHalfFov)) * 0.42;

        camera.position.copy(cameraDirection).multiplyScalar(distance);
        camera.near = Math.max(0.01, distance - modelRadius * 1.25);
        camera.far = Math.max(camera.near + 1, distance + modelRadius * 2.5);
        camera.lookAt(0, 0, 0);
        camera.updateProjectionMatrix();
    }

    function resizeRenderer(): boolean {
        const rect = previewCanvas.getBoundingClientRect();
        const width = Math.max(1, Math.round(rect.width));
        const height = Math.max(1, Math.round(rect.height));
        const pixelRatio = Math.min(
            window.devicePixelRatio || 1,
            MAX_PIXEL_RATIO
        );
        renderer.getSize(rendererSize);
        const sizeChanged =
            width !== rendererSize.x || height !== rendererSize.y;
        const pixelRatioChanged = pixelRatio !== renderer.getPixelRatio();
        const aspect = width / height;
        const aspectChanged = Math.abs(camera.aspect - aspect) > Number.EPSILON;

        if (sizeChanged || pixelRatioChanged) {
            renderer.setDrawingBufferSize(width, height, pixelRatio);
        }

        if (aspectChanged) {
            camera.aspect = aspect;
            frameCamera();
        }

        return sizeChanged || pixelRatioChanged || aspectChanged;
    }

    function centerAndFrameModel(model: THREE.Object3D): void {
        model.updateMatrixWorld(true);
        bounds.setFromObject(model);

        if (bounds.isEmpty()) {
            modelRadius = 0;
            frameCamera();
            return;
        }

        bounds.getBoundingSphere(boundingSphere);
        model.position.sub(boundingSphere.center);
        modelRadius = boundingSphere.radius;
        frameCamera();
        frameShadowCamera();
    }

    /** add Map-Preview Shadow Map */
    function frameShadowCamera(): void {
        if (!Number.isFinite(modelRadius) || modelRadius <= 0) {
            return;
        }

        const shadowCamera = keyLight.shadow.camera;
        const shadowExtent = modelRadius * 1.25;

        keyLight.position.setLength(modelRadius * 2.5);
        keyLight.target.position.setScalar(0);

        shadowCamera.left = -shadowExtent;
        shadowCamera.right = shadowExtent;
        shadowCamera.top = shadowExtent;
        shadowCamera.bottom = -shadowExtent;
        shadowCamera.near = Math.max(0.01, modelRadius * 0.1);
        shadowCamera.far = modelRadius * 4;
        shadowCamera.updateProjectionMatrix();

        keyLight.shadow.normalBias = modelRadius * 0.002;
        keyLight.shadow.needsUpdate = true;
    }

    function stopAnimation(): void {
        if (animationRunning) {
            renderer.setAnimationLoop(null);
            animationRunning = false;
        }

        animationTimer.reset();
    }

    function canAnimate(): boolean {
        return (
            !disposed &&
            !document.hidden &&
            !prefersReducedMotion &&
            pivot !== null &&
            modelRadius > 0
        );
    }

    function renderOnce(): void {
        if (disposed || document.hidden) {
            return;
        }

        resizeRenderer();
        renderer.render(scene, camera);
    }

    function renderAnimate(): void {
        renderOnce();
        startAnimation();
    }

    function animate(time: DOMHighResTimeStamp): void {
        const rotatingPivot = pivot;

        if (!canAnimate() || rotatingPivot === null) {
            // Three.js schedules its next frame after this callback returns.
            queueMicrotask(stopAnimation);
            return;
        }

        animationTimer.update(time);
        /** begrenze Frame-Zeit */
        const delta = Math.min(animationTimer.getDelta(), 0.1);

        rotatingPivot.rotateY(delta * ROTATION_SPEED);
        resizeRenderer();
        renderer.render(scene, camera);
    }

    function startAnimation(): void {
        if (!canAnimate() || animationRunning) {
            return;
        }

        animationTimer.reset();
        renderer.setAnimationLoop(animate);
        animationRunning = true;
    }

    function onResize(): void {
        renderAnimate();
    }

    function onVisibilityChange(): void {
        if (document.hidden) {
            stopAnimation();
            return;
        }

        renderAnimate();
    }

    function onReducedMotionChange(event: MediaQueryListEvent): void {
        prefersReducedMotion = event.matches;

        if (prefersReducedMotion) {
            stopAnimation();
            renderOnce();
            return;
        }

        renderAnimate();
    }

    window.addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', onVisibilityChange);

    if (typeof window.ResizeObserver === 'function') {
        resizeObserver = new window.ResizeObserver(onResize);
        resizeObserver.observe(previewCanvas);
    }

    reducedMotionQuery?.addEventListener('change', onReducedMotionChange);

    resizeRenderer();
    renderOnce();

    const loader = new GLTFLoader();

    async function loadMap(generation: number): Promise<void> {
        let gltf: Awaited<ReturnType<GLTFLoader['loadAsync']>>;
        try {
            gltf = await loader.loadAsync(MAP_MODEL_PATH);
        } catch (error: unknown) {
            if (isActiveGeneration(generation)) {
                console.error('Map preview failed to load:', error);
                renderOnce();
            }
            return;
        }

        if (!isActiveGeneration(generation)) {
            resourceDisposer.disposeObject3D(gltf.scene);
            return;
        }

        const meshes = gltf.scene.getObjectsByProperty(
            'isMesh',
            true
        ) as THREE.Mesh[];
        for (const mesh of meshes) {
            configureMapPreviewMesh(mesh);
        }

        pivot = new THREE.Group();
        pivot.add(gltf.scene);
        scene.add(pivot);

        resizeRenderer();
        centerAndFrameModel(gltf.scene);
        renderAnimate();
    }

    const generation = ++loadGeneration;
    void loadMap(generation);

    return {
        dispose() {
            if (disposed) {
                return;
            }

            disposed = true;
            loadGeneration++;
            stopAnimation();
            animationTimer.dispose();

            window.removeEventListener('resize', onResize);
            document.removeEventListener(
                'visibilitychange',
                onVisibilityChange
            );
            resizeObserver?.disconnect();
            resizeObserver = null;

            reducedMotionQuery?.removeEventListener(
                'change',
                onReducedMotionChange
            );

            if (pivot) {
                resourceDisposer.disposeObject3D(pivot);
                pivot = null;
            }

            scene.clear();
            renderer.dispose();
            renderer.forceContextLoss();
            console.log('mapPreview successfully disposed!');
        },
    };
}
