import { useCallback, useEffect, useState, type RefObject } from 'react';
import type { Socket } from 'socket.io-client';
import type { Remote_Player } from '../../game/remote_player.js';
import { useFriendList } from './FriendList';
export { getFriendRequestMessage } from './FriendList';
import {
    EventType,
    type EventDataFriendRequest,
    type GameEvent,
    type FriendRemoveAcknowledgement,
    type FriendRemovePayload,
    type FriendRequestAcknowledgement,
    type FriendRequestChangeHandler,
    type FriendRequestPayload,
    type FriendRequestState,
    type FriendResponsePayload,
    type FriendResponseType,
    type FriendStateSnapshot,
    type FriendStateSnapshotHandler,
    type User,
} from 'ftr-common/sharedTypes';

const FRIEND_REQUEST_RESULT_DISPLAY_MS = 4_000;

type UseFriendRequestOptions = {
    readonly onFriendListChange?: FriendRequestChangeHandler;
    readonly appendEvent?: (event: GameEvent) => void;
    readonly runtimeRef?: RefObject<FriendRequestRuntimeActions | null>;
    readonly user?: User;
};

export type FriendRequestRuntimeActions = {
    readonly removeFriend: (friendPlayerId: string) => void;
};

type FriendRequestRuntimeActionsOptions = {
    readonly isDisposed: () => boolean;
    readonly removeFriend: (friendPlayerId: string) => void;
};

export function createFriendRequestRuntimeActions(
    options: FriendRequestRuntimeActionsOptions
): FriendRequestRuntimeActions {
    return {
        removeFriend(friendPlayerId: string): void {
            if (options.isDisposed()) {
                return;
            }
            options.removeFriend(friendPlayerId);
        },
    };
}

type FriendRequestManagerOptions = {
    readonly socket: Socket;
    readonly players: ReadonlyMap<string, Remote_Player>;
    readonly onFriendRequestChange: FriendRequestChangeHandler | undefined;
    readonly onFriendStateSnapshot: FriendStateSnapshotHandler | undefined;
    readonly resolvePlayerNickname: (
        playerId: string,
        fallbackNickname?: string
    ) => string;
};

export type FriendRequestUpdate =
    FriendRequestPayload | FriendResponsePayload | FriendRemovePayload;

export function isFriendRequestUpdate(data: {
    readonly type: string;
}): data is FriendRequestUpdate {
    return (
        data.type === 'friend_request' ||
        data.type === 'friend_accept' ||
        data.type === 'friend_decline' ||
        data.type === 'friend_remove'
    );
}

function getStableFriendUserId(data: {
    readonly friendUserId?: number;
}): string | null {
    const friendUserId = data.friendUserId;
    return Number.isSafeInteger(friendUserId) ? String(friendUserId) : null;
}

export class FriendRequestManager {
    private readonly socket: Socket;
    private readonly players: ReadonlyMap<string, Remote_Player>;
    private onFriendRequestChange: FriendRequestChangeHandler | undefined;
    private onFriendStateSnapshot: FriendStateSnapshotHandler | undefined;
    private readonly resolvePlayerNickname: (
        playerId: string,
        fallbackNickname?: string
    ) => string;
    private pendingRequesterUserId: string | null = null;
    private pendingRecipientUserId: string | null = null;
    private requestTargetSocketId: string | null = null;
    constructor(options: FriendRequestManagerOptions) {
        this.socket = options.socket;
        this.players = options.players;
        this.onFriendRequestChange = options.onFriendRequestChange;
        this.onFriendStateSnapshot = options.onFriendStateSnapshot;
        this.resolvePlayerNickname = options.resolvePlayerNickname;
        this.bindSocketEvents();
        if (this.socket.connected) {
            this.syncFriendState();
        }
    }

    private readonly handleSocketUpdate = (data: {
        readonly type: string;
    }): void => {
        if (isFriendRequestUpdate(data)) {
            this.handleUpdate(data);
        }
    };

    private bindSocketEvents(): void {
        this.socket.on('connect', this.syncFriendState);
        this.socket.on('friend_state', this.applyFriendStateSnapshot);
        this.socket.on('update', this.handleSocketUpdate);
    }

