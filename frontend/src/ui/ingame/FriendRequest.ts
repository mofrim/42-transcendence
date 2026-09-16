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
    type FriendResponseStatus,
    type FriendResponseType,
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
    readonly getLocalPlayerId: () => string | undefined;
    readonly resolvePlayerNickname: (
        playerId: string,
        fallbackNickname?: string
    ) => string;
};

export type FriendRequestUpdate = FriendRequestPayload | FriendRemovePayload;

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

function getFriendResponseStatus(
    responseType: FriendResponseType
): FriendResponseStatus {
    if (responseType === 'friend_accept') {
        return 'accepted';
    }
    return 'declined';
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
    private readonly getLocalPlayerId: () => string | undefined;
    private readonly resolvePlayerNickname: (
        playerId: string,
        fallbackNickname?: string
    ) => string;
    private pendingRequesterId: string | null = null;
    private pendingRequesterUserId: string | null = null;
    private pendingRecipientId: string | null = null;
    constructor(options: FriendRequestManagerOptions) {
        this.socket = options.socket;
        this.players = options.players;
        this.onFriendRequestChange = options.onFriendRequestChange;
        this.getLocalPlayerId = options.getLocalPlayerId;
        this.resolvePlayerNickname = options.resolvePlayerNickname;
        this.bindSocketEvents();
    }
    private readonly handleSocketUpdate = (data: {
        readonly type: string;
    }): void => {
        if (isFriendRequestUpdate(data)) {
            this.handleUpdate(data);
        }
    };

    private readonly handlePlayerDisconnectedEvent = (
        playerId: string
    ): void => {
        this.handlePlayerDisconnected(playerId);
    };

    private readonly handleSocketDisconnectEvent = (): void => {
        this.handleSocketDisconnect();
    };

    private bindSocketEvents(): void {
        this.socket.on('update', this.handleSocketUpdate);
        this.socket.on(
            'player_disconnected',
            this.handlePlayerDisconnectedEvent
        );
        this.socket.on('disconnect', this.handleSocketDisconnectEvent);
    }

    private unbindSocketEvents(): void {
        this.socket.off('update', this.handleSocketUpdate);
        this.socket.off(
            'player_disconnected',
            this.handlePlayerDisconnectedEvent
        );
        this.socket.off('disconnect', this.handleSocketDisconnectEvent);
    }

    private isForLocalPlayer(data: FriendRequestPayload): boolean {
        const localPlayerId = this.getLocalPlayerId();
        return (
            localPlayerId !== undefined &&
            data.requestedPlayerID === localPlayerId
        );
    }

    handlePlayerDisconnected(playerId: string): void {
        if (this.pendingRequesterId === playerId) {
            this.pendingRequesterId = null;
            this.pendingRequesterUserId = null;
            this.onFriendRequestChange?.(null);
        }
        if (this.pendingRecipientId === playerId) {
            this.pendingRecipientId = null;
            this.onFriendRequestChange?.(null);
        }
    }

    handleSocketDisconnect(): void {
        this.pendingRequesterId = null;
        this.pendingRequesterUserId = null;
        this.pendingRecipientId = null;
        this.onFriendRequestChange?.(null);
    }

    handleRequest(data: FriendRequestPayload): void {
        if (!this.isForLocalPlayer(data)) {
            return;
        }
        const friendUserId = getStableFriendUserId(data);
        if (friendUserId === null) {
            return;
        }
        if (this.pendingRecipientId === data.id) {
            this.pendingRecipientId = null;
        }
        this.pendingRequesterId = data.id;
        this.pendingRequesterUserId = friendUserId;
        this.onFriendRequestChange?.({
            status: 'incoming',
            playerId: friendUserId,
            nickname: this.resolvePlayerNickname(data.id, data.nickname),
        });
    }

    handleResponse(data: FriendRequestPayload): void {
        if (!this.isForLocalPlayer(data)) {
            return;
        }
        const friendUserId = getStableFriendUserId(data);
        if (friendUserId === null) {
            return;
        }
        if (data.type === 'friend_request') {
            return;
        }
        if (this.pendingRecipientId === data.id) {
            this.pendingRecipientId = null;
        }
        this.onFriendRequestChange?.({
            status: getFriendResponseStatus(data.type),
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
            this.pendingRequesterId !== null ||
            this.pendingRecipientId !== null
        ) {
            return;
        }
        this.pendingRecipientId = requestedPlayerId;
        this.socket.emit(
            'update',
            {
                type: 'friend_request',
                id: this.socket.id,
                requestedPlayerID: requestedPlayerId,
            },
            (result: FriendRequestAcknowledgement) => {
                if (!result.accepted) {
                    if (this.pendingRecipientId === requestedPlayerId) {
                        this.pendingRecipientId = null;
                    }
                    this.onFriendRequestChange?.({
                        status: 'rejected',
                        playerId: requestedPlayerId,
                        nickname: requestedPlayer.nickname,
                        reason: result.reason,
                    });
                    return;
                }
                if (this.pendingRecipientId !== requestedPlayerId) {
                    return;
                }
                this.onFriendRequestChange?.({
                    status: 'sent',
                    playerId: String(result.friendUserId),
                    nickname: requestedPlayer.nickname,
                });
            }
        );
    }

    private respond(responseType: FriendResponseType): boolean {
        const requesterId = this.pendingRequesterId;
        const requesterUserId = this.pendingRequesterUserId;
        if (requesterId === null || requesterUserId === null) {
            return false;
        }
        this.pendingRequesterId = null;
        this.pendingRequesterUserId = null;
        this.socket.emit(
            'update',
            {
                type: responseType,
                id: this.socket.id,
                requestedPlayerID: requesterId,
            },
            (processed: boolean) => {
                if (!processed) {
                    this.onFriendRequestChange?.(null);
                    return;
                }
                this.onFriendRequestChange?.({
                    status: getFriendResponseStatus(responseType),
                    playerId: requesterUserId,
                    nickname: this.resolvePlayerNickname(requesterId),
                });
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
        this.pendingRequesterId = null;
        this.pendingRequesterUserId = null;
        this.pendingRecipientId = null;
    }
}

export function useFriendRequest(options: UseFriendRequestOptions = {}) {
    const { onFriendListChange, appendEvent, runtimeRef, user } = options;
    const { friends, handleFriendRequestChange: handleFriendListChange } =
        useFriendList();
    const [friendRequest, setFriendRequest] =
        useState<FriendRequestState | null>(null);
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
        resetFriendRequest,
        removeFriend,
    };
}
