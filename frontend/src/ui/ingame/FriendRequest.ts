import { useCallback, useEffect, useState } from 'react';

import type { FriendRequestState } from 'ftr-common/sharedTypes';

const FRIEND_REQUEST_RESULT_DISPLAY_MS = 4_000;

export function useFriendRequest() {
    const [friendRequest, setFriendRequestState] =
        useState<FriendRequestState | null>(null);
    const [friends, setFriends] = useState<string[]>([]);

    const setFriendRequest = useCallback(
        (state: FriendRequestState | null): void => {
            if (state?.status === 'accepted') {
                setFriends((currentFriends) =>
                    currentFriends.includes(state.nickname)
                        ? currentFriends
                        : [...currentFriends, state.nickname]
                );
            }

            setFriendRequestState(state);
        },
        []
    );

    useEffect(() => {
        if (
            friendRequest?.status !== 'accepted' &&
            friendRequest?.status !== 'declined'
        ) {
            return;
        }

        const timeoutId = window.setTimeout(() => {
            setFriendRequestState(null);
        }, FRIEND_REQUEST_RESULT_DISPLAY_MS);

        return () => {
            window.clearTimeout(timeoutId);
        };
    }, [friendRequest]);

    return {
        friendRequest,
        friends,
        setFriendRequest,
    };
}

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

    return `Friend request with ${friendRequest.nickname} ${friendRequest.status}.`;
}
