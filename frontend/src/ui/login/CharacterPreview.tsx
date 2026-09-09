import { useLoginContext } from '../../hooks/useLoginContext';
import {
    createCharacterPreview,
    type CreateCharPreviewReturnType,
} from '../../game/character_preview';
import type { Character } from 'ftr-common/sharedTypes';
import React, { useEffect, useRef } from 'react';

type CharacterPreviewViewProps = {
    readonly character: Character;
    readonly className: string;
    readonly canvasClassName?: string;
    readonly id?: string;
    readonly canvasId?: string;
    readonly labelId?: string;
};

export const CharacterPreviewView: React.FC<CharacterPreviewViewProps> = ({
    character,
    className,
    canvasClassName,
    id,
    canvasId,
    labelId,
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const labelRef = useRef<HTMLDivElement>(null);
    const charPreviewRef = useRef<CreateCharPreviewReturnType>(null);

    // using 2 effects here, because dispose should on be run on unmount not on
    // avatar change!
    useEffect(() => {
        const canvas = canvasRef.current;
        const label = labelRef.current;
        if (!canvas) return;

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

    // update preview when the selected character changes
    useEffect(() => {
        charPreviewRef.current?.setCharacter(character);
    }, [character]);

    let label: React.ReactNode = null;
    if (labelId !== undefined) {
        label = (
            <div ref={labelRef} id={labelId}>
                Main_Male.glb
            </div>
        );
    }

    return (
        <div
            id={id}
            className={className}
            role='img'
            aria-label='Selected player character 3D preview'
        >
            <canvas
                ref={canvasRef}
                id={canvasId}
                className={canvasClassName}
                aria-hidden='true'
            />
            {label}
        </div>
    );
};

/** Add selected character preview to login */
export const CharacterPreview: React.FC = () => {
    const { avatar } = useLoginContext();

    return (
        <CharacterPreviewView
            character={avatar === 'true'}
            className='character-preview'
            id='character-preview'
            canvasId='character-preview-canvas'
            labelId='character-preview-label'
        />
    );
};
