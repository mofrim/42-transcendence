import type { ReactNode } from 'react';

type HudPanelHeaderProps = {
    readonly children: ReactNode;
    readonly panelLabel: string;
    readonly onClose: () => void;
};

export function HudPanelHeader({
    children,
    panelLabel,
    onClose,
}: HudPanelHeaderProps) {
    const closeLabel = `Close ${panelLabel}`;

    return (
        <div className='hud-panel-header'>
            <h2 className='hud-title'>{children}</h2>
            <button
                type='button'
                className='hud-panel-close'
                aria-label={closeLabel}
                title={closeLabel}
                onClick={onClose}
            >
                ×
            </button>
        </div>
    );
}
