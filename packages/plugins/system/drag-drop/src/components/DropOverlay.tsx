/**
 * DropOverlay - Fullscreen visual overlay during file drag
 * 
 * Renders a beautiful "Drop Zone" overlay with the plugin icon
 * and instructional text when dragging .nhp files over the app.
 */

import { createPortal } from 'react-dom';
import type { FC } from 'react';
import type { DragType } from '../logic/DragController.js';

interface DropOverlayProps {
    /** Whether the overlay should be visible */
    isDragging: boolean;
    /** Type of files being dragged */
    dragType: DragType;
    /** Icon for plugins */
    PluginIcon: React.ElementType;
    /** Icon for markdown files */
    MarkdownIcon: React.ElementType;
    /** Icon for unsupported/unknown files */
    UnsupportedIcon: React.ElementType;
    /** Icon for mixed files */
    LayersIcon: React.ElementType;
}

/**
 * Keyframe animation styles (injected into head)
 */
const OVERLAY_STYLES = `
@keyframes nh-drop-pulse {
    0%, 100% {
        opacity: 1;
        transform: scale(1);
    }
    50% {
        opacity: 0.8;
        transform: scale(1.05);
    }
}

@keyframes nh-drop-border-pulse {
    0%, 100% {
        border-color: var(--nh-accent-primary);
        box-shadow: inset 0 0 30px rgba(var(--nh-accent-primary-rgb, 139, 92, 246), 0.1);
    }
    50% {
        border-color: var(--nh-accent-secondary, var(--nh-accent-primary));
        box-shadow: inset 0 0 60px rgba(var(--nh-accent-primary-rgb, 139, 92, 246), 0.2);
    }
}

.nh-drop-overlay {
    position: fixed;
    inset: 0;
    z-index: 9000;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.85);
    backdrop-filter: blur(8px);
    animation: fadeIn 0.2s ease-out;
}

.nh-drop-zone {
    position: absolute;
    inset: 16px;
    border: 4px dashed var(--nh-accent-primary);
    border-radius: 16px;
    animation: nh-drop-border-pulse 2s ease-in-out infinite;
    pointer-events: none;
}

.nh-drop-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 24px;
    animation: nh-drop-pulse 2s ease-in-out infinite;
}

.nh-drop-icon {
    color: var(--nh-accent-primary);
    filter: drop-shadow(0 0 20px var(--nh-accent-primary));
}

.nh-drop-text {
    font-size: 24px;
    font-weight: 700;
    color: white;
    text-shadow: 0 2px 10px rgba(0, 0, 0, 0.5);
    letter-spacing: 0.5px;
}

.nh-drop-hint {
    font-size: 14px;
    color: rgba(255, 255, 255, 0.6);
}

@keyframes fadeIn {
    from {
        opacity: 0;
    }
    to {
        opacity: 1;
    }
}
`;

/** Inject styles into document head (idempotent) */
let stylesInjected = false;
function injectStyles(): void {
    if (stylesInjected) return;

    const styleEl = document.createElement('style');
    styleEl.id = 'nh-drop-overlay-styles';
    styleEl.textContent = OVERLAY_STYLES;
    document.head.appendChild(styleEl);
    stylesInjected = true;
}

export const DropOverlay: FC<DropOverlayProps> = ({ isDragging, dragType, PluginIcon, MarkdownIcon, UnsupportedIcon, LayersIcon }) => {
    // Inject styles on first render
    injectStyles();

    if (!isDragging) {
        return null;
    }

    let Icon = PluginIcon;
    let title = 'Drop to Install Plugin';
    let hint = '.nhp files only';

    switch (dragType) {
        case 'markdown':
            Icon = MarkdownIcon;
            title = 'Drop to Import Note';
            hint = '.md files';
            break;
        case 'mixed':
            Icon = LayersIcon;
            title = 'Drop to Import Files';
            hint = 'Supported: .nhp, .md';
            break;
        case 'unknown':
            Icon = UnsupportedIcon;
            title = 'File type not supported';
            hint = 'Supported: .nhp, .md';
            break;
        case 'plugin':
        default:
            Icon = PluginIcon;
            title = 'Drop to Install Plugin';
            hint = '.nhp files only';
            break;
    }

    const overlay = (
        <div className="nh-drop-overlay">
            <div className="nh-drop-zone" />
            <div className="nh-drop-content">
                <div className="nh-drop-icon">
                    <Icon size={96} />
                </div>
                <div className="nh-drop-text">{title}</div>
                <div className="nh-drop-hint">{hint}</div>
            </div>
        </div>
    );

    return createPortal(overlay, document.body);
};
