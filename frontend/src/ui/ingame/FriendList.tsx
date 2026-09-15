import { useCallback, useState } from 'react';

import type { FriendRequestState } from 'ftr-common/sharedTypes';

import { getFriendRequestMessage } from './FriendRequest';

export const FRIENDS_PANEL_ID = 'game-friends-panel';

type FriendListProps = {
    readonly friendRequest: FriendRequestState | null | undefined;
    readonly friends: readonly string[];
    readonly isOpen: boolean;
};

// eslint-disable-next-line react-refresh/only-export-components
export function useFriendList() {
    const [friends, setFriends] = useState<string[]>([]);

    const addFriend = useCallback((nickname: string): void => {
        setFriends((currentFriends) => {
            if (currentFriends.includes(nickname)) {
                return currentFriends;
            }

            return [...currentFriends, nickname];
        });
    }, []);

    return {
        friends,
        addFriend,
    };
}

/** Shows accepted friends' nicknames in the list */
export function FriendList({
    friendRequest,
    friends,
    isOpen,
}: FriendListProps) {
    let friendListMessage = 'You got no friends. 😭';
    if (friends.length > 0) {
        friendListMessage = friends.join('\n');
    }

    return (
        <aside
            id={FRIENDS_PANEL_ID}
            className='hud-panel hud-friends-panel'
            aria-label='Friendlist'
            hidden={!isOpen}
        >
            <h2 className='hud-title'>Friendlist</h2>
            <p className='hud-friends-placeholder'>
                {friendListMessage}
                {'\n\n'}
                {getFriendRequestMessage(friendRequest)}
            </p>
        </aside>
    );
}
