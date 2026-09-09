import { EventLogItems, type EventLogEntry } from './EventLogItems';

type MatchHistoryProps = {
    readonly entries: readonly EventLogEntry[];
};

export function MatchHistory({ entries }: MatchHistoryProps) {
    return (
        <>
            <h3 className='hud-match-history-title'>
                Tic-Tac-Toe Match History:
            </h3>
            {entries.length === 0 && (
                <p className='hud-match-history-empty'>
                    No Tic-Tac-Toe matches yet.
                </p>
            )}
            {entries.length > 0 && (
                <ol className='hud-event-list hud-match-history-list'>
                    <EventLogItems entries={entries} />
                </ol>
            )}
        </>
    );
}
