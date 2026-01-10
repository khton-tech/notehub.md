/**
 * @fileoverview TitleBar Component
 * 
 * Custom title bar with branding, dynamic title, and window controls.
 * Replaces the native OS title bar when decorations are disabled.
 * 
 * Layout:
 * ┌──────────────────────────────────────────────────────────────────┐
 * │ [notehub]         [icon] Current Note Title          [─][□][✕]  │
 * └──────────────────────────────────────────────────────────────────┘
 * 
 * @module @notehub/titlebar
 */

import React, { useState, useEffect, useCallback } from 'react';
import type { TitleBarController } from '../logic/TitleBarController';
import type { NotehubCore } from '@notehub/core';

interface TitleBarProps {
    controller: TitleBarController;
    app?: NotehubCore;
}

/**
 * Dynamic Icon component that uses icon-manager API
 */
const DynamicIcon: React.FC<{ name: string; app?: NotehubCore; size?: number; style?: React.CSSProperties }> = ({
    name,
    app,
    size = 14,
    style
}) => {
    const [IconComponent, setIconComponent] = useState<React.ComponentType<{ size?: number; style?: React.CSSProperties }> | null>(null);

    useEffect(() => {
        if (app && name) {
            try {
                // icon:get returns a React ElementType synchronously (but wrapped in Promise by invoke)
                const result = app.api.invoke('icon:get', name);

                // Handle both Promise and direct returns
                if (result && typeof result === 'object' && 'then' in result) {
                    (result as Promise<any>).then((icon: any) => {
                        if (icon && typeof icon === 'function') {
                            setIconComponent(() => icon);
                        }
                    }).catch(() => {
                        // Ignore errors
                    });
                } else if (result && typeof result === 'function') {
                    setIconComponent(() => result as React.ComponentType<any>);
                }
            } catch {
                // Ignore errors
            }
        }
    }, [app, name]);

    if (!IconComponent) {
        return null;
    }

    return <IconComponent size={size} style={style} />;
};

/**
 * TitleBar - Custom window title bar component
 */
export const TitleBar: React.FC<TitleBarProps> = ({ controller, app }) => {
    const [state, setState] = useState(controller.getState());

    useEffect(() => {
        const unsubscribe = controller.subscribe(setState);
        return unsubscribe;
    }, [controller]);

    const handleMinimize = useCallback(() => {
        controller.minimize();
    }, [controller]);

    const handleMaximize = useCallback(() => {
        controller.toggleMaximize();
    }, [controller]);

    const handleClose = useCallback(() => {
        controller.close();
    }, [controller]);

    const handleDragStart = useCallback((e: React.MouseEvent) => {
        // Only drag on left mouse button
        if (e.button === 0) {
            controller.startDrag();
        }
    }, [controller]);

    // Don't render on non-Tauri platforms
    if (!controller.isTauri()) {
        return null;
    }

    return (
        <div
            className="titlebar"
            style={{
                display: 'flex',
                alignItems: 'center',
                height: '32px',
                backgroundColor: 'var(--nh-bg-surface)',
                borderBottom: '1px solid var(--nh-border-secondary)',
                userSelect: 'none',
                WebkitUserSelect: 'none',
            }}
        >
            {/* Branding - Left */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 16px',
                    fontWeight: 700,
                    fontSize: '14px',
                    color: 'var(--nh-accent-primary)',
                    letterSpacing: '-0.02em',
                    flexShrink: 0,
                }}
            >
                notehub
            </div>

            {/* Draggable Title Area - Center */}
            <div
                data-tauri-drag-region
                onMouseDown={handleDragStart}
                style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    height: '100%',
                    cursor: 'grab',
                    overflow: 'hidden',
                }}
            >
                {state.icon && app && (
                    <DynamicIcon
                        name={state.icon}
                        app={app}
                        size={14}
                        style={{
                            color: 'var(--nh-text-muted)',
                            flexShrink: 0,
                        }}
                    />
                )}
                <span
                    style={{
                        fontSize: '13px',
                        color: 'var(--nh-text-secondary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                    }}
                >
                    {state.title}
                </span>
            </div>

            {/* Window Controls - Right */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    height: '100%',
                    flexShrink: 0,
                }}
            >
                {/* Minimize */}
                <WindowButton onClick={handleMinimize} title="Minimize">
                    <MinimizeIcon />
                </WindowButton>

                {/* Maximize/Restore */}
                <WindowButton onClick={handleMaximize} title={state.isMaximized ? 'Restore' : 'Maximize'}>
                    {state.isMaximized ? <RestoreIcon /> : <MaximizeIcon />}
                </WindowButton>

                {/* Close */}
                <WindowButton onClick={handleClose} title="Close" isClose>
                    <CloseIcon />
                </WindowButton>
            </div>
        </div>
    );
};

/**
 * Window control button component
 */
interface WindowButtonProps {
    onClick: () => void;
    title: string;
    isClose?: boolean;
    children: React.ReactNode;
}

const WindowButton: React.FC<WindowButtonProps> = ({ onClick, title, isClose, children }) => {
    const [isHovered, setIsHovered] = useState(false);

    return (
        <button
            onClick={onClick}
            title={title}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '46px',
                height: '100%',
                border: 'none',
                background: isHovered
                    ? (isClose ? '#e81123' : 'var(--nh-bg-hover)')
                    : 'transparent',
                color: isHovered && isClose
                    ? '#fff'
                    : 'var(--nh-text-secondary)',
                cursor: 'pointer',
                transition: 'background-color 0.15s ease, color 0.15s ease',
                borderTopRightRadius: isClose ? '0.75rem' : 0,
                borderBottomRightRadius: isClose ? '0.75rem' : 0,
            }}
        >
            {children}
        </button>
    );
};

// ============================================================================
// Window Control Icons (inline SVG for reliability)
// ============================================================================

const MinimizeIcon: React.FC = () => (
    <svg width="10" height="1" viewBox="0 0 10 1" fill="currentColor">
        <rect width="10" height="1" />
    </svg>
);

const MaximizeIcon: React.FC = () => (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1">
        <rect x="0.5" y="0.5" width="9" height="9" />
    </svg>
);

const RestoreIcon: React.FC = () => (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1">
        <rect x="2.5" y="0.5" width="7" height="7" />
        <path d="M0.5 2.5 L0.5 9.5 L7.5 9.5 L7.5 7.5" />
    </svg>
);

const CloseIcon: React.FC = () => (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M0 0 L10 10 M10 0 L0 10" />
    </svg>
);

export default TitleBar;
