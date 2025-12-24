import type { IPlugin, PluginManifest, NotehubCore } from '@notehub/core';

/**
 * ConfigManagerPlugin - Centralized configuration management
 *
 * Provides API for reading/writing settings and persists them to JSON
 * via the fs-manager abstraction layer.
 *
 * API Methods:
 * - `config:get` - Get config value by key
 * - `config:set` - Set config value and persist
 * - `config:reload` - Force reload from disk
 *
 * Events:
 * - `config:updated` - Emitted when a setting changes
 */
export class ConfigManagerPlugin implements IPlugin {
    readonly manifest: PluginManifest = {
        id: 'nh.system.config-manager',
        name: 'ConfigManager',
        version: '0.0.0',
        type: 'system',
    };

    /** In-memory configuration cache */
    private config: Record<string, any> = {};

    /** Path to configuration file */
    private readonly CONFIG_PATH = '.notehub/configs/settings.json';

    /** Reference to kernel for event emission and API calls */
    private app: NotehubCore | null = null;

    /**
     * Log a message via the Logger plugin
     */
    private log(level: 'info' | 'warn' | 'error', message: string): void {
        if (this.app) {
            this.app.api.invoke(`logger:${level}`, this.manifest.id, message);
        }
    }

    /**
     * Load the plugin: register API methods and load config from disk
     */
    async load(app: NotehubCore): Promise<void> {
        this.app = app;
        this.log('info', 'Loading...');

        // Register API methods
        app.api.register('config:get', this.get.bind(this));
        app.api.register('config:set', this.set.bind(this));
        app.api.register('config:reload', this.reload.bind(this));

        // Load initial config from disk
        await this.loadFromDisk();

        this.log('info', `Loaded with ${Object.keys(this.config).length} setting(s)`);
    }

    /**
     * Unload the plugin and cleanup
     */
    async unload(app: NotehubCore): Promise<void> {
        this.log('info', 'Unloading...');

        // Unregister API methods
        app.api.unregister('config:get');
        app.api.unregister('config:set');
        app.api.unregister('config:reload');

        this.config = {};

        this.log('info', 'Unloaded');
        this.app = null;
    }

    // =============== API Methods ===============

    /**
     * Get a config value by key
     * @param key - Configuration key (supports simple keys for MVP)
     * @param defaultValue - Default value if key not found
     */
    private get(key: string, defaultValue?: any): any {
        if (key in this.config) {
            return this.config[key];
        }
        return defaultValue;
    }

    /**
     * Set a config value
     * @param key - Configuration key
     * @param value - Value to set
     */
    private async set(key: string, value: any): Promise<void> {
        // Update in-memory config
        this.config[key] = value;

        // Persist to disk
        await this.save();

        // Emit update event
        if (this.app) {
            this.app.events.emit('config:updated', { key, value });
        }
    }

    /**
     * Force reload configuration from disk
     */
    private async reload(): Promise<void> {
        this.log('info', 'Reloading config from disk...');
        await this.loadFromDisk();
        this.log('info', 'Config reloaded');
    }

    // =============== Internal Methods ===============

    /**
     * Load configuration from disk via fs-manager
     */
    private async loadFromDisk(): Promise<void> {
        if (!this.app) {
            this.log('error', 'Cannot load: app reference not set');
            return;
        }

        try {
            // Check if file exists first
            const exists = await this.app.api.invoke<boolean>('fs:exists', this.CONFIG_PATH);

            if (!exists) {
                // File doesn't exist - start with empty config
                this.log('info', 'Config file not found, starting with empty config');
                this.config = {};
                return;
            }

            // Read file content
            const content = await this.app.api.invoke<string>('fs:read-text-file', this.CONFIG_PATH);
            this.config = JSON.parse(content);

        } catch (error) {
            // Handle parse errors or other issues
            this.log('error', `Error loading config: ${error instanceof Error ? error.message : String(error)}`);
            this.config = {};
        }
    }

    /**
     * Save configuration to disk via fs-manager
     */
    private async save(): Promise<void> {
        if (!this.app) {
            this.log('error', 'Cannot save: app reference not set');
            return;
        }

        try {
            const content = JSON.stringify(this.config, null, 2);
            await this.app.api.invoke('fs:write-text-file', this.CONFIG_PATH, content);
        } catch (error) {
            this.log('error', `Error saving config: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}

// Default export for dynamic loading
export default ConfigManagerPlugin;
