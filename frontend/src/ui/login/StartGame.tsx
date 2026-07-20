import React from 'react';
import { useLoginContext } from '../../hooks/useLoginContext';
import { startGame } from '../../game/main';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';

// the start-button. all this does is setting the gameRunning state var
export const StartButton: React.FC = () => {
    const { setGameRunning } = useLoginContext();

    return (
        <button id='start-btn' onClick={() => setGameRunning(true)}>
            ENTER
        </button>
    );
};

export const Game = () => {
    const { gameRunning, avatar, fullAddr } = useLoginContext();

    // using ref here a lot because th
    const mountRef = useRef<HTMLDivElement>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const isInitializedRef = useRef(false);

    useEffect(() => {
        // guard against re-render due to strict-mode
        if (isInitializedRef.current) return;
        isInitializedRef.current = true;

        const renderer = new THREE.WebGLRenderer({ antialias: true });
        rendererRef.current = renderer;

        if (mountRef.current) {
            console.warn('mountRef.current am start!');
            mountRef.current.appendChild(renderer.domElement);
        }

        startGame(avatar === 'true' ? true : false, fullAddr.current, renderer);

        // cleanup... in case we want to support logging out againg one day
        // TODO test this! needs implementing some mechanism for unsetting gameRunning
        return () => {
            if (!gameRunning) {
                if (mountRef.current && rendererRef.current) {
                    mountRef.current.removeChild(
                        rendererRef.current.domElement
                    );
                    rendererRef.current.dispose();
                }
                isInitializedRef.current = false; // Reset on unmount
            }
        };
    }, [gameRunning]);

    return <div ref={mountRef} style={{ width: '100vw', height: '100vh' }} />;
};
