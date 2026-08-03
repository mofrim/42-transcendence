import { useEffect, useRef, useState } from 'react';
import type { SyntheticEvent } from 'react';
import { normalizePlayerNickname } from '../../game/PlayerIdentity';

import './GameUI.css';

const QUEST_LOG_ID = 'game-quest-log';
const PROFILE_PANEL_ID = 'game-profile-panel';
const EVENT_LOG_TITLE_ID = 'game-event-log-title';

export const MAX_EVENT_LOG_ENTRIES = 10;

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
    readonly onChatMessage?: (message: string) => void;
};

type HudPanelToggleProps = {
    readonly controls: string;
    readonly icon: string;
    readonly isOpen: boolean;
    readonly panelLabel: string;
    readonly onToggle: () => void;
};

function HudPanelToggle({
    controls,
    icon,
    isOpen,
    panelLabel,
    onToggle,
}: HudPanelToggleProps) {
    let action = 'öffnen';
    if (isOpen) {
        action = 'schließen';
    }
    const actionLabel = `${panelLabel} ${action}`;

    return (
        <button
            type='button'
            className='hud-toggle'
            aria-controls={controls}
            aria-expanded={isOpen}
            aria-label={actionLabel}
            title={actionLabel}
            onClick={onToggle}
        >
            {icon}
        </button>
    );
}

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
        id: 'find-computer',
        text: 'Finde einen Computer im Cluster',
    },
    {
        id: 'avoid-blackhole',
        text: "Don't get blackholed",
    },
];

/** Beispielereignisse für das Event Log.
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
*/

/**
 * React HUD for controls that do not belong in the Three.js scene.
 */
export function GameUI({
    nickname,
    quests = DEFAULT_QUESTS,
    events = [],
    onChatMessage,
}: GameUIProps) {
    const [isQuestLogOpen, setIsQuestLogOpen] = useState(false);
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [chatMessage, setChatMessage] = useState('');
    const eventListRef = useRef<HTMLOListElement>(null);
    const chatInputRef = useRef<HTMLInputElement>(null);

    const handleQuestLogToggle = (): void => {
        setIsQuestLogOpen((isOpen) => !isOpen);
    };

    const handleProfileToggle = (): void => {
        setIsProfileOpen((isOpen) => !isOpen);
    };

    const stopGameInteraction = (event: SyntheticEvent): void => {
        event.stopPropagation();
    };

    const displayedNickname = normalizePlayerNickname(nickname);
    const displayedEvents = events.slice(-MAX_EVENT_LOG_ENTRIES);
    const latestEventId = displayedEvents.at(-1)?.id;

    /** Auto Scroll des Eventlogs zum neuesten Eintrag. */
    useEffect(() => {
        const eventList = eventListRef.current;
        if (!eventList) return;

        eventList.scrollTop = eventList.scrollHeight;
    }, [latestEventId]);

    useEffect(() => {
        if (!isChatOpen) return;

        chatInputRef.current?.focus();
    }, [isChatOpen]);

    useEffect(() => {
        const handleChatToggle = (event: KeyboardEvent): void => {
            const isReturnOrEnter =
                event.key === 'Enter' || event.code === 'NumpadEnter';

            if (!isReturnOrEnter || event.repeat || event.isComposing) {
                return;
            }

            event.preventDefault();
            event.stopPropagation();

            if (isChatOpen) {
                const submittedMessage = chatMessage.trim();
                if (submittedMessage) {
                    onChatMessage?.(submittedMessage);
                }
                //  empty the chat input and close the chat window after sending a message
                setChatMessage('');
                setIsChatOpen(false);
                return;
            }

            setIsChatOpen(true);
        };

        window.addEventListener('keydown', handleChatToggle, true);

        return () => {
            window.removeEventListener('keydown', handleChatToggle, true);
        };
    }, [chatMessage, isChatOpen, onChatMessage]);

    return (
        <div
            id='game-ui'
            className='hud'
            onClick={stopGameInteraction}
            onPointerDown={stopGameInteraction}
        >
            <div className='hud-profile'>
                <HudPanelToggle
                    controls={PROFILE_PANEL_ID}
                    icon='👤'
                    isOpen={isProfileOpen}
                    panelLabel='Profil'
                    onToggle={handleProfileToggle}
                />

                <aside
                    id={PROFILE_PANEL_ID}
                    className='hud-panel hud-profile-panel'
                    aria-label='Spielerprofil'
                    hidden={!isProfileOpen}
                >
                    <h2 className='hud-title'>Profil</h2>
                    <p className='hud-profile-nickname'>
                        {/* TODO: edit nickname */}
                        <strong>Nickname:</strong> {displayedNickname} ✏️
                    </p>
                    <h3 className='hud-profile-stats-title'>Game Stats:</h3>
                    {/* TODO: Game Stats */}
                    <p className='hud-profile-nickname'></p>
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

            <HudPanelToggle
                controls={QUEST_LOG_ID}
                icon='📑'
                isOpen={isQuestLogOpen}
                panelLabel='Quest Log'
                onToggle={handleQuestLogToggle}
            />

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
                title='Event Log (Chat + Events)'
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

            <div className='hud-chat' hidden={!isChatOpen}>
                <input
                    ref={chatInputRef}
                    id='game-chat-input'
                    className='hud-chat-input'
                    type='text'
                    value={chatMessage}
                    aria-label='Chat-Nachricht'
                    placeholder='Nachricht eingeben...'
                    autoComplete='off'
                    onChange={(event) =>
                        setChatMessage(event.currentTarget.value)
                    }
                    onKeyDown={stopGameInteraction}
                    onKeyUp={stopGameInteraction}
                />
            </div>
        </div>
    );
}
