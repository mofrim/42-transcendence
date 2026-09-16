import { useCallback, useState } from 'react';

import type {
    FriendListEntry,
    FriendRequestChangeHandler,
    FriendRequestState,
} from 'ftr-common/sharedTypes';

import { getFriendRequestMessage } from './FriendRequest';

export const FRIENDS_PANEL_ID = 'game-friends-panel';

type FriendListProps = {
    readonly friendRequest: FriendRequestState | null | undefined;
    readonly friends: readonly FriendListEntry[];
    readonly isOpen: boolean;
    readonly onRemoveFriend?: ((friendPlayerId: string) => void) | undefined;
};

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
        handleFriendRequestChange,
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
