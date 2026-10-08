import {
    GameEvent,
    type EventDataChatMsg,
    type EventDataFriendRequest,
    type EventDataMiniGameResult,
    type EventDataPlayerInRange,
    type EventDataQuestCompleted,
} from 'ftr-common/sharedTypes';

export const MAX_EVENT_LOG_ENTRIES = 10;

export const EVENT_TIME_FORMAT = new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
});

function getLifecyclePlayerNickname(event: GameEvent): string {
    const { data } = event;
    if (data !== null && 'playerNickname' in data) {
        const playerNickname = data.playerNickname.trim();
        if (playerNickname) {
            return playerNickname;
        }
    }

    return event.user.nickname;
}

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
            return `${getLifecyclePlayerNickname(event)} 👋🏻 joined`;
        case 'PlayerLeft':
            return `${getLifecyclePlayerNickname(event)} 🚪 logged out`;
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
            if (evData.friendRequestStatus === 'removed') {
                return `Friendship with ${evData.friendNick} removed`;
            }
            if (evData.friendRequestStatus === 'rejected') {
                switch (evData.friendRequestReason) {
                    case 'same_account':
                        return `Friend request to ${evData.friendNick} rejected: same account`;
                    case 'already_friends':
                        return `Friend request to ${evData.friendNick} rejected: already friends`;
                    case 'duplicate':
                        return `Friend request to ${evData.friendNick} rejected: duplicate request`;
                    case 'duplicate_request':
                        return `Friend request to ${evData.friendNick} rejected: another request is pending`;
                    case 'invalid_target':
                        return `Friend request to ${evData.friendNick} rejected: player unavailable`;
                }
            }
            return `Friend request with ${evData.friendNick} ${evData.friendRequestStatus}`;
        }
        case 'QuestCompleted': {
            const evData = event.data as EventDataQuestCompleted;
            const questDescription =
                evData.questText ?? evData.questId ?? 'unknown quest';
            return `${event.user.nickname} completed quest ${questDescription}`;
        }
        case 'MiniGameResult': {
            const evData = event.data as EventDataMiniGameResult;
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
            return `Something else happened...`;
    }
};

export const getGameEventProfileNicknames = (
    event: GameEvent
): readonly string[] => {
    switch (event.eventType) {
        case 'PlayerJoined':
        case 'PlayerLeft':
            return [getLifecyclePlayerNickname(event)];
        case 'QuestCompleted':
        case 'Blackholed':
            return [event.user.nickname];
        case 'ChatMsg': {
            const evData = event.data as EventDataChatMsg;
            /** filter out NPC messages for profile links */
            if (evData.senderType === 'npc') {
                return [];
            }
            return [event.user.nickname];
        }
        case 'PlayerInRange':
            return [(event.data as EventDataPlayerInRange).remoteNick];
        case 'FriendRequest':
            return [(event.data as EventDataFriendRequest).friendNick];
        case 'MiniGameResult': {
            const evData = event.data as EventDataMiniGameResult;
            return [event.user.nickname, evData.opponentNickname];
        }
        default:
            return [];
    }
};
