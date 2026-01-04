/**
 * @fileoverview Plugin Loader for External Extensions
 * 
 * This module handles the loading and unloading of external JavaScript plugins
 * from disk. It uses SystemJS for dynamic module loading and validates that
 * loaded modules conform to either the legacy IPlugin or the new NotehubPlugin interface.
 * 
 * NotehubPlugin instances receive a PluginContextImpl that tracks all registrations
 * for automatic cleanup when the plugin is unloaded.
 */

import type { NotehubPlugin } from '@notehub/api';
import type { IPlugin, NotehubCore } from '@notehub/core';
import type { ExternalPluginManifest, LoadedPluginRecord, PluginLoadResult } from '../types.js';
import { PluginContextImpl } from './PluginContextImpl.js';
import { ZipLoader, type NhpLoadResult } from './ZipLoader.js';
import { convertFileSrc } from '@tauri-apps/api/core';

// SystemJS global type declaration (SystemJS 6.x)
// Note: System.newModule was removed in SystemJS 6.x
declare const System: {
    set(id: string, module: object): void;
    import(id: string): Promise<{ default?: unknown;[key: string]: unknown }>;
    delete(id: string): boolean;
};

/**
 * PluginLoader - Manages loading and unloading of external plugins
 * 
 * Responsibilities:
 * - Read plugin manifests from disk
 * - Load plugin entry points via SystemJS
 * - Validate plugin interface conformance
 * - Track loaded plugins for cleanup
 * - Handle errors gracefully (don't crash on bad plugins)
 */
export class PluginLoader {
    /** Map of loaded plugins by ID */
    private loadedPlugins: Map<string, LoadedPluginRecord> = new Map();

    /** Core application instance */
    private app: NotehubCore;

    constructor(app: NotehubCore) {
        this.app = app;
    }

    /**
     * Log a message via the Logger plugin
     */
    private log(level: 'info' | 'warn' | 'error', message: string): void {
        this.app.api.invoke(`logger:${level}`, 'nh.system.synapse', message);
    }

    /**
     * Load an external plugin from a directory path
     * 
     * @param pluginPath - Absolute path to the plugin directory
     * @returns Result indicating success or failure
     */
    async loadPlugin(pluginPath: string): Promise<PluginLoadResult> {
        const manifestPath = `${pluginPath}/manifest.json`;

        try {
            // Step 1: Check if manifest exists
            const manifestExists = await this.app.api.invoke('fs:exists', manifestPath);
            if (!manifestExists) {
                const error = `No manifest.json found at ${manifestPath}`;
                this.log('warn', error);
                return { success: false, error };
            }

            // Step 2: Read and parse manifest
            const manifestJson = await this.app.api.invoke('fs:read-text-file', manifestPath);
            const manifest = this.parseManifest(manifestJson, pluginPath);
            if (!manifest) {
                return { success: false, error: 'Invalid manifest.json format' };
            }

            // Step 3: Check if already loaded
            if (this.loadedPlugins.has(manifest.id)) {
                this.log('warn', `Plugin ${manifest.id} is already loaded, skipping`);
                return { success: true, pluginId: manifest.id };
            }

            // Step 4: Construct file URL for the entry point
            const entryPoint = manifest.main || 'main.js';
            const url = this.constructFileUrl(pluginPath, entryPoint);

            this.log('info', `Loading external plugin: ${manifest.id} from ${url}`);

            // Step 5: Dynamic import via SystemJS
            const module = await System.import(url);

            // Step 6: Get and validate the plugin class/instance
            const plugin = this.extractPlugin(module, manifest.id);
            if (!plugin) {
                return { success: false, error: 'Module does not export a valid plugin' };
            }

            // Step 7: Determine plugin type and call appropriate load method
            let context: PluginContextImpl | undefined;

            if (this.isNotehubPlugin(plugin)) {
                // New NotehubPlugin: create context with auto-cleanup
                context = new PluginContextImpl(this.app, manifest.id);
                await plugin.onload(context);
            } else {
                // Legacy IPlugin: call load with app reference
                await plugin.load(this.app);
            }

            // Step 8: Store in registry
            this.loadedPlugins.set(manifest.id, {
                manifest,
                plugin,
                context,
                url,
                loadedAt: new Date(),
            });

            const stats = context ? ` (${context.getStats().registeredApis} APIs, ${context.getStats().eventSubscriptions} subscriptions)` : '';
            this.log('info', `External plugin loaded: ${manifest.id} v${manifest.version}${stats}`);
            return { success: true, pluginId: manifest.id };

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.log('error', `Failed to load plugin from ${pluginPath}: ${errorMessage}`);
            return { success: false, error: errorMessage };
        }
    }

