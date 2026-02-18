/**
 * TabBar Component
 *
 * Renders a horizontal scrollable tab bar for open files.
 * Each tab shows the filename with a close button.
 * Supports drag-and-drop reordering, middle-click close,
 * context menu actions, and full keyboard navigation.
 *
 * @module @notehub/tabbar/components/TabBar
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import type { NotehubCore } from '@notehub/core';
import { X, FileText } from 'lucide-react';

/** Extract filename from a full path */
function getFileName(filePath: string): string {
    const i = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
    return i >= 0 ? filePath.substring(i + 1) : filePath;
}

/** Single tab entry */
export interface TabItem {
    /** Unique identifier (file path) */
    id: string;
    /** Display name (filename) */
    name: string;
    /** Full file path */
    path: string;
}

export interface TabBarProps {
    app: NotehubCore;
    tabs: TabItem[];
    activeTabId: string | null;
    onActivate: (tabId: string) => void;
    onClose: (tabId: string) => void;
    onReorder: (tabs: TabItem[]) => void;
}

export function TabBar({ app, tabs, activeTabId, onActivate, onClose, onReorder }: TabBarProps) {
    const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
    const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Auto-scroll active tab into view
    useEffect(() => {
        if (!activeTabId || !scrollRef.current) return;
        const el = scrollRef.current.querySelector(`[data-tab-id="${CSS.escape(activeTabId)}"]`);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
        }
    }, [activeTabId]);

    const handleDragStart = useCallback((e: React.DragEvent, idx: number) => {
        setDraggedIdx(idx);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(idx));
        if (e.currentTarget instanceof HTMLElement) {
            e.currentTarget.style.opacity = '0.5';
        }
    }, []);

    const handleDragEnd = useCallback((e: React.DragEvent) => {
        if (e.currentTarget instanceof HTMLElement) {
            e.currentTarget.style.opacity = '1';
        }
        setDraggedIdx(null);
        setDragOverIdx(null);
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent, idx: number) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDragOverIdx(idx);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent, dropIdx: number) => {
        e.preventDefault();
        if (draggedIdx === null || draggedIdx === dropIdx) {
            setDraggedIdx(null);
            setDragOverIdx(null);
            return;
        }
        const newTabs = [...tabs];
        const [moved] = newTabs.splice(draggedIdx, 1);
        if (moved) {
            newTabs.splice(dropIdx, 0, moved);
            onReorder(newTabs);
        }
        setDraggedIdx(null);
        setDragOverIdx(null);
    }, [draggedIdx, tabs, onReorder]);

    const handleMouseDown = useCallback((e: React.MouseEvent, tabId: string) => {
        if (e.button === 1) {
            e.preventDefault();
            onClose(tabId);
        }
    }, [onClose]);

    const handleContextMenu = useCallback(async (e: React.MouseEvent, tabId: string) => {
        e.preventDefault();
        try {
            await app.api.invoke('context-menu:trigger', e.nativeEvent, 'tabbar-tab', {
                tabId,
                path: tabs.find(t => t.id === tabId)?.path,
            });
        } catch { /* context menu not available */ }
    }, [app, tabs]);

    const handleWheel = useCallback((e: React.WheelEvent) => {
        if (scrollRef.current) {
            scrollRef.current.scrollLeft += e.deltaY;
        }
    }, []);

    // Keyboard navigation for tabs
    const handleKeyDown = useCallback((e: React.KeyboardEvent, tabId: string, idx: number) => {
        switch (e.key) {
            case 'ArrowRight': {
                e.preventDefault();
                const nextIdx = idx + 1;
                if (nextIdx < tabs.length && tabs[nextIdx]) {
                    const nextEl = scrollRef.current?.querySelector(
                        `[data-tab-id="${CSS.escape(tabs[nextIdx].id)}"]`
                    ) as HTMLElement | null;
                    nextEl?.focus();
                }
                break;
            }
            case 'ArrowLeft': {
                e.preventDefault();
                const prevIdx = idx - 1;
                if (prevIdx >= 0 && tabs[prevIdx]) {
                    const prevEl = scrollRef.current?.querySelector(
                        `[data-tab-id="${CSS.escape(tabs[prevIdx].id)}"]`
                    ) as HTMLElement | null;
                    prevEl?.focus();
                }
                break;
            }
            case 'Enter':
            case ' ':
                e.preventDefault();
                onActivate(tabId);
                break;
            case 'Delete':
            case 'Backspace':
                e.preventDefault();
                onClose(tabId);
                break;
            case 'Home': {
                e.preventDefault();
                if (tabs.length > 0 && tabs[0]) {
                    const firstEl = scrollRef.current?.querySelector(
                        `[data-tab-id="${CSS.escape(tabs[0].id)}"]`
                    ) as HTMLElement | null;
                    firstEl?.focus();
                }
                break;
            }
            case 'End': {
                e.preventDefault();
                const lastTab = tabs[tabs.length - 1];
                if (lastTab) {
                    const lastEl = scrollRef.current?.querySelector(
                        `[data-tab-id="${CSS.escape(lastTab.id)}"]`
                    ) as HTMLElement | null;
                    lastEl?.focus();
                }
                break;
            }
        }
    }, [tabs, onActivate, onClose]);

    // Empty state — all hooks are above this point (Rules of Hooks compliance)
    if (tabs.length === 0) return null;

    return (
        <div className="nh-tabbar" role="tablist" onWheel={handleWheel}>
            <div className="nh-tabbar__scroll" ref={scrollRef}>
                {tabs.map((tab, idx) => {
                    const isActive = tab.id === activeTabId;
                    const isDragOver = dragOverIdx === idx && draggedIdx !== idx;
                    const displayName = getFileName(tab.path);

                    const classes = [
                        'nh-tabbar__tab',
                        isActive ? 'nh-tabbar__tab--active' : '',
                        isDragOver ? 'nh-tabbar__tab--drag-over' : '',
                    ].filter(Boolean).join(' ');

                    return (
                        <div
                            key={tab.id}
                            className={classes}
                            data-tab-id={tab.id}
                            title={tab.path}
                            role="tab"
                            aria-selected={isActive}
                            tabIndex={isActive ? 0 : -1}
                            draggable
                            onClick={() => onActivate(tab.id)}
                            onMouseDown={(e) => handleMouseDown(e, tab.id)}
                            onContextMenu={(e) => handleContextMenu(e, tab.id)}
                            onKeyDown={(e) => handleKeyDown(e, tab.id, idx)}
                            onDragStart={(e) => handleDragStart(e, idx)}
                            onDragEnd={handleDragEnd}
                            onDragOver={(e) => handleDragOver(e, idx)}
                            onDrop={(e) => handleDrop(e, idx)}
                        >
                            <FileText size={14} className="nh-tabbar__icon" />
                            <span className="nh-tabbar__label">{displayName}</span>
                            <button
                                className="nh-tabbar__close"
                                tabIndex={-1}
                                aria-label={`Close ${displayName}`}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onClose(tab.id);
                                }}
                            >
                                <X size={12} />
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
