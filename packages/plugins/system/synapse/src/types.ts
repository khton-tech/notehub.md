import type { NotehubPlugin } from '@notehub.md/api';
import type { IPlugin, NotehubCore } from '@notehub/core';
import type { PluginContextImpl } from './logic/PluginContextImpl.js';

/**
 * External plugin manifest structure (from disk manifest.json)
 */
export interface ExternalPluginManifest {
    /** Unique plugin identifier */
    id: string;
    /** Human-readable plugin name */
    name: string;
    /** Semantic version string */
    version: string;
    /** Entry point file, defaults to 'main.js' */
    main?: string;
    /** Plugin dependencies (internal plugin IDs) */
    dependencies?: string[];
}

/**
 * Loaded plugin record for internal tracking
 */
export interface LoadedPluginRecord {
    /** Original manifest from disk */
    manifest: ExternalPluginManifest;
    /** Plugin instance (legacy IPlugin or new NotehubPlugin) */
    plugin: IPlugin | NotehubPlugin;
    /** Plugin context for auto-cleanup (only for NotehubPlugin) */
    context?: PluginContextImpl | undefined;
    /** URL used to load the plugin (for cleanup) */
    url: string;
    /** Blob URL for NHP-loaded plugins (needs revokeObjectURL on unload) */
    blobUrl?: string;
    /** Whether this plugin was loaded from an NHP file */
    isNhp?: boolean;
    /** Source path of the plugin (folder or .nhp file) for watcher tracking */
    sourcePath?: string;
    /** Timestamp when plugin was loaded */
    /** Timestamp when plugin was loaded */
    loadedAt: Date;
}

/**
 * Valid statuses for a plugin
 */
export type PluginStatus = 'Active' | 'Inactive' | 'Error';

/**
 * Record for discovered but potentially unloaded plugins
 */
export interface DiscoveredPluginRecord {
    /** The manifest parsed from disk */
    manifest: ExternalPluginManifest;
    /** Source path (folder or .nhp file) */
    sourcePath: string;
    /** Current status of the plugin */
    status: PluginStatus;
    /** Error message if load failed */
    error?: string;
    /** Whether it is an NHP file */
    isNhp: boolean;
}

/**
 * Context passed to external plugins during load
 */
export interface PluginContext {
    /** Core application instance */
    app: NotehubCore;
    /** Absolute path to the plugin directory */
    pluginDir: string;
}

/**
 * Result of a plugin load attempt
 */
export interface PluginLoadResult {
    /** Whether the load was successful */
    success: boolean;
    /** Plugin ID if successful */
    pluginId?: string;
    /** Error message if failed */
    error?: string;
}
