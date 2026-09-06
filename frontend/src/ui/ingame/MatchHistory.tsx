import { EventLogItems, type EventLogEntry } from './EventLogItems';

type MatchHistoryProps = {
    readonly entries: readonly EventLogEntry[];
};

export function MatchHistory({ entries }: MatchHistoryProps) {
    return (
        <>
            <h3 className='hud-profile-stats-title'>
                Tic-Tac-Toe Match History:
            </h3>
            {entries.length === 0 && (
                <p className='hud-profile-match-empty'>
                    No Tic-Tac-Toe matches yet.
                </p>
            )}
            {entries.length > 0 && (
                <ol className='hud-event-list hud-profile-match-history'>
                    <EventLogItems entries={entries} />
                </ol>
            )}
        </>
    );
}
