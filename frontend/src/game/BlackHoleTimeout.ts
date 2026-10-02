import { useEffect, useEffectEvent, useState } from 'react';
import {
    BLACK_HOLE_DURATION_SECONDS,
    type SaveGameSnapshot,
} from 'ftr-common/sharedTypes';

const COUNTDOWN_FORMAT = new Intl.DurationFormat('en', {
    style: 'digital',
    hoursDisplay: 'auto',
});

export type BlackHoleRestore = {
    readonly version: number;
    readonly secondsRemaining: number;
    readonly completed: boolean;
};

type UseBlackHoleTimeoutOptions = {
    readonly active: boolean;
    readonly connected: boolean;
    readonly restoredSecondsRemaining: number;
    readonly restoredCompleted: boolean;
    readonly evaluationCompleted: boolean;
    readonly onCountdownExpired: (() => void) | undefined;
    readonly onTimerChange:
        ((secondsRemaining: number, completed: boolean) => void) | undefined;
};

type BlackHoleTimeoutState = {
    readonly countdown: string;
    readonly questCompleted: boolean;
};

export function createBlackHoleRestore(
    snapshot: SaveGameSnapshot | null,
    version: number
): BlackHoleRestore {
    return {
        version,
        secondsRemaining:
            snapshot?.blackHoleSecondsRemaining ?? BLACK_HOLE_DURATION_SECONDS,
        completed: snapshot?.blackHoleCountdownCompleted ?? false,
    };
}

export function hasRestoredBlackHoleCountdownStarted(
    snapshot: SaveGameSnapshot | null
): boolean {
    return (
        snapshot !== null &&
        (snapshot.blackHoleCountdownCompleted ||
            snapshot.blackHoleSecondsRemaining < BLACK_HOLE_DURATION_SECONDS)
    );
}

export function isInitialBlackHoleRestore(
    completed: boolean,
    secondsRemaining: number
): boolean {
    return !completed && secondsRemaining === BLACK_HOLE_DURATION_SECONDS;
}

export function calculateBlackHoleSecondsRemaining(
    sessionStartedAtMs: number,
    completedAtMs: number
): number {
    const elapsedMs = Math.max(0, completedAtMs - sessionStartedAtMs);
    const remainingMs = BLACK_HOLE_DURATION_SECONDS * 1_000 - elapsedMs;
    return Math.max(
        0,
        Math.min(BLACK_HOLE_DURATION_SECONDS, Math.ceil(remainingMs / 1_000))
    );
}

export function formatBlackHoleTime(secondsRemaining: number | null): string {
    if (secondsRemaining === null) {
        return '—';
    }

    const minutes = Math.floor(secondsRemaining / 60);
    const seconds = secondsRemaining % 60;
    return minutes + ':' + seconds.toString().padStart(2, '0');
}

export function formatQuestCountdown(totalSeconds: number): string {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return COUNTDOWN_FORMAT.format({ minutes, seconds });
}

export function useBlackHoleTimeout({
    active,
    connected,
    restoredSecondsRemaining,
    restoredCompleted,
    evaluationCompleted,
    onCountdownExpired,
    onTimerChange,
}: UseBlackHoleTimeoutOptions): BlackHoleTimeoutState {
    const [secondsRemaining, setSecondsRemaining] = useState(
        restoredSecondsRemaining
    );
    const handleCountdownExpired = useEffectEvent((): void => {
        onCountdownExpired?.();
    });
    const handleTimerChange = useEffectEvent(
        (nextSecondsRemaining: number, completed: boolean): void => {
            onTimerChange?.(nextSecondsRemaining, completed);
        }
    );
    const getSecondsRemaining = useEffectEvent((): number => secondsRemaining);

    const countdownCompleted = restoredCompleted || evaluationCompleted;
    const countdownRunning = active && connected && !countdownCompleted;
    const questCompleted = active && countdownCompleted && secondsRemaining > 0;

    let hourglass = '⌛';
    if (secondsRemaining % 2 !== 0) {
        hourglass = '⏳';
    }
    const countdown = hourglass + formatQuestCountdown(secondsRemaining);

    useEffect(() => {
        if (!active || !connected || !evaluationCompleted) {
            return;
        }

        handleTimerChange(getSecondsRemaining(), true);
    }, [active, connected, evaluationCompleted]);

    useEffect(() => {
        if (!countdownRunning) {
            return;
        }

        const deadline = Date.now() + getSecondsRemaining() * 1_000;
        let intervalId: number | undefined;

        const updateTimer = (): void => {
            const millisecondsRemaining = deadline - Date.now();
            const nextSecondsRemaining = Math.max(
                0,
                Math.ceil(millisecondsRemaining / 1_000)
            );

            setSecondsRemaining(nextSecondsRemaining);

            if (nextSecondsRemaining > 0) {
                handleTimerChange(nextSecondsRemaining, false);
            } else if (intervalId !== undefined) {
                window.clearInterval(intervalId);
                intervalId = undefined;
                handleTimerChange(0, false);
                handleCountdownExpired();
            }
        };

        intervalId = window.setInterval(updateTimer, 1_000);
        updateTimer();

        return () => {
            if (intervalId !== undefined) {
                window.clearInterval(intervalId);
            }
        };
    }, [countdownRunning]);

    return {
        countdown,
        questCompleted,
    };
}
