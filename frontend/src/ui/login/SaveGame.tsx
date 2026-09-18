import { useCallback, useState, type RefObject } from 'react';
import {
    BLACK_HOLE_DURATION_SECONDS,
    type SaveGameSnapshot,
} from 'ftr-common/sharedTypes';
import type { GameRuntime } from '../../game/main';

type BlackHoleRestore = {
    readonly version: number;
    readonly secondsRemaining: number;
    readonly completed: boolean;
};

const DEFAULT_BLACK_HOLE_RESTORE = {
    secondsRemaining: BLACK_HOLE_DURATION_SECONDS,
    completed: false,
} satisfies Omit<BlackHoleRestore, 'version'>;

type UseSaveGameOptions = {
    readonly isSpectator: boolean;
    readonly gameRuntimeRef: RefObject<GameRuntime | null>;
};

export function useSaveGame({
    isSpectator,
    gameRuntimeRef,
}: UseSaveGameOptions) {
    const [isSaveGameReady, setIsSaveGameReady] = useState(isSpectator);
    const [isGameConnected, setIsGameConnected] = useState(isSpectator);
    const [blackHoleRestore, setBlackHoleRestore] = useState<BlackHoleRestore>({
        version: 0,
        ...DEFAULT_BLACK_HOLE_RESTORE,
    });

    const SaveGameRestore = useCallback(
        (snapshot: SaveGameSnapshot | null): void => {
            setBlackHoleRestore((currentRestore) => ({
                version: currentRestore.version + 1,
                secondsRemaining:
                    snapshot?.blackHoleSecondsRemaining ??
                    DEFAULT_BLACK_HOLE_RESTORE.secondsRemaining,
                completed:
                    snapshot?.blackHoleCountdownCompleted ??
                    DEFAULT_BLACK_HOLE_RESTORE.completed,
            }));
            setIsSaveGameReady(true);
        },
        []
    );

    const handleGameConnectionChange = useCallback(
        (connected: boolean): void => {
            setIsGameConnected(connected);
            if (!connected) {
                setIsSaveGameReady(false);
            }
        },
        []
    );

    const BlackHoleTimerChange = useCallback(
        (secondsRemaining: number, completed: boolean): void => {
            gameRuntimeRef.current?.updateBlackHoleTimer(
                secondsRemaining,
                completed
            );
        },
        [gameRuntimeRef]
    );

    const resetSaveGame = useCallback((): void => {
        setBlackHoleRestore((currentRestore) => ({
            version: currentRestore.version + 1,
            ...DEFAULT_BLACK_HOLE_RESTORE,
        }));
    }, []);

    return {
        isSaveGameReady,
        isGameConnected,
        blackHoleRestore,
        SaveGameRestore,
        handleGameConnectionChange,
        BlackHoleTimerChange,
        resetSaveGame,
    };
}
