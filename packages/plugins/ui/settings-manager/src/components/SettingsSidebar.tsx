/**
 * @fileoverview SettingsSidebar Component - Tab list for settings
 * 
 * Renders a vertical list of settings tabs with icons and active state.
 * 
 * @module @notehub/settings-manager/components/SettingsSidebar
 */

import { useState, useEffect, type FC } from 'react';
import type { NotehubCore } from '@notehub/core';
import { SettingsRegistry } from '../logic/SettingsRegistry';
import type { SettingsTab } from '../types';

// ============================================================================
// Icon Renderer Helper
// ============================================================================

interface DynamicIconProps {
    name: string;
    app: NotehubCore;
    size?: number;
    className?: string;
}

const DynamicIcon: FC<DynamicIconProps> = ({ name, app, size = 18, className }) => {
    const iconResult = app.api.invoke('icon:get', name);

    // Check if the result is a valid React component (function or class)
    // The icon:get API might return an object or undefined on fallback
    if (!iconResult || typeof iconResult !== 'function') {
        return <span className={`${className} text-[var(--nh-text-muted)]`}>•</span>;
    }

    const IconComponent = iconResult as React.ElementType;
    return <IconComponent size={size} className={className} />;
};

// ============================================================================
// Props
// ============================================================================

interface SettingsSidebarProps {
    /** Currently active tab ID */
    activeTab: string;
    /** Callback when tab is clicked */
    onTabChange: (tabId: string) => void;
    /** Reference to NotehubCore for API access */
    app: NotehubCore;
}

// ============================================================================
// Component
// ============================================================================

/**
 * SettingsSidebar - Tab list for settings
 * 
 * Features:
 * - Renders tabs from SettingsRegistry
 * - Active state highlighting with accent color
 * - Dynamic icons via icon:get API
 * - Subscribes to registry changes
 */
export const SettingsSidebar: FC<SettingsSidebarProps> = ({
    activeTab,
    onTabChange,
    app
}) => {
    const [tabs, setTabs] = useState<SettingsTab[]>([]);

    // Load tabs from registry and subscribe to changes
    useEffect(() => {
        const registry = SettingsRegistry.getInstance();

        const updateTabs = () => {
            const structure = registry.getStructure();
            setTabs(structure.tabs);
        };

        updateTabs();

        const unsubscribe = registry.subscribe(updateTabs);
        return unsubscribe;
    }, []);

    return (
        <nav className="flex flex-col h-full">
            {/* Header */}
            <div className="px-5 py-4 border-b border-[var(--nh-border-subtle)]">
                <h1 className="text-lg font-semibold text-[var(--nh-text-primary)]">
                    Settings
                </h1>
            </div>

            {/* Tab List */}
            <div className="
                flex-1 overflow-y-auto py-2
                [&::-webkit-scrollbar]:w-1.5
                [&::-webkit-scrollbar-track]:bg-transparent
                [&::-webkit-scrollbar-thumb]:bg-[var(--nh-ring-focus)]
                [&::-webkit-scrollbar-thumb]:rounded-full
                hover:[&::-webkit-scrollbar-thumb]:bg-[var(--nh-accent-primary)]
            ">
                {tabs.length === 0 ? (
                    <div className="px-4 py-8 text-center text-sm text-[var(--nh-text-muted)]">
                        No settings registered
                    </div>
                ) : (
                    tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => onTabChange(tab.id)}
                            className={`
                                w-full flex items-center gap-3 px-5 py-2.5 text-left
                                transition-colors
                                ${activeTab === tab.id
                                    ? 'bg-[var(--nh-accent-primary)]/15 text-[var(--nh-accent-primary)] border-l-2 border-[var(--nh-accent-primary)]'
                                    : 'text-[var(--nh-text-secondary)] hover:bg-[var(--nh-bg-main)] hover:text-[var(--nh-text-primary)] border-l-2 border-transparent'
                                }
                            `}
                        >
                            <DynamicIcon
                                name={tab.icon}
                                app={app}
                                size={18}
                                className="shrink-0"
                            />
                            <span className="text-sm font-medium truncate">
                                {tab.label}
                            </span>
                        </button>
                    ))
                )}
            </div>
        </nav>
    );
};

export default SettingsSidebar;
