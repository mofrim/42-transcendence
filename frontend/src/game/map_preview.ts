import * as THREE from 'three';

import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const MAP_MODEL_PATH = '/glb/42WOB_v3.glb';
const MAX_PIXEL_RATIO = 1.5;
const ROTATION_SPEED = THREE.MathUtils.degToRad(1.25);

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
function closeImageBitmapValue(
    value: unknown,
    disposedImageBitmaps: WeakSet<ImageBitmap>
): void {
    if (!value) {
        return;
    }

    if (Array.isArray(value)) {
        value.forEach((item) =>
            closeImageBitmapValue(item, disposedImageBitmaps)
        );
        return;
    }

    if (
        typeof ImageBitmap === 'undefined' ||
        !(value instanceof ImageBitmap) ||
        disposedImageBitmaps.has(value)
    ) {
        return;
    }

    disposedImageBitmaps.add(value);

    try {
        value.close();
    } catch {
        // Texture disposal must continue even if a browser rejects closing the source.
    }
}

function disposeTextureValue(
    value: unknown,
    disposedTextures: WeakSet<THREE.Texture>,
    disposedImageBitmaps: WeakSet<ImageBitmap>
): void {
    if (!value) {
        return;
    }

    if (value instanceof THREE.Texture) {
        if (!disposedTextures.has(value)) {
            disposedTextures.add(value);
            closeImageBitmapValue(value.source.data, disposedImageBitmaps);
            value.dispose();
        }
        return;
    }

    if (Array.isArray(value)) {
        value.forEach((item) =>
            disposeTextureValue(item, disposedTextures, disposedImageBitmaps)
        );
    }
}

function disposeMaterial(
    material: THREE.Material | null | undefined,
    disposedMaterials: WeakSet<THREE.Material>,
    disposedTextures: WeakSet<THREE.Texture>,
    disposedImageBitmaps: WeakSet<ImageBitmap>
): void {
    if (!material || disposedMaterials.has(material)) {
        return;
    }

    disposedMaterials.add(material);

    for (const value of Object.values(material)) {
        disposeTextureValue(value, disposedTextures, disposedImageBitmaps);
    }

    if (material instanceof THREE.ShaderMaterial) {
        for (const uniform of Object.values(material.uniforms)) {
            disposeTextureValue(
                uniform.value,
                disposedTextures,
                disposedImageBitmaps
            );
        }
    }

    material.dispose();
}

