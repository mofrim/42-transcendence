import * as THREE from 'three';

import { PLAYER_NETWORK_UPDATE_INTERVAL_SECONDS } from 'ftr-common/sharedTypes';

/** Smooth remote positions between network updates. */
export class SmootherMovement {
    private readonly startPosition = new THREE.Vector3();
    private readonly targetPosition = new THREE.Vector3();
    private elapsedSeconds = 0;
    private active = false;

    setTarget(
        currentPosition: THREE.Vector3,
        targetPosition: THREE.Vector3
    ): void {
        this.startPosition.copy(currentPosition);
        this.targetPosition.copy(targetPosition);
        this.elapsedSeconds = 0;
        this.active = true;
    }

    update(position: THREE.Vector3, deltaSeconds: number): void {
        if (!this.active) {
            return;
        }

        const safeDeltaSeconds = Math.max(0, deltaSeconds);
        this.elapsedSeconds += safeDeltaSeconds;

        const alpha = THREE.MathUtils.clamp(
            this.elapsedSeconds / PLAYER_NETWORK_UPDATE_INTERVAL_SECONDS,
            0,
            1
        );
        position.lerpVectors(this.startPosition, this.targetPosition, alpha);

        if (alpha >= 1) {
            this.active = false;
        }
    }
}
