/**
 * Tab Bar Plugin
 *
 * Provides a horizontal tab bar for navigating between open files.
 * Registers a controller in the "tabbar" zone and subscribes to
 * editor lifecycle events to keep tabs in sync.
 *
 * @module @notehub/tabbar
 */

import { SystemPlugin } from '@notehub/core';
import type { PluginManifest } from '@notehub/core';
import { useState, useEffect, useRef, useCallback } from 'react';
import { TabBar } from './components/TabBar.js';
import type { TabItem } from './components/TabBar.js';

// ─── Filename helper ────────────────────────────────────────────────────────

function filenameFromPath(path: string): string {
    return path.split(/[\\/]/).pop() || path;
}

// ─── Shared state (singleton across controller re-renders) ──────────────────

const STORAGE_KEY_TABS = 'tabs';
const STORAGE_KEY_ACTIVE = 'activeTab';

interface TabBarState {
    tabs: TabItem[];
    activeTabId: string | null;
    listeners: Set<() => void>;
}

const state: TabBarState = {
    tabs: [],
    activeTabId: null,
    listeners: new Set(),
};

function notify(): void {
    state.listeners.forEach(fn => fn());
}

function addTab(path: string): void {
    const existing = state.tabs.find(t => t.id === path);
    if (existing) {
        state.activeTabId = path;
        notify();
        return;
    }
    state.tabs.push({ id: path, name: filenameFromPath(path), path });
    state.activeTabId = path;
    notify();
}

function removeTab(tabId: string, app: { api: { invoke: (name: string, ...args: unknown[]) => Promise<unknown> } }): void {
    const idx = state.tabs.findIndex(t => t.id === tabId);
    if (idx === -1) return;

    const wasActive = state.activeTabId === tabId;
    state.tabs.splice(idx, 1);

    if (wasActive) {
        if (state.tabs.length > 0) {
            const nextIdx = Math.min(idx, state.tabs.length - 1);
            const nextTab = state.tabs[nextIdx];
            if (nextTab) {
                state.activeTabId = nextTab.id;
                app.api.invoke('editor:open', nextTab.path).catch(() => { });
            }
        } else {
            state.activeTabId = null;
        }
    }
    notify();
}

function reorderTabs(tabs: TabItem[]): void {
    state.tabs = tabs;
    notify();
}

function updateTabPath(oldPath: string, newPath: string): void {
    const tab = state.tabs.find(t => t.id === oldPath);
    if (tab) {
        tab.id = newPath;
        tab.path = newPath;
        tab.name = filenameFromPath(newPath);
        if (state.activeTabId === oldPath) {
            state.activeTabId = newPath;
        }
        notify();
    }
}

function removeTabByPath(path: string, app: { api: { invoke: (name: string, ...args: unknown[]) => Promise<unknown> } }): void {
    if (state.tabs.find(t => t.id === path)) {
        removeTab(path, app);
    }
}

function clearAllTabs(): void {
    state.tabs = [];
    state.activeTabId = null;
    notify();
}

async function saveTabs(app: { api: { invoke: (name: string, ...args: unknown[]) => Promise<unknown> } }): Promise<void> {
    try {
        const data = state.tabs.map(t => ({ id: t.id, name: t.name, path: t.path }));
        await app.api.invoke('config:set', `tabbar.${STORAGE_KEY_TABS}`, data);
        await app.api.invoke('config:set', `tabbar.${STORAGE_KEY_ACTIVE}`, state.activeTabId);
    } catch { /* config not available yet */ }
}

async function loadTabs(app: { api: { invoke: (name: string, ...args: unknown[]) => Promise<unknown> } }): Promise<void> {
    try {
        const saved = await app.api.invoke('config:get', `tabbar.${STORAGE_KEY_TABS}`) as TabItem[] | null;
        const active = await app.api.invoke('config:get', `tabbar.${STORAGE_KEY_ACTIVE}`) as string | null;
        if (saved && Array.isArray(saved) && saved.length > 0) {
            state.tabs = saved;
            state.activeTabId = active || (saved[0] ? saved[0].id : null);
            notify();
        }
    } catch { /* config not available yet */ }
}