    /**
     * Unload a previously loaded plugin
     * 
     * @param pluginId - ID of the plugin to unload
     * @returns true if plugin was unloaded, false if not found
     */
    async unloadPlugin(pluginId: string): Promise<boolean> {
        const record = this.loadedPlugins.get(pluginId);
        if (!record) {
            this.log('warn', `Cannot unload plugin ${pluginId}: not found in registry`);
            return false;
        }

        try {
            // Step 1: Clean up context BEFORE calling plugin.onunload()
            // This ensures APIs are unregistered even if onunload() throws
            if (record.context) {
                record.context.cleanup();
            }

            // Step 2: Call appropriate unload method
            if (this.isNotehubPlugin(record.plugin)) {
                await record.plugin.onunload();
            } else {
                await record.plugin.unload(this.app);
            }

            // Step 3: Clean up SystemJS registry for potential HMR
            System.delete(record.url);

            // Step 4: Revoke Blob URL if this was an NHP plugin (memory safety)
            if (record.blobUrl) {
                URL.revokeObjectURL(record.blobUrl);
                this.log('info', `Revoked Blob URL for ${pluginId}`);
            }

            // Step 5: Remove injected CSS style tag if present
            if (record.isNhp) {
                const styleTag = document.getElementById(`style-${pluginId}`);
                if (styleTag) {
                    styleTag.remove();
                    this.log('info', `Removed style tag for ${pluginId}`);
                }
            }

            // Step 6: Remove from our registry
            this.loadedPlugins.delete(pluginId);

            this.log('info', `External plugin unloaded: ${pluginId}`);
            return true;

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.log('error', `Error unloading plugin ${pluginId}: ${errorMessage}`);
            // Still remove from registry to prevent zombie entries
            this.loadedPlugins.delete(pluginId);
            // Also cleanup Blob URL and CSS even on error
            if (record.blobUrl) {
                URL.revokeObjectURL(record.blobUrl);
            }
            const styleTag = document.getElementById(`style-${pluginId}`);
            if (styleTag) {
                styleTag.remove();
            }
            return false;
        }
    }

    /**
     * Unload all loaded plugins
     */
    async unloadAll(): Promise<void> {
        const pluginIds = Array.from(this.loadedPlugins.keys());

        // Unload in reverse order (LIFO)
        for (const pluginId of pluginIds.reverse()) {
            await this.unloadPlugin(pluginId);
        }
    }

    /**
     * Get list of loaded plugin IDs
     */
    getLoadedPluginIds(): string[] {
        return Array.from(this.loadedPlugins.keys());
    }

    /**
     * Get a loaded plugin record by ID
     */
    getLoadedPlugin(pluginId: string): LoadedPluginRecord | undefined {
        return this.loadedPlugins.get(pluginId);
    }

    /**
     * Load an external plugin from an NHP file buffer (in-memory ZIP)
     * 
     * @param buffer - Raw bytes of the .nhp file
     * @param filename - Original filename for logging
     * @returns Result indicating success or failure
     */
    async loadFromNhp(buffer: ArrayBuffer, filename: string): Promise<PluginLoadResult> {
        try {
            // Step 1: Extract NHP contents using ZipLoader
            const zipLoader = new ZipLoader();
            const nhpResult: NhpLoadResult = await zipLoader.loadFromBuffer(buffer, filename);

            const { manifest, blobUrl, css } = nhpResult;

            // Step 2: Check if already loaded
            if (this.loadedPlugins.has(manifest.id)) {
                this.log('warn', `Plugin ${manifest.id} is already loaded, skipping`);
                // Revoke the blob URL we just created since we won't use it
                URL.revokeObjectURL(blobUrl);
                return { success: true, pluginId: manifest.id };
            }

            this.log('info', `Loading NHP plugin: ${manifest.id} from ${filename}`);

            // Step 3: Inject CSS if present
            if (css) {
                const styleTag = document.createElement('style');
                styleTag.id = `style-${manifest.id}`;
                styleTag.textContent = css;
                document.head.appendChild(styleTag);
                this.log('info', `Injected CSS for ${manifest.id}`);
            }

            // Step 4: Dynamic import via SystemJS using Blob URL
            const module = await System.import(blobUrl);

            // Step 5: Get and validate the plugin class/instance
            const plugin = this.extractPlugin(module, manifest.id);
            if (!plugin) {
                // Clean up on failure
                URL.revokeObjectURL(blobUrl);
                const styleTag = document.getElementById(`style-${manifest.id}`);
                if (styleTag) styleTag.remove();
                return { success: false, error: 'Module does not export a valid plugin' };
            }

            // Step 6: Determine plugin type and call appropriate load method
            let context: PluginContextImpl | undefined;

            if (this.isNotehubPlugin(plugin)) {
                // New NotehubPlugin: create context with auto-cleanup
                context = new PluginContextImpl(this.app, manifest.id);
                await plugin.onload(context);
            } else {
                // Legacy IPlugin: call load with app reference
                await plugin.load(this.app);
            }

            // Step 7: Store in registry with NHP-specific fields
            this.loadedPlugins.set(manifest.id, {
                manifest,
                plugin,
                context,
                url: blobUrl, // Use blobUrl as the URL for SystemJS cleanup
                blobUrl,      // Keep separate reference for revokeObjectURL
                isNhp: true,
                loadedAt: new Date(),
            });

            const stats = context ? ` (${context.getStats().registeredApis} APIs, ${context.getStats().eventSubscriptions} subscriptions)` : '';
            this.log('info', `NHP plugin loaded: ${manifest.id} v${manifest.version}${stats}`);
            return { success: true, pluginId: manifest.id };

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.log('error', `Failed to load NHP plugin from ${filename}: ${errorMessage}`);
            return { success: false, error: errorMessage };
        }
    }

