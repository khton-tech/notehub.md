/**
 * @fileoverview Synapse Plugin - External Extension Loader
 *
 * @module nh.system.synapse
 */

import 'systemjs';
import { SystemPlugin } from '@notehub/core';
import type { PluginManifest } from '@notehub/core';
import { initSharedScope } from './logic/ScopeInitializer.js';
import { PluginLoader } from './logic/PluginLoader.js';
import { PluginManagerView } from './components/PluginManagerView.js';

// Re-export types for consumers
export * from './types.js';
export { initSharedScope, isScopeInitialized } from './logic/ScopeInitializer.js';
export { PluginLoader } from './logic/PluginLoader.js';
export { ZipLoader, type NhpLoadResult } from './logic/ZipLoader.js';

/**
 * SynapsePlugin - System plugin for external extension loading
 */
export class SynapsePlugin extends SystemPlugin {
    readonly manifest: PluginManifest = {
        id: 'nh.system.synapse',
        name: 'Synapse',
        version: '0.0.0',
        type: 'system',
    };

    private loader: PluginLoader | null = null;
    private watcherUnsubscribe: (() => void) | null = null;
    private pendingEvents: Map<string, { path: string; type: string }> = new Map();
    private debounceTimer: ReturnType<typeof setTimeout> | null = null;

    protected async onLoad(): Promise<void> {
        this.log('info', 'Loading Synapse Engine...');

        try {
            // Initialize SystemJS shared scope with React, ReactDOM, @notehub/core
            initSharedScope();
            this.log('info', 'Shared scope initialized');

            // Create plugin loader instance
            this.loader = new PluginLoader(this.app);

            // Register API methods for programmatic plugin loading
            this.registerApi('synapse:load-plugin', this.loadExternalPlugin.bind(this));
            this.registerApi('synapse:unload-plugin', this.unloadExternalPlugin.bind(this));
            this.registerApi('synapse:list-plugins', this.listLoadedPlugins.bind(this));
            this.registerApi('synapse:get-details', this.getPluginsDetails.bind(this));

            // Subscribe to vault-opened event to scan for external plugins
            this.registerEvent('app:vault-opened', this.handleVaultOpened);
            this.log('info', 'Subscribed to app:vault-opened event');

            this.log('info', 'Synapse Engine loaded successfully');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.log('error', `Failed to initialize Synapse: ${errorMessage}`);
            throw error;
        }
    }

    /**
     * Handle vault opened event
     */
    private handleVaultOpened = async (payload: unknown): Promise<void> => {
        const eventData = payload as { path?: string; name?: string } | undefined;
        const vaultPath = eventData?.path;

        if (!vaultPath) {
            this.log('warn', 'Vault opened event received but no path in payload');
            return;
        }

        this.log('info', `Vault opened: ${vaultPath}, scanning for external plugins...`);
        try {
            await this.loader?.scan(vaultPath);
            await this.loader?.loadAll();
            await this.startWatching(vaultPath);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.log('error', `Error scanning for external plugins: ${errorMessage}`);
        }
    };

    protected async onPluginReady(): Promise<void> {
        this.log('info', 'Synapse onReady: scanning for external plugins...');

        try {
            // Register Settings UI
            this.app.api.invoke('settings:register-tab', {
                id: 'plugins',
                label: 'Plugins',
                order: 100,
                icon: 'package'
            });

            // Register custom view for the plugins tab
            this.app.api.invoke('settings:register-custom-view', {
                tabId: 'plugins',
                view: PluginManagerView
            });

            // Get current vault path from state
            const vaultPath = (await this.app.api.invoke('state:get', 'vault.current-path')) as string | undefined;

            if (!vaultPath) {
                this.log('info', 'No vault currently open, skipping external plugin scan');
                return;
            }

            await this.loader!.scan(vaultPath);
            await this.loader!.loadAll();
            await this.startWatching(vaultPath);

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.log('error', `Error during external plugin scan: ${errorMessage}`);
        }
    }

    protected async onUnload(): Promise<void> {
        this.log('info', 'Unloading Synapse Engine...');

        // Unload all external plugins
        if (this.loader) {
            await this.loader.unloadAll();
        }

        this.stopWatching();
        this.loader = null;
        this.log('info', 'Synapse Engine unloaded');
    }

    private async startWatching(vaultPath: string): Promise<void> {
        this.stopWatching();

        const pluginsDir = `${vaultPath}/.notehub/plugins`;
        const dirExists = await this.app.api.invoke('fs:exists', pluginsDir);
        if (!dirExists) return;

        try {
            this.log('info', `Starting plugin watcher on ${pluginsDir}`);
            this.watcherUnsubscribe = await this.app.api.invoke('fs:watch', pluginsDir, (event: any) => this.handleFsEvent(event)) as (() => void);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.log('error', `Failed to start plugin watcher: ${errorMessage}`);
        }
    }