// ─── Controller (React wrapper fed by shared state) ─────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createTabBarController(app: any) {
    return function TabBarController() {
        const [, forceUpdate] = useState(0);
        const appRef = useRef(app);

        useEffect(() => {
            const listener = () => forceUpdate(n => n + 1);
            state.listeners.add(listener);
            return () => { state.listeners.delete(listener); };
        }, []);

        // Save state on change
        useEffect(() => {
            saveTabs(appRef.current);
        }, [state.tabs, state.activeTabId]);

        const handleActivate = useCallback(async (tabId: string) => {
            state.activeTabId = tabId;
            notify();
            const tab = state.tabs.find(t => t.id === tabId);
            if (tab) {
                try { await app.api.invoke('editor:open', tab.path); } catch { /* */ }
            }
        }, []);

        const handleClose = useCallback((tabId: string) => {
            removeTab(tabId, app);
        }, []);

        const handleReorder = useCallback((tabs: TabItem[]) => {
            reorderTabs(tabs);
        }, []);

        return (
            <TabBar
                app={app}
                tabs={state.tabs}
                activeTabId={state.activeTabId}
                onActivate={handleActivate}
                onClose={handleClose}
                onReorder={handleReorder}
            />
        );
    };
}

// ─── Plugin class ───────────────────────────────────────────────────────────

export class TabBarPlugin extends SystemPlugin {
    readonly manifest: PluginManifest = {
        id: 'nh.features.tabbar',
        name: 'Tab Bar',
        version: '0.1.0',
        type: 'feature',
    };

    protected async onLoad(): Promise<void> {
        this.log('info', 'Loading...');

        // Load persisted tab state
        await loadTabs(this.app);

        // Register CSS
        this.injectStyles();

        // Register controller + zone
        const TabBarController = createTabBarController(this.app);
        await this.app.api.invoke('controller:register', 'tab-bar', TabBarController);
        await this.app.api.invoke('zone:register', 'tabbar', {
            component: 'tab-bar',
            priority: 100,
        });

        // ── Event subscriptions ──

        this.registerEvent('editor:file-opened', (payload) => {
            if (payload && typeof payload === 'object' && 'path' in payload) {
                addTab((payload as { path: string }).path);
            }
        });

        this.registerEvent('editor:file-closed', () => {
            clearAllTabs();
        });

        this.registerEvent('editor:path-changed', (payload) => {
            if (payload && typeof payload === 'object' && 'oldPath' in payload && 'newPath' in payload) {
                const p = payload as { oldPath: string; newPath: string };
                updateTabPath(p.oldPath, p.newPath);
            }
        });

        this.registerEvent('fs:deleted', (payload) => {
            if (payload && typeof payload === 'object' && 'path' in payload) {
                const { path, isDirectory } = payload as { path: string; isDirectory?: boolean };
                if (isDirectory) {
                    const toRemove = state.tabs.filter(
                        t => t.path.startsWith(path + '/') || t.path.startsWith(path + '\\')
                    );
                    toRemove.forEach(t => removeTabByPath(t.id, this.app));
                } else {
                    removeTabByPath(path, this.app);
                }
            }
        });

        this.registerEvent('fs:renamed', (payload) => {
            if (payload && typeof payload === 'object' && 'oldPath' in payload && 'newPath' in payload) {
                const p = payload as { oldPath: string; newPath: string };
                updateTabPath(p.oldPath, p.newPath);
                // Update children paths for directory renames
                const tabsToUpdate = state.tabs.filter(
                    t => t.path.startsWith(p.oldPath + '/') || t.path.startsWith(p.oldPath + '\\')
                );
                tabsToUpdate.forEach(t => {
                    const relative = t.path.slice(p.oldPath.length);
                    updateTabPath(t.id, p.newPath + relative);
                });
            }
        });

        // ── Context menu ──

        try {
            await this.app.api.invoke('context-menu:register', 'tabbar-tab', (payload: unknown) => {
                const data = payload as { tabId: string } | undefined;
                if (!data) return [];
                return [
                    {
                        type: 'action',
                        id: 'tab:close',
                        label: 'Close',
                        icon: 'x',
                        onClick: () => removeTab(data.tabId, this.app),
                    },
                    {
                        type: 'action',
                        id: 'tab:close-others',
                        label: 'Close Others',
                        icon: 'x-circle',
                        onClick: () => {
                            const keep = state.tabs.find(t => t.id === data.tabId);
                            if (keep) {
                                state.tabs = [keep];
                                state.activeTabId = keep.id;
                                notify();
                                this.app.api.invoke('editor:open', keep.path).catch(() => { });
                            }
                        },
                    },
                    {
                        type: 'action',
                        id: 'tab:close-all',
                        label: 'Close All',
                        icon: 'trash-2',
                        color: 'var(--nh-danger)',
                        onClick: () => clearAllTabs(),
                    },
                ];
            });
        } catch {
            this.log('warn', 'context-menu:register not available');
        }

        // ── Public APIs ──

        this.registerApi('tabbar:get-tabs', () => [...state.tabs]);
        this.registerApi('tabbar:get-active', () => state.activeTabId);
        this.registerApi('tabbar:close-tab', (tabId: unknown) => {
            if (typeof tabId === 'string') removeTab(tabId, this.app);
        });
        this.registerApi('tabbar:close-all', () => clearAllTabs());

        // Detect already-open file (plugin loads after editor)
        try {
            const activePath = await this.app.api.invoke('editor:get-active-path');
            if (activePath && state.tabs.length === 0) {
                addTab(activePath as string);
            }
        } catch {
            this.log('warn', 'Could not query active file path');
        }

        this.log('info', 'Loaded successfully');
    }

