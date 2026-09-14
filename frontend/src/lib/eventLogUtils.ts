import {
    GameEvent,
    type EventDataChatMsg,
    type EventDataFriendRequest,
    type EventDataGameResult,
    type EventDataPlayerInRange,
    type EventDataQuestCompleted,
} from 'ftr-common/sharedTypes';

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
            return `${event.user.nickname} 👋🏻 joined`;
        case 'PlayerLeft':
            return `${event.user.nickname} 🚪 logged out`;
        case 'PlayerInRange':
            return `Met ${(event.data as EventDataPlayerInRange).remoteNick} nearby`;
        case 'FriendRequest': {
            const evData = event.data as EventDataFriendRequest;
            if (evData.friendRequestStatus === 'incoming') {
                return `${evData.friendNick} sent you a friend request`;
            }
            if (evData.friendRequestStatus === 'sent') {
                return `Friend request sent to ${evData.friendNick}`;
            }
            return `Friend request with ${evData.friendNick} ${evData.friendRequestStatus}`;
        }
        case 'QuestCompleted': {
            const evData = event.data as EventDataQuestCompleted;
            const questDescription =
                evData.questText ?? evData.questId ?? 'unknown quest';
            return `${event.user.nickname} completed quest ${questDescription}`;
        }
        case 'GameResult': {
            const evData = event.data as EventDataGameResult;
            if (evData.outcome === 'draw') {
                return `${event.user.nickname} drew a game of ${evData.game} against ${evData.opponentNickname}`;
            }
            return `${event.user.nickname} ${evData.outcome} a game of ${evData.game} against ${evData.opponentNickname}`;
        }
        case 'ChatMsg': {
            const evData = event.data as EventDataChatMsg;
            return `${event.user.nickname} 💬 ${evData.chatmsg}`;
        }
        case 'Blackholed':
            return `${event.user.nickname} got blackholed`;
        default:
            // QUESTION
            // FIXME can we ever reach this? Are all possible events handled
            return `Something else happened...`;
    }
};
