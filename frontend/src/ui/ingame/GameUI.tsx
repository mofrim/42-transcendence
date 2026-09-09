import {
    useEffect,
    useEffectEvent,
    useRef,
    useState,
    type ReactNode,
    type SyntheticEvent,
} from 'react';
import {
    BLACK_HOLE_QUEST_ID,
    DEFAULT_QUESTS,
    formatQuestCountdown,
    getQuestStatusChanges,
    resolveQuestLogEntries,
    type QuestLogEntry,
    type QuestStatusChange,
    type ResolvedQuestLogEntry,
} from './QuestLog';
import {
    BLACK_HOLE_DURATION_SECONDS,
    getBlackHoleCountdownDeadline,
} from './BlackHoleCountdown';
import type { Character } from 'ftr-common/sharedTypes';
import { CharacterPreviewView } from '../login/CharacterPreview';
import { EventLogItems, type EventLogEntry } from './EventLogItems';
import { MatchHistory } from './MatchHistory';

import './GameUI.css';

const QUEST_LOG_ID = 'game-quest-log';
const PROFILE_PANEL_ID = 'game-profile-panel';
const MATCH_HISTORY_PANEL_ID = 'game-match-history-panel';
const EVENT_LOG_TITLE_ID = 'game-event-log-title';

export const MAX_EVENT_LOG_ENTRIES = 10;

export type DialogPanelState = {
    readonly isOpen: boolean;
    readonly message: string;
};

type GameUIProps = {
    readonly nickname: string;
    readonly email: string;
    readonly character: Character;
    readonly quests?: readonly QuestLogEntry[];
    readonly completedQuestIds?: readonly string[];
    readonly events?: readonly EventLogEntry[];
    readonly matchHistory?: readonly EventLogEntry[];
    readonly onChatMessage?: (message: string) => void;
    readonly onQuestStatusChange?: (change: QuestStatusChange) => void;
    readonly onLogout?: () => Promise<void>;
    readonly dialog?: DialogPanelState;
    readonly onDialogNext?: () => void;
    readonly blackHoleCountdownActive?: boolean;
    readonly isSpectator?: boolean;
};

type HudPanelToggleProps = {
    readonly questProgress?: {
        readonly completed: number;
        readonly total: number;
    };
    readonly bottomBadge?: string;
    readonly controls: string;
    readonly icon: string;
    readonly isOpen: boolean;
    readonly panelLabel: string;
    readonly onToggle: () => void;
};

