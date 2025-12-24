import type { IPlugin, PluginManifest, NotehubCore } from '@notehub/core';

/**
 * StateManagerPlugin - Runtime session state storage
 *
 * Provides in-memory storage for transient application state.
 * Unlike config-manager (for persistent settings), state-manager
 * is designed for session data that doesn't need immediate disk persistence.
 *
 * Use cases:
 * - Currently open tab
 * - Scroll positions
 * - UI expansion states
 * - Temporary editor state
 *
 * API Methods:
 * - `state:set` - Store a value
 * - `state:get` - Retrieve a value
 * - `state:delete` - Remove a value
 * - `state:dump` - Export entire state as JSON
 *
 * Events:
 * - `state:changed:{key}` - Emitted when a specific key changes
 */
export class StateManagerPlugin implements IPlugin {
    readonly manifest: PluginManifest = {
        id: 'nh.system.state-manager',
        name: 'StateManager',
        version: '0.0.0',
        type: 'system',
    };

    /** In-memory state storage */
    private state: Map<string, any> = new Map();

    /** Reference to kernel for event emission */
    private app: NotehubCore | null = null;

    /**
     * Log a message via the Logger plugin
     */
    private log(level: 'info' | 'warn' | 'error', message: string): void {
        if (this.app) {
            this.app.api.invoke(`logger:${level}`, this.manifest.id, message);
        }
    }

    // =============== API Method Handlers ===============

    /**
     * Store a value in state
     * Emits state:changed:{key} event after setting
     */
    private handleSet = (key: string, value: any): void => {
        if (typeof key !== 'string' || key.trim() === '') {
            this.log('error', 'Invalid key: must be a non-empty string');
            return;
        }

        const previousValue = this.state.get(key);
        this.state.set(key, value);

        // Emit change event
        if (this.app) {
            this.app.events.emit(`state:changed:${key}`, {
                key,
                value,
                previousValue,
            });
        }
    };

    /**
     * Retrieve a value from state
     * Returns undefined if key doesn't exist
     */
    private handleGet = (key: string): any => {
        if (typeof key !== 'string') {
            this.log('error', 'Invalid key: must be a string');
            return undefined;
        }

        return this.state.get(key);
    };

    /**
     * Remove a value from state
     * Returns true if the key existed and was deleted
     */
    private handleDelete = (key: string): boolean => {
        if (typeof key !== 'string') {
            this.log('error', 'Invalid key: must be a string');
            return false;
        }

        const existed = this.state.has(key);

        if (existed) {
            const previousValue = this.state.get(key);
            this.state.delete(key);

            // Emit change event with undefined as new value
            if (this.app) {
                this.app.events.emit(`state:changed:${key}`, {
                    key,
                    value: undefined,
                    previousValue,
                    deleted: true,
                });
            }
        }

        return existed;
    };

    /**
     * Export entire state as a plain object
     * Useful for session persistence on app close
     */
    private handleDump = (): Record<string, any> => {
        const result: Record<string, any> = {};

        for (const [key, value] of this.state.entries()) {
            result[key] = value;
        }

        return result;
    };

    /**
     * Restore state from a dump object
     * Useful for session restoration on app start
     */
    private handleRestore = (dump: Record<string, any>): void => {
        if (typeof dump !== 'object' || dump === null) {
            this.log('error', 'Invalid dump: must be a non-null object');
            return;
        }

        // Clear existing state
        this.state.clear();

        // Restore from dump
        for (const [key, value] of Object.entries(dump)) {
            this.state.set(key, value);
        }

        this.log('info', `Restored ${this.state.size} state entries`);
    };

    /**
     * Check if a key exists in state
     */
    private handleHas = (key: string): boolean => {
        if (typeof key !== 'string') {
            this.log('error', 'Invalid key: must be a string');
            return false;
        }

        return this.state.has(key);
    };

    /**
     * Get all keys in state
     */
    private handleKeys = (): string[] => {
        return Array.from(this.state.keys());
    };

    /**
     * Clear all state
     */
    private handleClear = (): void => {
        const keys = Array.from(this.state.keys());
        this.state.clear();

        // Emit change events for all cleared keys
        if (this.app) {
            for (const key of keys) {
                this.app.events.emit(`state:changed:${key}`, {
                    key,
                    value: undefined,
                    deleted: true,
                });
            }
        }

        this.log('info', `Cleared ${keys.length} state entries`);
    };

    // =============== Plugin Lifecycle ===============

    /**
     * Load the plugin: register API methods
     */
    async load(app: NotehubCore): Promise<void> {
        this.app = app;
        this.log('info', 'Loading...');

        // Register API methods
        app.api.register('state:set', this.handleSet);
        app.api.register('state:get', this.handleGet);
        app.api.register('state:delete', this.handleDelete);
        app.api.register('state:dump', this.handleDump);
        app.api.register('state:restore', this.handleRestore);
        app.api.register('state:has', this.handleHas);
        app.api.register('state:keys', this.handleKeys);
        app.api.register('state:clear', this.handleClear);

        this.log('info', 'Loaded successfully');
    }

    /**
     * Unload the plugin and cleanup
     */
    async unload(app: NotehubCore): Promise<void> {
        this.log('info', 'Unloading...');

        // Unregister API methods
        app.api.unregister('state:set');
        app.api.unregister('state:get');
        app.api.unregister('state:delete');
        app.api.unregister('state:dump');
        app.api.unregister('state:restore');
        app.api.unregister('state:has');
        app.api.unregister('state:keys');
        app.api.unregister('state:clear');

        // Clear state on unload
        this.state.clear();

        this.log('info', 'Unloaded');
        this.app = null;
    }
}

// Default export for dynamic loading
export default StateManagerPlugin;
