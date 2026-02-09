import React from 'react';
import { Bold, Italic, Code, Link, Heading1, Heading2, Quote, List } from 'lucide-react';
import type { ToolbarState } from '../index.js';

/**
 * Toolbar button configuration
 */
interface ToolbarButton {
    id: string;
    icon: React.ReactNode;
    label: string;
    command: string;
    shortcut?: string;
}

/**
 * Button configurations for the toolbar
 */
const BUTTONS: ToolbarButton[] = [
    {
        id: 'bold',
        icon: <Bold size={16} strokeWidth={2.5} />,
        label: 'Bold',
        command: 'editor:format-bold',
        shortcut: 'Ctrl+B'
    },
    {
        id: 'italic',
        icon: <Italic size={16} />,
        label: 'Italic',
        command: 'editor:format-italic',
        shortcut: 'Ctrl+I'
    },
    {
        id: 'code',
        icon: <Code size={16} />,
        label: 'Code',
        command: 'editor:format-code',
        shortcut: 'Ctrl+`'
    },
    {
        id: 'link',
        icon: <Link size={16} />,
        label: 'Link',
        command: 'editor:insert-link',
        shortcut: 'Ctrl+K'
    },
    {
        id: 'h1',
        icon: <Heading1 size={16} />,
        label: 'Heading 1',
        command: 'editor:format-heading-1',
        shortcut: 'Ctrl+1'
    },
    {
        id: 'h2',
        icon: <Heading2 size={16} />,
        label: 'Heading 2',
        command: 'editor:format-heading-2',
        shortcut: 'Ctrl+2'
    },
    {
        id: 'quote',
        icon: <Quote size={16} />,
        label: 'Quote',
        command: 'editor:format-blockquote',
        shortcut: 'Ctrl+Shift+.'
    },
    {
        id: 'list',
        icon: <List size={16} />,
        label: 'Bullet List',
        command: 'editor:format-bullet-list',
        shortcut: 'Ctrl+Shift+8'
    },
];

/**
 * Props for the FloatingToolbar component
 */
interface FloatingToolbarProps {
    state: ToolbarState;
    onAction: (command: string) => void;
}

/**
 * Styles for the toolbar
 */
const styles: Record<string, React.CSSProperties> = {
    container: {
        position: 'fixed',
        display: 'flex',
        gap: '2px',
        padding: '4px 6px',
        backgroundColor: 'var(--nh-surface-elevated, #1e1e1e)',
        border: '1px solid var(--nh-border-subtle, rgba(255,255,255,0.1))',
        borderRadius: '8px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.05)',
        zIndex: 10000,
        transform: 'translateX(-50%)',
        animation: 'floatingToolbarFadeIn 0.15s ease-out',
    },
    button: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '28px',
        height: '28px',
        border: 'none',
        borderRadius: '4px',
        backgroundColor: 'transparent',
        color: 'var(--nh-text-primary, #e0e0e0)',
        cursor: 'pointer',
        transition: 'background-color 0.1s, color 0.1s',
    },
    buttonHover: {
        backgroundColor: 'var(--nh-surface-hover, rgba(255,255,255,0.1))',
        color: 'var(--nh-accent, #60a5fa)',
    },
    separator: {
        width: '1px',
        height: '20px',
        backgroundColor: 'var(--nh-border-subtle, rgba(255,255,255,0.1))',
        margin: '4px 4px',
    },
};

/**
 * FloatingToolbar - A floating formatting toolbar component
 * 
 * Renders a toolbar above selected text with formatting options.
 * Uses lucide-react icons for a modern look.
 */
export const FloatingToolbar: React.FC<FloatingToolbarProps> = ({
    state,
    onAction,
}) => {
    const [hoveredButton, setHoveredButton] = React.useState<string | null>(null);

    if (!state.visible) {
        return null;
    }

    // Ensure toolbar stays within viewport
    const adjustedY = Math.max(50, state.position.y); // At least 50px from top
    const adjustedX = Math.max(100, Math.min(state.position.x, window.innerWidth - 100));

    return (
        <>
            {/* Inject animation keyframes */}
            <style>{`
                @keyframes floatingToolbarFadeIn {
                    from {
                        opacity: 0;
                        transform: translateX(-50%) translateY(5px);
                    }
                    to {
                        opacity: 1;
                        transform: translateX(-50%) translateY(0);
                    }
                }
            `}</style>
            <div
                style={{
                    ...styles.container,
                    left: adjustedX,
                    top: adjustedY - 40, // Position above selection
                }}
                onMouseDown={(e) => e.preventDefault()} // Prevent selection loss
            >
                {BUTTONS.map((btn, index) => (
                    <React.Fragment key={btn.id}>
                        {/* Add separator after link button */}
                        {index === 4 && <div style={styles.separator} />}
                        <button
                            type="button"
                            onClick={() => onAction(btn.command)}
                            onMouseEnter={() => setHoveredButton(btn.id)}
                            onMouseLeave={() => setHoveredButton(null)}
                            title={`${btn.label}${btn.shortcut ? ` (${btn.shortcut})` : ''}`}
                            style={{
                                ...styles.button,
                                ...(hoveredButton === btn.id ? styles.buttonHover : {}),
                            }}
                        >
                            {btn.icon}
                        </button>
                    </React.Fragment>
                ))}
            </div>
        </>
    );
};

export default FloatingToolbar;