    protected async onUnload(): Promise<void> {
        this.log('info', 'Unloading...');
        await saveTabs(this.app);
        state.tabs = [];
        state.activeTabId = null;
        state.listeners.clear();
        this.log('info', 'Unloaded');
    }

    // ── CSS injection ──

    private styleEl: HTMLStyleElement | null = null;

    private injectStyles(): void {
        const css = `
.nh-tabbar {
    display: flex;
    align-items: center;
    padding: 4px 8px 0;
    min-height: 40px;
    max-height: 40px;
    user-select: none;
    gap: 2px;
    overflow: hidden;
    background: transparent;
}
.nh-tabbar__scroll {
    display: flex;
    align-items: center;
    overflow-x: auto;
    overflow-y: hidden;
    flex: 1;
    gap: 2px;
    scrollbar-width: none;
}
.nh-tabbar__scroll::-webkit-scrollbar { display: none; }
.nh-tabbar__tab {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 0 10px;
    height: 32px;
    min-width: 0;
    max-width: 200px;
    border-radius: 8px;
    cursor: pointer;
    position: relative;
    font-size: 12px;
    color: var(--nh-text-muted, #888);
    white-space: nowrap;
    background: transparent;
    border: none;
    flex-shrink: 0;
    transition: background 150ms, color 150ms, box-shadow 150ms;
    outline: none;
}
.nh-tabbar__tab:hover {
    background: var(--nh-bg-hover, #1E1E1E);
    color: var(--nh-text-primary, #e0e0e0);
}
.nh-tabbar__tab:focus-visible {
    box-shadow: 0 0 0 2px var(--nh-bg-main), 0 0 0 4px var(--nh-accent-primary);
}
.nh-tabbar__tab--active {
    background: var(--nh-bg-secondary, #1A1A1A);
    color: var(--nh-text-primary, #e0e0e0);
    box-shadow: var(--nh-panel-glow);
}
.nh-tabbar__tab--drag-over {
    border-left: 2px solid var(--nh-accent-primary, #7c5bf0);
}
.nh-tabbar__icon { flex-shrink: 0; opacity: 0.6; }
.nh-tabbar__tab--active .nh-tabbar__icon { opacity: 0.9; }
.nh-tabbar__label {
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
    min-width: 0;
}
.nh-tabbar__close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    min-width: 22px;
    border: none;
    background: transparent;
    color: var(--nh-text-muted, #888);
    cursor: pointer;
    border-radius: 6px;
    flex-shrink: 0;
    padding: 0;
    margin-left: 2px;
    opacity: 0;
    transition: opacity 0.1s, background 0.15s;
}
.nh-tabbar__tab:hover .nh-tabbar__close,
.nh-tabbar__tab--active .nh-tabbar__close { opacity: 1; }
.nh-tabbar__close:hover {
    background: var(--nh-bg-hover, rgba(255, 255, 255, 0.1));
    color: var(--nh-text-primary, #e0e0e0);
}`;
        this.styleEl = document.createElement('style');

        // CSP Nonce Support
        let nonce: string | undefined;
        const scripts = document.scripts;
        for (let i = 0; i < scripts.length; i++) {
            const script = scripts.item(i);
            if (script && script.nonce) {
                nonce = script.nonce;
                break;
            }
        }

        if (nonce) {
            this.styleEl.setAttribute('nonce', nonce);
        }

        this.styleEl.textContent = css;
        this.styleEl.setAttribute('data-plugin', 'nh.features.tabbar');
        document.head.appendChild(this.styleEl);
    }
}

export default TabBarPlugin;
