import { useLoginContext } from '../../hooks/useLoginContext';
import { createCharacterPreview } from '../../game/character_preview';
import React, { useEffect } from 'react';


export const CharacterPreview: React.FC = () => {
    const { avatar } = useLoginContext();

    // create char preview for the first time needs this in order to run after
    // the component has been rendered
    useEffect(() => {
        // this runs after the component mounts and the DOM is updated
        // FIXME reactify this using Ref, maybe
        const canvas = document.getElementById('character-preview-canvas');
        const label = document.getElementById('character-preview-label');

        if (canvas && label) {
            const characterPreview = createCharacterPreview({
                // FIXME think about the types here...
                // @ts-ignore
                canvas,
                label,
            });
            // FIXME maybe move away from boolean one day...
            characterPreview.setCharacter(avatar === 'true' ? true : false);
        }
    }, [avatar]); // dependency: avatar state variable

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
