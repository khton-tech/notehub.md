/**
 * TabBar Component
 *
 * Renders a horizontal scrollable tab bar for open files.
 * Each tab shows the filename with a close button.
 * Supports drag-and-drop reordering (pointer events — works on desktop AND mobile),
 * middle-click close, context menu actions, and full keyboard navigation.
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

/** Minimum pointer movement (px) before we consider it a drag vs a click */
const DRAG_THRESHOLD = 5;

export function TabBar({ app, tabs, activeTabId, onActivate, onClose, onReorder }: TabBarProps) {
    // Visual-only state (drives re-renders for opacity/highlight)
    const [visualDraggedIdx, setVisualDraggedIdx] = useState<number | null>(null);
    const [visualDropIdx, setVisualDropIdx] = useState<number | null>(null);
    const [noOpenFilesLabel, setNoOpenFilesLabel] = useState('No open files');

    useEffect(() => {
        const load = () => app.api.invoke<string>('i18n:t', 'tabbar.noOpenFiles')
            .then(v => setNoOpenFilesLabel(v ?? 'No open files')).catch(() => {});
        load();
        app.events.on('i18n:language-changed', load);
        return () => app.events.off('i18n:language-changed', load);
    }, [app]);

    // Refs for the actual drag state — avoids stale-closure issues in pointer handlers
    const draggedIdxRef = useRef<number | null>(null);
    const dropIdxRef = useRef<number | null>(null);
    const dragStartXRef = useRef<number | null>(null);
    const wasDragRef = useRef(false);

    const scrollRef = useRef<HTMLDivElement>(null);

    // Keep a live ref to `tabs` so pointer handlers always see the current list
    const tabsRef = useRef(tabs);
    useEffect(() => { tabsRef.current = tabs; }, [tabs]);

    // Auto-scroll active tab into view
    useEffect(() => {
        if (!activeTabId || !scrollRef.current) return;
        const el = scrollRef.current.querySelector(`[data-tab-id="${CSS.escape(activeTabId)}"]`);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
        }
    }, [activeTabId]);

    // ── Pointer-based drag-and-drop ────────────────────────────────────────────
    // Uses the Pointer Events API so it works on both desktop (mouse) and mobile
    // (touch). setPointerCapture ensures we keep receiving events even when the
    // pointer leaves the originating element.

    const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>, idx: number) => {
        // Don't intercept close-button clicks — pointer capture would swallow them
        if ((e.target as HTMLElement).closest('.nh-tabbar__close')) return;
        // Only primary button on mouse; any pointer type (touch, pen) is fine
        if (e.pointerType === 'mouse' && e.button !== 0) return;

        e.currentTarget.setPointerCapture(e.pointerId);
        dragStartXRef.current = e.clientX;
        wasDragRef.current = false;
        draggedIdxRef.current = idx;
        dropIdxRef.current = idx;
        setVisualDraggedIdx(idx);
        setVisualDropIdx(idx);
    }, []);

    const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        if (draggedIdxRef.current === null || dragStartXRef.current === null) return;

        // Only commit to a drag once the pointer has moved enough
        if (Math.abs(e.clientX - dragStartXRef.current) > DRAG_THRESHOLD) {
            wasDragRef.current = true;
        }
        if (!wasDragRef.current) return;

        // elementsFromPoint works correctly even with pointer capture active —
        // it performs a visual hit-test ignoring the capture.
        const elements = document.elementsFromPoint(e.clientX, e.clientY);
        for (const el of elements) {
            if (el instanceof HTMLElement && el.dataset.tabId) {
                const targetIdx = tabsRef.current.findIndex(t => t.id === el.dataset.tabId);
                if (targetIdx >= 0 && targetIdx !== dropIdxRef.current) {
                    dropIdxRef.current = targetIdx;
                    setVisualDropIdx(targetIdx);
                }
                return;
            }
        }
    }, []);

    const handlePointerUp = useCallback((_e: React.PointerEvent<HTMLDivElement>) => {
        if (draggedIdxRef.current === null) return;

        const dragIdx = draggedIdxRef.current;
        const dropIdx = dropIdxRef.current;

        if (wasDragRef.current && dropIdx !== null && dropIdx !== dragIdx) {
            const newTabs = [...tabsRef.current];
            const [moved] = newTabs.splice(dragIdx, 1);
            if (moved) {
                newTabs.splice(dropIdx, 0, moved);
                onReorder(newTabs);
            }
        }

        draggedIdxRef.current = null;
        dropIdxRef.current = null;
        dragStartXRef.current = null;
        setVisualDraggedIdx(null);
        setVisualDropIdx(null);
        // wasDragRef is intentionally NOT reset here — onClick reads it right after
    }, [onReorder]);

    // ── Click / keyboard / wheel ───────────────────────────────────────────────

    const handleClick = useCallback((tabId: string) => {
        // Suppress the click that fires after a completed drag
        if (wasDragRef.current) {
            wasDragRef.current = false;
            return;
        }
        onActivate(tabId);
    }, [onActivate]);

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
    if (tabs.length === 0) {
        return (
            <div className="nh-tabbar nh-tabbar--empty" role="tablist">
                <span className="nh-tabbar__empty-hint">{noOpenFilesLabel}</span>
            </div>
        );
    }

    const isDragging = visualDraggedIdx !== null;

    return (
        <div className="nh-tabbar" role="tablist" onWheel={handleWheel}>
            <div className="nh-tabbar__scroll" ref={scrollRef}>
                {tabs.map((tab, idx) => {
                    const isActive = tab.id === activeTabId;
                    const isBeingDragged = visualDraggedIdx === idx;
                    const isDragOver = visualDropIdx === idx && visualDraggedIdx !== idx;
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
                            style={{
                                opacity: isBeingDragged ? 0.5 : 1,
                                cursor: isDragging ? 'grabbing' : 'grab',
                                // Disable browser scroll-on-touch so pointer events fire cleanly
                                touchAction: 'none',
                            }}
                            onClick={() => handleClick(tab.id)}
                            onMouseDown={(e) => handleMouseDown(e, tab.id)}
                            onContextMenu={(e) => handleContextMenu(e, tab.id)}
                            onKeyDown={(e) => handleKeyDown(e, tab.id, idx)}
                            onPointerDown={(e) => handlePointerDown(e, idx)}
                            onPointerMove={handlePointerMove}
                            onPointerUp={handlePointerUp}
                            onPointerCancel={handlePointerUp}
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
