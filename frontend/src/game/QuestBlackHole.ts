const COUNTDOWN_FORMAT = new Intl.DurationFormat('en', {
    style: 'digital',
    hoursDisplay: 'auto',
    minutes: '2-digit',
    seconds: '2-digit',
});

/** blackhole timer */
export function formatQuestCountdown(totalSeconds: number): string {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return COUNTDOWN_FORMAT.format({ minutes, seconds });
}
