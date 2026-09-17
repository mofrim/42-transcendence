import { useCallback, useState } from 'react';
import type {
    FriendListEntry,
    FriendRequestChangeHandler,
    FriendRequestState,
} from 'ftr-common/sharedTypes';
export const FRIENDS_PANEL_ID = 'game-friends-panel';

type FriendListProps = {
    readonly friendRequest: FriendRequestState | null | undefined;
    readonly friends: readonly FriendListEntry[];
    readonly isOpen: boolean;
    readonly onRemoveFriend?: ((friendPlayerId: string) => void) | undefined;
};

// eslint-disable-next-line react-refresh/only-export-components
export function getFriendRequestMessage(
    friendRequest: FriendRequestState | null | undefined
): string {
    if (!friendRequest) {
        return 'No pending friend requests.';
    }
    if (friendRequest.status === 'incoming') {
        return `${friendRequest.nickname} sent you a friend request.  Press\n👍🏻 [Y] ⌨️ to accept or\n👎🏻 [X] ⌨️ to decline.`;
    }
    if (friendRequest.status === 'sent') {
        return `Friend request sent to ${friendRequest.nickname}.`;
    }
    if (friendRequest.status === 'rejected') {
        switch (friendRequest.reason) {
            case 'same_account':
                return 'You cannot send a friend request to another player session using your account.';
            case 'already_friends':
                return `${friendRequest.nickname} is already in your friend list.`;
            case 'duplicate':
            case 'duplicate_request':
                return `A friend request involving ${friendRequest.nickname} is already pending.`;
            case 'invalid_target':
            default:
                return `Friend request to ${friendRequest.nickname} could not be sent.`;
        }
    }
    if (friendRequest.status === 'removed') {
        return `Friendship with ${friendRequest.nickname} removed.`;
    }
    return `Friend request with ${friendRequest.nickname} ${friendRequest.status}.`;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useFriendList() {
    const [friends, setFriends] = useState<FriendListEntry[]>([]);
    const handleFriendRequestChange = useCallback<FriendRequestChangeHandler>(
        (state): void => {
            if (state?.status === 'accepted') {
                setFriends((currentFriends) => {
                    if (
                        currentFriends.some(
                            (currentFriend) =>
                                currentFriend.playerId === state.playerId
                        )
                    ) {
                        return currentFriends;
                    }
                    return [...currentFriends, state];
                });
                return;
            }
            if (state?.status === 'removed') {
                setFriends((currentFriends) =>
                    currentFriends.filter(
                        (currentFriend) =>
                            currentFriend.playerId !== state.playerId
                    )
                );
            }
        },
        []
    );
    return {
        friends,
        setFriends,
        handleFriendRequestChange,
    };
}

// eslint-disable-next-line react-refresh/only-export-components
export function useFriendListPanel(
    friendRequest: FriendRequestState | null | undefined
) {
    const [isOpen, setIsOpen] = useState(false);
    const toggle = useCallback((): void => {
        setIsOpen((currentIsOpen) => !currentIsOpen);
    }, []);
    return {
        isOpen: isOpen || Boolean(friendRequest),
        toggle,
    };
}

/** Shows accepted friends' nicknames in the list */
export function FriendList({
    friendRequest,
    friends,
    isOpen,
    onRemoveFriend,
}: FriendListProps) {
    let friendListContent = (
        <p className='hud-friends-placeholder'>You got no friends. 😭</p>
    );
    if (friends.length > 0) {
        friendListContent = (
            <ul className='hud-friends-list'>
                {friends.map((friend) => {
                    let removeButton = null;
                    if (onRemoveFriend) {
                        const removeLabel = `Remove ${friend.nickname} from friend list`;
                        removeButton = (
                            <button
                                type='button'
                                className='hud-friend-remove'
                                aria-label={removeLabel}
                                title={removeLabel}
                                onClick={() => onRemoveFriend(friend.playerId)}
                            >
                                ×
                            </button>
                        );
                    }
                    return (
                        <li key={friend.playerId} className='hud-friend-item'>
                            <span className='hud-friend-name'>
                                {friend.nickname}
                            </span>
                            {removeButton}
                        </li>
                    );
                })}
            </ul>
        );
    }
    return (
        <aside
            id={FRIENDS_PANEL_ID}
            className='hud-panel hud-friends-panel'
            aria-label='Friendlist'
            hidden={!isOpen}
        >
            <h2 className='hud-title'>Friendlist</h2>
            {friendListContent}
            <p className='hud-friends-placeholder'>
                {getFriendRequestMessage(friendRequest)}
            </p>
        </aside>
    );
}
