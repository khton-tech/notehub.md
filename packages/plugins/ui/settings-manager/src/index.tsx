/**
 * @fileoverview Settings Manager Plugin
 * 
 * Provides a metadata-driven settings UI for Notehub.md.
 * Other plugins register their settings, and this plugin renders the modal.
 * 
 * @module @notehub/settings-manager
 */

import type {
    IPlugin,
    PluginManifest,
    NotehubCore,
    SettingsTabDef,
    SettingsGroupDef,
    SettingsItemDef
} from '@notehub/core';
import { createRoot, type Root } from 'react-dom/client';
import { SettingsRegistry } from './logic/SettingsRegistry';
import { SettingsModal } from './components/SettingsModal';
import { SettingsLayout } from './components/SettingsLayout';
import type { SettingsStructure } from './types';

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
export class SettingsManagerPlugin implements IPlugin {
    readonly manifest: PluginManifest = {
        id: 'nh.ui.settings-manager',
        name: 'SettingsManager',
        version: '1.0.0',
        type: 'ui',
    };

    private app: NotehubCore | null = null;
    private modalContainer: HTMLDivElement | null = null;
    private modalRoot: Root | null = null;
    private isOpen = false;

    // ========================================================================
    // Logging
    // ========================================================================

    private log(level: 'info' | 'warn' | 'error', message: string): void {
        if (this.app) {
            this.app.api.invoke(`logger:${level}`, this.manifest.id, message);
        }
    }

    // ========================================================================
    // Plugin Lifecycle
    // ========================================================================

    async load(app: NotehubCore): Promise<void> {
        this.app = app;
        this.log('info', 'Loading...');

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
        app.api.register('settings:register-tab', (tab: SettingsTabDef) => {
            registry.registerTab(tab);
            this.log('info', `Registered tab: ${tab.id}`);
        });

        // Group registration
        app.api.register('settings:register-group', (group: SettingsGroupDef) => {
            registry.registerGroup(group);
            this.log('info', `Registered group: ${group.id}`);
        });

        // Item registration
        app.api.register('settings:register-item', (item: SettingsItemDef) => {
            registry.registerItem(item);
            this.log('info', `Registered item: ${item.key}`);
        });

        // Bulk registration
        app.api.register('settings:register-tabs', (tabs: SettingsTabDef[]) => {
            registry.registerTabs(tabs);
            this.log('info', `Registered ${tabs.length} tabs`);
        });

        app.api.register('settings:register-groups', (groups: SettingsGroupDef[]) => {
            registry.registerGroups(groups);
            this.log('info', `Registered ${groups.length} groups`);
        });

        app.api.register('settings:register-items', (items: SettingsItemDef[]) => {
            registry.registerItems(items);
            this.log('info', `Registered ${items.length} items`);
        });

        // ====================================================================
        // Unregister API Methods
        // ====================================================================

        app.api.register('settings:unregister-tab', (tabId: string) => {
            registry.unregisterTab(tabId);
            this.log('info', `Unregistered tab: ${tabId}`);
        });

        app.api.register('settings:unregister-group', (groupId: string) => {
            registry.unregisterGroup(groupId);
            this.log('info', `Unregistered group: ${groupId}`);
        });

        app.api.register('settings:unregister-item', (itemKey: string) => {
            registry.unregisterItem(itemKey);
            this.log('info', `Unregistered item: ${itemKey}`);
        });

        // Get structure
        app.api.register('settings:get-structure', (): SettingsStructure => {
            return registry.getStructure();
        });

        // Open/close modal
        app.api.register('settings:open', () => {
            this.openModal();
        });

        app.api.register('settings:close', () => {
            this.closeModal();
        });

        app.api.register('settings:toggle', () => {
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
        app.events.on('command:settings:open', () => {
            this.openModal();
        });

        // Register settings layout
        app.api.invoke('layout:register-component', 'settings', SettingsLayout);
        this.log('info', 'Registered settings layout');

        this.log('info', 'Loaded successfully');
    }

    async unload(_app: NotehubCore): Promise<void> {
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

        this.app = null;
        this.log('info', 'Unloaded');
    }

    // ========================================================================
    // Modal Control
    // ========================================================================

    private openModal(): void {
        if (!this.app || !this.modalRoot || this.isOpen) return;

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

        if (this.app) {
            this.app.events.emit('settings:closed', {});
            this.log('info', 'Settings modal closed');
        }
    }
}

// Default export for dynamic loading
export default SettingsManagerPlugin;
