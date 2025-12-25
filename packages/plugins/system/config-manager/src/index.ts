import type { IPlugin, PluginManifest, NotehubCore } from '@notehub/core';
import { appDataDir, join } from '@tauri-apps/api/path';

/**
 * ConfigManagerPlugin - Centralized configuration management
 * ...
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

    /** Path to configuration file (resolved at runtime) */
    private configPath: string | null = null;
    private readonly CONFIG_DIR = '.notehub/configs';
    private readonly CONFIG_FILE = 'settings.json';

    /** Reference to kernel for event emission and API calls */
    private app: NotehubCore | null = null;

    private log(level: 'info' | 'warn' | 'error', message: string): void {
        if (this.app) {
            this.app.api.invoke(`logger:${level}`, this.manifest.id, message);
        }
    }

    async load(app: NotehubCore): Promise<void> {
        this.app = app;
        this.log('info', 'Loading...');

        // Register API methods
        app.api.register('config:get', this.get.bind(this));
        app.api.register('config:set', this.set.bind(this));
        app.api.register('config:reload', this.reload.bind(this));

        // Resolve config path
        try {
            const appData = await appDataDir();
            const configDir = await join(appData, this.CONFIG_DIR);
            this.configPath = await join(configDir, this.CONFIG_FILE);

            // Ensure directory exists
            await this.app.api.invoke('fs:create-dir', configDir, { recursive: true });
        } catch (error) {
            this.log('error', `Failed to resolve config path: ${error}`);
            // Fallback? Or just fail?
        }

        // Load initial config from disk
        await this.loadFromDisk();

        this.log('info', `Loaded with ${Object.keys(this.config).length} setting(s)`);
    }

    async unload(app: NotehubCore): Promise<void> {
        this.log('info', 'Unloading...');

        app.api.unregister('config:get');
        app.api.unregister('config:set');
        app.api.unregister('config:reload');

        this.config = {};
        this.log('info', 'Unloaded');
        this.app = null;
    }

    // =============== API Methods ===============

    private get(key: string, defaultValue?: any): any {
        if (key in this.config) {
            return this.config[key];
        }
        return defaultValue;
    }

    private async set(key: string, value: any): Promise<void> {
        this.config[key] = value;
        await this.save();
        if (this.app) {
            this.app.events.emit('config:updated', { key, value });
        }
    }

    private async reload(): Promise<void> {
        this.log('info', 'Reloading config from disk...');
        await this.loadFromDisk();
        this.log('info', 'Config reloaded');
    }

    // =============== Internal Methods ===============

    private async loadFromDisk(): Promise<void> {
        if (!this.app || !this.configPath) {
            this.log('error', 'Cannot load: app reference or config path not set');
            return;
        }

        try {
            const exists = await this.app.api.invoke<boolean>('fs:exists', this.configPath);

            if (!exists) {
                this.log('info', `Config file not found at ${this.configPath}, starting with empty config`);
                this.config = {};
                return;
            }

            const content = await this.app.api.invoke<string>('fs:read-text-file', this.configPath);
            this.config = JSON.parse(content);

        } catch (error) {
            this.log('error', `Error loading config: ${error instanceof Error ? error.message : String(error)}`);
            this.config = {};
        }
    }

    private async save(): Promise<void> {
        if (!this.app || !this.configPath) {
            this.log('error', 'Cannot save: app reference or config path not set');
            return;
        }

        try {
            const content = JSON.stringify(this.config, null, 2);
            await this.app.api.invoke('fs:write-text-file', this.configPath, content);
        } catch (error) {
            this.log('error', `Error saving config: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}

// Default export for dynamic loading
export default ConfigManagerPlugin;
