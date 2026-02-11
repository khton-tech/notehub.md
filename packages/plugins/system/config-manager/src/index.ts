import { SystemPlugin } from '@notehub/core';
import type { PluginManifest } from '@notehub/core';

/**
 * ConfigManagerPlugin - Centralized configuration management
 */
export class ConfigManagerPlugin extends SystemPlugin {
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

    protected async onLoad(): Promise<void> {
        this.log('info', 'Loading...');

        // Register API methods
        this.registerApi('config:get', this.get.bind(this));
        this.registerApi('config:set', this.set.bind(this));
        this.registerApi('config:delete', this.delete.bind(this));
        this.registerApi('config:reload', this.reload.bind(this));

        // Listen for vault events
        this.registerEvent('app:vault-opened', this.handleVaultOpened);
        this.registerEvent('app:vault-closed', this.handleVaultClosed);

        // Resolve and load global config
        await this.resolveGlobalPath();
        await this.loadGlobalConfig();

        this.log('info', 'Loaded');
    }

    // Helper to resolve global path
    private async resolveGlobalPath(): Promise<string | null> {
        if (this.globalConfigPath) return this.globalConfigPath;

        try {
            // Check for Capacitor first
            // @ts-ignore
            const isCapacitor = typeof window !== 'undefined' && !!window.Capacitor;

            if (isCapacitor) {
                this.globalConfigPath = `.notehub/${this.GLOBAL_CONFIG_FILE}`;
            } else {
                // Check if we are in Tauri
                // @ts-ignore
                const isTauri = typeof window !== 'undefined' && !!window.__TAURI__;

                if (isTauri) {
                    try {
                        const { appDataDir, join } = await import('@tauri-apps/api/path');
                        const appData = await appDataDir();
                        this.globalConfigPath = await join(appData, this.GLOBAL_CONFIG_FILE);
                    } catch (e) {
                        this.log('warn', `Tauri path resolution failed: ${e}. Using fallback.`);
                        this.globalConfigPath = `.notehub/${this.GLOBAL_CONFIG_FILE}`;
                    }
                } else {
                    this.globalConfigPath = `.notehub/${this.GLOBAL_CONFIG_FILE}`;
                }
            }

            return this.globalConfigPath;
        } catch (e) {
            this.log('error', `Failed to resolve global config path: ${e}`);
            this.globalConfigPath = `.notehub/${this.GLOBAL_CONFIG_FILE}`;
            return this.globalConfigPath;
        }
    }

    protected async onUnload(): Promise<void> {
        this.log('info', 'Unloading...');
        this.vaultConfig = {};
        this.globalConfig = {};
        this.currentVaultPath = null;
        this.log('info', 'Unloaded');
    }

    // =============== Event Handlers ===============

    private handleVaultOpened = async (payload: any): Promise<void> => {
        const { path } = payload;
        if (!path) return;

        this.currentVaultPath = path;
        this.log('info', `Vault opened: ${path}. Loading settings...`);
        await this.loadVaultSettings();
    };

    private handleVaultClosed = (): void => {
        this.log('info', 'Vault closed. Clearing vault settings.');
        this.currentVaultPath = null;
        this.vaultConfig = {};
        this.app.events.emit('config:reloaded', {});
    };

    // =============== API Methods ===============

    private get(key: string, defaultValue?: any): any {
        if (key in this.vaultConfig) {
            return this.vaultConfig[key];
        }
        if (key in this.globalConfig) {
            return this.globalConfig[key];
        }
        return defaultValue;
    }

    private async set(key: string, value: any): Promise<void> {
        const isGlobal = this.isGlobalKey(key);

        if (isGlobal) {
            this.globalConfig[key] = value;
            await this.saveGlobalSettings();
        } else {
            if (this.currentVaultPath) {
                this.vaultConfig[key] = value;
                await this.saveVaultSettings();
            } else {
                this.log('warn', `Cannot save vault setting '${key}' - No vault open. Falling back to global.`);
                this.globalConfig[key] = value;
                await this.saveGlobalSettings();
            }
        }

        this.app.events.emit('config:updated', { key, value });
    }

    private async delete(key: string): Promise<void> {
        if (key in this.vaultConfig) {
            delete this.vaultConfig[key];
            await this.saveVaultSettings();
        } else if (key in this.globalConfig) {
            delete this.globalConfig[key];
            await this.saveGlobalSettings();
        }

        this.app.events.emit('config:deleted', { key });
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
        return key.startsWith('vault.') || key.startsWith('window.');
    }

    private async loadGlobalConfig(): Promise<void> {
        if (!this.globalConfigPath) {
            await this.resolveGlobalPath();
        }

        if (!this.globalConfigPath) {
            this.log('warn', 'Global config path not resolved. Cannot load global settings.');
            return;
        }

        try {
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
        if (!this.currentVaultPath) return;

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
        if (!this.currentVaultPath) return;

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
        if (!this.globalConfigPath) {
            this.log('warn', 'Cannot save global settings: Global config path not resolved.');
            return;
        }

        try {
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
