import {
    BLACK_HOLE_DURATION_SECONDS,
    type PlayerPosition,
    type SaveGameQuestStatusPayload,
    type SaveGameSnapshot,
    type SaveGameTimerPayload,
} from 'ftr-common/sharedTypes';

type MutableSaveGameSnapshot = {
    -readonly [Key in keyof SaveGameSnapshot]: SaveGameSnapshot[Key];
};

export class SaveGameBackend {
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

        return structuredClone(this.saves.get(userId) ?? null);
    }

    disconnect(
        userId: number,
        socketId: string,
        position: PlayerPosition | undefined
    ): boolean {
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

        const hasActiveConnection = (activeSockets?.size ?? 0) > 0;

        if (!this.isOwnerSocket(userId, socketId)) {
            return hasActiveConnection;
        }

        const replacementOwner = activeSockets
            ? Array.from(activeSockets).at(-1)
            : undefined;
        if (replacementOwner) {
            this.ownerSocketByUser.set(userId, replacementOwner);
        } else {
            this.ownerSocketByUser.delete(userId);
        }

        return hasActiveConnection;
    }

    getSnapshot(userId: number, socketId: string): SaveGameSnapshot | null {
        if (
            !this.isOwnerSocket(userId, socketId) ||
            this.blockedSocketIds.has(socketId)
        ) {
            return null;
        }

        this.restoreReadySocketIds.add(socketId);
        return structuredClone(this.saves.get(userId) ?? null);
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

    updateQuestStatus(
        userId: number,
        socketId: string,
        position: PlayerPosition,
        completedQuestIds: readonly string[]
    ): void {
        if (!this.isWritable(userId, socketId)) {
            return;
        }
        const save = this.getOrCreateSave(userId, position);
        save.completedQuestIds = [...new Set(completedQuestIds)];
    }

    SaveGameBlackholeTimer(
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

    SaveGameQuestStatus(
        userId: number | null,
        socketId: string,
        position: PlayerPosition | undefined,
        data: SaveGameQuestStatusPayload
    ): void {
        if (
            userId === null ||
            position === undefined ||
            !Array.isArray(data.completedQuestIds) ||
            data.completedQuestIds.some(
                (questId) => typeof questId !== 'string'
            )
        ) {
            return;
        }
        this.updateQuestStatus(
            userId,
            socketId,
            position,
            data.completedQuestIds
        );
    }

    clearForBlackHoleTimeout(userId: number, socketId: string): void {
        if (!this.isOwnerSocket(userId, socketId)) {
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

    restartAfterBlackHole(
        userId: number,
        socketId: string,
        position: PlayerPosition | undefined
    ): void {
        if (!this.isOwnerSocket(userId, socketId)) {
            return;
        }

        this.saves.delete(userId);
        this.blockedSocketIds.delete(socketId);
        if (position !== undefined) {
            this.getOrCreateSave(userId, position);
        }
    }

    private isWritable(userId: number, socketId: string): boolean {
        return (
            this.isOwnerSocket(userId, socketId) &&
            !this.blockedSocketIds.has(socketId) &&
            this.restoreReadySocketIds.has(socketId)
        );
    }

    private isOwnerSocket(userId: number, socketId: string): boolean {
        return this.ownerSocketByUser.get(userId) === socketId;
    }

    getOrCreateSave(
        userId: number,
        position: PlayerPosition,
        blackHoleSecondsRemaining?: number
    ): MutableSaveGameSnapshot {
        const existingSave = this.saves.get(userId);
        if (existingSave) {
            return existingSave;
        }

        const save: MutableSaveGameSnapshot = {
            position: structuredClone(position),
            blackHoleSecondsRemaining:
                blackHoleSecondsRemaining ?? BLACK_HOLE_DURATION_SECONDS,
            blackHoleCountdownCompleted: false,
            completedQuestIds: [],
        };
        this.saves.set(userId, save);
        return save;
    }
}
