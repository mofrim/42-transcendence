import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLoginContext } from '../../hooks/useLoginContext';
import { startGame } from '../../game/main';
import type { GameRuntime, GameRuntimeEvent } from '../../game/main';
import {
    DEFAULT_PLAYER_NICKNAME,
    normalizePlayerNickname,
} from '../../game/PlayerIdentity';
import {
    GameUI,
    MAX_EVENT_LOG_ENTRIES,
    type EventLogEntry,
} from '../ingame/GameUI';
import {
    applyQuestCompletionEvent,
    describeQuestStatusChange,
} from '../ingame/QuestLog';
import type { QuestStatusChange } from '../ingame/QuestLog';
import * as THREE from 'three';

/** Formats a date as a time string in HH:MM:SS format */
function formatEventTimestamp(date: Date): string {
    return [date.getHours(), date.getMinutes(), date.getSeconds()]
        .map((part) => String(part).padStart(2, '0'))
        .join(':');
}

function describeGameRuntimeEvent(event: GameRuntimeEvent): string {
    switch (event.type) {
        case 'player_joined':
            return `${event.nickname} 👋🏻 joined`;
        case 'player_left':
            return `${event.nickname} 🚪 logged out`;
        case 'player_in_range':
            return `Met ${event.nickname} nearby`;
        case 'game_result':
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

export const Game = () => {
    const { gameRunning, avatar, nicknameRef, fullAddrRef } = useLoginContext();

    // using ref here a lot because th
    const mountRef = useRef<HTMLDivElement>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const gameRuntimeRef = useRef<GameRuntime | null>(null);
    const isInitializedRef = useRef(false);
    const eventSequenceRef = useRef(0);
    const [nickname, setNickname] = useState(DEFAULT_PLAYER_NICKNAME);
    const [events, setEvents] = useState<EventLogEntry[]>([]);
    const [completedQuestIds, setCompletedQuestIds] = useState<string[]>([]);

    const appendEvent = useCallback((description: string): void => {
        const now = new Date();
        const event: EventLogEntry = {
            id: `${now.getTime()}-${eventSequenceRef.current++}`,
            timestamp: formatEventTimestamp(now),
            description,
        };

        setEvents((currentEvents) =>
            [...currentEvents, event].slice(-MAX_EVENT_LOG_ENTRIES)
        );
    }, []);

    /** Runtime-Ereignisse bleiben auch außerhalb des Sichtfelds sichtbar. */
    const handleGameEvent = useCallback(
        (event: GameRuntimeEvent): void => {
            appendEvent(describeGameRuntimeEvent(event));
            setCompletedQuestIds((currentQuestIds) =>
                applyQuestCompletionEvent(currentQuestIds, event)
            );
        },
        [appendEvent]
    );

    const handleChatMessage = useCallback(
        (message: string): void => {
            appendEvent(`${nickname} 💬 ${message}`);
            gameRuntimeRef.current?.showLocalChatMessage(message);
        },
        [appendEvent, nickname]
    );

    const handleQuestStatusChange = useCallback(
        (statusChange: QuestStatusChange): void => {
            appendEvent(describeQuestStatusChange(statusChange));
        },
        [appendEvent]
    );

    useEffect(() => {
        // guard against re-render due to strict-mode
        if (isInitializedRef.current) return;
        isInitializedRef.current = true;
        const normalizedNickname = normalizePlayerNickname(nicknameRef.current);
        setNickname(normalizedNickname);

        const renderer = new THREE.WebGLRenderer({ antialias: true });
        rendererRef.current = renderer;

        if (mountRef.current) {
            console.warn('mountRef.current am start!');
            mountRef.current.appendChild(renderer.domElement);
        }

        gameRuntimeRef.current = startGame(
            avatar === 'true',
            normalizedNickname,
            fullAddrRef.current,
            renderer,
            handleGameEvent
        );

        // cleanup... in case we want to support logging out againg one day
        // TODO test this! needs implementing some mechanism for unsetting gameRunning
        return () => {
            if (!gameRunning) {
                if (mountRef.current && rendererRef.current) {
                    // TODO think about this...
                    // eslint-disable-next-line react-hooks/exhaustive-deps
                    mountRef.current.removeChild(
                        rendererRef.current.domElement
                    );
                    rendererRef.current.dispose();
                }
                gameRuntimeRef.current = null;
                isInitializedRef.current = false; // Reset on unmount
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [gameRunning]);

    return (
        <>
            <div ref={mountRef} style={{ width: '100vw', height: '100vh' }} />
            <GameUI
                nickname={nickname}
                completedQuestIds={completedQuestIds}
                events={events}
                onChatMessage={handleChatMessage}
                onQuestStatusChange={handleQuestStatusChange}
            />
        </>
    );
};
