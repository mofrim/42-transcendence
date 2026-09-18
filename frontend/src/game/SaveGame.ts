import type { Socket } from 'socket.io-client';
import type {
    PlayerPosition,
    SaveGameQuestStatusPayload,
    SaveGameSnapshot,
    SaveGameTimerPayload,
} from 'ftr-common/sharedTypes';

type SaveGameOptions = {
    readonly socket: Socket;
    readonly isDisposed: () => boolean;
    readonly onSaveGameRestore:
        ((snapshot: SaveGameSnapshot | null) => void) | undefined;
    readonly onConnectionChange: ((connected: boolean) => void) | undefined;
    readonly onPositionRestore: (position: PlayerPosition) => void;
    readonly onRestoreReady: () => void;
};

type SaveGameUpdatePayload =
    | SaveGameTimerPayload
    | SaveGameQuestStatusPayload
    | { readonly type: 'black_hole_timeout' | 'save_game_restart' };

export class SaveGame {
    private restoreReady = false;

    constructor(private readonly options: SaveGameOptions) {}

    get isRestoreReady(): boolean {
        return this.restoreReady;
    }

    prepareRestore(): void {
        this.restoreReady = false;
    }

    requestRestore(socketId: string): void {
        const { socket } = this.options;
        socket.emit(
            'save_game_restore',
            (snapshot: SaveGameSnapshot | null): void => {
                if (
                    this.options.isDisposed() ||
                    !socket.connected ||
                    socket.id !== socketId
                ) {
                    return;
                }
                if (snapshot) {
                    this.options.onPositionRestore(snapshot.position);
                }
                this.restoreReady = true;
                this.options.onSaveGameRestore?.(snapshot);
                this.options.onConnectionChange?.(true);
                this.options.onRestoreReady();
            }
        );
    }

    handleDisconnect(): void {
        this.prepareRestore();
        this.options.onConnectionChange?.(false);
    }

    updateBlackHoleTimer(secondsRemaining: number, completed: boolean): void {
        this.emitUpdate({
            type: 'save_game_timer',
            blackHoleSecondsRemaining: secondsRemaining,
            completed,
        });
    }

    updateQuestStatus(completedQuestIds: readonly string[]): void {
        this.emitUpdate({
            type: 'save_game_quest_status',
            completedQuestIds,
        });
    }

    emitBlackHoleTimeout(): void {
        this.emitUpdate({
            type: 'black_hole_timeout',
        });
    }

    restartAfterBlackHole(): void {
        this.emitUpdate({
            type: 'save_game_restart',
        });
    }

    dispose(): void {
        this.prepareRestore();
    }

    private emitUpdate(payload: SaveGameUpdatePayload): void {
        const { socket } = this.options;
        if (!socket.connected || !this.restoreReady) {
            return;
        }
        socket.emit('update', payload);
    }
}
