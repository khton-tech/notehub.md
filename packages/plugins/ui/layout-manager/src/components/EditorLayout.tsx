import React, { useState, useEffect, useCallback } from 'react';
import { Controller } from '@notehub/controllers-manager';
import type { NotehubCore } from '@notehub/core';

interface EditorLayoutProps {
    app?: NotehubCore;
    [key: string]: unknown;
}

export const EditorLayout: React.FC<EditorLayoutProps> = ({ app }) => {
    const [sidebarWidth, setSidebarWidth] = useState(250);
    const [isResizing, setIsResizing] = useState(false);

    // Load width from state manager
    useEffect(() => {
        if (app) {
            const loadWidth = async () => {
                const savedWidth = await app.api.invoke('state:get', 'layout.sidebar.width');
                if (typeof savedWidth === 'number') {
                    setSidebarWidth(savedWidth);
                }
            };
            loadWidth();
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
            const newWidth = e.clientX - 48; // Subtract ribbon width
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

    return (
        <div style={{
            display: 'grid',
            height: '100vh',
            width: '100vw',
            gridTemplateAreas: `
                "ribbon sidebar main"
                "status status  status"
            `,
            gridTemplateColumns: `48px ${sidebarWidth}px 1fr`,
            gridTemplateRows: '1fr 24px',
            color: 'var(--nh-text-primary)'
        }}>
            {/* Ribbon Area */}
            <div style={{ gridArea: 'ribbon' }} className="border-r border-[#444] bg-[var(--nh-bg-sidebar)] flex flex-col items-center py-2 gap-2">
                <Controller type="ribbon-placeholder" />
            </div>

            {/* Sidebar Area */}
            <div style={{ gridArea: 'sidebar', position: 'relative' }} className="border-r border-[#444] bg-[var(--nh-bg-sidebar)]">
                <Controller type="explorer-placeholder" />

                {/* Resize Handle */}
                <div
                    onMouseDown={startResizing}
                    style={{
                        position: 'absolute',
                        right: -2,
                        top: 0,
                        width: 4,
                        height: '100%',
                        cursor: 'col-resize',
                        zIndex: 10,
                        backgroundColor: isResizing ? 'var(--nh-accent-primary, #4a90e2)' : 'transparent',
                        opacity: isResizing ? 0.5 : 0,
                        transition: 'opacity 0.2s',
                    }}
                    className="hover:bg-blue-500 hover:opacity-100"
                />
            </div>

            {/* Main Area */}
            <div style={{ gridArea: 'main' }} className="bg-[var(--nh-bg-main)]">
                <Controller type="empty-slot" />
            </div>

            {/* Status Area */}
            <div style={{ gridArea: 'status' }}>
                <Controller type="status-bar" props={{ status: 'ready' }} />
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
    );
};
