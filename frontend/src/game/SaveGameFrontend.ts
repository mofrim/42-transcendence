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
        ((snapshot: SaveGameSnapshot | null) => Promise<void>) | undefined;
    readonly onConnectionChange: ((connected: boolean) => void) | undefined;
    readonly onPositionRestore: (position: PlayerPosition) => void;
    readonly onRestoreReady: () => void;
};

type SaveGameUpdatePayload =
    | SaveGameTimerPayload
    | SaveGameQuestStatusPayload
    | { readonly type: 'black_hole_timeout' | 'save_game_restart' };

export class SaveGameFrontend {
    private restoreReady = false;
    private restoreGeneration = 0;

    constructor(private readonly options: SaveGameOptions) {}

    get isRestoreReady(): boolean {
        return this.restoreReady;
    }

    prepareRestore(): void {
        this.restoreReady = false;
        this.restoreGeneration += 1;
    }

    requestRestore(socketId: string): void {
        const { socket } = this.options;
        const restoreGeneration = ++this.restoreGeneration;
        this.restoreReady = false;
        socket.emit(
            'save_game_restore',
            async (snapshot: SaveGameSnapshot | null): Promise<void> => {
                if (
                    this.options.isDisposed() ||
                    !socket.connected ||
                    socket.id !== socketId ||
                    this.restoreGeneration !== restoreGeneration
                ) {
                    return;
                }
                if (snapshot) {
                    this.options.onPositionRestore(snapshot.position);
                }

                try {
                    await this.options.onSaveGameRestore?.(snapshot);
                } catch (error) {
                    console.error('[SaveGameRestore] restore failed:', error);
                    return;
                }

                if (
                    this.options.isDisposed() ||
                    !socket.connected ||
                    socket.id !== socketId ||
                    this.restoreGeneration !== restoreGeneration
                ) {
                    return;
                }

                this.restoreReady = true;
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
