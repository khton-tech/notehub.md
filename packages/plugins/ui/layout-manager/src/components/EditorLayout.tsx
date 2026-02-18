import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Controller } from '@notehub/controllers-manager';
import { Icon } from '@notehub/icon-manager';
import { ZoneRenderer } from '../index.js';
import type { NotehubCore } from '@notehub/core';

// Note: ZoneRenderer is imported from parent index.js (circular dep).
// This is safe because ZoneRenderer is only used lazily in JSX, not at module evaluation time.

interface EditorLayoutProps {
    app?: NotehubCore;
    [key: string]: unknown;
}

export const EditorLayout: React.FC<EditorLayoutProps> = ({ app }) => {
    // Debug: Detect Remounts
    useEffect(() => {
        console.log('[EditorLayout] Mounted');
        return () => console.log('[EditorLayout] Unmounted');
    }, []);

    const [sidebarWidth, setSidebarWidth] = useState(250);
    const [isResizing, setIsResizing] = useState(false);
    const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [vaultName] = useState('Notehub');
    const drawerRef = useRef<HTMLDivElement>(null);

    // Load width and vault name from state/api
    useEffect(() => {
        if (app) {
            const loadState = async () => {
                // Load Sidebar Width
                try {
                    const savedWidth = await app.api.invoke('state:get', 'layout.sidebar.width');
                    if (typeof savedWidth === 'number') {
                        setSidebarWidth(savedWidth);
                    }
                } catch (e) {
                    // Ignore error if state API fails
                }
            };
            loadState();
        }
    }, [app]);

    // Handle resizing
    const startResizing = useCallback(() => {
        setIsResizing(true);
    }, []);

    const stopResizing = useCallback(() => {
        setIsResizing(false);
        // Save width to state manager
        if (app) {
            app.api.invoke('state:set', 'layout.sidebar.width', sidebarWidth);
        }
    }, [app, sidebarWidth]);

    const resize = useCallback((e: MouseEvent) => {
        if (isResizing) {
            const newWidth = e.clientX - 56 - 8; // Subtract ribbon width + gap
            if (newWidth > 150 && newWidth < 600) {
                setSidebarWidth(newWidth);
            }
        }
    }, [isResizing]);

    const resizeTouch = useCallback((e: TouchEvent) => {
        const touch = e.touches[0];
        if (isResizing && touch) {
            const newWidth = touch.clientX - 56 - 8;
            if (newWidth > 150 && newWidth < 600) {
                setSidebarWidth(newWidth);
            }
        }
    }, [isResizing]);

    useEffect(() => {
        if (isResizing) {
            window.addEventListener('mousemove', resize);
            window.addEventListener('mouseup', stopResizing);
            window.addEventListener('touchmove', resizeTouch);
            window.addEventListener('touchend', stopResizing);
        }

        return () => {
            window.removeEventListener('mousemove', resize);
            window.removeEventListener('mouseup', stopResizing);
            window.removeEventListener('touchmove', resizeTouch);
            window.removeEventListener('touchend', stopResizing);
        };
    }, [isResizing, resize, resizeTouch, stopResizing]);

    // Mobile drawer: close on Escape and trap focus
    useEffect(() => {
        if (!isMobileMenuOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                setMobileMenuOpen(false);
                return;
            }
            if (e.key === 'Tab' && drawerRef.current) {
                const focusable = drawerRef.current.querySelectorAll<HTMLElement>(
                    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
                );
                if (focusable.length === 0) return;
                const first = focusable[0];
                const last = focusable[focusable.length - 1];
                if (!first || !last) return;
                if (e.shiftKey) {
                    if (document.activeElement === first) {
                        e.preventDefault();
                        last.focus();
                    }
                } else {
                    if (document.activeElement === last) {
                        e.preventDefault();
                        first.focus();
                    }
                }
            }
        };

        document.addEventListener('keydown', handleKeyDown);

        // Focus first focusable element in drawer
        if (drawerRef.current) {
            const first = drawerRef.current.querySelector<HTMLElement>(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            );
            first?.focus();
        }

        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isMobileMenuOpen]);

    // Gap size for floating panels
    const gap = 16;

    return (
        <div
            className="w-full h-full overflow-hidden flex flex-col"
        >
            {/* Main Content Area */}
            <div
                className="flex-1 overflow-hidden p-2"
                style={{
                    // Safe Area Padding for Mobile Notches
                    paddingBottom: `max(8px, env(safe-area-inset-bottom))`,
                }}
            >
                {/* Desktop Grid Layout */}
                <div
                    className="hidden md:grid h-full"
                    style={{
                        gridTemplateAreas: `
                            "ribbon sidebar main"
                            "ribbon sidebar status"
                        `,
                        gridTemplateColumns: `3.5rem ${sidebarWidth / 16}rem 1fr`,
                        gridTemplateRows: '1fr auto',
                        gap: `${gap}px`,
                    }}
                >
                    {/* Ribbon Area - Floating Panel */}
                    <div
                        style={{ gridArea: 'ribbon' }}
                        className="bg-[var(--nh-bg-surface)] rounded-xl shadow-[var(--nh-shadow-sm),var(--nh-panel-glow)] flex flex-col items-center py-3 gap-2 overflow-hidden"
                    >
                        <div className="flex-1 w-full">
                            <Controller type="ribbon-placeholder" app={app} />
                        </div>
                        <div className="mt-auto w-full flex flex-col items-center pb-1">
                            <Controller type="ribbon-bottom" app={app} />
                        </div>
                    </div>

                    {/* Sidebar Area - Floating Panel */}
                    <div
                        style={{ gridArea: 'sidebar' }}
                        className="bg-[var(--nh-bg-surface)] rounded-xl shadow-[var(--nh-shadow-sm),var(--nh-panel-glow)] relative overflow-hidden"
                    >
                        <Controller type="explorer-tree" />

                        {/* Resize Handle — padded for touch, visually thin */}
                        <div
                            onMouseDown={startResizing}
                            onTouchStart={startResizing}
                            style={{
                                position: 'absolute',
                                right: -13,
                                top: 8,
                                width: 24,
                                height: 'calc(100% - 16px)',
                                cursor: 'col-resize',
                                zIndex: 10,
                                display: 'flex',
                                alignItems: 'stretch',
                                justifyContent: 'center',
                                touchAction: 'none',
                            }}
                        >
                            <div
                                style={{
                                    width: 6,
                                    borderRadius: 3,
                                    backgroundColor: isResizing ? 'var(--nh-accent-primary)' : 'transparent',
                                    opacity: isResizing ? 0.8 : 0,
                                    transition: 'all 0.2s ease',
                                }}
                                className="hover:bg-[var(--nh-accent-primary)] hover:opacity-60 hover:shadow-[0_0_8px_var(--nh-accent-primary)]"
                            />
                        </div>
                    </div>

                    {/* Main Editor Area - Floating Panel */}
                    <div
                        style={{ gridArea: 'main' }}
                        className="bg-[var(--nh-bg-surface)] rounded-xl shadow-[var(--nh-shadow-sm),var(--nh-panel-glow)] overflow-auto relative flex flex-col"
                    >
                        <ZoneRenderer name="tabbar" className="shrink-0" />
                        <div className="flex-1 overflow-auto">
                            <Controller type="editor-main" />
                        </div>
                    </div>

                    {/* Status Bar - Floating Panel */}
                    <div
                        style={{ gridArea: 'status' }}
                        className="bg-[var(--nh-bg-surface)] rounded-xl shadow-[var(--nh-shadow-sm),var(--nh-panel-glow)] px-3 py-1.5 text-xs overflow-visible"
                    >
                        <ZoneRenderer name="status-bar" />
                        <Controller type="status-bar" props={{ status: 'ready' }} />
                    </div>
                </div>

                {/* Mobile Layout */}
                <div className="md:hidden flex flex-col h-full gap-2">
                    {/* Mobile Header */}
                    <div className="flex items-center h-12 px-4 bg-[var(--nh-bg-surface)] rounded-xl shadow-[var(--nh-shadow-sm)] shrink-0">
                        <button
                            onClick={() => setMobileMenuOpen(true)}
                            className="p-2 -ml-2 text-[var(--nh-text-primary)] hover:bg-[var(--nh-bg-hover)] rounded-lg transition-colors"
                        >
                            <Icon name="menu" size={24} />
                        </button>
                        <span className="ml-4 font-semibold text-lg truncate">
                            {vaultName}
                        </span>
                    </div>

                    {/* Mobile Content */}
                    <div className="flex-1 bg-[var(--nh-bg-surface)] rounded-xl shadow-[var(--nh-shadow-sm)] overflow-auto flex flex-col">
                        <ZoneRenderer name="tabbar" className="shrink-0" />
                        <div className="flex-1 overflow-auto">
                            <Controller type="editor-main" />
                        </div>
                    </div>

                    {/* Mobile Status */}
                    <div className="bg-[var(--nh-bg-surface)] rounded-xl shadow-[var(--nh-shadow-sm),var(--nh-panel-glow)] px-3 py-1.5 text-xs shrink-0 overflow-visible">
                        <ZoneRenderer name="status-bar" />
                        <Controller type="status-bar" props={{ status: 'ready' }} />
                    </div>
                </div>

                {/* Mobile Backdrop */}
                {isMobileMenuOpen && (
                    <div
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[300] md:hidden animate-in fade-in duration-200"
                        onClick={() => setMobileMenuOpen(false)}
                    />
                )}

                {/* Mobile Drawer */}
                <div
                    ref={drawerRef}
                    className={`
                    fixed inset-y-0 left-0 z-[350] flex h-full transition-transform duration-300 transform p-2
                    ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
                    md:hidden
                `}
                >
                    <div className="flex gap-2 h-full">
                        {/* Ribbon */}
                        <div className="w-14 bg-[var(--nh-bg-surface)] rounded-xl shadow-[var(--nh-shadow-md)] flex flex-col items-center py-3 gap-2">
                            <div className="flex-1 w-full">
                                <Controller type="ribbon-placeholder" app={app} />
                            </div>
                            <div className="mt-auto w-full flex flex-col items-center pb-1">
                                <Controller type="ribbon-bottom" app={app} />
                            </div>
                        </div>

                        {/* Sidebar */}
                        <div className="w-64 bg-[var(--nh-bg-surface)] rounded-xl shadow-[var(--nh-shadow-md)] overflow-hidden">
                            <Controller type="explorer-tree" />
                        </div>
                    </div>
                </div>

                {/* Overlay to prevent iframe capturing mouse events while resizing */}
                {isResizing && (
                    <div style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        width: '100vw',
                        height: '100vh',
                        zIndex: 300,
                        cursor: 'col-resize'
                    }} />
                )}
            </div>
        </div>
    );
};