    private unbindSocketEvents(): void {
        this.socket.off('connect', this.syncFriendState);
        this.socket.off('friend_state', this.applyFriendStateSnapshot);
        this.socket.off('update', this.handleSocketUpdate);
    }

    private readonly syncFriendState = (): void => {
        if (!this.onFriendStateSnapshot) {
            return;
        }
        this.socket.emit('friend_sync', this.applyFriendStateSnapshot);
    };

    private readonly applyFriendStateSnapshot = (
        snapshot: FriendStateSnapshot
    ): void => {
        this.pendingRequesterUserId = null;
        this.pendingRecipientUserId = null;
        this.requestTargetSocketId = null;
        const pendingRequest = snapshot.pendingRequest;
        if (pendingRequest !== null) {
            if (pendingRequest.direction === 'incoming') {
                this.pendingRequesterUserId = pendingRequest.playerId;
            } else {
                this.pendingRecipientUserId = pendingRequest.playerId;
            }
        }
        this.onFriendStateSnapshot?.(snapshot);
    };

    handleRequest(data: FriendRequestPayload): void {
        const friendUserId = getStableFriendUserId(data);
        if (friendUserId === null) {
            return;
        }
        this.pendingRecipientUserId = null;
        this.requestTargetSocketId = null;
        this.pendingRequesterUserId = friendUserId;
        this.onFriendRequestChange?.({
            status: 'incoming',
            playerId: friendUserId,
            nickname: this.resolvePlayerNickname(data.id, data.nickname),
        });
    }

    handleResponse(data: FriendResponsePayload): void {
        const friendUserId = getStableFriendUserId(data);
        if (friendUserId === null) {
            return;
        }
        if (this.pendingRequesterUserId === friendUserId) {
            this.pendingRequesterUserId = null;
        }
        if (this.pendingRecipientUserId === friendUserId) {
            this.pendingRecipientUserId = null;
        }
        this.requestTargetSocketId = null;
        let status: FriendRequestState['status'] = 'declined';
        if (data.type === 'friend_accept') {
            status = 'accepted';
        }
        this.onFriendRequestChange?.({
            status,
            playerId: friendUserId,
            nickname: this.resolvePlayerNickname(data.id, data.nickname),
        });
    }

    private applyFriendRemoval(
        friendUserId: string,
        fallbackNickname?: string
    ): void {
        const nickname = fallbackNickname?.trim() || friendUserId;
        this.onFriendRequestChange?.({
            status: 'removed',
            playerId: friendUserId,
            nickname,
        });
    }

    handleRemoval(data: FriendRemovePayload): void {
        const friendUserId = getStableFriendUserId(data);
        if (friendUserId === null) {
            return;
        }
        this.applyFriendRemoval(friendUserId, data.nickname);
    }

    handleUpdate(data: FriendRequestUpdate): void {
        if (data.type === 'friend_request') {
            this.handleRequest(data);
            return;
        }
        if (data.type === 'friend_remove') {
            this.handleRemoval(data);
            return;
        }
        this.handleResponse(data);
    }

    sendRequest(requestedPlayerId: string): void {
        const requestedPlayer = this.players.get(requestedPlayerId);
        if (!requestedPlayer?.isActive()) {
            return;
        }
        if (
            this.pendingRequesterUserId !== null ||
            this.pendingRecipientUserId !== null ||
            this.requestTargetSocketId !== null
        ) {
            return;
        }
        this.requestTargetSocketId = requestedPlayerId;
        this.socket.emit(
            'update',
            {
                type: 'friend_request',
                id: this.socket.id,
                requestedPlayerID: requestedPlayerId,
            },
            (result: FriendRequestAcknowledgement) => {
                if (this.requestTargetSocketId === requestedPlayerId) {
                    this.requestTargetSocketId = null;
                }
                if (!result.accepted) {
                    this.onFriendRequestChange?.({
                        status: 'rejected',
                        playerId: requestedPlayerId,
                        nickname: requestedPlayer.nickname,
                        reason: result.reason,
                    });
                    return;
                }
                const friendUserId = String(result.friendUserId);
                this.pendingRecipientUserId = friendUserId;
                this.onFriendRequestChange?.({
                    status: 'sent',
                    playerId: friendUserId,
                    nickname: requestedPlayer.nickname,
                });
            }
        );
    }

