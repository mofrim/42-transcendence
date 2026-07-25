import { useLoginContext } from '../../hooks/useLoginContext';
import { createCharacterPreview } from '../../game/character_preview';
import React, { useEffect } from 'react';

export const CharacterPreview: React.FC = () => {
    const { avatar, charPreviewRef } = useLoginContext();

    // using 2 effects here, because dispose should on be run on unmount not on
    // avatar change!
    useEffect(() => {
        const canvas = document.getElementById('character-preview-canvas');
        const label = document.getElementById('character-preview-label');
        if (!canvas || !label) return;

        // initialize only once
        if (charPreviewRef.current === null) {
            charPreviewRef.current = createCharacterPreview({
                canvas: canvas as HTMLCanvasElement,
                label,
            });
        }

        // cleanup only on unmount!
        return () => charPreviewRef.current?.dispose();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // empty dependency array => runs once on mount!

    // update avatar on radio change
    useEffect(() => {
        if (charPreviewRef.current) {
            charPreviewRef.current.setCharacter(avatar === 'true');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [avatar]); // runs when avatar changes

    return (
        <div
            id='character-preview'
            className='character-preview'
            role='img'
            aria-label='Selected player character 3D preview'
        >
            <canvas id='character-preview-canvas' aria-hidden='true'></canvas>
            <div id='character-preview-label'>Male_Test.glb</div>
        </div>
    );
};
