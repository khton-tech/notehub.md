/**
 * @fileoverview SettingsLayout Component - Full-screen settings layout
 * 
 * Replaces the main editor layout when Settings is active.
 * Grid layout with sidebar on the left and content on the right.
 * 
 * @module @notehub/settings-manager/components/SettingsLayout
 */

import { useState, useEffect, useCallback, type FC } from 'react';
import type { NotehubCore } from '@notehub/core';
import { SettingsRegistry } from '../logic/SettingsRegistry';
import { SettingsSidebar } from './SettingsSidebar';
import { SettingsContent } from './SettingsContent';

// ============================================================================
// Props
// ============================================================================

interface SettingsLayoutProps {
    /** Reference to NotehubCore for API access */
    app?: NotehubCore;
}

// ============================================================================
// Component
// ============================================================================

/**
 * SettingsLayout - Full-screen settings layout
 * 
 * Features:
 * - Grid layout: 280px sidebar + flexible content
 * - Manages active tab state internally
 * - Close button returns to editor layout
 * - Keyboard navigation (Escape to close)
 */
export const SettingsLayout: FC<SettingsLayoutProps> = ({ app }) => {
    const [activeTab, setActiveTab] = useState<string>('');

    // Set initial active tab from first available
    useEffect(() => {
        const registry = SettingsRegistry.getInstance();
        const structure = registry.getStructure();

        if (structure.tabs.length > 0 && !activeTab) {
            setActiveTab(structure.tabs[0]?.id ?? '');
        }

        // Subscribe to changes in case tabs are registered after mount
        const unsubscribe = registry.subscribe(() => {
            const newStructure = registry.getStructure();
            if (!activeTab && newStructure.tabs.length > 0) {
                setActiveTab(newStructure.tabs[0]?.id ?? '');
            }
        });

        return unsubscribe;
    }, [activeTab]);

    // Handle keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                handleClose();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Return to editor layout
    const handleClose = useCallback(() => {
        if (app) {
            app.api.invoke('layout:set', 'editor');
        }
    }, [app]);

    // Handle tab change
    const handleTabChange = useCallback((tabId: string) => {
        setActiveTab(tabId);
    }, []);

    if (!app) {
        return (
            <div className="flex items-center justify-center h-screen w-screen bg-[var(--nh-bg-main)]">
                <span className="text-[var(--nh-text-muted)]">Loading settings...</span>
            </div>
        );
    }

    return (
        <div
            className="grid h-screen w-screen"
            style={{ gridTemplateColumns: '280px 1fr' }}
        >
            {/* Sidebar */}
            <div className="bg-[var(--nh-bg-sidebar)] border-r border-[var(--nh-border-subtle)] overflow-hidden">
                <SettingsSidebar
                    activeTab={activeTab}
                    onTabChange={handleTabChange}
                    app={app}
                />
            </div>

            {/* Content */}
            <div className="bg-[var(--nh-bg-main)] overflow-hidden">
                <SettingsContent
                    activeTab={activeTab}
                    app={app}
                    onClose={handleClose}
                />
            </div>
        </div>
    );
};

export default SettingsLayout;
