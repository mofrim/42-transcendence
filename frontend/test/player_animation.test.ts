import assert from 'node:assert/strict';
import test from 'node:test';

import * as THREE from 'three';
import { PlayerState } from 'ftr-common/sharedTypes';

import {
    normalizePlayerAnimationState,
    resolvePlayerAnimationClip,
} from '../src/game/player_animation.ts';

function clip(name: string): THREE.AnimationClip {
    return new THREE.AnimationClip(name, 1, []);
}

test('resolves clips by name for all both gender character models', () => {
    const maleAnimations = [clip('Running'), clip('Breathing')];
    const femaleAnimations = [clip('Running'), clip('Breathing'), clip('Idle')];

    assert.equal(
        resolvePlayerAnimationClip(maleAnimations, 'Idle', 'Main_Male.glb')
            .name,
        'Breathing'
    );
    assert.equal(
        resolvePlayerAnimationClip(maleAnimations, 'Run', 'Main_Male.glb').name,
        'Running'
    );
    assert.equal(
        resolvePlayerAnimationClip(femaleAnimations, 'Idle', 'Main_Female.glb')
            .name,
        'Breathing'
    );
    assert.equal(
        resolvePlayerAnimationClip(femaleAnimations, 'Run', 'Main_Female.glb')
            .name,
        'Running'
    );
});

test('normalizes shared player states to supported animation states', () => {
    const idleState: PlayerState = normalizePlayerAnimationState(
        PlayerState.Idle
    );
    const runState: PlayerState = normalizePlayerAnimationState(
        PlayerState.Run
    );
    const jumpState: PlayerState = normalizePlayerAnimationState(
        PlayerState.Jump
    );

    assert.equal(idleState, PlayerState.Idle);
    assert.equal(runState, PlayerState.Run);
    assert.equal(jumpState, PlayerState.Idle);
});