    private stopWatching(): void {
        if (this.watcherUnsubscribe) {
            try {
                this.watcherUnsubscribe();
                this.log('info', 'Stopped plugin watcher');
            } catch (error) {
                // Ignore errors during cleanup
            }
            this.watcherUnsubscribe = null;
        }

        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }
        this.pendingEvents.clear();
    }

    private handleFsEvent(event: { path: string; type: string }): void {
        if (!event.path || !event.type) return;
        this.pendingEvents.set(event.path, event);
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        this.debounceTimer = setTimeout(() => {
            this.processPendingEvents();
        }, 500);
    }

    private async processPendingEvents(): Promise<void> {
        if (!this.loader) return;
        const events = Array.from(this.pendingEvents.values());
        this.pendingEvents.clear();
        this.debounceTimer = null;
        for (const event of events) {
            await this.processFsEvent(event);
        }
    }

    /**
     * Wait for a file to become stable (fully written to disk).
     * Retries fs:exists checks with intervals to confirm the file is ready.
     */
    private async waitForFileStability(path: string, maxRetries = 5, intervalMs = 200): Promise<boolean> {
        for (let i = 0; i < maxRetries; i++) {
            await new Promise(r => setTimeout(r, intervalMs));
            try {
                const exists = await this.app.api.invoke('fs:exists', path);
                if (exists) return true;
            } catch { /* file not ready yet */ }
        }
        return false;
    }

    private async processFsEvent(event: { path: string; type: string }): Promise<void> {
        const { path, type } = event;
        const normalizedPath = path.replace(/\\/g, '/');
        this.log('info', `Processing FS event: ${type} on ${normalizedPath}`);
        const affectedPluginId = this.loader!.getPluginIdByPath(normalizedPath);

        if (type === 'remove') {
            if (affectedPluginId) {
                this.log('info', `Detected removal of plugin ${affectedPluginId}`);
                await this.loader!.unloadPlugin(affectedPluginId);
            }
            return;
        }

        if (type === 'create' || type === 'modify') {
            if (affectedPluginId) {
                this.log('info', `Hot reloading plugin ${affectedPluginId}...`);
                const record = this.loader!.getLoadedPlugin(affectedPluginId);
                const sourcePath = record?.sourcePath;
                await this.loader!.unloadPlugin(affectedPluginId);
                if (sourcePath) {
                    const stable = await this.waitForFileStability(sourcePath);
                    if (stable) {
                        await this.loadPluginByPath(sourcePath);
                    } else {
                        this.log('warn', `File not stable after retries, skipping reload: ${sourcePath}`);
                    }
                }
                return;
            }

            if (normalizedPath.endsWith('.nhp')) {
                await this.loadPluginByPath(normalizedPath);
                return;
            }

            if (normalizedPath.endsWith('/manifest.json')) {
                const pluginDir = normalizedPath.substring(0, normalizedPath.lastIndexOf('/'));
                await this.loadPluginByPath(pluginDir);
                return;
            }
        }
    }

    private async loadPluginByPath(path: string): Promise<void> {
        if (!this.loader) return;
        if (path.endsWith('.nhp')) {
            try {
                const buffer = await this.app.api.invoke('fs:read-file', path) as Uint8Array;
                const arrayBuffer = new Uint8Array(buffer).buffer;
                await this.loader.loadFromNhp(arrayBuffer, path);
            } catch (err) {
                this.log('error', `Hot load failed for NHP ${path}: ${err}`);
            }
        } else {
            await this.loader.loadPlugin(path);
        }
    }

    // =========================================================================
    // API Methods
    // =========================================================================

    private async loadExternalPlugin(pluginPath: string): Promise<{ success: boolean; pluginId?: string; error?: string }> {
        if (!this.loader) {
            return { success: false, error: 'Synapse not initialized' };
        }
        return this.loader.loadPlugin(pluginPath);
    }

    private async unloadExternalPlugin(pluginId: string): Promise<boolean> {
        if (!this.loader) {
            return false;
        }
        return this.loader.unloadPlugin(pluginId);
    }

    private listLoadedPlugins(): string[] {
        if (!this.loader) {
            return [];
        }
        return this.loader.getLoadedPluginIds();
    }

    private getPluginsDetails(): any[] {
        if (!this.loader) {
            return [];
        }
        return this.loader.getPluginsMetadata();
    }
}

// Default export for dynamic loading
export default SynapsePlugin;