    /**
     * Parse and validate manifest JSON
     */
    private parseManifest(json: string, path: string): ExternalPluginManifest | null {
        try {
            const parsed = JSON.parse(json);

            // Minimal validation
            if (!parsed.id || typeof parsed.id !== 'string') {
                this.log('error', `Invalid manifest at ${path}: missing or invalid 'id'`);
                return null;
            }
            if (!parsed.name || typeof parsed.name !== 'string') {
                this.log('error', `Invalid manifest at ${path}: missing or invalid 'name'`);
                return null;
            }
            if (!parsed.version || typeof parsed.version !== 'string') {
                this.log('error', `Invalid manifest at ${path}: missing or invalid 'version'`);
                return null;
            }

            return {
                id: parsed.id,
                name: parsed.name,
                version: parsed.version,
                main: parsed.main,
                dependencies: parsed.dependencies,
            };
        } catch (error) {
            this.log('error', `Failed to parse manifest at ${path}: ${error}`);
            return null;
        }
    }

    /**
     * Construct a file URL for loading
     * 
     * Uses Tauri's convertFileSrc to create an asset:// URL that can be
     * loaded in the WebView. Direct file:// URLs are blocked for security.
     */
    private constructFileUrl(basePath: string, entryPoint: string): string {
        // Normalize path separators
        const normalizedPath = basePath.replace(/\\/g, '/');
        const normalizedEntry = entryPoint.replace(/\\/g, '/');

        // Build full file path
        const fullPath = `${normalizedPath}/${normalizedEntry}`;

        // Use Tauri's convertFileSrc to get a safe asset:// URL
        // This transforms file paths into URLs that Tauri's WebView can load
        return convertFileSrc(fullPath);
    }

    /**
     * Extract and validate plugin from module exports
     * Supports both legacy IPlugin and new NotehubPlugin interfaces
     */
    private extractPlugin(
        module: { default?: unknown;[key: string]: unknown },
        pluginId: string
    ): IPlugin | NotehubPlugin | null {
        // Try default export first
        let pluginCandidate = module.default;

        // If default is a class, instantiate it
        if (typeof pluginCandidate === 'function') {
            try {
                pluginCandidate = new (pluginCandidate as new () => IPlugin | NotehubPlugin)();
            } catch (error) {
                this.log('error', `Failed to instantiate plugin class for ${pluginId}: ${error}`);
                return null;
            }
        }

        // Check for new NotehubPlugin interface first (onload/onunload)
        if (this.isNotehubPlugin(pluginCandidate)) {
            this.log('info', `Detected NotehubPlugin interface for ${pluginId}`);
            return pluginCandidate;
        }

        // Fall back to legacy IPlugin interface validation
        if (this.isLegacyPlugin(pluginCandidate)) {
            this.log('info', `Detected legacy IPlugin interface for ${pluginId}`);
            return pluginCandidate;
        }

        this.log('error', `Invalid plugin export for ${pluginId}: must implement NotehubPlugin (onload/onunload) or IPlugin (manifest/load/unload)`);
        return null;
    }

    /**
     * Type guard for NotehubPlugin interface (new @notehub/api style)
     * Checks for onload and onunload methods
     */
    private isNotehubPlugin(candidate: unknown): candidate is NotehubPlugin {
        if (!candidate || typeof candidate !== 'object') {
            return false;
        }

        const plugin = candidate as Record<string, unknown>;
        return typeof plugin.onload === 'function' && typeof plugin.onunload === 'function';
    }

    /**
     * Type guard for legacy IPlugin interface
     * Checks for manifest object with id, and load/unload methods
     */
    private isLegacyPlugin(candidate: unknown): candidate is IPlugin {
        if (!candidate || typeof candidate !== 'object') {
            return false;
        }

        const plugin = candidate as Record<string, unknown>;

        // Must have manifest object with id
        if (!plugin.manifest || typeof plugin.manifest !== 'object') {
            return false;
        }

        const manifest = plugin.manifest as Record<string, unknown>;
        if (!manifest.id || typeof manifest.id !== 'string') {
            return false;
        }

        // Must have load function
        if (typeof plugin.load !== 'function') {
            return false;
        }

        // Must have unload function
        if (typeof plugin.unload !== 'function') {
            return false;
        }

        return true;
    }
}
