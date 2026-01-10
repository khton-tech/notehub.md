import React, { useState, useEffect, useCallback } from 'react';
import { Controller } from '@notehub/controllers-manager';
import { Icon } from '@notehub/icon-manager';
import type { NotehubCore } from '@notehub/core';

interface EditorLayoutProps {
    app?: NotehubCore;
    [key: string]: unknown;
}

export const EditorLayout: React.FC<EditorLayoutProps> = ({ app }) => {
    const [sidebarWidth, setSidebarWidth] = useState(250);
    const [isResizing, setIsResizing] = useState(false);
    const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [vaultName] = useState('Notehub');

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

    useEffect(() => {
        if (isResizing) {
            window.addEventListener('mousemove', resize);
            window.addEventListener('mouseup', stopResizing);
        }

        return () => {
            window.removeEventListener('mousemove', resize);
            window.removeEventListener('mouseup', stopResizing);
        };
    }, [isResizing, resize, stopResizing]);

    // Gap size for floating panels
    const gap = 8;

    return (
        <div
            className="w-screen h-screen overflow-hidden bg-[var(--nh-bg-main)] text-[var(--nh-text-primary)] flex flex-col"
        >
            {/* Title Bar - Always visible at all screen sizes */}
            <div className="shrink-0">
                <Controller type="titlebar" app={app} />
            </div>

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
                        className="bg-[var(--nh-bg-surface)] rounded-xl shadow-[var(--nh-shadow-sm)] flex flex-col items-center py-3 gap-2 overflow-hidden"
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
                        className="bg-[var(--nh-bg-surface)] rounded-xl shadow-[var(--nh-shadow-sm)] relative overflow-hidden"
                    >
                        <Controller type="explorer-tree" />

                        {/* Resize Handle */}
                        <div
                            onMouseDown={startResizing}
                            style={{
                                position: 'absolute',
                                right: -4,
                                top: 8,
                                width: 6,
                                height: 'calc(100% - 16px)',
                                cursor: 'col-resize',
                                zIndex: 10,
                                borderRadius: 3,
                                backgroundColor: isResizing ? 'var(--nh-accent-primary)' : 'transparent',
                                opacity: isResizing ? 0.8 : 0,
                                transition: 'all 0.2s ease',
                            }}
                            className="hover:bg-[var(--nh-accent-primary)] hover:opacity-60 hover:shadow-[0_0_8px_var(--nh-accent-primary)]"
                        />
                    </div>

                    {/* Main Editor Area - Floating Panel */}
                    <div
                        style={{ gridArea: 'main' }}
                        className="bg-[var(--nh-bg-surface)] rounded-xl shadow-[var(--nh-shadow-sm)] overflow-auto relative"
                    >
                        <Controller type="editor-main" />
                    </div>

                    {/* Status Bar - Floating Panel */}
                    <div
                        style={{ gridArea: 'status' }}
                        className="bg-[var(--nh-bg-surface)] rounded-xl shadow-[var(--nh-shadow-sm)] border border-[var(--nh-accent-primary)] px-3 py-1.5 text-xs"
                    >
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
                    <div className="flex-1 bg-[var(--nh-bg-surface)] rounded-xl shadow-[var(--nh-shadow-sm)] overflow-auto">
                        <Controller type="editor-main" />
                    </div>

                    {/* Mobile Status */}
                    <div className="bg-[var(--nh-bg-surface)] rounded-xl shadow-[var(--nh-shadow-sm)] border border-[var(--nh-accent-primary)] px-3 py-1.5 text-xs shrink-0">
                        <Controller type="status-bar" props={{ status: 'ready' }} />
                    </div>
                </div>

                {/* Mobile Backdrop */}
                {isMobileMenuOpen && (
                    <div
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden animate-in fade-in duration-200"
                        onClick={() => setMobileMenuOpen(false)}
                    />
                )}

                {/* Mobile Drawer */}
                <div
                    className={`
                    fixed inset-y-0 left-0 z-50 flex h-full transition-transform duration-300 transform p-2
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
                        zIndex: 9999,
                        cursor: 'col-resize'
                    }} />
                )}
            </div>
        </div>
    );
};
