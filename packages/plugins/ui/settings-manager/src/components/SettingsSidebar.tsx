/**
 * @fileoverview SettingsSidebar Component - Tab list for settings
 * 
 * Renders a vertical list of settings tabs with icons and active state.
 * 
 * @module @notehub/settings-manager/components/SettingsSidebar
 */

import { useState, useEffect, useCallback, type FC } from 'react';
import type { NotehubCore } from '@notehub/core';
import { X } from 'lucide-react';
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
    /** Callback when a tab is selected on mobile */
    onMobileClick?: () => void;
    /** Callback to close settings */
    onClose?: () => void;
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
 * - Close button for mobile
 */
const SIDEBAR_DEFAULTS = {
    title: 'Settings',
    noSettings: 'No settings registered',
    builtin: 'Built-in',
    thirdParty: 'Third-party',
};

export const SettingsSidebar: FC<SettingsSidebarProps> = ({
    activeTab,
    onTabChange,
    app,
    onMobileClick,
    onClose
}) => {
    const [tabs, setTabs] = useState<SettingsTab[]>([]);
    const [strings, setStrings] = useState(SIDEBAR_DEFAULTS);

    const loadStrings = useCallback(async () => {
        try {
            const t = (key: string) => app.api.invoke<string>('i18n:t', key);
            const results = await Promise.all([
                t('settings-manager.title'),
                t('settings-manager.empty.noSettings'),
                t('settings-manager.categories.builtin'),
                t('settings-manager.categories.thirdParty'),
            ]);
            setStrings({
                title: results[0] ?? SIDEBAR_DEFAULTS.title,
                noSettings: results[1] ?? SIDEBAR_DEFAULTS.noSettings,
                builtin: results[2] ?? SIDEBAR_DEFAULTS.builtin,
                thirdParty: results[3] ?? SIDEBAR_DEFAULTS.thirdParty,
            });
        } catch { /* use defaults */ }
    }, [app]);

    useEffect(() => {
        loadStrings();
        app.events.on('i18n:language-changed', loadStrings);
        return () => app.events.off('i18n:language-changed', loadStrings);
    }, [app, loadStrings]);

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

    const handleTabClick = (tabId: string) => {
        onTabChange(tabId);
        onMobileClick?.();
    };

    const coreTabs = tabs.filter(t => t.category === 'core');
    const customTabs = tabs.filter(t => t.category !== 'core');

    return (
        <nav className="flex flex-col h-full">
            {/* Header with Close Button */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--nh-border-subtle)]">
                <h1 className="text-lg font-semibold text-[var(--nh-text-primary)]">
                    {strings.title}
                </h1>
                {onClose && (
                    <button
                        onClick={onClose}
                        className="
                            p-2 rounded-xl text-[var(--nh-text-muted)]
                            hover:text-white hover:bg-[var(--nh-bg-hover)]
                            transition-all duration-200
                        "
                        aria-label="Close settings"
                    >
                        <X size={20} strokeWidth={2.5} />
                    </button>
                )}
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
                        {strings.noSettings}
                    </div>
                ) : (
                    <div className="flex flex-col gap-4">
                        {coreTabs.length > 0 && (
                            <div>
                                <h3 className="px-5 pb-2 text-xs font-semibold text-[var(--nh-text-muted)] uppercase tracking-wider">
                                    {strings.builtin}
                                </h3>
                                <div>
                                    {coreTabs.map(tab => (
                                        <button
                                            key={tab.id}
                                            onClick={() => handleTabClick(tab.id)}
                                            className={`
                                                w-full flex items-center gap-3 px-5 py-2.5 text-left
                                                transition-colors
                                                ${activeTab === tab.id
                                                    ? 'bg-[var(--nh-accent-primary)]/15 text-[var(--nh-accent-primary)] border-l-2 border-[var(--nh-accent-primary)]'
                                                    : 'text-[var(--nh-text-secondary)] hover:bg-[var(--nh-bg-hover)] hover:text-[var(--nh-text-primary)] border-l-2 border-transparent'
                                                }
                                            `}
                                        >
                                            <DynamicIcon name={tab.icon} app={app} size={18} className="shrink-0" />
                                            <span className="text-sm font-medium truncate">{tab.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {customTabs.length > 0 && (
                            <div>
                                <h3 className="px-5 pb-2 pt-2 text-xs font-semibold text-[var(--nh-text-muted)] uppercase tracking-wider border-t border-[var(--nh-border-subtle)]">
                                    {strings.thirdParty}
                                </h3>
                                <div>
                                    {customTabs.map(tab => (
                                        <button
                                            key={tab.id}
                                            onClick={() => handleTabClick(tab.id)}
                                            className={`
                                                w-full flex items-center gap-3 px-5 py-2.5 text-left
                                                transition-colors
                                                ${activeTab === tab.id
                                                    ? 'bg-[var(--nh-accent-primary)]/15 text-[var(--nh-accent-primary)] border-l-2 border-[var(--nh-accent-primary)]'
                                                    : 'text-[var(--nh-text-secondary)] hover:bg-[var(--nh-bg-hover)] hover:text-[var(--nh-text-primary)] border-l-2 border-transparent'
                                                }
                                            `}
                                        >
                                            <DynamicIcon name={tab.icon} app={app} size={18} className="shrink-0" />
                                            <span className="text-sm font-medium truncate">{tab.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </nav>
    );
};

export default SettingsSidebar;
