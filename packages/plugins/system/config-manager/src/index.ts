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
        version: '0.2.0',
        type: 'system',
    };

    /** Global configuration (app-wide) */
    private globalConfig: Record<string, any> = {};

    /** Vault-specific configuration (active vault) */
    private vaultConfig: Record<string, any> = {};

    /** Current vault path (null if no vault open) */
    private currentVaultPath: string | null = null;

    // File constants
    private readonly CONFIG_DIR = '.notehub/configs';
    private readonly CONFIG_FILE = 'settings.json';
    private readonly GLOBAL_CONFIG_FILE = 'global-settings.json';

    /** Path to global configuration file */
    private globalConfigPath: string | null = null;

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
        app.api.register('config:delete', this.delete.bind(this));
        app.api.register('config:reload', this.reload.bind(this));

        // Listen for vault events
        this.app.events.on('app:vault-opened', this.handleVaultOpened.bind(this));
        this.app.events.on('app:vault-closed', this.handleVaultClosed.bind(this));

        // Resolve and load global config
        await this.resolveGlobalPath();
        await this.loadGlobalConfig();

        this.log('info', 'Loaded');
    }

    // Helper to resolve global path
    private async resolveGlobalPath(): Promise<string | null> {
        if (this.globalConfigPath) return this.globalConfigPath;

        try {
            // Use standard AppData location
            const appData = await appDataDir();
            // Store in %APPDATA%/Notehub/config.json (simplest)
            // OR keep consistent structure
            this.globalConfigPath = await join(appData, this.GLOBAL_CONFIG_FILE);
            return this.globalConfigPath;
        } catch (e) {
            this.log('error', `Failed to resolve global config path: ${e}`);
            return null;
        }
    }

    async unload(app: NotehubCore): Promise<void> {
        this.log('info', 'Unloading...');

        app.api.unregister('config:get');
        app.api.unregister('config:set');
        app.api.unregister('config:delete');
        app.api.unregister('config:reload');

        // Remove listeners
        if (this.app) {
            this.app.events.off('app:vault-opened', this.handleVaultOpened.bind(this));
            this.app.events.off('app:vault-closed', this.handleVaultClosed.bind(this));
        }

        this.vaultConfig = {};
        this.globalConfig = {}; // Keep? Or clear. Clear is safer.
        this.currentVaultPath = null;
        this.log('info', 'Unloaded');
        this.app = null;
    }

    // =============== Event Handlers ===============

    private async handleVaultOpened(payload: any): Promise<void> {
        const { path } = payload;
        if (!path) return;

        this.currentVaultPath = path;
        this.log('info', `Vault opened: ${path}. Loading settings...`);
        await this.loadVaultSettings();
    }

    private handleVaultClosed(): void {
        this.log('info', 'Vault closed. Clearing vault settings.');
        this.currentVaultPath = null;
        this.vaultConfig = {};

        // We still have global config, so we don't strictly "reload" to empty, 
        // but existing listeners might expect a flush.
        if (this.app) {
            this.app.events.emit('config:reloaded', {});
        }
    }

    // =============== API Methods ===============

    private get(key: string, defaultValue?: any): any {
        // 1. Vault specific (highest priority)
        if (key in this.vaultConfig) {
            return this.vaultConfig[key];
        }
        // 2. Global (fallback)
        if (key in this.globalConfig) {
            return this.globalConfig[key];
        }
        // 3. Default
        return defaultValue;
    }

    private async set(key: string, value: any): Promise<void> {
        // Determine scope
        const isGlobal = this.isGlobalKey(key);

        if (isGlobal) {
            this.globalConfig[key] = value;
            await this.saveGlobalSettings();
        } else {
            // Vault specific
            if (this.currentVaultPath) {
                this.vaultConfig[key] = value;
                await this.saveVaultSettings();
            } else {
                this.log('warn', `Cannot save vault setting '${key}' - No vault open. Falling back to global.`);
                // Fallback to global if no vault open? Or just ignore?
                // For safety, let's save to global so we don't lose data, 
                // but user might be confused if it applies to all vaults later.
                // Better approach: "Welcome Screen" settings are global.
                this.globalConfig[key] = value;
                await this.saveGlobalSettings();
            }
        }

        if (this.app) {
            this.app.events.emit('config:updated', { key, value });
        }
    }

    private async delete(key: string): Promise<void> {
        if (key in this.vaultConfig) {
            delete this.vaultConfig[key];
            await this.saveVaultSettings();
        } else if (key in this.globalConfig) {
            delete this.globalConfig[key];
            await this.saveGlobalSettings();
        }

        if (this.app) {
            this.app.events.emit('config:deleted', { key });
        }
    }

    private async reload(): Promise<void> {
        this.log('info', 'Reloading config...');
        await this.loadGlobalConfig();
        if (this.currentVaultPath) {
            await this.loadVaultSettings();
        }
    }

    // =============== Internal Methods ===============

    private isGlobalKey(key: string): boolean {
        // Heuristic for global keys
        return key.startsWith('vault.') || key.startsWith('window.') || key === 'theme.current';
    }

    /**
     * Load global configuration
     */
    private async loadGlobalConfig(): Promise<void> {
        if (!this.app) return;

        if (!this.globalConfigPath) {
            await this.resolveGlobalPath();
        }

        if (!this.globalConfigPath) {
            this.log('warn', 'Global config path not resolved. Cannot load global settings.');
            return;
        }

        try {
            // Ensure dir exists
            const configDir = this.globalConfigPath.replace(/[\\\/][^\\\/]+$/, '');
            await this.app.api.invoke('fs:create-dir', configDir, { recursive: true });

            const exists = await this.app.api.invoke<boolean>('fs:exists', this.globalConfigPath);
            if (exists) {
                const content = await this.app.api.invoke<string>('fs:read-text-file', this.globalConfigPath);
                this.globalConfig = JSON.parse(content);
                this.log('info', `Loaded global config from ${this.globalConfigPath}`);
            } else {
                this.log('info', `No global settings file found at ${this.globalConfigPath}. Using defaults.`);
                this.globalConfig = {};
            }
        } catch (e) {
            this.log('error', `Failed to load global config: ${e instanceof Error ? e.message : String(e)}`);
        }
    }

    private async loadVaultSettings(): Promise<void> {
        if (!this.app || !this.currentVaultPath) return;

        const configPath = await this.app.api.invoke('path:join', this.currentVaultPath, this.CONFIG_DIR, this.CONFIG_FILE)
            .catch(() => `${this.currentVaultPath}/${this.CONFIG_DIR}/${this.CONFIG_FILE}`.replace(/\\/g, '/'));

        try {
            const exists = await this.app.api.invoke<boolean>('fs:exists', configPath);

            if (!exists) {
                this.log('info', `No vault settings at ${configPath}. Using defaults.`);
                this.vaultConfig = {};
            } else {
                const content = await this.app.api.invoke<string>('fs:read-text-file', configPath);
                this.vaultConfig = JSON.parse(content);
                this.log('info', `Loaded vault settings from ${configPath}`);
            }

            this.app.events.emit('config:reloaded', {});

        } catch (error) {
            this.log('error', `Error loading vault config: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private async saveVaultSettings(): Promise<void> {
        if (!this.app || !this.currentVaultPath) return;

        const configDir = `${this.currentVaultPath}/${this.CONFIG_DIR}`.replace(/\\/g, '/');
        const configPath = `${configDir}/${this.CONFIG_FILE}`;

        try {
            await this.app.api.invoke('fs:create-dir', configDir, { recursive: true });
            const content = JSON.stringify(this.vaultConfig, null, 2);
            await this.app.api.invoke('fs:write-text-file', configPath, content);
        } catch (error) {
            this.log('error', `Error saving vault config: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private async saveGlobalSettings(): Promise<void> {
        if (!this.app || !this.globalConfigPath) {
            this.log('warn', 'Cannot save global settings: Global config path not resolved.');
            return;
        }

        try {
            // Dir creation handled in load/resolve
            // But let's be safe
            const configDir = this.globalConfigPath.replace(/[\\\/][^\\\/]+$/, '');
            await this.app.api.invoke('fs:create-dir', configDir, { recursive: true });

            const content = JSON.stringify(this.globalConfig, null, 2);
            await this.app.api.invoke('fs:write-text-file', this.globalConfigPath, content);
        } catch (e) {
            this.log('error', `Error saving global config: ${e instanceof Error ? e.message : String(e)}`);
        }
    }
}

// Default export for dynamic loading
export default ConfigManagerPlugin;
