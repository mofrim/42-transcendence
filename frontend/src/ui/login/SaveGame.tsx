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
        secondsRemaining: BLACK_HOLE_DURATION_SECONDS,
        completed: false,
    });

    const handleSaveGameRestore = useCallback(
        (snapshot: SaveGameSnapshot | null): void => {
            setBlackHoleRestore((currentRestore) => ({
                version: currentRestore.version + 1,
                secondsRemaining:
                    snapshot?.blackHoleSecondsRemaining ??
                    BLACK_HOLE_DURATION_SECONDS,
                completed: snapshot?.blackHoleCountdownCompleted ?? false,
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

    const handleBlackHoleTimerChange = useCallback(
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
            secondsRemaining: BLACK_HOLE_DURATION_SECONDS,
            completed: false,
        }));
    }, []);

    return {
        isSaveGameReady,
        isGameConnected,
        blackHoleRestore,
        handleSaveGameRestore,
        handleGameConnectionChange,
        handleBlackHoleTimerChange,
        resetSaveGame,
    };
}
