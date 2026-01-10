/**
 * @fileoverview SettingsContent Component - Main content area for settings
 * 
 * Renders groups and items for the active settings tab.
 * 
 * @module @notehub/settings-manager/components/SettingsContent
 */

import { useState, useEffect, type FC } from 'react';
import type { NotehubCore } from '@notehub/core';
import { X, ChevronLeft } from 'lucide-react';
import { SettingsRegistry } from '../logic/SettingsRegistry';
import type { SettingsStructure } from '../types';
import { SettingField } from './SettingField';

// ============================================================================
// Props
// ============================================================================

interface SettingsContentProps {
    /** Currently active tab ID */
    activeTab: string;
    /** Reference to NotehubCore for API access */
    app: NotehubCore;
    /** Callback when close button is clicked */
    onClose: () => void;
    /** Callback when back button is clicked (mobile only) */
    onBack?: () => void;
}

// ============================================================================
// Component
// ============================================================================

/**
 * SettingsContent - Main content area for settings
 * 
 * Features:
 * - Header with tab label and close button
 * - Renders groups and items for active tab
 * - Uses SettingField for individual settings
 * - Subscribes to registry changes
 */
export const SettingsContent: FC<SettingsContentProps> = ({
    activeTab,
    app,
    onClose,
    onBack
}) => {
    const [structure, setStructure] = useState<SettingsStructure>({ tabs: [] });

    // Load structure from registry and subscribe to changes
    useEffect(() => {
        const registry = SettingsRegistry.getInstance();

        const updateStructure = () => {
            setStructure(registry.getStructure());
        };

        updateStructure();

        const unsubscribe = registry.subscribe(updateStructure);
        return unsubscribe;
    }, []);

    // Get data for active tab
    const tabData = structure.tabs.find(tab => tab.id === activeTab);

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <header className="
                flex items-center justify-between px-4 py-4 md:px-8
                border-b border-[var(--nh-border-subtle)]
                bg-[var(--nh-bg-main)]
            ">
                <div className="flex items-center flex-1 shadow-sm min-w-0">
                    {/* Mobile Back Button */}
                    <button
                        onClick={onBack}
                        className="
                            md:hidden mr-2 p-1.5 -ml-2 rounded-md
                            text-[var(--nh-text-secondary)]
                            hover:text-[var(--nh-text-primary)] hover:bg-[var(--nh-bg-surface)]
                            transition-colors
                        "
                        aria-label="Back to menu"
                    >
                        <ChevronLeft size={20} />
                    </button>

                    <h2 className="text-lg font-semibold text-[var(--nh-text-primary)] truncate">
                        {tabData?.label || 'Settings'}
                    </h2>
                </div>

                <button
                    onClick={onClose}
                    className="
                        p-1.5 rounded-md text-[var(--nh-text-muted)]
                        hover:text-[var(--nh-text-primary)] hover:bg-[var(--nh-bg-surface)]
                        transition-colors ml-4
                    "
                    aria-label="Close settings"
                >
                    <X size={18} />
                </button>
            </header>

            {/* Content */}
            <div className="
                flex-1 overflow-y-auto p-4 md:p-8
                [&::-webkit-scrollbar]:w-1.5
                [&::-webkit-scrollbar-track]:bg-transparent
                [&::-webkit-scrollbar-thumb]:bg-[var(--nh-ring-focus)]
                [&::-webkit-scrollbar-thumb]:rounded-full
                hover:[&::-webkit-scrollbar-thumb]:bg-[var(--nh-accent-primary)]
            ">
                {!tabData ? (
                    <div className="flex items-center justify-center h-full text-[var(--nh-text-muted)]">
                        Select a category from the sidebar
                    </div>
                ) : (
                    (() => {
                        const registry = SettingsRegistry.getInstance();
                        const CustomView = registry.getCustomView(tabData.id);

                        if (CustomView) {
                            return <CustomView app={app} />;
                        }

                        return (
                            tabData.groups.length === 0 ? (
                                <div className="flex items-center justify-center h-full text-[var(--nh-text-muted)]">
                                    No settings in this category
                                </div>
                            ) : (
                                <div className="space-y-8 max-w-3xl mx-auto md:mx-0">
                                    {tabData.groups.map(group => (
                                        <section key={group.id}>
                                            {/* Group Header */}
                                            <h3 className="
                                                text-xs font-semibold uppercase tracking-wider
                                                text-[var(--nh-text-muted)] mb-3 pb-2
                                                border-b border-[var(--nh-border-subtle)]
                                            ">
                                                {group.label}
                                            </h3>

                                            {/* Group Items */}
                                            <div className="bg-[var(--nh-bg-surface)] rounded-lg px-4">
                                                {group.items.length === 0 ? (
                                                    <div className="py-4 text-sm text-[var(--nh-text-muted)]">
                                                        No settings in this group
                                                    </div>
                                                ) : (
                                                    group.items.map(item => (
                                                        <SettingField
                                                            key={item.key}
                                                            item={item}
                                                            app={app}
                                                        />
                                                    ))
                                                )}
                                            </div>
                                        </section>
                                    ))}
                                </div>
                            )
                        );
                    })()
                )}
            </div>
        </div>
    );
};

export default SettingsContent;