function HudPanelToggle({
    questProgress,
    bottomBadge,
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
    let actionLabel = `${panelLabel} ${action}`;
    let badge: ReactNode = null;
    let bottomBadgeElement: ReactNode = null;

    if (questProgress !== undefined) {
        const questProgressLabel = `${questProgress.completed} von ${questProgress.total} Aufgaben erledigt`;

        actionLabel = `${actionLabel}, ${questProgressLabel}`;
        badge = (
            <span className='hud-toggle-badge' aria-hidden='true'>
                {questProgress.completed}/{questProgress.total}
            </span>
        );
    }

    if (bottomBadge !== undefined) {
        actionLabel = `${actionLabel}, Black Hole Timer ${bottomBadge}`;
        bottomBadgeElement = (
            <span className='hud-toggle-timer-badge' aria-hidden='true'>
                {bottomBadge}
            </span>
        );
    }

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
            {badge}
            {bottomBadgeElement}
        </button>
    );
}

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
    email,
    character,
    quests = DEFAULT_QUESTS,
    completedQuestIds = [],
    events = [],
    matchHistory = [],
    onChatMessage,
    onQuestStatusChange,
    onLogout,
    dialog,
    onDialogNext,
    blackHoleCountdownActive = true,
    isSpectator = false,
}: GameUIProps) {
    const [isQuestLogOpen, setIsQuestLogOpen] = useState(false);
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [isMatchHistoryOpen, setIsMatchHistoryOpen] = useState(false);
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [chatMessage, setChatMessage] = useState('');
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [blackHoleSecondsRemaining, setBlackHoleSecondsRemaining] = useState(
        BLACK_HOLE_DURATION_SECONDS
    );
    const eventListRef = useRef<HTMLOListElement>(null);
    const chatInputRef = useRef<HTMLInputElement>(null);
    const previousResolvedQuestsRef = useRef<
        readonly ResolvedQuestLogEntry[] | null
    >(null);

    const handleQuestLogToggle = (): void => {
        setIsQuestLogOpen((isOpen) => !isOpen);
    };

    const handleProfileToggle = (): void => {
        setIsProfileOpen((isOpen) => !isOpen);
    };

    const handleMatchHistoryToggle = (): void => {
        setIsMatchHistoryOpen((isOpen) => !isOpen);
    };

    const handleLogout = async (): Promise<void> => {
        if (isLoggingOut || !onLogout) {
            return;
        }

        setIsLoggingOut(true);
        try {
            await onLogout();
        } catch (error) {
            console.error('Logout failed:', error);
            setIsLoggingOut(false);
        }
    };

    const stopGameInteraction = (event: SyntheticEvent): void => {
        event.stopPropagation();
    };

    const handleChatToggle = useEffectEvent((event: KeyboardEvent): void => {
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
            // empty the chat input and close the chat window after sending a message
            setChatMessage('');
            setIsChatOpen(false);
            return;
        }

        setIsChatOpen(true);
    });

    const displayedEvents = events.slice(-MAX_EVENT_LOG_ENTRIES);
    const latestEventId = displayedEvents.at(-1)?.id;
    let blackHoleHourglass = '⌛';
    if (blackHoleSecondsRemaining % 2 !== 0) {
        blackHoleHourglass = '⏳';
    }
    const blackHoleCountdown =
        blackHoleHourglass + formatQuestCountdown(blackHoleSecondsRemaining);
    const resolvedQuests = resolveQuestLogEntries(
        quests,
        completedQuestIds,
        blackHoleSecondsRemaining
    );
    const completedQuestCount = resolvedQuests.filter(
        (quest) => quest.completed
    ).length;

    /** blackhole timer */
    useEffect(() => {
        const blackHoleDeadline = getBlackHoleCountdownDeadline(
            blackHoleCountdownActive,
            Date.now()
        );

        if (blackHoleDeadline === null) {
            return;
        }

        let intervalId: number | undefined;

        const updateBlackHoleTimer = (): void => {
            const millisecondsRemaining = blackHoleDeadline - Date.now();
            const secondsRemaining = Math.max(
                0,
                Math.ceil(millisecondsRemaining / 1_000)
            );

            setBlackHoleSecondsRemaining(secondsRemaining);

            if (secondsRemaining === 0 && intervalId !== undefined) {
                window.clearInterval(intervalId);
                intervalId = undefined;
            }
        };

        intervalId = window.setInterval(updateBlackHoleTimer, 1_000);
        updateBlackHoleTimer();

        return () => {
            if (intervalId !== undefined) {
                window.clearInterval(intervalId);
            }
        };
    }, [blackHoleCountdownActive]);

    /** Meldet ausschließlich tatsächliche Änderungen eines Quest-Status. */
    useEffect(() => {
        const statusChanges = getQuestStatusChanges(
            previousResolvedQuestsRef.current,
            resolvedQuests
        );

        previousResolvedQuestsRef.current = resolvedQuests;

        for (const statusChange of statusChanges) {
            onQuestStatusChange?.(statusChange);
        }
    }, [onQuestStatusChange, resolvedQuests]);

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
        window.addEventListener('keydown', handleChatToggle, true);

        return () => {
            window.removeEventListener('keydown', handleChatToggle, true);
        };
    }, []);

    let hudClassName = 'hud';
    if (isSpectator) {
        hudClassName += ' spectator-hud';
    }

    return (
        <div
            id='game-ui'
            className={hudClassName}
            onClick={stopGameInteraction}
            onPointerDown={stopGameInteraction}
        >
            <div className='hud-profile'>
                <div className='hud-profile-toggles'>
                    <HudPanelToggle
                        controls={PROFILE_PANEL_ID}
                        icon='👤'
                        isOpen={isProfileOpen}
                        panelLabel='Profil'
                        onToggle={handleProfileToggle}
                    />
                    <HudPanelToggle
                        controls={MATCH_HISTORY_PANEL_ID}
                        icon='📊'
                        isOpen={isMatchHistoryOpen}
                        panelLabel='Match History'
                        onToggle={handleMatchHistoryToggle}
                    />
                </div>

                <aside
                    id={PROFILE_PANEL_ID}
                    className='hud-panel hud-profile-panel'
                    aria-label='Spielerprofil'
                    hidden={!isProfileOpen}
                >
                    <h2 className='hud-title'>Profil</h2>
                    {isProfileOpen && (
                        <CharacterPreviewView
                            character={character}
                            className='hud-profile-character-preview'
                            canvasClassName='hud-profile-character-preview-canvas'
                        />
                    )}
                    <p className='hud-profile-nickname'>
                        {/* TODO: edit nickname */}
                        <strong>Nickname:</strong> {nickname} ✏️
                    </p>
                    <p className='hud-profile-email'>
                        <strong>Email:</strong> {email}
                    </p>
                    <button
                        type='button'
                        className='hud-profile-logout'
                        disabled={isLoggingOut || !onLogout}
                        aria-busy={isLoggingOut}
                        onClick={() => void handleLogout()}
                    >
                        {isLoggingOut ? 'Logging out…' : '🚪 Logout'}
                    </button>
                </aside>

                <aside
                    id={MATCH_HISTORY_PANEL_ID}
                    className='hud-panel hud-match-history-panel'
                    aria-label='Match History'
                    hidden={!isMatchHistoryOpen}
                >
                    <h2 className='hud-title'>Match History</h2>
                    <MatchHistory entries={matchHistory} />
                </aside>
            </div>

            <HudPanelToggle
                questProgress={{
                    completed: completedQuestCount,
                    total: resolvedQuests.length,
                }}
                bottomBadge={blackHoleCountdown}
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
                    {resolvedQuests.map((quest) => {
                        let marker = '🟥';
                        let blackHoleTimer: ReactNode = null;

                        if (quest.completed) {
                            marker = '✅';
                        }

                        if (quest.id === BLACK_HOLE_QUEST_ID) {
                            blackHoleTimer = (
                                <time
                                    className='hud-black-hole-timer'
                                    aria-label={`🕳️ Black Hole Timer: ${blackHoleCountdown} verbleibend`}
                                >
                                    {blackHoleCountdown}
                                </time>
                            );
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
                                <span className='hud-quest-text'>
                                    {quest.text}
                                </span>
                                {blackHoleTimer}
                            </li>
                        );
                    })}
                </ul>
            </aside>

            <aside
                className='hud-panel hud-dialog-panel'
                aria-label='Dialog'
                hidden={!dialog?.isOpen}
            >
                <h2 className='hud-title'>{nickname}</h2>
                <p className='hud-dialog-message'>{dialog?.message}</p>
                <div className='hud-dialog-actions'>
                    <button
                        type='button'
                        className='hud-dialog-next'
                        onClick={onDialogNext}
                    >
                        ...
                    </button>
                </div>
            </aside>

            {displayedEvents.length > 0 && (
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
                        <EventLogItems entries={displayedEvents} />
                    </ol>
                </aside>
            )}

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
