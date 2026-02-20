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
        backgroundColor: 'var(--nh-bg-surface)',
        border: '1px solid var(--nh-border-secondary)',
        borderRadius: '8px',
        boxShadow: 'var(--nh-shadow-md)',
        zIndex: 300,
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
        color: 'var(--nh-text-primary)',
        cursor: 'pointer',
        transition: 'background-color 0.1s, color 0.1s',
    },
    buttonHover: {
        backgroundColor: 'var(--nh-bg-hover)',
        color: 'var(--nh-accent-primary)',
    },
    separator: {
        width: '1px',
        height: '20px',
        backgroundColor: 'var(--nh-border-subtle)',
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
    const toolbarRef = React.useRef<HTMLDivElement>(null);
    const [halfWidth, setHalfWidth] = React.useState(140); // fallback estimate for ~260px toolbar

    // Measure actual toolbar width after mount to fix off-screen clamping
    React.useLayoutEffect(() => {
        if (toolbarRef.current) {
            setHalfWidth(toolbarRef.current.offsetWidth / 2);
        }
    }, [state.visible]);

    if (!state.visible) {
        return null;
    }

    const margin = 8;
    // Clamp X so toolbar never goes off-screen (accounts for translateX(-50%))
    const adjustedX = Math.max(
        halfWidth + margin,
        Math.min(state.position.x, window.innerWidth - halfWidth - margin)
    );
    // Ensure toolbar has room above the selection; if not, flip below
    const spaceAbove = state.position.y - 40;
    const adjustedY = spaceAbove < margin ? state.position.y + 8 : spaceAbove;

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
                ref={toolbarRef}
                style={{
                    ...styles.container,
                    left: adjustedX,
                    top: adjustedY,
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
