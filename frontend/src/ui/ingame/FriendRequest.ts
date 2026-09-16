import { useCallback, useEffect, useState, type RefObject } from 'react';
import type { Socket } from 'socket.io-client';
import type { Remote_Player } from '../../game/remote_player.js';
import { useFriendList } from './FriendList';
export { getFriendRequestMessage } from './FriendList';
import {
    EventType,
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
    private pendingRecipientId: string | null = null;
    private readonly friendPlayerIds = new Set<string>();
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

    private isForLocalPlayer(
        data: FriendRequestPayload | FriendRemovePayload
    ): boolean {
        const localPlayerId = this.getLocalPlayerId();
        return (
            localPlayerId !== undefined &&
            data.requestedPlayerID === localPlayerId
        );
    }

    handlePlayerDisconnected(playerId: string): void {
        if (this.pendingRequesterId === playerId) {
            this.pendingRequesterId = null;
            this.onFriendRequestChange?.(null);
        }
        if (this.pendingRecipientId === playerId) {
            this.pendingRecipientId = null;
            this.onFriendRequestChange?.(null);
        }
    }

    handleSocketDisconnect(): void {
        this.pendingRequesterId = null;
        this.pendingRecipientId = null;
        this.friendPlayerIds.clear();
        this.onFriendRequestChange?.(null);
    }

    handleRequest(data: FriendRequestPayload): void {
        if (!this.isForLocalPlayer(data)) {
            return;
        }
        if (this.pendingRecipientId === data.id) {
            this.pendingRecipientId = null;
        }
        this.pendingRequesterId = data.id;
        this.onFriendRequestChange?.({
            status: 'incoming',
            playerId: data.id,
            nickname: this.resolvePlayerNickname(data.id, data.nickname),
        });
    }

    handleResponse(data: FriendRequestPayload): void {
        if (!this.isForLocalPlayer(data)) {
            return;
        }
        if (data.type === 'friend_request') {
            return;
        }
        if (this.pendingRecipientId === data.id) {
            this.pendingRecipientId = null;
        }
        if (data.type === 'friend_accept') {
            this.friendPlayerIds.add(data.id);
        }
        this.onFriendRequestChange?.({
            status: getFriendResponseStatus(data.type),
            playerId: data.id,
            nickname: this.resolvePlayerNickname(data.id, data.nickname),
        });
    }

    private applyFriendRemoval(
        playerId: string,
        fallbackNickname?: string
    ): void {
        this.friendPlayerIds.delete(playerId);
        this.onFriendRequestChange?.({
            status: 'removed',
            playerId,
            nickname: this.resolvePlayerNickname(playerId, fallbackNickname),
        });
    }

    handleRemoval(data: FriendRemovePayload): void {
        if (!this.isForLocalPlayer(data)) {
            return;
        }
        this.applyFriendRemoval(data.id, data.nickname);
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
            this.friendPlayerIds.has(requestedPlayerId) ||
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
                    return;
                }
                if (this.pendingRecipientId !== requestedPlayerId) {
                    return;
                }
                this.onFriendRequestChange?.({
                    status: 'sent',
                    playerId: requestedPlayerId,
                    nickname: requestedPlayer.nickname,
                });
            }
        );
    }

    private respond(responseType: FriendResponseType): boolean {
        const requesterId = this.pendingRequesterId;
        if (requesterId === null) {
            return false;
        }
        this.pendingRequesterId = null;
        if (responseType === 'friend_accept') {
            this.friendPlayerIds.add(requesterId);
        }
        this.socket.emit('update', {
            type: responseType,
            id: this.socket.id,
            requestedPlayerID: requesterId,
        });
        this.onFriendRequestChange?.({
            status: getFriendResponseStatus(responseType),
            playerId: requesterId,
            nickname: this.resolvePlayerNickname(requesterId),
        });
        return true;
    }

    accept(): boolean {
        return this.respond('friend_accept');
    }

    decline(): boolean {
        return this.respond('friend_decline');
    }

    remove(friendPlayerId: string): void {
        this.socket.emit(
            'update',
            {
                type: 'friend_remove',
                id: this.socket.id,
                requestedPlayerID: friendPlayerId,
            },
            (result: FriendRemoveAcknowledgement) => {
                if (!result.removed) {
                    return;
                }
                this.applyFriendRemoval(friendPlayerId);
            }
        );
    }

    dispose(): void {
        this.unbindSocketEvents();
        this.onFriendRequestChange = undefined;
        this.pendingRequesterId = null;
        this.pendingRecipientId = null;
        this.friendPlayerIds.clear();
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
                appendEvent({
                    eventType: EventType.FriendRequest,
                    data: {
                        friendNick: state.nickname,
                        friendRequestStatus: state.status,
                    },
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
