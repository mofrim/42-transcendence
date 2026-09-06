export type EventLogEntry = {
    readonly id: string;
    readonly timestamp: string;
    readonly description: string;
};

type EventLogItemsProps = {
    readonly entries: readonly EventLogEntry[];
};

export function EventLogItems({ entries }: EventLogItemsProps) {
    return entries.map((entry) => (
        <li key={entry.id} className='hud-event-item'>
            <time className='hud-event-time'>{entry.timestamp}</time>
            <span>{entry.description}</span>
        </li>
    ));
}
