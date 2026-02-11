import { SystemPlugin } from '@notehub/core';
import type { PluginManifest } from '@notehub/core';

/**
 * StateManagerPlugin - Runtime session state storage
 *
 * Provides in-memory storage for transient application state.
 * Unlike config-manager (for persistent settings), state-manager
 * is designed for session data that doesn't need immediate disk persistence.
 */
export class StateManagerPlugin extends SystemPlugin {
    readonly manifest: PluginManifest = {
        id: 'nh.system.state-manager',
        name: 'StateManager',
        version: '0.0.0',
        type: 'system',
    };

    /** In-memory state storage */
    private state: Map<string, any> = new Map();

    // =============== API Method Handlers ===============

    private handleSet = (key: string, value: any): void => {
        if (typeof key !== 'string' || key.trim() === '') {
            this.log('error', 'Invalid key: must be a non-empty string');
            return;
        }

        const previousValue = this.state.get(key);
        this.state.set(key, value);

        this.app.events.emit(`state:changed:${key}`, {
            key,
            value,
            previousValue,
        });
    };

    private handleGet = (key: string): any => {
        if (typeof key !== 'string') {
            this.log('error', 'Invalid key: must be a string');
            return undefined;
        }
        return this.state.get(key);
    };

    private handleDelete = (key: string): boolean => {
        if (typeof key !== 'string') {
            this.log('error', 'Invalid key: must be a string');
            return false;
        }

        const existed = this.state.has(key);
        if (existed) {
            const previousValue = this.state.get(key);
            this.state.delete(key);
            this.app.events.emit(`state:changed:${key}`, {
                key,
                value: undefined,
                previousValue,
                deleted: true,
            });
        }
        return existed;
    };

    private handleDump = (): Record<string, any> => {
        const result: Record<string, any> = {};
        for (const [key, value] of this.state.entries()) {
            result[key] = value;
        }
        return result;
    };

    private handleRestore = (dump: Record<string, any>): void => {
        if (typeof dump !== 'object' || dump === null) {
            this.log('error', 'Invalid dump: must be a non-null object');
            return;
        }
        this.state.clear();
        for (const [key, value] of Object.entries(dump)) {
            this.state.set(key, value);
        }
        this.log('info', `Restored ${this.state.size} state entries`);
    };

    private handleHas = (key: string): boolean => {
        if (typeof key !== 'string') {
            this.log('error', 'Invalid key: must be a string');
            return false;
        }
        return this.state.has(key);
    };

    private handleKeys = (): string[] => {
        return Array.from(this.state.keys());
    };

    private handleClear = (): void => {
        const keys = Array.from(this.state.keys());
        this.state.clear();
        for (const key of keys) {
            this.app.events.emit(`state:changed:${key}`, {
                key,
                value: undefined,
                deleted: true,
            });
        }
        this.log('info', `Cleared ${keys.length} state entries`);
    };

    // =============== Plugin Lifecycle ===============

    protected async onLoad(): Promise<void> {
        this.log('info', 'Loading...');

        this.registerApi('state:set', this.handleSet);
        this.registerApi('state:get', this.handleGet);
        this.registerApi('state:delete', this.handleDelete);
        this.registerApi('state:dump', this.handleDump);
        this.registerApi('state:restore', this.handleRestore);
        this.registerApi('state:has', this.handleHas);
        this.registerApi('state:keys', this.handleKeys);
        this.registerApi('state:clear', this.handleClear);

        this.log('info', 'Loaded successfully');
    }

    protected async onUnload(): Promise<void> {
        this.log('info', 'Unloading...');
        this.state.clear();
        this.log('info', 'Unloaded');
    }
}

// Default export for dynamic loading
export default StateManagerPlugin;
