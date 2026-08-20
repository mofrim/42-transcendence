import { createMapPreview } from '../../game/map_preview';
import React, { useEffect } from 'react';

export const MapPreview: React.FC = () => {
    /**
     * create map preview for the first time needs this in order to run after
     * the component has been rendered
     */
    useEffect(() => {
        // this runs after the component mounts and the DOM is updated
        const canvas = document.getElementById('map-preview-canvas');
        if (!canvas) return;

        console.log('creating map preview...');

        const mapPreview = createMapPreview({
            canvas: canvas as HTMLCanvasElement,
        });

        // cleanup function
        return () => mapPreview.dispose();
    }, []); // empty deps hack again: make this only run once on mount!

    return (
        <div id='map-preview' className='map-preview' aria-hidden='true'>
            <canvas id='map-preview-canvas' aria-hidden='true'></canvas>
        </div>
    );
};
