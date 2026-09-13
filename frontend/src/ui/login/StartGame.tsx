import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLoginContext } from '../../hooks/useLoginContext';
import { useAuth } from '../../hooks/useAuthContext';
import { startGame, type GameMode, type GameRuntime } from '../../game/main';
import {
    type ReceivedChatPayload,
    GameEvent,
    EventType,
    User,
} from 'ftr-common/sharedTypes';
import { useMatchHistory } from '../../hooks/useMatchHistory';
import { GameUI, type DialogPanelState } from '../ingame/GameUI';
import { useFriendRequest } from '../ingame/FriendList';
import {
    applyQuestCompletionEvent,
    type QuestStatusChange,
} from '../ingame/QuestLog';
import * as THREE from 'three';

import { useEventLog } from '../../hooks/useEventLog';

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
    const [completedQuestIds, setCompletedQuestIds] = useState<string[]>([]);
    const [gameResetVersion, setGameResetVersion] = useState(0);
    const [isGameplayReady, setIsGameplayReady] = useState(false);
    const { friendRequest, setFriendRequest } = useFriendRequest();
    const [dialog, setDialog] = useState<DialogPanelState>({
        isOpen: false,
        message: '',
    });

    const { matchHistory, saveMatchResult } = useMatchHistory({
        userId: user?.id ?? 0,
        isSpectator,
    });

    // FIXME unfortunately useEventLog() cannot be loaded conditionally (leads
    // to lint-error) so we have to handle it like this for spectator-mode
    const { events: realEvents, appendEvent: realAppendEvent } = useEventLog();

    // dummies for spectator mode
    const spectatorEventLog = {
        events: [],
        appendEvent: () => {},
    };

    // set events, appendEvent conditionally
    const { events, appendEvent } = isSpectator
        ? spectatorEventLog
        : { events: realEvents, appendEvent: realAppendEvent };

    /** Runtime-Ereignisse bleiben auch außerhalb des Sichtfelds sichtbar. */
    const handleGameEvent = useCallback(
        (event: GameEvent): void => {
            if (event.eventType === EventType.PlayerInRange) {
                const metPlayerNicknames = metPlayerNicknamesRef.current;
                // only log the first time we meet a player, not every time again
                if (!metPlayerNicknames.has(event.data.nickname!)) {
                    metPlayerNicknames.add(event.data.nickname!);
                    appendEvent(event);
                }
            } else if (event.eventType !== EventType.QuestCompleted) {
                appendEvent(event);
            }

            if (event.eventType === EventType.GameResult) {
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
                    nickname: message.senderName,
                    chatmsg: message.message,
                },
                logtime: new Date(),
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
                    nickname: user!.nickname,
                    questText: statusChange.questText,
                    questId: statusChange.questId,
                },
                logtime: new Date(),
            });
        },
        [appendEvent, user]
    );

    const handleBlackHoleCountdownExpired = useCallback((): void => {
        appendEvent({
            eventType: EventType.Blackholed,
            data: { nickname: user!.nickname },
            logtime: new Date(),
        });
        gameRuntimeRef.current?.triggerBlackHoleCutscene();
    }, [appendEvent, user]);

    const handleDialogNext = useCallback((): void => {
        gameRuntimeRef.current?.continueDialogue();
    }, []);

    const handleGameReset = useCallback((): void => {
        metPlayerNicknamesRef.current.clear();
        setCompletedQuestIds([]);
        setFriendRequest(null);
        setGameResetVersion((currentVersion) => currentVersion + 1);
    }, [setFriendRequest]);

    /** suck up */
    const exitLocalPlayer = useCallback(async (): Promise<void> => {
        const event: GameEvent = {
            eventType: EventType.PlayerLeft,
            data: {
                nickname: user!.nickname,
            },
            logtime: new Date(),
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
        let runtimeFriendRequestHandler: typeof setFriendRequest | undefined;

        if (!isSpectator) {
            gameMode = 'player';
            runtimeGameEventHandler = handleGameEvent;
            runtimeDialogHandler = setDialog;
            runtimeGameResetHandler = handleGameReset;
            runtimeGameplayReadyHandler = () => setIsGameplayReady(true);
            runtimeFriendRequestHandler = setFriendRequest;
        }

        const runtime: GameRuntime = startGame(
            character,
            user!.nickname,
            serverAddrRef.current,
            renderer,
            runtimeGameEventHandler,
            runtimeDialogHandler,
            gameMode,
            handleReceivedChatMessage,
            runtimeGameResetHandler,
            runtimeGameplayReadyHandler,
            runtimeFriendRequestHandler
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
        handleReceivedChatMessage,
        isSpectator,
        user,
        serverAddrRef,
        setFriendRequest,
    ]);

    let spectatorExitButton: React.ReactNode = null;
    let playerOnlyGameUIProps: Partial<React.ComponentProps<typeof GameUI>> =
        {};

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
            friendRequest,
        };
    }

    return (
        <>
            <div ref={mountRef} className='game-canvas-container' />
            {spectatorExitButton}
            <GameUI
                key={gameResetVersion}
                // NOTE now we can just use the users nickname from DB here..
                // this might change when we want to allow change user-prefs
                // from a in-game ui
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
        </>
    );
};
