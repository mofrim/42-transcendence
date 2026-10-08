import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLoginContext } from '../../hooks/useLoginContext';
import { useAuth } from '../../hooks/useAuthContext';
import { startGame, type GameMode, type GameRuntime } from '../../game/main';
import {
    GameEvent,
    EventType,
    User,
    API_USER,
    type QuestTuple,
    type ApiResponse,
    type ReceivedChatPayload,
    type EventDataPlayerInRange,
    type SaveGameSnapshot,
} from 'ftr-common/sharedTypes';
import {
    hasRestoredBlackHoleCountdownStarted,
    isInitialBlackHoleRestore,
} from '../../game/BlackHoleTimeout';
import { useMatchHistory } from '../../hooks/useMatchHistory';
import { GameUI, type DialogPanelState } from '../ingame/GameUI';
import type { EventLogEntry } from '../ingame/EventLogItems';
import { useFriendRequest } from '../ingame/FriendRequest';
import { useSaveGame } from './SaveGame';
import {
    sawShownIntroCutscene,
    IntroCutsceneSeen,
} from './IntroCutsceneSession';
import {
    applyQuestCompletionEvent,
    type QuestStatusChange,
} from '../ingame/QuestLog';
import * as THREE from 'three';
import axios from 'axios';
import { useOptionalEventLog } from '../../hooks/useEventLog';
import { api } from '../../lib/utils.ts';

const SPECTATOR_EVENTS: readonly EventLogEntry[] = [];
const appendSpectatorEvent: (
    event: GameEvent
) => Promise<void> = async () => {};

// the start-button. all this does is setting the gameRunning state var
export const StartButton: React.FC = () => {
    const { setGameRunning } = useLoginContext();

    return (
        <button id='start-btn' onClick={() => setGameRunning(true)}>
            ENTER
        </button>
    );
};

