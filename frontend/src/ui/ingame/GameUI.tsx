import { useState } from 'react';
import type { SyntheticEvent } from 'react';

import './GameUI.css';

const QUEST_LOG_ID = 'game-quest-log';

export type QuestLogEntry = {
    readonly id: string;
    readonly text: string;
    readonly completed?: boolean;
};

type GameUIProps = {
    readonly quests?: readonly QuestLogEntry[];
};

/** Statische Beispielaufgaben für das Quest Log. */
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

/**
 * React HUD for controls that do not belong in the Three.js scene.
 */
export function GameUI({ quests = DEFAULT_QUESTS }: GameUIProps) {
    const [isQuestLogOpen, setIsQuestLogOpen] = useState(false);

    const handleToggle = (): void => {
        setIsQuestLogOpen((isOpen) => !isOpen);
    };

    const stopGameInteraction = (event: SyntheticEvent): void => {
        event.stopPropagation();
    };

    let buttonLabel = 'Quest Log öffnen';
    if (isQuestLogOpen) {
        buttonLabel = 'Quest Log schließen';
    }

    return (
        <div
            id='game-ui'
            className='game-ui'
            onClick={stopGameInteraction}
            onPointerDown={stopGameInteraction}
        >
            <button
                type='button'
                className='game-ui__quest-toggle'
                aria-controls={QUEST_LOG_ID}
                aria-expanded={isQuestLogOpen}
                aria-label={buttonLabel}
                title={buttonLabel}
                onClick={handleToggle}
            >
                📑
            </button>

            <aside
                id={QUEST_LOG_ID}
                className='game-ui__quest-log'
                aria-label='Quest Log'
                hidden={!isQuestLogOpen}
            >
                <h2 className='game-ui__quest-title'>Quest Log</h2>
                <ul className='game-ui__quest-list'>
                    {quests.map((quest) => {
                        let marker = '❎';
                        if (quest.completed) {
                            marker = '✅';
                        }

                        return (
                            <li
                                key={quest.id}
                                className='game-ui__quest-item'
                                data-quest-id={quest.id}
                            >
                                <span
                                    className='game-ui__quest-marker'
                                    aria-hidden='true'
                                >
                                    {marker}
                                </span>
                                <span className='game-ui__quest-text'>
                                    {quest.text}
                                </span>
                            </li>
                        );
                    })}
                </ul>
            </aside>
        </div>
    );
}
