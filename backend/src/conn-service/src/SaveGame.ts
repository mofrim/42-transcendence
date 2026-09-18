import { BLACK_HOLE_DURATION_SECONDS } from 'ftr-common/sharedTypes';
import type {
    PlayerPosition,
    SaveGameSnapshot,
    SaveGameTimerPayload,
} from 'ftr-common/sharedTypes';

type MutableSaveGameSnapshot = {
    -readonly [Key in keyof SaveGameSnapshot]: SaveGameSnapshot[Key];
};

export class SaveGame {
    private readonly saves = new Map<number, MutableSaveGameSnapshot>();
    private readonly activeSocketsByUser = new Map<number, Set<string>>();
    private readonly ownerSocketByUser = new Map<number, string>();
    private readonly blockedSocketIds = new Set<string>();
    private readonly restoreReadySocketIds = new Set<string>();

    connect(userId: number, socketId: string): SaveGameSnapshot | null {
        const activeSockets =
            this.activeSocketsByUser.get(userId) ?? new Set<string>();
        activeSockets.add(socketId);
        this.activeSocketsByUser.set(userId, activeSockets);
        this.ownerSocketByUser.set(userId, socketId);
        this.restoreReadySocketIds.delete(socketId);

        const save = this.saves.get(userId);
        if (!save) {
            return null;
        }
        return structuredClone(save);
    }

    disconnect(
        userId: number,
        socketId: string,
        position: PlayerPosition | undefined
    ): void {
        if (this.isWritable(userId, socketId) && position) {
            const save = this.saves.get(userId);
            if (save) {
                save.position = structuredClone(position);
            }
        }

        const activeSockets = this.activeSocketsByUser.get(userId);
        activeSockets?.delete(socketId);
        this.blockedSocketIds.delete(socketId);
        this.restoreReadySocketIds.delete(socketId);

        if (activeSockets?.size === 0) {
            this.activeSocketsByUser.delete(userId);
        }

        if (this.ownerSocketByUser.get(userId) !== socketId) {
            return;
        }

        const replacementOwner = activeSockets
            ? Array.from(activeSockets).at(-1)
            : undefined;
        if (replacementOwner) {
            this.ownerSocketByUser.set(userId, replacementOwner);
        } else {
            this.ownerSocketByUser.delete(userId);
        }
    }

    getSnapshot(userId: number, socketId: string): SaveGameSnapshot | null {
        if (
            this.ownerSocketByUser.get(userId) !== socketId ||
            this.blockedSocketIds.has(socketId)
        ) {
            return null;
        }

        this.restoreReadySocketIds.add(socketId);
        const save = this.saves.get(userId);
        if (!save) {
            return null;
        }
        return structuredClone(save);
    }

    updatePosition(
        userId: number,
        socketId: string,
        position: PlayerPosition
    ): void {
        if (!this.isWritable(userId, socketId)) {
            return;
        }

        const save = this.getOrCreateSave(userId, position);
        save.position = structuredClone(position);
    }

    updateBlackHoleTimer(
        userId: number,
        socketId: string,
        position: PlayerPosition,
        secondsRemaining: number,
        completed: boolean
    ): void {
        if (
            !this.isWritable(userId, socketId) ||
            !Number.isFinite(secondsRemaining) ||
            secondsRemaining < 0 ||
            secondsRemaining > BLACK_HOLE_DURATION_SECONDS
        ) {
            return;
        }

        const save = this.getOrCreateSave(userId, position);
        save.blackHoleSecondsRemaining = Math.ceil(secondsRemaining);
        save.blackHoleCountdownCompleted = completed;
    }

    handleSaveGameTimer(
        userId: number | null,
        socketId: string,
        position: PlayerPosition | undefined,
        data: SaveGameTimerPayload
    ): void {
        if (
            typeof data.blackHoleSecondsRemaining !== 'number' ||
            typeof data.completed !== 'boolean' ||
            userId === null ||
            position === undefined
        ) {
            return;
        }

        if (data.blackHoleSecondsRemaining === 0 && !data.completed) {
            this.clearForBlackHoleTimeout(userId, socketId);
            return;
        }

        this.updateBlackHoleTimer(
            userId,
            socketId,
            position,
            data.blackHoleSecondsRemaining,
            data.completed
        );
    }

    clearForBlackHoleTimeout(userId: number, socketId: string): void {
        if (this.ownerSocketByUser.get(userId) !== socketId) {
            return;
        }

        this.saves.delete(userId);
        const activeSockets = this.activeSocketsByUser.get(userId);
        if (!activeSockets) {
            return;
        }
        for (const activeSocketId of activeSockets) {
            this.blockedSocketIds.add(activeSocketId);
        }
    }

    restartAfterBlackHole(userId: number, socketId: string): void {
        if (this.ownerSocketByUser.get(userId) !== socketId) {
            return;
        }

        this.saves.delete(userId);
        this.blockedSocketIds.delete(socketId);
    }

    private isWritable(userId: number, socketId: string): boolean {
        return (
            this.ownerSocketByUser.get(userId) === socketId &&
            !this.blockedSocketIds.has(socketId) &&
            this.restoreReadySocketIds.has(socketId)
        );
    }

    private getOrCreateSave(
        userId: number,
        position: PlayerPosition
    ): MutableSaveGameSnapshot {
        const existingSave = this.saves.get(userId);
        if (existingSave) {
            return existingSave;
        }

        const save: MutableSaveGameSnapshot = {
            position: structuredClone(position),
            blackHoleSecondsRemaining: BLACK_HOLE_DURATION_SECONDS,
            blackHoleCountdownCompleted: false,
        };
        this.saves.set(userId, save);
        return save;
    }
}
