import { GameEvent } from 'ftr-common/sharedTypes';

export const EVENT_TIME_FORMAT = new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
});

/**
 * The single source of truth for event-descriptions.
 *
 * @param event - GameEvent object containing all necessary info
 * @returns string - containing the events description as shown in eventlog
 *
 */
export const describeGameEvent = (event: GameEvent): string => {
    switch (event.eventType) {
        case 'PlayerJoined':
            return `${event.data.nickname} 👋🏻 joined`;
        case 'PlayerLeft':
            // FIXME handle undefined at first start here
            return `${event.data.nickname} 🚪 logged out`;
        case 'PlayerInRange':
            return `Met ${event.data.nickname} nearby`;
        case 'QuestCompleted': {
            const questDescription =
                event.data.questText ?? event.data.questId ?? 'unknown quest';
            return `${event.data.nickname} completed quest ${questDescription}`;
        }
        case 'GameResult':
            if (event.data.outcome === 'draw') {
                return `${event.data.playerNickname} drew a game of ${event.data.game} against ${event.data.opponentNickname}`;
            }
            return `${event.data.playerNickname} ${event.data.outcome} a game of ${event.data.game} against ${event.data.opponentNickname}`;
        case 'ChatMsg':
            return `${event.data.nickname} 💬 ${event.data.chatmsg}`;
        case 'Blackholed':
            return `${event.data.nickname} got blackholed`;
        default:
            // QUESTION
            // FIXME can we ever reach this? Are all possible events handled
            return `Something else happened...`;
    }
};
