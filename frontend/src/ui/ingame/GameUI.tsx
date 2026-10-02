import {
    useEffect,
    useEffectEvent,
    useRef,
    useState,
    type ReactNode,
    type SyntheticEvent,
} from 'react';
import axios from 'axios';

import {
    getQuestStatusChanges,
    resolveQuestLogEntries,
    type QuestStatusChange,
    type ResolvedQuestLogEntry,
} from './QuestLog';

import { formatQuestCountdown } from '../../game/QuestBlackHole';

import {
    API_USER,
    BLACK_HOLE_DURATION_SECONDS,
    type ApiResponse,
    type Character,
    type FriendListEntry,
    type FriendRequestState,
    type PublicUserProfile,
    QUESTS,
} from 'ftr-common/sharedTypes';

import { EventLogItems, type EventLogEntry } from './EventLogItems';
import { FRIENDS_PANEL_ID, FriendList, useFriendListPanel } from './FriendList';
import { Leaderboard } from './Leaderboard';
import { MatchHistory } from './MatchHistory';
import { PROFILE_PANEL_ID, ProfilePanel } from './Profile';
import { MAX_EVENT_LOG_ENTRIES } from '../../lib/eventLogUtils';

import './GameUI.css';

const QUEST_LOG_ID = 'game-quest-log';
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
    readonly blackHoleConnected?: boolean;
    readonly restoredBlackHoleSecondsRemaining?: number;
    readonly restoredBlackHoleCountdownCompleted?: boolean;
    readonly onBlackHoleTimerChange?: (
        secondsRemaining: number,
        completed: boolean
    ) => void;
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
    let action = 'open';
    if (isOpen) {
        action = 'close';
    }
    let actionLabel = `${panelLabel} ${action}`;
    let badge: ReactNode = null;
    let bottomBadgeElement: ReactNode = null;

    if (questProgress !== undefined) {
        const questProgressLabel = `${questProgress.completed} of ${questProgress.total} quests completed`;

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
    blackHoleConnected = true,
    restoredBlackHoleSecondsRemaining = BLACK_HOLE_DURATION_SECONDS,
    restoredBlackHoleCountdownCompleted = false,
    onBlackHoleTimerChange,
    friendRequest,
    friends = [],
    onFriendRemove,
    isSpectator = false,
}: GameUIProps) {
    const [isQuestLogOpen, setIsQuestLogOpen] = useState(false);
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [isMatchHistoryOpen, setIsMatchHistoryOpen] = useState(false);
    const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [chatMessage, setChatMessage] = useState('');
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [selectedProfileNickname, setSelectedProfileNickname] =
        useState(nickname);
    const [publicProfile, setPublicProfile] =
        useState<PublicUserProfile | null>(null);
    const [isProfileLoading, setIsProfileLoading] = useState(false);
    const [profileLoadFailed, setProfileLoadFailed] = useState(false);
    const [blackHoleSecondsRemaining, setBlackHoleSecondsRemaining] = useState(
        restoredBlackHoleSecondsRemaining
    );
    const eventListRef = useRef<HTMLOListElement>(null);
    const matchHistoryListRef = useRef<HTMLOListElement>(null);
    const chatInputRef = useRef<HTMLInputElement>(null);
    const previousResolvedQuestsRef = useRef<
        readonly ResolvedQuestLogEntry[] | null
    >(null);
    const { isOpen: friendsPanelOpen, toggle: handleFriendsToggle } =
        useFriendListPanel(friendRequest);

    const handleQuestLogToggle = (): void => {
        setIsQuestLogOpen((isOpen) => !isOpen);
    };

    const handleProfileToggle = (): void => {
        if (isProfileOpen) {
            setIsProfileOpen(false);
            return;
        }

        setSelectedProfileNickname(nickname);
        setPublicProfile(null);
        setIsProfileLoading(false);
        setProfileLoadFailed(false);
        setIsProfileOpen(true);
    };

    const handlePlayerProfileOpen = (playerNickname: string): void => {
        const normalizedNickname = playerNickname.trim();
        if (!normalizedNickname) {
            return;
        }
        if (isProfileOpen && selectedProfileNickname === normalizedNickname) {
            return;
        }

        setSelectedProfileNickname(normalizedNickname);
        setPublicProfile(null);
        setIsProfileLoading(false);
        setProfileLoadFailed(false);
        setIsMatchHistoryOpen(false);
        setIsLeaderboardOpen(false);
        setIsProfileOpen(true);
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
    const BlackHoleTimerChange = useEffectEvent(
        (secondsRemaining: number, completed: boolean): void => {
            onBlackHoleTimerChange?.(secondsRemaining, completed);
        }
    );
    const getBlackHoleSecondsRemaining = useEffectEvent(
        (): number => blackHoleSecondsRemaining
    );

    const displayedEvents = events.slice(-MAX_EVENT_LOG_ENTRIES);
    const latestEventId = displayedEvents.at(-1)?.id;
    let blackHoleHourglass = '⌛';
    if (blackHoleSecondsRemaining % 2 !== 0) {
        blackHoleHourglass = '⏳';
    }
    const blackHoleCountdown =
        blackHoleHourglass + formatQuestCountdown(blackHoleSecondsRemaining);
    const isStartEvaluationCompleted = completedQuestIds.includes(
        QUESTS.START_EVALUATION_QUEST_ID.id
    );
    const isBlackHoleCountdownCompleted =
        restoredBlackHoleCountdownCompleted || isStartEvaluationCompleted;
    const isBlackHoleCountdownRunning =
        blackHoleCountdownActive &&
        blackHoleConnected &&
        !isBlackHoleCountdownCompleted;
    const isBlackHoleQuestCompleted =
        blackHoleCountdownActive &&
        isBlackHoleCountdownCompleted &&
        blackHoleSecondsRemaining > 0;
    const resolvedQuests = resolveQuestLogEntries(
        quests,
        completedQuestIds,
        isBlackHoleQuestCompleted
    );
    const completedQuestCount = resolvedQuests.filter(
        (quest) => quest.completed
    ).length;

    useEffect(() => {
        if (
            !blackHoleCountdownActive ||
            !blackHoleConnected ||
            !isStartEvaluationCompleted
        ) {
            return;
        }

        BlackHoleTimerChange(getBlackHoleSecondsRemaining(), true);
    }, [
        blackHoleConnected,
        blackHoleCountdownActive,
        isStartEvaluationCompleted,
    ]);

    /** blackhole timer */
    useEffect(() => {
        if (!isBlackHoleCountdownRunning) {
            return;
        }

        const blackHoleDeadline =
            Date.now() + getBlackHoleSecondsRemaining() * 1_000;
        let intervalId: number | undefined;

        const updateBlackHoleTimer = (): void => {
            const millisecondsRemaining = blackHoleDeadline - Date.now();
            const secondsRemaining = Math.max(
                0,
                Math.ceil(millisecondsRemaining / 1_000)
            );

            setBlackHoleSecondsRemaining(secondsRemaining);

            if (secondsRemaining > 0) {
                BlackHoleTimerChange(secondsRemaining, false);
            } else if (intervalId !== undefined) {
                window.clearInterval(intervalId);
                intervalId = undefined;
                BlackHoleTimerChange(0, false);
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

    /** Reports only actual changes to a quest status. */
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

    /** Automatically scrolls the event log to the latest entry. */
    useEffect(() => {
        const eventList = eventListRef.current;
        if (!eventList) return;

        eventList.scrollTop = eventList.scrollHeight;
    }, [latestEventId]);

    /** Automatically scrolls the match history to the latest entry. */
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
        if (!isProfileOpen || selectedProfileNickname === nickname) {
            return;
        }

        const controller = new AbortController();

        const loadPublicProfile = async (): Promise<void> => {
            setIsProfileLoading(true);
            setProfileLoadFailed(false);

            try {
                const response = await axios.get<
                    ApiResponse<PublicUserProfile>
                >(
                    API_USER.profile +
                        '/' +
                        encodeURIComponent(selectedProfileNickname),
                    { signal: controller.signal }
                );
                const profile = response.data.data;
                if (!profile) {
                    throw new Error('Public profile response has no data');
                }

                if (!controller.signal.aborted) {
                    setPublicProfile(profile);
                }
            } catch (error) {
                if (controller.signal.aborted) {
                    return;
                }

                console.error('Failed to load player profile:', error);
                setProfileLoadFailed(true);
            } finally {
                if (!controller.signal.aborted) {
                    setIsProfileLoading(false);
                }
            }
        };

        void loadPublicProfile();

        return () => controller.abort();
    }, [isProfileOpen, nickname, selectedProfileNickname]);

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
                        panelLabel='Profile'
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

                <ProfilePanel
                    character={character}
                    email={email}
                    isLoading={isProfileLoading}
                    isLoggingOut={isLoggingOut}
                    isOpen={isProfileOpen}
                    loadFailed={profileLoadFailed}
                    nickname={nickname}
                    publicProfile={publicProfile}
                    selectedNickname={selectedProfileNickname}
                    canLogout={onLogout !== undefined}
                    onLogout={handleLogout}
                />

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
                        onPlayerProfileOpen={handlePlayerProfileOpen}
                    />
                </aside>

                <aside
                    id={LEADERBOARD_PANEL_ID}
                    className='hud-panel hud-leaderboard-panel'
                    aria-label='Leaderboard'
                    hidden={!isLeaderboardOpen}
                >
                    <h2 className='hud-title'>Leaderboard</h2>
                    <Leaderboard
                        currentNickname={nickname}
                        isOpen={isLeaderboardOpen}
                        onPlayerProfileOpen={handlePlayerProfileOpen}
                    />
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
                                    aria-label={`🕳️ Black Hole Timer: ${blackHoleCountdown} remaining`}
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
                        <EventLogItems
                            entries={displayedEvents}
                            onPlayerProfileOpen={handlePlayerProfileOpen}
                        />
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
                    aria-label='Chat message'
                    placeholder='Enter a message...'
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