    private respond(responseType: FriendResponseType): boolean {
        const requesterUserId = this.pendingRequesterUserId;
        if (requesterUserId === null) {
            return false;
        }
        const stableRequesterUserId = Number(requesterUserId);
        if (!Number.isSafeInteger(stableRequesterUserId)) {
            return false;
        }
        this.pendingRequesterUserId = null;
        this.socket.emit(
            'update',
            {
                type: responseType,
                id: this.socket.id ?? '',
                friendUserId: stableRequesterUserId,
            },
            (processed: boolean) => {
                if (!processed) {
                    this.syncFriendState();
                }
            }
        );
        return true;
    }

    accept(): boolean {
        return this.respond('friend_accept');
    }

    decline(): boolean {
        return this.respond('friend_decline');
    }

    remove(friendUserId: string): void {
        const stableFriendUserId = Number(friendUserId);
        if (!Number.isSafeInteger(stableFriendUserId)) {
            return;
        }
        this.socket.emit(
            'update',
            {
                type: 'friend_remove',
                id: this.socket.id,
                friendUserId: stableFriendUserId,
            },
            (result: FriendRemoveAcknowledgement) => {
                if (!result.removed) {
                    return;
                }
                this.applyFriendRemoval(friendUserId);
            }
        );
    }

    dispose(): void {
        this.unbindSocketEvents();
        this.onFriendRequestChange = undefined;
        this.onFriendStateSnapshot = undefined;
        this.pendingRequesterUserId = null;
        this.pendingRecipientUserId = null;
        this.requestTargetSocketId = null;
    }
}

export function useFriendRequest(options: UseFriendRequestOptions = {}) {
    const { onFriendListChange, appendEvent, runtimeRef, user } = options;
    const {
        friends,
        setFriends,
        handleFriendRequestChange: handleFriendListChange,
    } = useFriendList();
    const [friendRequest, setFriendRequest] =
        useState<FriendRequestState | null>(null);
    const handleFriendStateSnapshot = useCallback<FriendStateSnapshotHandler>(
        (snapshot): void => {
            setFriends([...snapshot.friends]);
            const pendingRequest = snapshot.pendingRequest;
            if (pendingRequest === null) {
                setFriendRequest(null);
                return;
            }
            let status: FriendRequestState['status'] = 'sent';
            if (pendingRequest.direction === 'incoming') {
                status = 'incoming';
            }
            setFriendRequest({
                status,
                playerId: pendingRequest.playerId,
                nickname: pendingRequest.nickname,
            });
        },
        [setFriends]
    );
    const handleFriendRequestChange = useCallback<FriendRequestChangeHandler>(
        (state): void => {
            handleFriendListChange(state);
            onFriendListChange?.(state);
            setFriendRequest(state);
            if (!state) {
                return;
            }
            if (appendEvent && user) {
                let friendRequestData: EventDataFriendRequest = {
                    friendNick: state.nickname,
                    friendRequestStatus: state.status,
                };
                if (state.reason !== undefined) {
                    friendRequestData = {
                        ...friendRequestData,
                        friendRequestReason: state.reason,
                    };
                }
                appendEvent({
                    eventType: EventType.FriendRequest,
                    data: friendRequestData,
                    logtime: new Date(),
                    user,
                });
            }
        },
        [appendEvent, handleFriendListChange, onFriendListChange, user]
    );

    const resetFriendRequest = useCallback((): void => {
        setFriendRequest(null);
    }, []);

    const removeFriend = useCallback(
        (friendPlayerId: string): void => {
            runtimeRef?.current?.removeFriend(friendPlayerId);
        },
        [runtimeRef]
    );

    useEffect(() => {
        if (
            friendRequest?.status !== 'accepted' &&
            friendRequest?.status !== 'declined' &&
            friendRequest?.status !== 'rejected' &&
            friendRequest?.status !== 'removed'
        ) {
            return;
        }
        const timeoutId = window.setTimeout(() => {
            setFriendRequest(null);
        }, FRIEND_REQUEST_RESULT_DISPLAY_MS);

        return () => {
            window.clearTimeout(timeoutId);
        };
    }, [friendRequest]);

    return {
        friends,
        friendRequest,
        setFriendRequest,
        handleFriendRequestChange,
        handleFriendStateSnapshot,
        resetFriendRequest,
        removeFriend,
    };
}
