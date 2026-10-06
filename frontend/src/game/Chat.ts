import type { Socket } from 'socket.io-client';
import type { ReceivedChatPayload } from 'ftr-common/sharedTypes';

import type { Player } from './player.js';
import type { Remote_Player } from './remote_player.js';

type ChatOptions = {
    readonly socket: Socket;
    readonly localPlayer: Player | null;
    readonly players: Map<string, Remote_Player>;
    readonly onChatMessage:
        ((message: ReceivedChatPayload) => void) | undefined;
    readonly isDisposed: () => boolean;
};

export class Chat {
    private readonly handleChatMessage = (data: ReceivedChatPayload): void => {
        if (this.options.isDisposed()) {
            return;
        }

        this.options.onChatMessage?.(data);
        if (data.senderId === this.options.socket.id) {
            this.options.localPlayer?.showChatMessage(data.message);
            return;
        }

        this.options.players.get(data.senderId)?.showChatMessage(data.message);
    };

    constructor(private readonly options: ChatOptions) {}

    bindSocketEvents(): void {
        this.options.socket.on('chat_message', this.handleChatMessage);
    }

    unbindSocketEvents(): void {
        this.options.socket.off('chat_message', this.handleChatMessage);
    }

    sendMessage(message: string): void {
        if (this.options.isDisposed()) {
            return;
        }

        this.options.socket.emit('chat_message', { message });
    }
}