function disposeObject(object: THREE.Object3D): void {
    const disposedGeometries = new WeakSet<THREE.BufferGeometry>();
    const disposedMaterials = new WeakSet<THREE.Material>();
    const disposedTextures = new WeakSet<THREE.Texture>();
    const disposedImageBitmaps = new WeakSet<ImageBitmap>();
    const disposedSkeletons = new WeakSet<THREE.Skeleton>();

    object.traverse((child) => {
        if (
            child instanceof THREE.Mesh ||
            child instanceof THREE.Line ||
            child instanceof THREE.Points
        ) {
            if (!disposedGeometries.has(child.geometry)) {
                disposedGeometries.add(child.geometry);
                child.geometry.dispose();
            }

            let materials: THREE.Material[];
            if (Array.isArray(child.material)) {
                materials = child.material;
            } else {
                materials = [child.material];
            }

            for (const material of materials) {
                disposeMaterial(
                    material,
                    disposedMaterials,
                    disposedTextures,
                    disposedImageBitmaps
                );
            }
        } else if (child instanceof THREE.Sprite) {
            disposeMaterial(
                child.material,
                disposedMaterials,
                disposedTextures,
                disposedImageBitmaps
            );
        }

        if (
            child instanceof THREE.SkinnedMesh &&
            !disposedSkeletons.has(child.skeleton)
        ) {
            disposedSkeletons.add(child.skeleton);
            child.skeleton.dispose();
        }
    });
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

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.01, 1000);

    const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x536579, 1.8);
    scene.add(hemisphereLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.6);
    keyLight.position.set(4, 7, 6);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xbfd8ff, 1.2);
    fillLight.position.set(-5, 3, -2);
    scene.add(fillLight);

    const bounds = new THREE.Box3();
    const center = new THREE.Vector3();
    const boundingSphere = new THREE.Sphere();
    const rendererSize = new THREE.Vector2();
    const cameraDirection = new THREE.Vector3(0.75, 0.55, 1).normalize();

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
    let previousFrameTime: DOMHighResTimeStamp | null = null;
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
            camera.far = 1000;
            camera.position.set(0, 2, 5);
            camera.lookAt(0, 0, 0);
            camera.updateProjectionMatrix();
            return;
        }

        const verticalFov = THREE.MathUtils.degToRad(camera.fov);
        const horizontalFov =
            2 * Math.atan(Math.tan(verticalFov / 2) * camera.aspect);
        const limitingHalfFov = Math.max(
            0.01,
            Math.min(verticalFov, horizontalFov) / 2
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

        bounds.getCenter(center);
        model.position.sub(center);
        model.updateMatrixWorld(true);

        bounds.setFromObject(model);
        bounds.getCenter(center);

        if (center.lengthSq() > Number.EPSILON) {
            model.position.sub(center);
            model.updateMatrixWorld(true);
            bounds.setFromObject(model);
        }

        bounds.getBoundingSphere(boundingSphere);
        modelRadius = boundingSphere.radius;
        frameCamera();
    }

    function stopAnimation(): void {
        if (animationRunning) {
            renderer.setAnimationLoop(null);
            animationRunning = false;
        }

        previousFrameTime = null;
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

        let delta = 0;
        if (previousFrameTime !== null) {
            delta = Math.min((time - previousFrameTime) / 1000, 0.1);
        }
        previousFrameTime = time;

        rotatingPivot.rotation.y = THREE.MathUtils.euclideanModulo(
            rotatingPivot.rotation.y + delta * ROTATION_SPEED,
            Math.PI * 2
        );
        resizeRenderer();
        renderer.render(scene, camera);
    }

    function startAnimation(): void {
        if (!canAnimate() || animationRunning) {
            return;
        }

        previousFrameTime = null;
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

    if (typeof reducedMotionQuery?.addEventListener === 'function') {
        reducedMotionQuery.addEventListener('change', onReducedMotionChange);
    } else if (typeof reducedMotionQuery?.addListener === 'function') {
        reducedMotionQuery.addListener(onReducedMotionChange);
    }

    resizeRenderer();
    renderOnce();

    const loader = new GLTFLoader();
    const generation = ++loadGeneration;

    try {
        loader.load(
            MAP_MODEL_PATH,
            (gltf) => {
                if (!isActiveGeneration(generation)) {
                    disposeObject(gltf.scene);
                    return;
                }

                pivot = new THREE.Group();
                pivot.add(gltf.scene);
                scene.add(pivot);

                resizeRenderer();
                centerAndFrameModel(gltf.scene);
                renderAnimate();
            },
            undefined,
            (error: unknown) => {
                if (isActiveGeneration(generation)) {
                    console.error('Map preview failed to load:', error);
                    renderOnce();
                }
            }
        );
    } catch (error: unknown) {
        console.error('Map preview failed to load:', error);
    }

    return {
        dispose() {
            if (disposed) {
                return;
            }

            disposed = true;
            loadGeneration++;
            stopAnimation();

            window.removeEventListener('resize', onResize);
            document.removeEventListener(
                'visibilitychange',
                onVisibilityChange
            );
            resizeObserver?.disconnect();
            resizeObserver = null;

            if (typeof reducedMotionQuery?.removeEventListener === 'function') {
                reducedMotionQuery.removeEventListener(
                    'change',
                    onReducedMotionChange
                );
            } else if (
                typeof reducedMotionQuery?.removeListener === 'function'
            ) {
                reducedMotionQuery.removeListener(onReducedMotionChange);
            }

            if (pivot) {
                disposeObject(pivot);
                pivot = null;
            }

            scene.clear();
            renderer.dispose();
            renderer.forceContextLoss();
            console.log('mapPreview successfully disposed!');
        },
    };
}
