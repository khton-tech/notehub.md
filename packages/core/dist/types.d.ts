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
 * Note: Uses `any` for the app parameter to avoid circular generic
 * dependencies. Plugins can cast to NotehubCore<YourEvents> if needed.
 */
export interface IPlugin {
    /** Plugin manifest containing metadata */
    readonly manifest: PluginManifest;
    /**
     * Called when the plugin is loaded
     * @param app - The core application instance
     */
    load(app: any): Promise<void> | void;
    /**
     * Called when the plugin is unloaded
     * @param app - The core application instance
     */
    unload(app: any): Promise<void> | void;
}
//# sourceMappingURL=types.d.ts.map