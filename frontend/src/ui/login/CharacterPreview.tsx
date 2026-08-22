import { useLoginContext } from '../../hooks/useLoginContext';
import { createCharacterPreview } from '../../game/character_preview';
import type { CreateCharPreviewReturnType } from '../../game/character_preview';
import React, { useEffect, useRef } from 'react';

export const CharacterPreview: React.FC = () => {
    const { avatar } = useLoginContext();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const labelRef = useRef<HTMLDivElement>(null);
    const charPreviewRef = useRef<CreateCharPreviewReturnType>(null);

    // using 2 effects here, because dispose should on be run on unmount not on
    // avatar change!
    useEffect(() => {
        const canvas = canvasRef.current;
        const label = labelRef.current;
        if (!canvas || !label) return;

        const preview = createCharacterPreview({ canvas, label });
        charPreviewRef.current = preview;

        // cleanup only on unmount!
        return () => {
            if (charPreviewRef.current === preview) {
                charPreviewRef.current = null;
            }
            preview.dispose();
        };
    }, []); // empty dependency array => runs once on mount!

    // update avatar on radio change
    useEffect(() => {
        if (charPreviewRef.current) {
            charPreviewRef.current.setCharacter(avatar === 'true');
        }
    }, [avatar]); // runs when avatar changes

    return (
        <div
            id='character-preview'
            className='character-preview'
            role='img'
            aria-label='Selected player character 3D preview'
        >
            <canvas
                ref={canvasRef}
                id='character-preview-canvas'
                aria-hidden='true'
            ></canvas>
            <div ref={labelRef} id='character-preview-label'>
                Main_Male.glb
            </div>
        </div>
    );
};
