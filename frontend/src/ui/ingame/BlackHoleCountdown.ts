export const BLACK_HOLE_DURATION_SECONDS = 5 * 60; // 5 minutes in seconds (05:00)

export function getBlackHoleCountdownDeadline(
    active: boolean,
    nowMilliseconds: number
): number | null {
    if (!active) {
        return null;
    }

    return nowMilliseconds + BLACK_HOLE_DURATION_SECONDS * 1_000;
}
