import { AnimationClip } from 'three';
import type { AnimationAction, AnimationMixer } from 'three';
import { PlayerState } from 'ftr-common/sharedTypes';

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
    Victory: PlayerState.Victory,
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
        [PLAYER_ANIMATION_STATE.Victory]: 'Victory',
    });

const PLAYER_ANIMATION_ORDER = [
    PLAYER_ANIMATION_STATE.Idle,
    PLAYER_ANIMATION_STATE.Run,
    PLAYER_ANIMATION_STATE.Angry,
    PLAYER_ANIMATION_STATE.Falling,
    PLAYER_ANIMATION_STATE.ArmStretch,
    PLAYER_ANIMATION_STATE.Drinking,
    PLAYER_ANIMATION_STATE.Relieved,
    PLAYER_ANIMATION_STATE.Strong,
    PLAYER_ANIMATION_STATE.Surprised,
    PLAYER_ANIMATION_STATE.ThumbsUp,
    PLAYER_ANIMATION_STATE.Victory,
] as const;

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
    const clips = PLAYER_ANIMATION_ORDER.map(
        (state) =>
            [
                state,
                resolvePlayerAnimationClip(animations, state, modelPath),
            ] as const
    );
    const actions = {} as PlayerAnimationActions;

    for (const [state, clip] of clips) {
        const action = mixer.clipAction(clip);
        action.enabled = true;
        action.setEffectiveTimeScale(1);
        let weight = 0;
        if (state === PLAYER_ANIMATION_STATE.Idle) {
            weight = 1;
        }
        action.setEffectiveWeight(weight);
        actions[state] = action;
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
