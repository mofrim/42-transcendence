import { useEffect, useRef, useState } from 'react';
import type { SyntheticEvent } from 'react';

import './GameUI.css';

const QUEST_LOG_ID = 'game-quest-log';
const PROFILE_PANEL_ID = 'game-profile-panel';
const EVENT_LOG_TITLE_ID = 'game-event-log-title';

export type QuestLogEntry = {
    readonly id: string;
    readonly text: string;
    readonly completed?: boolean;
};

export type EventLogEntry = {
    readonly id: string;
    readonly timestamp: string;
    readonly description: string;
};

type GameUIProps = {
    readonly nickname: string;
    readonly quests?: readonly QuestLogEntry[];
    readonly events?: readonly EventLogEntry[];
};

/** Beispielaufgaben für das Quest Log. */
const DEFAULT_QUESTS: readonly QuestLogEntry[] = [
    {
        id: 'enter-campus',
        text: 'Enter 42 Campus via Token',
    },
    {
        id: 'win-rps',
        text: 'Gewinne eine Runde Schere, Stein, Papier',
    },
    {
        id: 'win-ttt',
        text: 'Gewinne eine Runde Tic-Tac-Toe',
    },
    {
        id: 'meet-player',
        text: 'Finde einen anderen Spieler',
    },
    {
        id: 'avoid-blackhole',
        text: "Don't get blackholed",
    },
];

/** Beispielereignisse für das Event Log. */
const DEFAULT_EVENTS: readonly EventLogEntry[] = [
    {
        id: 'user-b-logout',
        timestamp: '16:52:00',
        description: '"UserB" log out',
    },
    {
        id: 'user-c-login',
        timestamp: '16:52:01',
        description: '"UserC" log in',
    },
    {
        id: 'user-c-message',
        timestamp: '16:52:05',
        description: '"UserC" says: Hallo',
    },
    {
        id: 'user-a-message',
        timestamp: '16:52:10',
        description: '"UserA" says: Hi',
    },
    {
        id: 'user-b-login',
        timestamp: '16:52:15',
        description: '"UserB" log in',
    },
    {
        id: 'user-a-login',
        timestamp: '16:52:20',
        description: '"UserA" log in',
    },
    {
        id: 'user-a-message-2',
        timestamp: '16:52:25',
        description: '"UserA" says: challenge?',
    },
    {
        id: 'user-c-message-2',
        timestamp: '16:52:30',
        description: '"UserC" says: accepted!',
    },
    {
        id: 'user-b-message-2',
        timestamp: '16:52:35',
        description: '"UserB" says: lets play!',
    },
    {
        id: 'user-b-logout-2',
        timestamp: '16:52:40',
        description: 'UserB rage quits!',
    },
    {
        id: 'user-c-message-3',
        timestamp: '16:52:30',
        description: '"UserC" says: okay?',
    },
];

/**
 * React HUD for controls that do not belong in the Three.js scene.
 */
export function GameUI({
    nickname,
    quests = DEFAULT_QUESTS,
    events = DEFAULT_EVENTS,
}: GameUIProps) {
    const [isQuestLogOpen, setIsQuestLogOpen] = useState(false);
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const eventListRef = useRef<HTMLOListElement>(null);

    const handleQuestLogToggle = (): void => {
        setIsQuestLogOpen((isOpen) => !isOpen);
    };

    const handleProfileToggle = (): void => {
        setIsProfileOpen((isOpen) => !isOpen);
    };

    const stopGameInteraction = (event: SyntheticEvent): void => {
        event.stopPropagation();
    };

    let questLogButtonLabel = 'Quest Log öffnen';
    if (isQuestLogOpen) {
        questLogButtonLabel = 'Quest Log schließen';
    }

    let profileButtonLabel = 'Profil öffnen';
    if (isProfileOpen) {
        profileButtonLabel = 'Profil schließen';
    }

    const displayedNickname = nickname.trim() || 'Player';
    const displayedEvents = events.slice(-10);
    const latestEventId = displayedEvents.at(-1)?.id;

    /** Auto Scroll des Eventlogs zum neuesten Eintrag. */
    useEffect(() => {
        const eventList = eventListRef.current;
        if (!eventList) return;

        eventList.scrollTop = eventList.scrollHeight;
    }, [latestEventId]);

    return (
        <div
            id='game-ui'
            className='hud'
            onClick={stopGameInteraction}
            onPointerDown={stopGameInteraction}
        >
            <div className='hud-profile'>
                <button
                    type='button'
                    className='hud-toggle'
                    aria-controls={PROFILE_PANEL_ID}
                    aria-expanded={isProfileOpen}
                    aria-label={profileButtonLabel}
                    title={profileButtonLabel}
                    onClick={handleProfileToggle}
                >
                    👤
                </button>

                <aside
                    id={PROFILE_PANEL_ID}
                    className='hud-panel hud-profile-panel'
                    aria-label='Spielerprofil'
                    hidden={!isProfileOpen}
                >
                    <h2 className='hud-title'>Profil</h2>
                    <p className='hud-profile-nickname'>
                        <strong>Nickname:</strong> {displayedNickname} ✏️
                    </p>
                    <h3 className='hud-profile-stats-title'>Game Stats:</h3>
                    <dl className='hud-profile-stats'>
                        <div>
                            <dt>Rock-Paper-Scissors</dt>
                            <dd>3 Wins</dd>
                        </div>
                        <div>
                            <dt>Tic-Tac-Toe</dt>
                            <dd>1 Win</dd>
                        </div>
                    </dl>
                </aside>
            </div>

            <button
                type='button'
                className='hud-toggle'
                aria-controls={QUEST_LOG_ID}
                aria-expanded={isQuestLogOpen}
                aria-label={questLogButtonLabel}
                title={questLogButtonLabel}
                onClick={handleQuestLogToggle}
            >
                📑
            </button>

            <aside
                id={QUEST_LOG_ID}
                className='hud-panel hud-quest-log'
                aria-label='Quest Log'
                hidden={!isQuestLogOpen}
            >
                <h2 className='hud-title'>Quest Log Checklist:</h2>
                <ul className='hud-quest-list'>
                    {quests.map((quest) => {
                        let marker = '❎';
                        if (quest.completed) {
                            marker = '✅';
                        }

                        return (
                            <li
                                key={quest.id}
                                className='hud-quest-item'
                                data-quest-id={quest.id}
                            >
                                <span
                                    className='hud-quest-marker'
                                    aria-hidden='true'
                                >
                                    {marker}
                                </span>
                                <span>{quest.text}</span>
                            </li>
                        );
                    })}
                </ul>
            </aside>

            <aside
                className='hud-panel hud-event-log'
                aria-labelledby={EVENT_LOG_TITLE_ID}
                title='Event Log (Chat + Player Events)'
            >
                <ol
                    ref={eventListRef}
                    className='hud-event-list'
                    role='log'
                    aria-live='polite'
                >
                    {displayedEvents.map((event) => (
                        <li key={event.id} className='hud-event-item'>
                            <time className='hud-event-time'>
                                {event.timestamp}
                            </time>
                            <span>{event.description}</span>
                        </li>
                    ))}
                </ol>
            </aside>
        </div>
    );
}
