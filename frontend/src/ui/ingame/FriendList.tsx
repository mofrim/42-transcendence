import type { FriendRequestState } from 'ftr-common/sharedTypes';

import { getFriendRequestMessage } from './FriendRequest';

export const FRIENDS_PANEL_ID = 'game-friends-panel';

type FriendListProps = {
    readonly friendRequest: FriendRequestState | null | undefined;
    readonly isOpen: boolean;
};

export function FriendList({ friendRequest, isOpen }: FriendListProps) {
    return (
        <aside
            id={FRIENDS_PANEL_ID}
            className='hud-panel hud-friends-panel'
            aria-label='Friendlist'
            hidden={!isOpen}
        >
            <h2 className='hud-title'>Friendlist</h2>
            <p className='hud-friends-placeholder'>
                {getFriendRequestMessage(friendRequest)}
            </p>
        </aside>
    );
}
