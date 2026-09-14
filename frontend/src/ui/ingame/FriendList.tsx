import type { FriendRequestState } from 'ftr-common/sharedTypes';

import { getFriendRequestMessage } from './FriendRequest';

export const FRIENDS_PANEL_ID = 'game-friends-panel';

type FriendListProps = {
    readonly friendRequest: FriendRequestState | null | undefined;
    readonly friends: readonly string[];
    readonly isOpen: boolean;
};

/** Shows accepted friends' nicknames in the list */
export function FriendList({
    friendRequest,
    friends,
    isOpen,
}: FriendListProps) {
    const friendListMessage =
        friends.length === 0 ? 'You got no friends. 😭' : friends.join('\n');

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
