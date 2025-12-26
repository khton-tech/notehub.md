/**
 * Plugin type classification
 */
export type PluginType = 'system' | 'ui' | 'feature';

/**
 * Plugin manifest describing plugin metadata and dependencies
 */
export interface PluginManifest {
    /** Unique plugin identifier (e.g., "nh.system.logger") */
    id: string;
    /** Human-readable plugin name */
    name: string;
    /** Semantic version string */
    version: string;
    /** Plugin type classification */
    type: PluginType;
    /** Optional array of plugin IDs this plugin depends on */
    dependencies?: string[];
}

/**
 * Plugin interface that all plugins must implement
 * 
 * Lifecycle:
 * 1. load() - Called when the plugin is loaded (register API, subscribe to events)
 * 2. onReady() - Called after ALL plugins are loaded (safe for cross-plugin interactions)
 * 3. unload() - Called when the plugin is unloaded (cleanup resources)
 * 
 * Note: Uses `any` for the app parameter to avoid circular generic
 * dependencies. Plugins can cast to NotehubCore<YourEvents> if needed.
 */
export interface IPlugin {
    /** Plugin manifest containing metadata */
    readonly manifest: PluginManifest;

    /**
     * Called when the plugin is loaded
     * Use for: registering API handlers, subscribing to events, initializing state
     * @param app - The core application instance
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    load(app: any): Promise<void> | void;

    /**
     * Called after ALL plugins have been loaded
     * Use for: cross-plugin interactions that require other plugins to be ready
     * @param app - The core application instance
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onReady?(app: any): Promise<void> | void;

    /**
     * Called when the plugin is unloaded
     * Use for: cleanup resources, unsubscribe from events
     * @param app - The core application instance
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    unload(app: any): Promise<void> | void;
}
