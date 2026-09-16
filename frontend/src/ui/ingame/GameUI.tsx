import {
    useEffect,
    useEffectEvent,
    useRef,
    useState,
    type ReactNode,
    type SyntheticEvent,
} from 'react';

import {
    getQuestStatusChanges,
    resolveQuestLogEntries,
    type QuestStatusChange,
    type ResolvedQuestLogEntry,
} from './QuestLog';

import { formatQuestCountdown } from '../../game/QuestBlackHole';

import {
    BLACK_HOLE_DURATION_SECONDS,
    getBlackHoleCountdownDeadline,
} from './BlackHoleCountdown';

import {
    type Character,
    type FriendListEntry,
    type FriendRequestState,
    QUESTS,
} from 'ftr-common/sharedTypes';

import { CharacterPreviewView } from '../login/PreviewCharacter';
import { EventLogItems, type EventLogEntry } from './EventLogItems';
import { FRIENDS_PANEL_ID, FriendList } from './FriendList';
import { Leaderboard } from './Leaderboard';
import { MatchHistory } from './MatchHistory';
import { MAX_EVENT_LOG_ENTRIES } from '../../lib/eventLogUtils';

import './GameUI.css';

const QUEST_LOG_ID = 'game-quest-log';
const PROFILE_PANEL_ID = 'game-profile-panel';
const MATCH_HISTORY_PANEL_ID = 'game-match-history-panel';
const LEADERBOARD_PANEL_ID = 'game-leaderboard-panel';
const EVENT_LOG_TITLE_ID = 'game-event-log-title';

export type DialogPanelState = {
    readonly isOpen: boolean;
    readonly message: string;
};

