import { EventLogItems, type EventLogEntry } from './EventLogItems';
import { type Ref } from 'react';

type MatchHistoryProps = {
    readonly entries: readonly EventLogEntry[];
    readonly listref: Ref<HTMLOListElement>;
};

export function MatchHistory({ entries, listref }: MatchHistoryProps) {
    if (entries.length === 0) {
        return <p className='hud-match-history-empty'>No matches yet.</p>;
    }

    return (
        <ol ref={listref} className='hud-event-list hud-match-history-list'>
            <EventLogItems entries={entries} />
        </ol>
    );
}
