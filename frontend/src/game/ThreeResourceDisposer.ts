import * as THREE from 'three';

type DisposalInput<T> = T | readonly T[] | null | undefined;

interface ThreeResourceDisposerOptions {
    shouldDisposeTexture?(texture: THREE.Texture): boolean;
    shouldCloseImageBitmap?(bitmap: ImageBitmap, owner: THREE.Texture): boolean;
    onError?(error: unknown): void;
}

export interface ThreeResourceDisposer {
    disposeObject3D(value: DisposalInput<THREE.Object3D>): void;
    disposeMaterial(value: DisposalInput<THREE.Material>): void;
    disposeTexture(value: DisposalInput<THREE.Texture>): void;
}

function forEachInput<T>(
    value: DisposalInput<T>,
    callback: (item: T) => void
): void {
    if (value === null || value === undefined) {
        return;
    }
    if (Array.isArray(value)) {
        for (const item of value) {
            callback(item);
        }
        return;
    }
    callback(value as T);
}

export function createThreeResourceDisposer(
    options: ThreeResourceDisposerOptions = {}
): ThreeResourceDisposer {
    const geometries = new WeakSet<THREE.BufferGeometry>();
    const materials = new WeakSet<THREE.Material>();
    const textures = new WeakSet<THREE.Texture>();
    const skeletons = new WeakSet<THREE.Skeleton>();
    const bitmaps = new WeakSet<ImageBitmap>();

    function report(error: unknown): void {
        try {
            options.onError?.(error);
        } catch {
            // Cleanup continues even when reporting fails.
        }
    }

    function safely(callback: () => void): void {
        try {
            callback();
        } catch (error: unknown) {
            report(error);
        }
    }

    /**
     * Texture.dispose() releases GPU resources, but Three.js does not close
     * ImageBitmap sources because they may be shared.
     */
    function closeBitmapValue(
        value: unknown,
        owner: THREE.Texture,
        visited: WeakSet<object>
    ): void {
        if (typeof ImageBitmap === 'undefined' || value === null) {
            return;
        }
        if (value instanceof ImageBitmap) {
            if (bitmaps.has(value)) {
                return;
            }
            let shouldClose = false;
            try {
                shouldClose =
                    options.shouldCloseImageBitmap?.(value, owner) === true;
            } catch (error: unknown) {
                report(error);
            }
            if (shouldClose) {
                bitmaps.add(value);
                // Texture disposal must continue even if a browser rejects closing the source.
                safely(() => value.close());
            }
            return;
        }
        if (Array.isArray(value)) {
            if (visited.has(value)) {
                return;
            }
            visited.add(value);
            for (const item of value) {
                closeBitmapValue(item, owner, visited);
            }
        }
    }

    function disposeTexture(texture: THREE.Texture): void {
        if (textures.has(texture)) {
            return;
        }

        let shouldDispose = true;
        try {
            if (options.shouldDisposeTexture) {
                shouldDispose = options.shouldDisposeTexture(texture);
            }
        } catch (error: unknown) {
            report(error);
            return;
        }
        if (!shouldDispose) {
            return;
        }

        textures.add(texture);
        closeBitmapValue(texture.source.data, texture, new WeakSet<object>());
        safely(() => texture.dispose());
    }

    function disposeTextureValue(
        value: unknown,
        visited: WeakSet<object>
    ): void {
        if (value instanceof THREE.Texture) {
            disposeTexture(value);
            return;
        }
        if (Array.isArray(value)) {
            if (visited.has(value)) {
                return;
            }
            visited.add(value);
            for (const item of value) {
                disposeTextureValue(item, visited);
            }
            return;
        }
        if (
            typeof value === 'object' &&
            value !== null &&
            Object.getPrototypeOf(value) === Object.prototype
        ) {
            if (visited.has(value)) {
                return;
            }
            visited.add(value);
            for (const item of Object.values(value)) {
                disposeTextureValue(item, visited);
            }
        }
    }

    function disposeMaterial(material: THREE.Material): void {
        if (materials.has(material)) {
            return;
        }
        materials.add(material);

        const visited = new WeakSet<object>();
        for (const value of Object.values(material)) {
            disposeTextureValue(value, visited);
        }
        safely(() => material.dispose());
    }

    function disposeObject3D(object: THREE.Object3D): void {
        object.removeFromParent();
        safely(() => {
            object.traverse((child) => {
                if (
                    child instanceof THREE.SkinnedMesh &&
                    !skeletons.has(child.skeleton)
                ) {
                    skeletons.add(child.skeleton);
                    safely(() => child.skeleton.dispose());
                }

                if (
                    child instanceof THREE.Mesh ||
                    child instanceof THREE.Line ||
                    child instanceof THREE.Points
                ) {
                    if (!geometries.has(child.geometry)) {
                        geometries.add(child.geometry);
                        safely(() => child.geometry.dispose());
                    }
                    forEachInput(child.material, disposeMaterial);
                } else if (child instanceof THREE.Sprite) {
                    disposeMaterial(child.material);
                }
            });
        });
    }

    return {
        disposeObject3D(value): void {
            forEachInput(value, disposeObject3D);
        },
        disposeMaterial(value): void {
            forEachInput(value, disposeMaterial);
        },
        disposeTexture(value): void {
            forEachInput(value, disposeTexture);
        },
    };
}
