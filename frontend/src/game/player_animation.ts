import { AnimationClip } from 'three';
import type { AnimationAction, AnimationMixer } from 'three';
import { PlayerState } from '@common/types';

/** Es gibt noch kein Jump. */
const PLAYER_ANIMATION_STATE = Object.freeze({
    Idle: PlayerState.Idle,
    Run: PlayerState.Run,
    Falling: PlayerState.Falling,
    Angry: PlayerState.Angry,
    ArmStretch: PlayerState.ArmStretch,
    Drinking: PlayerState.Drinking,
    Relieved: PlayerState.Relieved,
    Strong: PlayerState.Strong,
    Surprised: PlayerState.Surprised,
    ThumbsUp: PlayerState.ThumbsUp,
    Victory: PlayerState.Victory
});

type PlayerAnimationState =
    (typeof PLAYER_ANIMATION_STATE)[keyof typeof PLAYER_ANIMATION_STATE];
type PlayerAnimationActions = Record<PlayerAnimationState, AnimationAction>;

type PlayerAnimationMixerCleanupOperation = 'stopAllAction' | 'uncacheRoot';

export function cleanupPlayerAnimationMixer(
    mixer: AnimationMixer,
    onError?: (
        error: unknown,
        operation: PlayerAnimationMixerCleanupOperation
    ) => void
): void {
    const report = (
        error: unknown,
        operation: PlayerAnimationMixerCleanupOperation
    ): void => {
        if (!onError) {
            return;
        }

        try {
            onError(error, operation);
        } catch {
            return;
        }
    };

    try {
        mixer.stopAllAction();
    } catch (error: unknown) {
        report(error, 'stopAllAction');
    }

    try {
        mixer.uncacheRoot(mixer.getRoot());
    } catch (error: unknown) {
        report(error, 'uncacheRoot');
    }
}

/**
 * beim weiblichen Modell Breathing (Index 0, Hände seitlich) der gewünschte Stillstand,
 * nicht der zusätzliche Clip Idle (Index 1, Hände hinten)
 */
const CLIP_NAME_BY_STATE: Readonly<Record<PlayerAnimationState, string>> =
    Object.freeze({
        [PLAYER_ANIMATION_STATE.Idle]: 'Breathing',
        [PLAYER_ANIMATION_STATE.Run]: 'Running',
        [PLAYER_ANIMATION_STATE.Falling]: 'Falling',
        [PLAYER_ANIMATION_STATE.Angry]: 'Angry',
        [PLAYER_ANIMATION_STATE.ArmStretch]: 'ArmStretch',
        [PLAYER_ANIMATION_STATE.Drinking]: 'Drinking',
        [PLAYER_ANIMATION_STATE.Relieved]: 'Relieved',
        [PLAYER_ANIMATION_STATE.Strong]: 'Strong',
        [PLAYER_ANIMATION_STATE.Surprised]: 'Surprised',
        [PLAYER_ANIMATION_STATE.ThumbsUp]: 'ThumbsUp',
        [PLAYER_ANIMATION_STATE.Victory]: 'Victory'
    });

export function normalizePlayerAnimationState(
    state: unknown
): PlayerAnimationState {
    switch (state) {
        case PLAYER_ANIMATION_STATE.Idle:
        case PLAYER_ANIMATION_STATE.Run:
        case PLAYER_ANIMATION_STATE.Falling:
        case PLAYER_ANIMATION_STATE.Angry:
        case PLAYER_ANIMATION_STATE.ArmStretch:
        case PLAYER_ANIMATION_STATE.Drinking:
        case PLAYER_ANIMATION_STATE.Relieved:
        case PLAYER_ANIMATION_STATE.Strong:
        case PLAYER_ANIMATION_STATE.Surprised:
        case PLAYER_ANIMATION_STATE.ThumbsUp:
        case PLAYER_ANIMATION_STATE.Victory:
            return state;
        default:
            return PLAYER_ANIMATION_STATE.Idle;
    }
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
    const angryClip = resolvePlayerAnimationClip(
        animations,
        PLAYER_ANIMATION_STATE.Angry,
        modelPath
    );
    const fallingClip = resolvePlayerAnimationClip(
        animations,
        PLAYER_ANIMATION_STATE.Falling,
        modelPath
    );
    const armStretchClip = resolvePlayerAnimationClip(
        animations,
        PLAYER_ANIMATION_STATE.ArmStretch,
        modelPath
    );
    const drinkingClip = resolvePlayerAnimationClip(
        animations,
        PLAYER_ANIMATION_STATE.Drinking,
        modelPath
    );
    const relievedClip = resolvePlayerAnimationClip(
        animations,
        PLAYER_ANIMATION_STATE.Relieved,
        modelPath
    );
    const strongClip = resolvePlayerAnimationClip(
        animations,
        PLAYER_ANIMATION_STATE.Strong,
        modelPath
    );
    const surprisedClip = resolvePlayerAnimationClip(
        animations,
        PLAYER_ANIMATION_STATE.Surprised,
        modelPath
    );
    const thumbsUpClip = resolvePlayerAnimationClip(
        animations,
        PLAYER_ANIMATION_STATE.ThumbsUp,
        modelPath
    );
    const victoryClip = resolvePlayerAnimationClip(
        animations,
        PLAYER_ANIMATION_STATE.Victory,
        modelPath
    );

    const actions = {
        [PLAYER_ANIMATION_STATE.Idle]: mixer.clipAction(idleClip),
        [PLAYER_ANIMATION_STATE.Run]: mixer.clipAction(runClip),
        [PLAYER_ANIMATION_STATE.Angry]: mixer.clipAction(angryClip),
        [PLAYER_ANIMATION_STATE.Falling]: mixer.clipAction(fallingClip),
        [PLAYER_ANIMATION_STATE.ArmStretch]: mixer.clipAction(armStretchClip),
        [PLAYER_ANIMATION_STATE.Drinking]: mixer.clipAction(drinkingClip),
        [PLAYER_ANIMATION_STATE.Relieved]: mixer.clipAction(relievedClip),
        [PLAYER_ANIMATION_STATE.Strong]: mixer.clipAction(strongClip),
        [PLAYER_ANIMATION_STATE.Surprised]: mixer.clipAction(surprisedClip),
        [PLAYER_ANIMATION_STATE.ThumbsUp]: mixer.clipAction(thumbsUpClip),
        [PLAYER_ANIMATION_STATE.Victory]: mixer.clipAction(victoryClip),
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
