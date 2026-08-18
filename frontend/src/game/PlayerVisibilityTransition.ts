import * as THREE from 'three';

import { getPlayerMaterials } from './PlayerModelMaterials.js';

export const PLAYER_VISIBILITY_DURATION_SECONDS = 0.75;
export const PLAYER_VISIBILITY_RISE_DISTANCE = 1.5;

const ENDPOINT_EPSILON = 0.000_000_001;

export type PlayerLifecycleState = 'active' | 'despawning' | 'disposed';

export interface PlayerVisibilityBindings {
    getModel(): THREE.Object3D | null;
    onSpawnComplete?(): void;
    finalize(): void;
    onFinalizeError?(error: unknown): void;
}

type MaterialVisualState = {
    readonly opacity: number;
    readonly transparent: boolean;
};

/** Runs the shared leave animation and releases the player's Three.js resources. */
export class PlayerVisibilityTransition {
    private readonly visiblePosition = new THREE.Vector3();
    private readonly hiddenPosition = new THREE.Vector3();
    private readonly visibleScale = new THREE.Vector3();
    private readonly hiddenScale = new THREE.Vector3();
    private readonly materialStates = new Map<
        THREE.Material,
        MaterialVisualState
    >();
    public readonly completion: Promise<void>;

    private lifecycleState: PlayerLifecycleState = 'active';
    private direction: -1 | 0 | 1 = 0;
    private visibility = 0;
    private capturedModel: THREE.Object3D | null = null;
    private resolveCompletion: () => void = () => undefined;

    public constructor(
        private readonly bindings: PlayerVisibilityBindings,
        private readonly durationSeconds = PLAYER_VISIBILITY_DURATION_SECONDS
    ) {
        if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
            throw new RangeError(
                'Player visibility duration must be finite and positive.'
            );
        }

        this.completion = new Promise<void>((resolve) => {
            this.resolveCompletion = resolve;
        });
    }

    public get state(): PlayerLifecycleState {
        return this.lifecycleState;
    }

    public startSpawn(): void {
        if (this.lifecycleState === 'active' && this.visibility < 1) {
            this.direction = 1;
            this.applyCurrentVisualState();
        }
    }

    public startDespawn(): Promise<void> {
        if (this.lifecycleState === 'active') {
            this.lifecycleState = 'despawning';
            this.direction = -1;
            this.applyCurrentVisualState();
            if (this.visibility <= ENDPOINT_EPSILON) {
                this.visibility = 0;
                this.finishDespawn();
            }
        }

        return this.completion;
    }

    public update(deltaSeconds: number): void {
        if (
            this.lifecycleState === 'disposed' ||
            this.direction === 0 ||
            !Number.isFinite(deltaSeconds) ||
            deltaSeconds <= 0
        ) {
            return;
        }

        if (this.direction === 1 && this.bindings.getModel() === null) {
            return;
        }

        this.visibility = THREE.MathUtils.clamp(
            this.visibility +
                (this.direction * deltaSeconds) / this.durationSeconds,
            0,
            1
        );
        this.applyCurrentVisualState();

        if (this.direction === 1 && this.visibility >= 1 - ENDPOINT_EPSILON) {
            this.visibility = 1;
            this.applyCurrentVisualState();
            this.finishSpawn();
        } else if (
            this.direction === -1 &&
            this.visibility <= ENDPOINT_EPSILON
        ) {
            this.visibility = 0;
            this.applyCurrentVisualState();
            this.finishDespawn();
        }
    }

    public applyCurrentVisualState(): void {
        const model = this.bindings.getModel();
        if (model === null) {
            return;
        }

        this.captureModel(model);
        const visible = THREE.MathUtils.smoothstep(this.visibility, 0, 1);
        model.position.lerpVectors(
            this.hiddenPosition,
            this.visiblePosition,
            visible
        );
        model.scale.lerpVectors(this.hiddenScale, this.visibleScale, visible);

        for (const [material, initial] of this.materialStates) {
            let transparent = true;
            if (visible >= 1 - ENDPOINT_EPSILON) {
                transparent = initial.transparent;
            }
            if (material.transparent !== transparent) {
                material.transparent = transparent;
                material.needsUpdate = true;
            }
            material.opacity = initial.opacity * visible;
        }
    }

    public forceComplete(): void {
        if (this.lifecycleState === 'disposed') {
            return;
        }

        this.lifecycleState = 'despawning';
        this.direction = -1;
        this.visibility = 0;
        this.applyCurrentVisualState();
        this.finishDespawn();
    }

    private captureModel(model: THREE.Object3D): void {
        if (this.capturedModel === model) {
            return;
        }

        this.capturedModel = model;
        this.visiblePosition.copy(model.position);
        this.hiddenPosition.copy(this.visiblePosition);
        this.hiddenPosition.y += PLAYER_VISIBILITY_RISE_DISTANCE;
        this.visibleScale.copy(model.scale);
        this.hiddenScale.set(0, this.visibleScale.y, 0);
        this.materialStates.clear();

        const meshes = model.getObjectsByProperty(
            'isMesh',
            true
        ) as THREE.Mesh[];
        for (const object of meshes) {
            for (const material of getPlayerMaterials(object.material)) {
                if (!this.materialStates.has(material)) {
                    this.materialStates.set(material, {
                        opacity: material.opacity,
                        transparent: material.transparent,
                    });
                }
            }
        }
    }

    private finishSpawn(): void {
        this.direction = 0;
        try {
            this.bindings.onSpawnComplete?.();
        } catch {
            // Gameplay does not depend on the notification callback.
        }
    }

    private finishDespawn(): void {
        if (this.lifecycleState === 'disposed') {
            return;
        }

        this.lifecycleState = 'disposed';
        this.direction = 0;
        try {
            this.bindings.finalize();
        } catch (error: unknown) {
            try {
                this.bindings.onFinalizeError?.(error);
            } catch {
                // Completion still resolves when error reporting fails.
            }
        } finally {
            this.resolveCompletion();
        }
    }
}
