import * as THREE from 'three';

import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const MAP_MODEL_PATH = '/glb/42WOB_v3.glb';
const MAX_PIXEL_RATIO = 1.5;
const ROTATION_SPEED = THREE.MathUtils.degToRad(1.25);

function createSafePreview() {
    return {
        dispose() {},
    };
}

function isImageBitmap(value) {
    if (
        !value ||
        typeof value !== 'object' ||
        typeof value.close !== 'function'
    ) {
        return false;
    }

    const ImageBitmapConstructor = globalThis.ImageBitmap;
    return (
        (typeof ImageBitmapConstructor === 'function' &&
            value instanceof ImageBitmapConstructor) ||
        Object.prototype.toString.call(value) === '[object ImageBitmap]'
    );
}

function closeImageBitmapValue(value, disposedImageBitmaps) {
    if (!value) {
        return;
    }

    if (Array.isArray(value)) {
        value.forEach((item) =>
            closeImageBitmapValue(item, disposedImageBitmaps)
        );
        return;
    }

    if (!isImageBitmap(value) || disposedImageBitmaps.has(value)) {
        return;
    }

    disposedImageBitmaps.add(value);

    try {
        value.close();
    } catch {
        // Texture disposal must continue even if a browser rejects closing the source.
    }
}

function disposeTextureValue(value, disposedTextures, disposedImageBitmaps) {
    if (!value) {
        return;
    }

    if (value.isTexture) {
        if (!disposedTextures.has(value)) {
            disposedTextures.add(value);
            closeImageBitmapValue(value.source?.data, disposedImageBitmaps);
            closeImageBitmapValue(value.image, disposedImageBitmaps);
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
    material,
    disposedMaterials,
    disposedTextures,
    disposedImageBitmaps
) {
    if (!material || disposedMaterials.has(material)) {
        return;
    }

    disposedMaterials.add(material);

    for (const value of Object.values(material)) {
        disposeTextureValue(value, disposedTextures, disposedImageBitmaps);
    }

    if (material.uniforms) {
        for (const uniform of Object.values(material.uniforms)) {
            disposeTextureValue(
                uniform?.value,
                disposedTextures,
                disposedImageBitmaps
            );
        }
    }

    material.dispose();
}

function disposeObject(object) {
    const disposedGeometries = new Set();
    const disposedMaterials = new Set();
    const disposedTextures = new Set();
    const disposedImageBitmaps = new Set();
    const disposedSkeletons = new Set();

    object.traverse((child) => {
        if (child.geometry && !disposedGeometries.has(child.geometry)) {
            disposedGeometries.add(child.geometry);
            child.geometry.dispose();
        }

        const materials = Array.isArray(child.material)
            ? child.material
            : [child.material];

        materials.forEach((material) => {
            disposeMaterial(
                material,
                disposedMaterials,
                disposedTextures,
                disposedImageBitmaps
            );
        });

        if (child.skeleton && !disposedSkeletons.has(child.skeleton)) {
            disposedSkeletons.add(child.skeleton);
            child.skeleton.dispose?.();
        }
    });
}

export function createMapPreview({ canvas } = {}) {
    if (
        !canvas ||
        typeof window === 'undefined' ||
        typeof document === 'undefined'
    ) {
        return createSafePreview();
    }

    let renderer;

    try {
        renderer = new THREE.WebGLRenderer({
            canvas,
            antialias: true,
            alpha: true,
        });
    } catch (error) {
        console.error('Map preview renderer initialization failed:', error);
        return createSafePreview();
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
    const cameraDirection = new THREE.Vector3(0.75, 0.55, 1).normalize();
    const reducedMotionQuery =
        typeof window.matchMedia === 'function'
            ? window.matchMedia('(prefers-reduced-motion: reduce)')
            : null;

    let pivot = null;
    let modelRadius = 0;
    let disposed = false;
    let frameId = null;
    let previousFrameTime = null;
    let loadGeneration = 0;
    let rendererWidth = 0;
    let rendererHeight = 0;
    let rendererPixelRatio = 0;
    let prefersReducedMotion = reducedMotionQuery?.matches ?? false;
    let resizeObserver = null;

    function frameCamera() {
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

    function resizeRenderer() {
        const rect =
            typeof canvas.getBoundingClientRect === 'function'
                ? canvas.getBoundingClientRect()
                : null;
        const width = Math.max(
            1,
            Math.round(rect?.width ?? canvas.clientWidth ?? 1)
        );
        const height = Math.max(
            1,
            Math.round(rect?.height ?? canvas.clientHeight ?? 1)
        );
        const pixelRatio = Math.min(
            window.devicePixelRatio || 1,
            MAX_PIXEL_RATIO
        );
        const sizeChanged =
            width !== rendererWidth || height !== rendererHeight;
        const pixelRatioChanged = pixelRatio !== rendererPixelRatio;
        const aspect = width / height;
        const aspectChanged = Math.abs(camera.aspect - aspect) > Number.EPSILON;

        if (pixelRatioChanged) {
            rendererPixelRatio = pixelRatio;
            renderer.setPixelRatio(pixelRatio);
        }

        if (sizeChanged || pixelRatioChanged) {
            rendererWidth = width;
            rendererHeight = height;
            renderer.setSize(width, height, false);
        }

        if (aspectChanged) {
            camera.aspect = aspect;
            frameCamera();
        }

        return sizeChanged || pixelRatioChanged || aspectChanged;
    }

    function centerAndFrameModel(model) {
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

    function stopAnimation() {
        if (frameId !== null) {
            window.cancelAnimationFrame(frameId);
            frameId = null;
        }

        previousFrameTime = null;
    }

    function canAnimate() {
        return (
            !disposed &&
            !document.hidden &&
            !prefersReducedMotion &&
            pivot !== null &&
            modelRadius > 0
        );
    }

    function renderOnce() {
        if (disposed || document.hidden) {
            return;
        }

        resizeRenderer();
        renderer.render(scene, camera);
    }

    function animate(time) {
        frameId = null;

        if (!canAnimate()) {
            previousFrameTime = null;
            return;
        }

        const delta =
            previousFrameTime === null
                ? 0
                : Math.min((time - previousFrameTime) / 1000, 0.1);
        previousFrameTime = time;

        pivot.rotation.y =
            (pivot.rotation.y + delta * ROTATION_SPEED) % (Math.PI * 2);
        resizeRenderer();
        renderer.render(scene, camera);
        frameId = window.requestAnimationFrame(animate);
    }

    function startAnimation() {
        if (!canAnimate() || frameId !== null) {
            return;
        }

        previousFrameTime = null;
        frameId = window.requestAnimationFrame(animate);
    }

    function onResize() {
        renderOnce();
        startAnimation();
    }

    function onVisibilityChange() {
        if (document.hidden) {
            stopAnimation();
            return;
        }

        renderOnce();
        startAnimation();
    }

    function onReducedMotionChange(event) {
        prefersReducedMotion = event.matches;

        if (prefersReducedMotion) {
            stopAnimation();
            renderOnce();
            return;
        }

        renderOnce();
        startAnimation();
    }

    window.addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', onVisibilityChange);

    if (typeof window.ResizeObserver === 'function') {
        resizeObserver = new window.ResizeObserver(onResize);
        resizeObserver.observe(canvas);
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
                if (disposed || generation !== loadGeneration) {
                    disposeObject(gltf.scene);
                    return;
                }

                pivot = new THREE.Group();
                pivot.add(gltf.scene);
                scene.add(pivot);

                resizeRenderer();
                centerAndFrameModel(gltf.scene);
                renderOnce();
                startAnimation();
            },
            undefined,
            (error) => {
                if (!disposed && generation === loadGeneration) {
                    console.error('Map preview failed to load:', error);
                    renderOnce();
                }
            }
        );
    } catch (error) {
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
                scene.remove(pivot);
                disposeObject(pivot);
                pivot = null;
            }

            scene.clear();
            renderer.dispose();
            renderer.forceContextLoss?.();
        },
    };
}
