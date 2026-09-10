import { EventLogItems, type EventLogEntry } from './EventLogItems';

type MatchHistoryProps = {
    readonly entries: readonly EventLogEntry[];
};

export function MatchHistory({ entries }: MatchHistoryProps) {
    if (entries.length === 0) {
        return <p className='hud-match-history-empty'>No matches yet.</p>;
    }

    return (
        <ol className='hud-event-list hud-match-history-list'>
            <EventLogItems entries={entries} />
        </ol>
    );
}
