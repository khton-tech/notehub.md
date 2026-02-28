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
        return <span className={className} style={{ display: 'inline-block', width: size, height: size }} />;
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
const MODAL_DEFAULTS = {
    title: 'Settings',
    closeSettings: 'Close Settings',
    noSettings: 'No settings registered',
    builtin: 'Built-in',
    thirdParty: 'Third-party',
    selectCategory: 'Select a category from the sidebar',
    noSettingsInCategory: 'No settings in this category',
    noSettingsInGroup: 'No settings in this group',
};

export const SettingsModal: FC<SettingsModalProps> = ({ app, onClose }) => {
    const [structure, setStructure] = useState<SettingsStructure>({ tabs: [] });
    const [activeTabId, setActiveTabId] = useState<string | null>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const [strings, setStrings] = useState(MODAL_DEFAULTS);

    const loadStrings = useCallback(async () => {
        try {
            const t = (key: string) => app.api.invoke<string>('i18n:t', key);
            const results = await Promise.all([
                t('settings-manager.title'),
                t('settings-manager.close'),
                t('settings-manager.empty.noSettings'),
                t('settings-manager.categories.builtin'),
                t('settings-manager.categories.thirdParty'),
                t('settings-manager.empty.selectCategory'),
                t('settings-manager.empty.noSettingsInCategory'),
                t('settings-manager.empty.noSettingsInGroup'),
            ]);
            setStrings({
                title: results[0] ?? MODAL_DEFAULTS.title,
                closeSettings: results[1] ?? MODAL_DEFAULTS.closeSettings,
                noSettings: results[2] ?? MODAL_DEFAULTS.noSettings,
                builtin: results[3] ?? MODAL_DEFAULTS.builtin,
                thirdParty: results[4] ?? MODAL_DEFAULTS.thirdParty,
                selectCategory: results[5] ?? MODAL_DEFAULTS.selectCategory,
                noSettingsInCategory: results[6] ?? MODAL_DEFAULTS.noSettingsInCategory,
                noSettingsInGroup: results[7] ?? MODAL_DEFAULTS.noSettingsInGroup,
            });
        } catch { /* use defaults */ }
    }, [app]);

    useEffect(() => {
        loadStrings();
        app.events.on('i18n:language-changed', loadStrings);
        return () => app.events.off('i18n:language-changed', loadStrings);
    }, [app, loadStrings]);

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

    const coreTabs = structure.tabs.filter(t => t.category === 'core');
    const customTabs = structure.tabs.filter(t => t.category !== 'core');

    // ========================================================================
    // Render
    // ========================================================================

    return (
        <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[400] animate-[settingsFadeIn_0.2s_ease-out]"
            onClick={onClose}
        >
            {/* Modal Container */}
            <div
                className="
                    w-[800px] h-[600px] max-w-[90vw] max-h-[85vh]
                    bg-[var(--nh-glass-bg,rgba(20,20,20,0.85))] backdrop-blur-xl
                    rounded-2xl border border-[var(--nh-glass-border,rgba(255,255,255,0.08))]
                    shadow-[var(--nh-shadow-lg)] overflow-hidden flex flex-col
                    animate-[settingsSlideIn_0.25s_ease-out]
                "
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="
                    flex items-center justify-between px-5 py-4
                    border-b border-[var(--nh-border-secondary)]
                    bg-[var(--nh-bg-sidebar)]
                    shrink-0 z-10
                ">
                    <h1 className="text-lg font-semibold text-[var(--nh-text-primary)]">
                        {strings.title}
                    </h1>
                    <button
                        onClick={onClose}
                        className="
                            p-2 md:p-1.5 rounded-xl 
                            text-white/80 hover:text-white
                            hover:bg-[var(--nh-bg-hover)]
                            transition-all duration-200
                            flex items-center justify-center
                        "
                        aria-label="Close settings"
                    >
                        <X size={24} className="md:w-[18px] md:h-[18px]" strokeWidth={2.5} />
                    </button>
                </div>

                {/* Body */}
                <div className="flex flex-1 overflow-hidden">
                    {/* Sidebar */}
                    <nav className="
                        w-52 shrink-0 bg-[var(--nh-bg-sidebar)]/50
                        overflow-y-auto py-2
                        [&::-webkit-scrollbar]:w-1.5
                        [&::-webkit-scrollbar-track]:bg-transparent
                        [&::-webkit-scrollbar-thumb]:bg-[var(--nh-border-secondary)]
                        [&::-webkit-scrollbar-thumb]:rounded-full
                        hover:[&::-webkit-scrollbar-thumb]:bg-[var(--nh-accent-primary)]
                    ">
                        {/* Mobile Close Button - Only visible on small screens */}
                        <div className="md:hidden px-4 pb-4 mb-2 border-b border-[var(--nh-border-secondary)]">
                            <button
                                onClick={onClose}
                                className="
                                    w-full flex items-center justify-center gap-2
                                    p-2.5 rounded-xl 
                                    text-white/80 hover:text-white
                                    hover:bg-[var(--nh-bg-hover)]
                                    transition-all duration-200
                                "
                                aria-label="Close settings"
                            >
                                <X size={20} strokeWidth={2.5} />
                                <span className="text-sm font-medium">{strings.closeSettings}</span>
                            </button>
                        </div>

                        {structure.tabs.length === 0 ? (
                            <div className="px-4 py-8 text-center text-sm text-[var(--nh-text-muted)]">
                                {strings.noSettings}
                            </div>
                        ) : (
                            <div className="flex flex-col gap-4">
                                {coreTabs.length > 0 && (
                                    <div>
                                        <h3 className="px-4 pb-2 text-xs font-semibold text-[var(--nh-text-muted)] uppercase tracking-wider">
                                            {strings.builtin}
                                        </h3>
                                        <div>
                                            {coreTabs.map(tab => (
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
                                                    <DynamicIcon name={tab.icon} app={app} size={18} className="shrink-0" />
                                                    <span className="text-sm font-medium truncate">{tab.label}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {customTabs.length > 0 && (
                                    <div>
                                        <h3 className="px-4 pb-2 pt-2 text-xs font-semibold text-[var(--nh-text-muted)] uppercase tracking-wider border-t border-[var(--nh-border-subtle)]">
                                            {strings.thirdParty}
                                        </h3>
                                        <div>
                                            {customTabs.map(tab => (
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
                                                    <DynamicIcon name={tab.icon} app={app} size={18} className="shrink-0" />
                                                    <span className="text-sm font-medium truncate">{tab.label}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </nav>

                    {/* Content */}
                    <div
                        ref={contentRef}
                        className="
                            flex-1 overflow-y-auto bg-[var(--nh-bg-main)] p-6
                            [&::-webkit-scrollbar]:w-1.5
                            [&::-webkit-scrollbar-track]:bg-transparent
                            [&::-webkit-scrollbar-thumb]:bg-[var(--nh-ring-focus)]
                            [&::-webkit-scrollbar-thumb]:rounded-full
                            hover:[&::-webkit-scrollbar-thumb]:bg-[var(--nh-accent-primary)]
                        "
                    >
                        {!activeTab ? (
                            <div className="flex items-center justify-center h-full text-[var(--nh-text-muted)]">
                                {strings.selectCategory}
                            </div>
                        ) : activeTab.customView ? (
                            <div className="h-full">
                                <activeTab.customView />
                            </div>
                        ) : activeTab.groups.length === 0 ? (
                            <div className="flex items-center justify-center h-full text-[var(--nh-text-muted)]">
                                {strings.noSettingsInCategory}
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
                                                    {strings.noSettingsInGroup}
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
