import { AnimationClip } from 'three';
import type { AnimationAction, AnimationMixer } from 'three';

/** Es gibt noch kein Jump. */
const PLAYER_ANIMATION_STATE = Object.freeze({
    Idle: 'Idle',
    Run: 'Run',
});

type PlayerAnimationState =
    (typeof PLAYER_ANIMATION_STATE)[keyof typeof PLAYER_ANIMATION_STATE];
type PlayerAnimationActions = Record<PlayerAnimationState, AnimationAction>;

/**
 * beim weiblichen Modell Breathing (Index 0, Hände seitlich) der gewünschte Stillstand,
 * nicht der zusätzliche Clip Idle (Index 1, Hände hinten)
 */
const CLIP_NAME_BY_STATE: Readonly<Record<PlayerAnimationState, string>> =
    Object.freeze({
        [PLAYER_ANIMATION_STATE.Idle]: 'Breathing',
        [PLAYER_ANIMATION_STATE.Run]: 'Running',
    });

export function normalizePlayerAnimationState(
    state: unknown
): PlayerAnimationState {
    return state === PLAYER_ANIMATION_STATE.Run
        ? PLAYER_ANIMATION_STATE.Run
        : PLAYER_ANIMATION_STATE.Idle;
}

export function resolvePlayerAnimationClip(
    animations: readonly AnimationClip[] = [],
    requestedState: unknown,
    modelPath: string = 'character'
): AnimationClip {
    const clips: AnimationClip[] = Array.isArray(animations)
        ? [...animations]
        : [];
    const state = normalizePlayerAnimationState(requestedState);
    const expectedName = CLIP_NAME_BY_STATE[state];
    const clip = AnimationClip.findByName(clips, expectedName);

    if (clip) {
        return clip;
    }

    const availableNames = clips.length
        ? clips.map((clip) => clip?.name || '<unnamed>').join(', ')
        : '<none>';

    throw new Error(
        `Missing ${state} animation "${expectedName}" for "${modelPath}". Available: ${availableNames}.`
    );
}

export function createPlayerAnimationActions(
    mixer: AnimationMixer,
    animations: readonly AnimationClip[],
    modelPath: string
): PlayerAnimationActions {
    const idleClip = resolvePlayerAnimationClip(
        animations,
        PLAYER_ANIMATION_STATE.Idle,
        modelPath
    );
    const runClip = resolvePlayerAnimationClip(
        animations,
        PLAYER_ANIMATION_STATE.Run,
        modelPath
    );

    const actions = {
        [PLAYER_ANIMATION_STATE.Idle]: mixer.clipAction(idleClip),
        [PLAYER_ANIMATION_STATE.Run]: mixer.clipAction(runClip),
    };

    for (const [state, action] of Object.entries(actions)) {
        action.enabled = true;
        action.setEffectiveTimeScale(1);
        action.setEffectiveWeight(
            state === PLAYER_ANIMATION_STATE.Idle ? 1 : 0
        );
    }

    actions.Idle.reset().play();

    return actions;
}

/** transitions to Run and normalizes unsupported states to Idle */
export function transitionPlayerAnimation(
    actions: Partial<PlayerAnimationActions> | null | undefined,
    currentState: unknown,
    requestedState: unknown,
    fadeDuration: number
): PlayerAnimationState {
    const fromState = normalizePlayerAnimationState(currentState);
    const toState = normalizePlayerAnimationState(requestedState);

    if (fromState === toState) {
        return toState;
    }

    const fromAction = actions?.[fromState];
    const toAction = actions?.[toState];

    if (!fromAction || !toAction) {
        return fromState;
    }

    const duration =
        Number.isFinite(fadeDuration) && fadeDuration > 0 ? fadeDuration : 0;

    fromAction.stopFading();
    toAction.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).play();

    if (duration === 0) {
        fromAction.stop();
    } else {
        toAction.crossFadeFrom(fromAction, duration, false);
    }

    return toState;
}