export const Game: React.FC<{
    isSpectator?: boolean;
}> = ({ isSpectator = false }) => {
    const { avatar, serverAddrRef, setGameRunning, setIsSpectator } =
        useLoginContext();
    const { user: authUser, logout } = useAuth();

    let user: User | null;
    if (isSpectator) {
        user = new User();
        user.nickname = 'Spectator';
    } else {
        user = authUser;
    }

    const [character] = useState(() => avatar === 'true');

    // using ref here a lot because th
    const mountRef = useRef<HTMLDivElement>(null);
    const gameRuntimeRef = useRef<GameRuntime | null>(null);
    const metPlayerNicknamesRef = useRef(new Set<string>());
    const playerJoinedLoggedRef = useRef(false);
    const sawIntroCutsceneRef = useRef(
        authUser !== null && sawShownIntroCutscene(authUser.id)
    );
    const [completedQuestIds, setCompletedQuestIds] = useState<string[]>([]);
    const [gameResetVersion, setGameResetVersion] = useState(0);
    const [isGameplayReady, setIsGameplayReady] = useState(false);
    const [dialog, setDialog] = useState<DialogPanelState>({
        isOpen: false,
        message: '',
    });
    /** SaveGame */
    const {
        isSaveGameReady,
        isGameConnected,
        blackHoleRestore,
        SaveGameRestore: handleSaveGameStateRestore,
        handleGameConnectionChange,
        BlackHoleTimerChange,
        resetSaveGame,
    } = useSaveGame({
        isSpectator,
        gameRuntimeRef,
    });

    const SaveGameRestore = useCallback(
        async (snapshot: SaveGameSnapshot | null): Promise<void> => {
            let completedQsts: string[] = [];

            // get completed quests from DB first...
            try {
                const response = await axios.get<ApiResponse<QuestTuple[]>>(
                    API_USER.quests
                );
                const quests: QuestTuple[] = response.data.data!;

                quests.forEach((obj) => {
                    const [key, val] = Object.entries(obj)[0]!;
                    if (val) {
                        completedQsts.push(key);
                    }
                });
            } catch {
                console.log(
                    '[SaveGameRestore] getting user-quests from DB failed'
                );
            }

            // merge quests from DB with possible quests from snapshot..
            //
            // QUESTION what is the scenario for quests not being saved to DB
            // but to the snapshot?
            completedQsts = [
                ...new Set([
                    ...(snapshot?.completedQuestIds ?? []),
                    ...completedQsts,
                ]),
            ];

            gameRuntimeRef.current?.updateQuestStatus(completedQsts);
            setCompletedQuestIds(completedQsts);
            handleSaveGameStateRestore(snapshot);

            /** used to prevent repeated Intro Cutscene */
            const restoredCountdownAlreadyStarted =
                hasRestoredBlackHoleCountdownStarted(snapshot);

            if (!sawIntroCutsceneRef.current) {
                sawIntroCutsceneRef.current = true;
                if (authUser !== null) {
                    IntroCutsceneSeen(authUser.id);
                }
                if (!restoredCountdownAlreadyStarted) {
                    try {
                        await gameRuntimeRef.current?.playIntroCutscene();
                    } catch (error) {
                        console.error('Intro cutscene failed:', error);
                    }
                }
            }
        },
        [authUser, handleSaveGameStateRestore]
    );

    useEffect(() => {
        if (isSpectator || !isSaveGameReady || !isGameConnected) {
            return;
        }
        gameRuntimeRef.current?.updateQuestStatus(completedQuestIds);
    }, [completedQuestIds, isGameConnected, isSaveGameReady, isSpectator]);

    const { matchHistory, saveMatchResult } = useMatchHistory({
        isSpectator,
    });

    const eventLog = useOptionalEventLog();
    const events = eventLog?.events ?? SPECTATOR_EVENTS;
    const appendEvent = eventLog?.appendEvent ?? appendSpectatorEvent;

    /** used for blackhole timer tracking in leaderboard */
    useEffect(() => {
        if (
            isSpectator ||
            user === null ||
            playerJoinedLoggedRef.current ||
            !isGameplayReady ||
            !isSaveGameReady ||
            !isGameConnected ||
            !isInitialBlackHoleRestore(
                blackHoleRestore.completed,
                blackHoleRestore.secondsRemaining
            )
        ) {
            return;
        }

        playerJoinedLoggedRef.current = true;
        void appendEvent({
            eventType: EventType.PlayerJoined,
            data: null,
            logtime: new Date(),
            user,
        });
    }, [
        appendEvent,
        blackHoleRestore.completed,
        blackHoleRestore.secondsRemaining,
        isGameConnected,
        isGameplayReady,
        isSaveGameReady,
        isSpectator,
        user,
    ]);

    const {
        friends,
        friendRequest,
        handleFriendRequestChange,
        handleFriendStateSnapshot,
        resetFriendRequest,
        removeFriend,
    } = useFriendRequest({
        appendEvent,
        runtimeRef: gameRuntimeRef,
        user: user!,
    });

    /** Runtime-Ereignisse bleiben auch außerhalb des Sichtfelds sichtbar. */
    const handleGameEvent = useCallback(
        (event: GameEvent): void => {
            if (event.eventType === EventType.PlayerInRange) {
                const evData = event.data as EventDataPlayerInRange;
                const metPlayerNicknames = metPlayerNicknamesRef.current;
                // only log the first time we meet a player, not every time again
                if (!metPlayerNicknames.has(evData.remoteNick!)) {
                    metPlayerNicknames.add(evData.remoteNick!);
                    appendEvent(event);
                }
            } else if (event.eventType !== EventType.QuestCompleted) {
                appendEvent(event);
            }

            if (event.eventType === EventType.MiniGameResult) {
                void saveMatchResult(event);
            }
            setCompletedQuestIds((currentQuestIds) =>
                applyQuestCompletionEvent(currentQuestIds, event)
            );
        },
        [appendEvent, saveMatchResult]
    );

    const handleChatMessage = useCallback((message: string): void => {
        gameRuntimeRef.current?.sendChatMessage(message);
    }, []);

    const handleReceivedChatMessage = useCallback(
        (message: ReceivedChatPayload): void => {
            const event: GameEvent = {
                eventType: EventType.ChatMsg,
                data: {
                    chatmsg: message.message,
                },
                logtime: new Date(),
                user: new User({ nickname: message.senderName }),
            };
            appendEvent(event);
        },
        [appendEvent]
    );

    const handleQuestStatusChange = useCallback(
        (statusChange: QuestStatusChange): void => {
            if (!statusChange.completed) {
                return;
            }

            appendEvent({
                eventType: EventType.QuestCompleted,
                data: {
                    questText: statusChange.questText,
                    questId: statusChange.questId,
                },
                logtime: new Date(),
                user: user!,
            });
        },
        [appendEvent, user]
    );

    const handleBlackHoleCountdownExpired = useCallback((): void => {
        appendEvent({
            eventType: EventType.Blackholed,
            data: null,
            logtime: new Date(),
            user: user!,
        });
        gameRuntimeRef.current?.triggerBlackHoleCutscene();
    }, [appendEvent, user]);

    const handleDialogNext = useCallback((): void => {
        gameRuntimeRef.current?.continueDialogue();
    }, []);

    const handleGameReset = useCallback(async (): Promise<void> => {
        setIsGameplayReady(false);
        playerJoinedLoggedRef.current = false;
        metPlayerNicknamesRef.current.clear();
        setCompletedQuestIds([]);
        resetSaveGame();
        resetFriendRequest();
        setGameResetVersion((currentVersion) => currentVersion + 1);

        // finally also reset user in DB so the savegame is not overwritten on
        // app reload.
        try {
            await api.delete(API_USER.root);
        } catch {
            console.warn('[resetUserInDB] DB reset failed!');
        }
        console.log('[GameReset] user has been successfully reset');
    }, [resetFriendRequest, resetSaveGame]);

    /** suck up */
    const exitLocalPlayer = useCallback(async (): Promise<void> => {
        const event: GameEvent = {
            eventType: EventType.PlayerLeft,
            data: null,
            logtime: new Date(),
            user: user!,
        };
        appendEvent(event);
        await gameRuntimeRef.current?.despawnLocalPlayer();
    }, [appendEvent, user]);

    const handleLogout = useCallback(async (): Promise<void> => {
        try {
            await exitLocalPlayer();
        } catch (error) {
            console.error(
                'Failed to despawn local player during logout:',
                error
            );
        }

        await logout();
    }, [exitLocalPlayer, logout]);

    const handleSpectatorExit = useCallback((): void => {
        setIsSpectator(false);
        setGameRunning(false);
    }, [setGameRunning, setIsSpectator]);

    /** bind Cleanup direkt */
    useEffect(() => {
        const mount = mountRef.current;
        if (!mount) return;

        const renderer = new THREE.WebGLRenderer({ antialias: true });
        mount.appendChild(renderer.domElement);

        let gameMode: GameMode = 'spectator';
        let runtimeGameEventHandler: ((event: GameEvent) => void) | undefined;
        let runtimeDialogHandler:
            ((state: DialogPanelState) => void) | undefined;
        let runtimeGameResetHandler: (() => void) | undefined;
        let runtimeGameplayReadyHandler: (() => void) | undefined;
        let runtimeFriendRequestHandler:
            typeof handleFriendRequestChange | undefined;
        let runtimeFriendStateSnapshotHandler:
            typeof handleFriendStateSnapshot | undefined;
        let runtimeSaveGameRestoreHandler: typeof SaveGameRestore | undefined;
        let runtimeConnectionChangeHandler:
            typeof handleGameConnectionChange | undefined;

        if (!isSpectator) {
            gameMode = 'player';
            runtimeGameEventHandler = handleGameEvent;
            runtimeDialogHandler = setDialog;
            runtimeGameResetHandler = handleGameReset;
            runtimeGameplayReadyHandler = () => setIsGameplayReady(true);
            runtimeFriendRequestHandler = handleFriendRequestChange;
            runtimeFriendStateSnapshotHandler = handleFriendStateSnapshot;
            runtimeSaveGameRestoreHandler = SaveGameRestore;
            runtimeConnectionChangeHandler = handleGameConnectionChange;
        }

        const runtime: GameRuntime = startGame(
            character,
            user!,
            serverAddrRef.current,
            renderer,
            runtimeGameEventHandler,
            runtimeDialogHandler,
            gameMode,
            handleReceivedChatMessage,
            runtimeGameResetHandler,
            runtimeGameplayReadyHandler,
            runtimeFriendRequestHandler,
            runtimeFriendStateSnapshotHandler,
            runtimeSaveGameRestoreHandler,
            runtimeConnectionChangeHandler
        );
        gameRuntimeRef.current = runtime;

        return () => {
            if (gameRuntimeRef.current === runtime) {
                gameRuntimeRef.current = null;
            }
            renderer.domElement.remove();

            void runtime
                .dispose()
                .finally(() => {
                    renderer.dispose();
                })
                .catch((error: unknown) => {
                    console.error('Game runtime cleanup failed:', error);
                });
        };
    }, [
        character,
        handleGameEvent,
        handleGameReset,
        handleFriendRequestChange,
        handleFriendStateSnapshot,
        handleGameConnectionChange,
        handleReceivedChatMessage,
        SaveGameRestore,
        isSpectator,
        user,
        serverAddrRef,
    ]);

    let spectatorExitButton: React.ReactNode = null;
    let playerOnlyGameUIProps: Partial<React.ComponentProps<typeof GameUI>> =
        {};

    if (!isSpectator && !eventLog) {
        throw new Error('Game must be used within an EventLogProvider');
    }

    if (isSpectator) {
        spectatorExitButton = (
            <button
                id='spectator-exit-btn'
                type='button'
                onClick={handleSpectatorExit}
            >
                EXIT SPECTATOR
            </button>
        );
    } else {
        playerOnlyGameUIProps = {
            onQuestStatusChange: handleQuestStatusChange,
            onBlackHoleCountdownExpired: handleBlackHoleCountdownExpired,
            onLogout: handleLogout,
            dialog,
            onDialogNext: handleDialogNext,
            blackHoleCountdownActive: isGameplayReady,
            blackHoleConnected: isGameConnected,
            restoredBlackHoleSecondsRemaining:
                blackHoleRestore.secondsRemaining,
            restoredBlackHoleCountdownCompleted: blackHoleRestore.completed,
            onBlackHoleTimerChange: BlackHoleTimerChange,
            friendRequest,
            friends,
            onFriendRemove: removeFriend,
        };
    }

    return (
        <>
            <div ref={mountRef} className='game-canvas-container' />
            {spectatorExitButton}
            {/* render GameUI after  SaveGameRestore */}
            {isSaveGameReady && (
                <GameUI
                    key={gameResetVersion + ':' + blackHoleRestore.version}
                    nickname={user!.nickname}
                    email={user!.email}
                    character={character}
                    completedQuestIds={completedQuestIds}
                    events={events}
                    matchHistory={matchHistory}
                    onChatMessage={handleChatMessage}
                    {...playerOnlyGameUIProps}
                    isSpectator={isSpectator}
                />
            )}
        </>
    );
};
