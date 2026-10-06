import { useCallback, useState, type RefObject } from 'react';
import type { SaveGameSnapshot } from 'ftr-common/sharedTypes';
import {
    createBlackHoleRestore,
    type BlackHoleRestore,
} from '../../game/BlackHoleTimeout';
import type { GameRuntime } from '../../game/main';

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
    const [blackHoleRestore, setBlackHoleRestore] = useState<BlackHoleRestore>(
        () => createBlackHoleRestore(null, 0)
    );

    const SaveGameRestore = useCallback(
        (snapshot: SaveGameSnapshot | null): void => {
            setBlackHoleRestore((currentRestore) =>
                createBlackHoleRestore(snapshot, currentRestore.version + 1)
            );
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
        setBlackHoleRestore((currentRestore) =>
            createBlackHoleRestore(null, currentRestore.version + 1)
        );
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
