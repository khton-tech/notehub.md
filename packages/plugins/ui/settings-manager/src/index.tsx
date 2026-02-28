/**
 * @fileoverview Settings Manager Plugin
 *
 * Provides a metadata-driven settings UI for Notehub.md.
 * Other plugins register their settings, and this plugin renders the modal.
 *
 * @module @notehub/settings-manager
 */

import { SystemPlugin } from '@notehub/core';
import type {
    PluginManifest,
    SettingsTabDef,
    SettingsGroupDef,
    SettingsItemDef
} from '@notehub/core';
import { createRoot, type Root } from 'react-dom/client';
import { SettingsRegistry } from './logic/SettingsRegistry';
import { SettingsModal } from './components/SettingsModal';
import { SettingsLayout } from './components/SettingsLayout';
import type { SettingsStructure } from './types';
import en from './locales/en';
import ru from './locales/ru';

// Re-export types for consumers
export * from './types';
export { SettingsRegistry, getSettingsRegistry } from './logic/SettingsRegistry';

/**
 * SettingsManagerPlugin - Metadata-driven settings UI engine
 *
 * Features:
 * - Registry API for plugins to register tabs, groups, and items
 * - Command `settings:open` to show the modal
 * - Obsidian/VS Code style settings interface
 */
export class SettingsManagerPlugin extends SystemPlugin {
    readonly manifest: PluginManifest = {
        id: 'nh.ui.settings-manager',
        name: 'SettingsManager',
        version: '1.0.0',
        type: 'ui',
    };

    private modalContainer: HTMLDivElement | null = null;
    private modalRoot: Root | null = null;
    private isOpen = false;

    // ========================================================================
    // Plugin Lifecycle
    // ========================================================================

    protected async onLoad(): Promise<void> {
        this.log('info', 'Loading...');

        // Register i18n namespace if i18n plugin is available
        try {
            this.app.api.invoke('i18n:register-namespace', 'settings-manager', {
                en: en['settings-manager'],
                ru: ru['settings-manager'],
            });
        } catch { /* i18n not available, components will use English defaults */ }

        // Create modal container
        this.modalContainer = document.createElement('div');
        this.modalContainer.id = 'nh-settings-modal-container';
        document.body.appendChild(this.modalContainer);
        this.modalRoot = createRoot(this.modalContainer);

        // Get registry instance
        const registry = SettingsRegistry.getInstance();

        // ====================================================================
        // Register API Methods
        // ====================================================================

        // Tab registration
        this.registerApi('settings:register-tab', (tab: SettingsTabDef) => {
            registry.registerTab(tab);
            this.log('info', `Registered tab: ${tab.id}`);
        });

        // Group registration
        this.registerApi('settings:register-group', (group: SettingsGroupDef) => {
            registry.registerGroup(group);
            this.log('info', `Registered group: ${group.id}`);
        });

        // Item registration
        this.registerApi('settings:register-item', (item: SettingsItemDef) => {
            registry.registerItem(item);
            this.log('info', `Registered item: ${item.key}`);
        });

        // Bulk registration
        this.registerApi('settings:register-tabs', (tabs: SettingsTabDef[]) => {
            registry.registerTabs(tabs);
            this.log('info', `Registered ${tabs.length} tabs`);
        });

        this.registerApi('settings:register-groups', (groups: SettingsGroupDef[]) => {
            registry.registerGroups(groups);
            this.log('info', `Registered ${groups.length} groups`);
        });

        this.registerApi('settings:register-items', (items: SettingsItemDef[]) => {
            registry.registerItems(items);
            this.log('info', `Registered ${items.length} items`);
        });

        // Custom View registration
        this.registerApi('settings:register-custom-view', (args: { tabId: string; view: React.FC<any> }) => {
            registry.registerCustomView(args.tabId, args.view);
            this.log('info', `Registered custom view for tab: ${args.tabId}`);
        });

        // ====================================================================
        // Unregister API Methods
        // ====================================================================

        this.registerApi('settings:unregister-tab', (tabId: string) => {
            registry.unregisterTab(tabId);
            this.log('info', `Unregistered tab: ${tabId}`);
        });

        this.registerApi('settings:unregister-group', (groupId: string) => {
            registry.unregisterGroup(groupId);
            this.log('info', `Unregistered group: ${groupId}`);
        });

        this.registerApi('settings:unregister-item', (itemKey: string) => {
            registry.unregisterItem(itemKey);
            this.log('info', `Unregistered item: ${itemKey}`);
        });

        // Get structure
        this.registerApi('settings:get-structure', (): SettingsStructure => {
            return registry.getStructure();
        });

        // Open/close modal
        this.registerApi('settings:open', () => {
            this.openModal();
        });

        this.registerApi('settings:close', () => {
            this.closeModal();
        });

        this.registerApi('settings:toggle', () => {
            if (this.isOpen) {
                this.closeModal();
            } else {
                this.openModal();
            }
        });

        // ====================================================================
        // Register Command
        // ====================================================================

        // Listen for settings:open command via events
        this.registerEvent('command:settings:open', () => {
            this.openModal();
        });

        // Register settings layout
        this.app.api.invoke('layout:register-component', 'settings', SettingsLayout);
        this.log('info', 'Registered settings layout');

        this.log('info', 'Loaded successfully');
    }

    protected async onUnload(): Promise<void> {
        this.log('info', 'Unloading...');

        // Cleanup modal
        this.closeModal();
        if (this.modalRoot) {
            this.modalRoot.unmount();
            this.modalRoot = null;
        }
        if (this.modalContainer) {
            this.modalContainer.remove();
            this.modalContainer = null;
        }

        // Clear registry
        SettingsRegistry.resetInstance();

        this.log('info', 'Unloaded');
    }

    // ========================================================================
    // Modal Control
    // ========================================================================

    private openModal(): void {
        if (!this.modalRoot || this.isOpen) return;

        this.isOpen = true;
        this.modalRoot.render(
            <SettingsModal
                app={this.app}
                onClose={() => this.closeModal()}
            />
        );

        this.app.events.emit('settings:opened', {});
        this.log('info', 'Settings modal opened');
    }

    private closeModal(): void {
        if (!this.modalRoot || !this.isOpen) return;

        this.isOpen = false;
        this.modalRoot.render(null);

        this.app.events.emit('settings:closed', {});
        this.log('info', 'Settings modal closed');
    }
}

// Default export for dynamic loading
export default SettingsManagerPlugin;
