export type EventLogEntry = {
    readonly id: string;
    readonly timestamp: string;
    readonly description: string;
    readonly profileNicknames: readonly string[];
};

type EventLogItemsProps = {
    readonly entries: readonly EventLogEntry[];
    readonly onPlayerProfileOpen: (nickname: string) => void;
};

function renderDescription(
    entry: EventLogEntry,
    onPlayerProfileOpen: (nickname: string) => void
) {
    const nicknames = new Set(
        entry.profileNicknames
            .map((nickname) => nickname.trim())
            .filter(Boolean)
    );

    if (nicknames.size === 0) {
        return entry.description;
    }

    const linkedNicknames = new Set<string>();
    const nicknamePattern = Array.from(nicknames)
        .toSorted((left, right) => right.length - left.length)
        .map(RegExp.escape)
        .join('|');
    const parts = entry.description.split(
        new RegExp('(' + nicknamePattern + ')', 'g')
    );

    return parts.map((part, index) => {
        if (!nicknames.has(part) || linkedNicknames.has(part)) {
            return part;
        }
        linkedNicknames.add(part);

        return (
            <button
                type='button'
                className='hud-player-profile-link'
                key={part + '-' + index}
                title={'Open ' + part + ' profile'}
                onClick={() => onPlayerProfileOpen(part)}
            >
                {part}
            </button>
        );
    });
}

export function EventLogItems({
    entries,
    onPlayerProfileOpen,
}: EventLogItemsProps) {
    return entries.map((entry) => (
        <li key={entry.id} className='hud-event-item'>
            <time className='hud-event-time'>{entry.timestamp}</time>
            <span>{renderDescription(entry, onPlayerProfileOpen)}</span>
        </li>
    ));
}
