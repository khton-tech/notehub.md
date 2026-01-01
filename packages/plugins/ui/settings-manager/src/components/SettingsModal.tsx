/**
 * @fileoverview SettingsModal Component - Main settings UI
 * 
 * Renders a full-screen modal with sidebar tabs and scrollable content.
 * Styled to match Obsidian/VS Code aesthetics.
 * 
 * @module @notehub/settings-manager/components/SettingsModal
 */

import { useState, useEffect, useCallback, useRef, type FC } from 'react';
import type { NotehubCore } from '@notehub/core';
import { X } from 'lucide-react';
import { SettingsRegistry } from '../logic/SettingsRegistry';
import type { SettingsStructure } from '../types';
import { SettingField } from './SettingField';

// ============================================================================
// Props
// ============================================================================

interface SettingsModalProps {
    /** Reference to NotehubCore for API access */
    app: NotehubCore;
    /** Callback when modal should close */
    onClose: () => void;
}

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
    const IconComponent = app.api.invoke('icon:get', name) as unknown as React.ElementType | undefined;

    if (!IconComponent) {
        return <span className={className}>?</span>;
    }

    return <IconComponent size={size} className={className} />;
};

// ============================================================================
// Component
// ============================================================================

/**
 * SettingsModal - Full settings UI modal
 * 
 * Features:
 * - Dark sidebar with tab icons
 * - Scrollable content area with groups
 * - Subscribes to registry changes
 * - Keyboard navigation (Escape to close)
 */
export const SettingsModal: FC<SettingsModalProps> = ({ app, onClose }) => {
    const [structure, setStructure] = useState<SettingsStructure>({ tabs: [] });
    const [activeTabId, setActiveTabId] = useState<string | null>(null);
    const contentRef = useRef<HTMLDivElement>(null);

    // ========================================================================
    // Load structure from registry
    // ========================================================================

    useEffect(() => {
        const registry = SettingsRegistry.getInstance();

        const updateStructure = () => {
            const newStructure = registry.getStructure();
            setStructure(newStructure);

            // Set first tab as active if none selected
            const firstTab = newStructure.tabs[0];
            if (!activeTabId && firstTab) {
                setActiveTabId(firstTab.id);
            }
        };

        updateStructure();

        // Subscribe to registry changes
        const unsubscribe = registry.subscribe(updateStructure);

        return unsubscribe;
    }, [activeTabId]);

    // ========================================================================
    // Keyboard handling
    // ========================================================================

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    // ========================================================================
    // Tab selection
    // ========================================================================

    const handleTabClick = useCallback((tabId: string) => {
        setActiveTabId(tabId);
        // Scroll content to top when switching tabs
        if (contentRef.current) {
            contentRef.current.scrollTop = 0;
        }
    }, []);

    // ========================================================================
    // Get active tab data
    // ========================================================================

    const activeTab = structure.tabs.find(tab => tab.id === activeTabId);

    // ========================================================================
    // Render
    // ========================================================================

    return (
        <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[9999] animate-[settingsFadeIn_0.2s_ease-out]"
            onClick={onClose}
        >
            {/* Modal Container */}
            <div
                className="
                    w-[800px] h-[600px] max-w-[90vw] max-h-[85vh]
                    bg-[var(--nh-bg-surface)] rounded-xl border border-[var(--nh-border-secondary)]
                    shadow-2xl overflow-hidden flex flex-col
                    animate-[settingsSlideIn_0.2s_ease-out]
                "
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="
                    flex items-center justify-between px-5 py-4
                    border-b border-[var(--nh-border-secondary)]
                    bg-[var(--nh-bg-sidebar)]
                ">
                    <h1 className="text-lg font-semibold text-[var(--nh-text-primary)]">
                        Settings
                    </h1>
                    <button
                        onClick={onClose}
                        className="
                            p-1.5 rounded-md text-[var(--nh-text-muted)]
                            hover:text-[var(--nh-text-primary)] hover:bg-[var(--nh-bg-main)]
                            transition-colors
                        "
                        aria-label="Close settings"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Body */}
                <div className="flex flex-1 overflow-hidden">
                    {/* Sidebar */}
                    <nav className="
                        w-52 shrink-0 bg-[var(--nh-bg-sidebar)] border-r border-[var(--nh-border-secondary)]
                        overflow-y-auto py-2
                    ">
                        {structure.tabs.length === 0 ? (
                            <div className="px-4 py-8 text-center text-sm text-[var(--nh-text-muted)]">
                                No settings registered
                            </div>
                        ) : (
                            structure.tabs.map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => handleTabClick(tab.id)}
                                    className={`
                                        w-full flex items-center gap-3 px-4 py-2.5 text-left
                                        transition-colors
                                        ${activeTabId === tab.id
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
                    </nav>

                    {/* Content */}
                    <div
                        ref={contentRef}
                        className="flex-1 overflow-y-auto bg-[var(--nh-bg-main)] p-6"
                    >
                        {!activeTab ? (
                            <div className="flex items-center justify-center h-full text-[var(--nh-text-muted)]">
                                Select a category from the sidebar
                            </div>
                        ) : activeTab.groups.length === 0 ? (
                            <div className="flex items-center justify-center h-full text-[var(--nh-text-muted)]">
                                No settings in this category
                            </div>
                        ) : (
                            <div className="space-y-8">
                                {activeTab.groups.map(group => (
                                    <section key={group.id}>
                                        {/* Group Header */}
                                        <h2 className="
                                            text-xs font-semibold uppercase tracking-wider
                                            text-[var(--nh-text-muted)] mb-3 pb-2
                                            border-b border-[var(--nh-border-subtle)]
                                        ">
                                            {group.label}
                                        </h2>

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
                        )}
                    </div>
                </div>
            </div>

            {/* CSS Keyframes */}
            <style>{`
                @keyframes settingsFadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes settingsSlideIn {
                    from { 
                        transform: scale(0.95) translateY(-10px); 
                        opacity: 0; 
                    }
                    to { 
                        transform: scale(1) translateY(0); 
                        opacity: 1; 
                    }
                }
            `}</style>
        </div>
    );
};

export default SettingsModal;
