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
 * - Grid layout: 280px sidebar + flexible content (Desktop)
 * - Master-Detail layout: Sidebar OR Content (Mobile)
 * - Manages active tab state internally
 * - Close button returns to editor layout
 * - Keyboard navigation (Escape to close)
 */
export const SettingsLayout: FC<SettingsLayoutProps> = ({ app }) => {
    const [activeTab, setActiveTab] = useState<string>('');
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(true);

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

    // Handle navigation logic
    const handleMobileClick = useCallback(() => {
        setIsMobileMenuOpen(false);
    }, []);

    const handleBack = useCallback(() => {
        setIsMobileMenuOpen(true);
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
            className="flex flex-col h-screen w-screen md:grid"
            style={{ gridTemplateColumns: '280px 1fr' }} // Inline styles apply only when display is grid (desktop)
        >
            {/* Sidebar (Master) */}
            <div className={`
                bg-[var(--nh-bg-sidebar)] border-r border-[var(--nh-border-subtle)] overflow-hidden
                ${!isMobileMenuOpen ? 'hidden' : 'w-full h-full'}
                md:block md:w-auto md:h-auto
            `}>
                <SettingsSidebar
                    activeTab={activeTab}
                    onTabChange={handleTabChange}
                    app={app}
                    onMobileClick={handleMobileClick}
                    onClose={handleClose}
                />
            </div>

            {/* Content (Detail) */}
            <div className={`
                bg-[var(--nh-bg-main)] overflow-hidden
                ${isMobileMenuOpen ? 'hidden' : 'w-full h-full'}
                md:block md:w-auto md:h-auto
            `}>
                <SettingsContent
                    activeTab={activeTab}
                    app={app}
                    onClose={handleClose}
                    onBack={handleBack}
                />
            </div>
        </div>
    );
};

export default SettingsLayout;
