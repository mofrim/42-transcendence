import { useState } from 'react';
import type { SyntheticEvent } from 'react';

import './GameUI.css';

const QUEST_LOG_ID = 'game-quest-log';
const PROFILE_PANEL_ID = 'game-profile-panel';

export type QuestLogEntry = {
    readonly id: string;
    readonly text: string;
    readonly completed?: boolean;
};

type GameUIProps = {
    readonly nickname: string;
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
export function GameUI({ nickname, quests = DEFAULT_QUESTS }: GameUIProps) {
    const [isQuestLogOpen, setIsQuestLogOpen] = useState(false);
    const [isProfileOpen, setIsProfileOpen] = useState(false);

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
                <h2 className='hud-title'>Quest Log</h2>
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
        </div>
    );
}
