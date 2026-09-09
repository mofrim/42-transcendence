import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLoginContext } from '../../hooks/useLoginContext';
import { useAuth } from '../../hooks/useAuthContext';
import {
    startGame,
    type GameMode,
    type GameRuntime,
    type GameRuntimeEvent,
} from '../../game/main';
import type { ReceivedChatPayload } from 'common/sharedTypes';
import { useMatchHistory } from '../../hooks/useMatchHistory';
import {
    GameUI,
    type DialogPanelState,
    MAX_EVENT_LOG_ENTRIES,
} from '../ingame/GameUI';
import type { EventLogEntry } from '../ingame/EventLogItems';
import {
    applyQuestCompletionEvent,
    BLACK_HOLE_QUEST_ID,
    describeQuestStatusChange,
    type QuestStatusChange,
} from '../ingame/QuestLog';
import * as THREE from 'three';

const EVENT_TIME_FORMAT = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
});

function describeGameEvent(event: GameRuntimeEvent): string {
    switch (event.type) {
        case 'player_joined':
            return `${event.nickname} 👋🏻 joined`;
        case 'player_left':
            return `${event.nickname} 🚪 logged out`;
        case 'player_in_range':
            return `Met ${event.nickname} nearby`;
        case 'quest_completed':
            return `Completed quest ${event.questId}`;
        case 'game_result':
            if (event.outcome === 'draw') {
                return `${event.playerNickname} drew a game of ${event.game} against ${event.opponentNickname}`;
            }
            return `${event.playerNickname} ${event.outcome} a game of ${event.game} against ${event.opponentNickname}`;
    }
}

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
    nickname: string;
    email: string;
    isSpectator?: boolean;
}> = ({ nickname, email, isSpectator = false }) => {
    const { avatar, serverAddrRef, setGameRunning, setIsSpectator } =
        useLoginContext();
    const { logout } = useAuth();
    const [character] = useState(() => avatar === 'true');

    // using ref here a lot because th
    const mountRef = useRef<HTMLDivElement>(null);
    const gameRuntimeRef = useRef<GameRuntime | null>(null);
    const metPlayerNicknamesRef = useRef(new Set<string>());
    const [events, setEvents] = useState<EventLogEntry[]>([]);
    const { matchHistory, saveTicTacToeMatch } = useMatchHistory({
        nickname,
        isSpectator,
    });
    const [completedQuestIds, setCompletedQuestIds] = useState<string[]>([]);
    const [gameResetVersion, setGameResetVersion] = useState(0);
    const [isGameplayReady, setIsGameplayReady] = useState(false);
    const [dialog, setDialog] = useState<DialogPanelState>({
        isOpen: false,
        message: '',
    });

    const appendEvent = useCallback((description: string): void => {
        const now = new Date();
        const event: EventLogEntry = {
            id: crypto.randomUUID(),
            timestamp: EVENT_TIME_FORMAT.format(now),
            description,
        };

        setEvents((currentEvents) =>
            [...currentEvents, event].slice(-MAX_EVENT_LOG_ENTRIES)
        );
    }, []);

    /** Runtime-Ereignisse bleiben auch außerhalb des Sichtfelds sichtbar. */
    const handleGameEvent = useCallback(
        (event: GameRuntimeEvent): void => {
            if (event.type === 'player_in_range') {
                const metPlayerNicknames = metPlayerNicknamesRef.current;
                // only log the first time we meet a player, not every time again
                if (!metPlayerNicknames.has(event.nickname)) {
                    metPlayerNicknames.add(event.nickname);
                    appendEvent(describeGameEvent(event));
                }
            } else if (event.type !== 'quest_completed') {
                appendEvent(describeGameEvent(event));
            }

            if (event.type === 'game_result') {
                void saveTicTacToeMatch(event);
            }
            setCompletedQuestIds((currentQuestIds) =>
                applyQuestCompletionEvent(currentQuestIds, event)
            );
        },
        [appendEvent, saveTicTacToeMatch]
    );

    const handleChatMessage = useCallback((message: string): void => {
        gameRuntimeRef.current?.sendChatMessage(message);
    }, []);

    const handleReceivedChatMessage = useCallback(
        (message: ReceivedChatPayload): void => {
            appendEvent(`${message.senderName} 💬 ${message.message}`);
        },
        [appendEvent]
    );

    const handleQuestStatusChange = useCallback(
        (statusChange: QuestStatusChange): void => {
            appendEvent(describeQuestStatusChange(statusChange));
            if (
                statusChange.questId === BLACK_HOLE_QUEST_ID &&
                !statusChange.completed
            ) {
                gameRuntimeRef.current?.triggerBlackHoleCutscene();
                //console.log('### Quest status change:', statusChange);
            }
        },
        [appendEvent]
    );

    const handleDialogNext = useCallback((): void => {
        gameRuntimeRef.current?.continueDialogue();
    }, []);

    const handleGameReset = useCallback((): void => {
        metPlayerNicknamesRef.current.clear();
        setCompletedQuestIds([]);
        setEvents([]);
        setGameResetVersion((currentVersion) => currentVersion + 1);
    }, []);

    /** suck up */
    const exitLocalPlayer = useCallback(
        async (description: string): Promise<void> => {
            appendEvent(description);
            await gameRuntimeRef.current?.despawnLocalPlayer();
        },
        [appendEvent]
    );

    const handleLogout = useCallback(async (): Promise<void> => {
        try {
            await exitLocalPlayer(`${nickname} 🚪 logged out`);
        } catch (error) {
            console.error(
                'Failed to despawn local player during logout:',
                error
            );
        }

        await logout();
    }, [exitLocalPlayer, logout, nickname]);

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
        let runtimeGameEventHandler:
            ((event: GameRuntimeEvent) => void) | undefined;
        let runtimeDialogHandler:
            ((state: DialogPanelState) => void) | undefined;
        let runtimeGameResetHandler: (() => void) | undefined;
        let runtimeGameplayReadyHandler: (() => void) | undefined;

        if (!isSpectator) {
            gameMode = 'player';
            runtimeGameEventHandler = handleGameEvent;
            runtimeDialogHandler = setDialog;
            runtimeGameResetHandler = handleGameReset;
            runtimeGameplayReadyHandler = () => setIsGameplayReady(true);
        }

        const runtime: GameRuntime = startGame(
            character,
            nickname,
            serverAddrRef.current,
            renderer,
            runtimeGameEventHandler,
            runtimeDialogHandler,
            gameMode,
            handleReceivedChatMessage,
            runtimeGameResetHandler,
            runtimeGameplayReadyHandler
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
        nickname,
        serverAddrRef,
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
            onLogout: handleLogout,
            dialog,
            onDialogNext: handleDialogNext,
            blackHoleCountdownActive: isGameplayReady,
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
                nickname={nickname}
                email={email}
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