type GameUIProps = {
    readonly nickname: string;
    readonly email: string;
    readonly character: Character;
    readonly quests?: typeof QUESTS;
    readonly completedQuestIds?: readonly string[];
    readonly events?: readonly EventLogEntry[];
    readonly matchHistory?: readonly EventLogEntry[];
    readonly onChatMessage?: (message: string) => void;
    readonly onQuestStatusChange?: (change: QuestStatusChange) => void;
    readonly onBlackHoleCountdownExpired?: () => void;
    readonly onLogout?: () => Promise<void>;
    readonly dialog?: DialogPanelState;
    readonly onDialogNext?: () => void;
    readonly blackHoleCountdownActive?: boolean;
    readonly friendRequest?: FriendRequestState | null;
    readonly friends?: readonly FriendListEntry[];
    readonly onFriendRemove?: (friendPlayerId: string) => void;
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

/**
 * React HUD for controls that do not belong in the Three.js scene.
 */
export function GameUI({
    nickname,
    email,
    character,
    quests = QUESTS,
    completedQuestIds = [],
    events = [],
    matchHistory = [],
    onChatMessage,
    onQuestStatusChange,
    onBlackHoleCountdownExpired,
    onLogout,
    dialog,
    onDialogNext,
    blackHoleCountdownActive = true,
    friendRequest,
    friends = [],
    onFriendRemove,
    isSpectator = false,
}: GameUIProps) {
    const [isQuestLogOpen, setIsQuestLogOpen] = useState(false);
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [isFriendsOpen, setIsFriendsOpen] = useState(false);
    const [isMatchHistoryOpen, setIsMatchHistoryOpen] = useState(false);
    const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [chatMessage, setChatMessage] = useState('');
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [blackHoleSecondsRemaining, setBlackHoleSecondsRemaining] = useState(
        BLACK_HOLE_DURATION_SECONDS
    );
    const eventListRef = useRef<HTMLOListElement>(null);
    const matchHistoryListRef = useRef<HTMLOListElement>(null);
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

    const handleFriendsToggle = (): void => {
        setIsFriendsOpen((isOpen) => !isOpen);
    };

    const handleMatchHistoryToggle = (): void => {
        setIsMatchHistoryOpen((isOpen) => !isOpen);
    };

    const handleLeaderboardToggle = (): void => {
        setIsLeaderboardOpen((isOpen) => !isOpen);
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

    const handleBlackHoleCountdownExpired = useEffectEvent((): void => {
        onBlackHoleCountdownExpired?.();
    });

    const displayedEvents = events.slice(-MAX_EVENT_LOG_ENTRIES);
    const latestEventId = displayedEvents.at(-1)?.id;
    let blackHoleHourglass = '⌛';
    if (blackHoleSecondsRemaining % 2 !== 0) {
        blackHoleHourglass = '⏳';
    }
    const blackHoleCountdown =
        blackHoleHourglass + formatQuestCountdown(blackHoleSecondsRemaining);
    const isBlackHoleCountdownRunning =
        blackHoleCountdownActive &&
        !completedQuestIds.includes(QUESTS.START_EVALUATION_QUEST_ID.id);
    const isBlackHoleQuestCompleted =
        blackHoleCountdownActive &&
        !isBlackHoleCountdownRunning &&
        blackHoleSecondsRemaining > 0;
    const resolvedQuests = resolveQuestLogEntries(
        quests,
        completedQuestIds,
        isBlackHoleQuestCompleted
    );
    const completedQuestCount = resolvedQuests.filter(
        (quest) => quest.completed
    ).length;
    /** blackhole timer */
    useEffect(() => {
        const blackHoleDeadline = getBlackHoleCountdownDeadline(
            isBlackHoleCountdownRunning,
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
                handleBlackHoleCountdownExpired();
            }
        };

        intervalId = window.setInterval(updateBlackHoleTimer, 1_000);
        updateBlackHoleTimer();

        return () => {
            if (intervalId !== undefined) {
                window.clearInterval(intervalId);
            }
        };
    }, [isBlackHoleCountdownRunning]);

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

    /** Auto Scroll der MatchHistory zum neuesten Eintrag. */
    useEffect(() => {
        const matchHistoryList = matchHistoryListRef.current;
        if (!matchHistoryList) return;

        matchHistoryList.scrollTop = matchHistoryList.scrollHeight;
    }, [matchHistory]);

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
    const friendsPanelOpen = isFriendsOpen || Boolean(friendRequest);

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
                        controls={FRIENDS_PANEL_ID}
                        icon='👥'
                        isOpen={friendsPanelOpen}
                        panelLabel='Friendlist'
                        onToggle={handleFriendsToggle}
                    />
                    <HudPanelToggle
                        controls={MATCH_HISTORY_PANEL_ID}
                        icon='📊'
                        isOpen={isMatchHistoryOpen}
                        panelLabel='Match History'
                        onToggle={handleMatchHistoryToggle}
                    />
                    <HudPanelToggle
                        controls={LEADERBOARD_PANEL_ID}
                        icon='🏆'
                        isOpen={isLeaderboardOpen}
                        panelLabel='Leaderboard'
                        onToggle={handleLeaderboardToggle}
                    />
                </div>

                <aside
                    id={PROFILE_PANEL_ID}
                    className='hud-panel hud-profile-panel'
                    aria-label='Spielerprofil'
                    hidden={!isProfileOpen}
                >
                    <h2 className='hud-title'>🪪 Student ID</h2>
                    {isProfileOpen && (
                        <CharacterPreviewView
                            character={character}
                            className='hud-profile-character-preview'
                            canvasClassName='hud-profile-character-preview-canvas'
                        />
                    )}
                    <p className='hud-profile-nickname'>
                        {/* TODO: edit nickname */}
                        <strong>Intraname:</strong> {nickname} ✏️
                    </p>
                    <p className='hud-profile-email'>
                        <strong>E-Mail:</strong> {email}
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

                <FriendList
                    friendRequest={friendRequest}
                    friends={friends}
                    isOpen={friendsPanelOpen}
                    onRemoveFriend={onFriendRemove}
                />

                <aside
                    id={MATCH_HISTORY_PANEL_ID}
                    className='hud-panel hud-match-history-panel'
                    aria-label='Match History'
                    hidden={!isMatchHistoryOpen}
                >
                    <h2 className='hud-title'>Match History</h2>
                    <MatchHistory
                        entries={matchHistory}
                        listref={matchHistoryListRef}
                    />
                </aside>

                <aside
                    id={LEADERBOARD_PANEL_ID}
                    className='hud-panel hud-leaderboard-panel'
                    aria-label='Leaderboard'
                    hidden={!isLeaderboardOpen}
                >
                    <h2 className='hud-title'>Leaderboard</h2>
                    <Leaderboard />
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

                        if (quest.id === QUESTS.BLACK_HOLE_QUEST_ID.id) {
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
                                <span
                                    className={
                                        quest.completed
                                            ? 'hud-quest-text hud-quest-text-completed'
                                            : 'hud-quest-text'
                                    }
                                >
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
