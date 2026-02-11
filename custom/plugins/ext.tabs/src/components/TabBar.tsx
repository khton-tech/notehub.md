
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { PluginContext } from '@notehub/api';
import { Icon } from 'lucide-react';

interface TabBarProps {
    ctx: PluginContext;
}

const EXTENSIONS = ['.md', '.markdown', '.txt', '.json', '.js', '.ts', '.tsx', '.jsx'];

export const TabBar: React.FC<TabBarProps> = ({ ctx }) => {
    const [tabs, setTabs] = useState<string[]>([]);
    const [activeTab, setActiveTab] = useState<string | null>(null);

    // Initial load from storage
    useEffect(() => {
        const loadState = async () => {
            try {
                const storedTabs = await ctx.storage.get<string[]>('open-tabs');
                if (storedTabs && Array.isArray(storedTabs)) {
                    setTabs(storedTabs);
                }
                const storedActive = await ctx.storage.get<string>('active-tab');
                if (storedActive) {
                    setActiveTab(storedActive);
                }
            } catch (e) {
                console.error('[TabBar] Failed to load state', e);
            }
        };
        loadState();
    }, [ctx]);

    // Save state helper
    const saveState = useCallback(async (newTabs: string[], newActive: string | null) => {
        if (!ctx) return;
        try {
            await ctx.storage.set('open-tabs', newTabs);
            await ctx.storage.set('active-tab', newActive);
        } catch (e) {
            console.error('[TabBar] Failed to save state', e);
        }
    }, [ctx]);

    // Handle file opened event
    useEffect(() => {
        const handleFileOpened = (payload: any) => {
            const path = typeof payload === 'string' ? payload : payload?.path;
            if (!path) return;

            setTabs(prev => {
                let newTabs = prev;
                if (!prev.includes(path)) {
                    newTabs = [...prev, path];
                }

                // If we changed tabs, save
                if (newTabs !== prev) {
                    saveState(newTabs, path);
                } else {
                    // Just update active tab storage
                    ctx.storage.set('active-tab', path);
                }

                return newTabs;
            });
            setActiveTab(path);
        };

        // Subscribe with low priority to ensure other listeners run first? 
        // Actually default is fine.
        ctx.subscribe('editor:file-opened', handleFileOpened);

        // Also check current active path on mount, in case we missed event
        ctx.invokeApi<string | null>('editor:get-active-path').then(path => {
            if (path) handleFileOpened(path);
        });

    }, [ctx, saveState]);

    const handleTabClick = async (path: string) => {
        if (path === activeTab) return;
        try {
            await ctx.invokeApi('editor:open', path);
        } catch (e) {
            console.error('[TabBar] Failed to open file', e);
        }
    };

    const handleTabClose = async (e: React.MouseEvent, path: string) => {
        e.stopPropagation();

        const newTabs = tabs.filter(t => t !== path);
        let newActive = activeTab;

        if (activeTab === path) {
            // We are closing the active tab
            // Try to switch to the one before it, or after it
            const idx = tabs.indexOf(path);
            let nextPath: string | null = null;

            if (newTabs.length > 0) {
                // If there was a prev one, go there (like Chrome)
                // If idx was 0 (first), go to new first (which was second)
                // If idx > 0, go to idx - 1
                const nextIdx = idx > 0 ? idx - 1 : 0;
                nextPath = newTabs[nextIdx];
            }

            if (nextPath) {
                newActive = nextPath;
                await ctx.invokeApi('editor:open', nextPath);
            } else {
                newActive = null;
                // How to clear editor? There is no editor:close API that clears.
                // Maybe enable empty state?
                // For now, just leave it or maybe open a default 'start' page if we had one.
                // We'll leave the editor showing the last file but tab bar empty? 
                // Or we can try to invoke an internal method if we knew one.
            }
        }

        setTabs(newTabs);
        setActiveTab(newActive);
        saveState(newTabs, newActive);
    };

    const getBasename = (path: string) => {
        // Handle Windows and Unix paths
        return path.split(/[/\\]/).pop() || path;
    };

    if (tabs.length === 0) return null;

    return (
        <div className="tab-bar-container">
            <style>{`
                .tab-bar-container {
                    display: flex;
                    flex-direction: row;
                    background-color: var(--nh-bg-sidebar);
                    border-bottom: 1px solid var(--nh-border-subtle);
                    overflow-x: auto;
                    height: 36px;
                    align-items: flex-end;
                }
                
                /* Hide scrollbar */
                .tab-bar-container::-webkit-scrollbar {
                    height: 4px;
                }
                .tab-bar-container::-webkit-scrollbar-thumb {
                    background: var(--nh-border-subtle);
                    border-radius: 2px;
                }

                .tab-item {
                    display: flex;
                    align-items: center;
                    height: 36px;
                    padding: 0 10px;
                    max-width: 200px;
                    min-width: 80px;
                    cursor: pointer;
                    user-select: none;
                    background-color: var(--nh-bg-sidebar);
                    border-right: 1px solid var(--nh-border-subtle);
                    color: var(--nh-text-muted);
                    font-size: 13px;
                    position: relative;
                    transition: all 0.1s ease;
                }

                .tab-item:hover {
                    background-color: var(--nh-bg-hover);
                }

                .tab-item.active {
                    background-color: var(--nh-bg-main);
                    color: var(--nh-text-primary);
                    border-top: 2px solid var(--nh-accent-primary);
                }

                .tab-label {
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    margin-right: 6px;
                }

                .tab-close {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 16px;
                    height: 16px;
                    border-radius: 2px;
                    opacity: 0;
                    margin-left: auto;
                }

                .tab-item:hover .tab-close,
                .tab-item.active .tab-close {
                    opacity: 0.7;
                }

                .tab-close:hover {
                    opacity: 1 !important;
                    background-color: var(--nh-bg-secondary);
                    color: var(--nh-text-error, #ff5555);
                }
            `}</style>

            {tabs.map(path => (
                <div
                    key={path}
                    className={`tab-item ${path === activeTab ? 'active' : ''}`}
                    onClick={() => handleTabClick(path)}
                    title={path}
                >
                    <span className="tab-label">{getBasename(path)}</span>
                    <div
                        className="tab-close"
                        onClick={(e) => handleTabClose(e, path)}
                    >
                        <Icon size={12} name="x" />
                    </div>
                </div>
            ))}
        </div>
    );
};

export default TabBar;
