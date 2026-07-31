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

    const [sidebarWidth, setSidebarWidth] = useState(250);
    const [isResizing, setIsResizing] = useState(false);
    const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [vaultName] = useState('Notehub');
    const drawerRef = useRef<HTMLDivElement>(null);

    // Load width and vault name from config/api
    useEffect(() => {
        if (!app) return;

        const loadState = async () => {
            // Load Sidebar Width
            try {
                const savedWidth = await app.api.invoke('config:get', 'ui.sidebar-width');
                if (typeof savedWidth === 'number') {
                    setSidebarWidth(savedWidth);
                }
            } catch (e) {
                // Ignore error if config API fails
            }
        };
        loadState();

        // Listen for config changes
        const handleConfigUpdate = (payload: any) => {
            if (payload.key === 'ui.sidebar-width' && typeof payload.value === 'number') {
                setSidebarWidth(payload.value);
            }
        };
        app.events.on('config:updated', handleConfigUpdate);

        return () => {
            app.events.off('config:updated', handleConfigUpdate);
        };
    }, [app]);

    // Handle resizing
    const startResizing = useCallback(() => {
        setIsResizing(true);
    }, []);

    const stopResizing = useCallback(() => {
        setIsResizing(false);
        // Save width to config manager
        if (app) {
            app.api.invoke('config:set', 'ui.sidebar-width', sidebarWidth);
        }
    }, [app, sidebarWidth]);

    const resize = useCallback((e: MouseEvent) => {
        if (isResizing) {
            const newWidth = e.clientX - 12; // Subtract left outer padding
            if (newWidth > 180 && newWidth < 600) {
                setSidebarWidth(newWidth);
            }
        }
    }, [isResizing]);

    const resizeTouch = useCallback((e: TouchEvent) => {
        const touch = e.touches[0];
        if (isResizing && touch) {
            const newWidth = touch.clientX - 12;
            if (newWidth > 180 && newWidth < 600) {
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

    // Gap size for desktop floating panels (8px baseline)
    const gap = 8;

    return (
        <div className="w-full h-full overflow-hidden flex flex-col relative bg-[var(--nh-bg-main)]">
            {/* Main Content Area */}
            <div
                className="flex-1 overflow-hidden"
                style={{
                    paddingTop: `max(8px, env(safe-area-inset-top))`,
                    paddingRight: `max(8px, env(safe-area-inset-right))`,
                    paddingBottom: `max(8px, env(safe-area-inset-bottom))`,
                    paddingLeft: `max(8px, env(safe-area-inset-left))`,
                }}
            >
                {/* Desktop Grid Layout */}
                <div
                    className="hidden md:grid h-full"
                    style={{
                        gridTemplateAreas: `"sidebar main"`,
                        gridTemplateColumns: `${sidebarWidth}px 1fr`,
                        gridTemplateRows: '1fr',
                        gap: `${gap}px`,
                    }}
                >
                    {/* Unified Left Sidebar - Activity Bar + Explorer */}
                    <div
                        style={{ gridArea: 'sidebar' }}
                        className="bg-[var(--nh-bg-sidebar)] rounded-lg shadow-[var(--nh-shadow-sm)] border border-[var(--nh-border-secondary)] relative overflow-hidden flex"
                    >
                        {/* Compact Integrated Activity Bar */}
                        <div className="w-10 bg-[var(--nh-bg-sidebar)] border-r border-[var(--nh-border-subtle)] flex flex-col items-center py-2 gap-1.5 shrink-0 select-none">
                            <div className="flex-1 w-full flex flex-col items-center">
                                <Controller type="ribbon-placeholder" app={app} />
                            </div>
                            <div className="mt-auto w-full flex flex-col items-center pb-1">
                                <Controller type="ribbon-bottom" app={app} />
                            </div>
                        </div>

                        {/* File Tree / Explorer */}
                        <div className="flex-1 min-w-0 h-full overflow-hidden bg-[var(--nh-bg-sidebar)]">
                            <Controller type="explorer-tree" />
                        </div>

                        {/* Resize Handle — padded for touch/mouse, visually thin line */}
                        <div
                            onMouseDown={startResizing}
                            onTouchStart={startResizing}
                            style={{
                                position: 'absolute',
                                right: -4,
                                top: 0,
                                width: 8,
                                height: '100%',
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
                                    width: 2,
                                    backgroundColor: isResizing ? 'var(--nh-accent-primary)' : 'transparent',
                                    opacity: isResizing ? 0.9 : 0,
                                    transition: 'all 120ms ease-out',
                                }}
                                className="hover:bg-[var(--nh-accent-primary)] hover:opacity-70"
                            />
                        </div>
                    </div>

                    {/* Main Editor Area - Floating Panel with Integrated Footer */}
                    <div
                        style={{ gridArea: 'main' }}
                        className="bg-[var(--nh-bg-surface)] rounded-lg shadow-[var(--nh-shadow-sm)] border border-[var(--nh-border-secondary)] overflow-hidden relative flex flex-col"
                    >
                        <ZoneRenderer name="tabbar" className="shrink-0 border-b border-[var(--nh-border-subtle)]" />
                        <div className="flex-1 bg-[var(--nh-bg-surface)] overflow-auto">
                            <Controller type="editor-main" />
                        </div>
                        {/* Integrated Status Bar Footer */}
                        <div className="h-6 bg-[var(--nh-bg-surface)] border-t border-[var(--nh-border-subtle)] px-3 text-[11px] text-[var(--nh-text-muted)] flex items-center justify-between shrink-0 select-none">
                            <ZoneRenderer name="status-bar" />
                            <Controller type="status-bar" props={{ status: 'ready' }} />
                        </div>
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
                    <div className="flex-1 rounded-xl shadow-[var(--nh-shadow-sm)] overflow-hidden flex flex-col">
                        <ZoneRenderer name="tabbar" className="shrink-0" />
                        <div className="flex-1 bg-[var(--nh-bg-surface)] overflow-auto">
                            <Controller type="editor-main" />
                        </div>
                    </div>

                    {/* Mobile Status */}
                    <div className="bg-[var(--nh-bg-surface)] rounded-xl shadow-[var(--nh-shadow-sm),var(--nh-panel-glow)] px-3 py-1.5 text-xs shrink-0 overflow-visible border border-[var(--nh-border-accent)]">
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
                    absolute inset-y-0 left-0 z-[350] flex transition-transform duration-300 transform p-2
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
