import { SystemPlugin } from '@notehub/core';
import type { PluginManifest } from '@notehub/core';
import { Bootloader, type LoadablePlugin, type BootloaderResult } from './Bootloader.js';

// Re-export all public types and classes
export * from './schema.js';
export * from './graph/index.js';
export { Bootloader, type LoadablePlugin, type BootloaderResult, type PluginLoadResult } from './Bootloader.js';

/**
 * Bootloader Plugin - System component for plugin orchestration
 */
export class BootloaderPlugin extends SystemPlugin {
    readonly manifest: PluginManifest = {
        id: 'nh.system.bootloader',
        name: 'Bootloader',
        version: '0.1.0',
        type: 'system',
    };

    private bootloader: Bootloader | null = null;
    private lastResult: BootloaderResult | null = null;

    protected async onLoad(): Promise<void> {
        this.log('info', 'Loading...');

        this.bootloader = new Bootloader(this.app);

        this.registerApi('bootloader.load', this.loadPlugins.bind(this) as (plugins: unknown[]) => Promise<unknown>);
        this.registerApi('bootloader.getResult', this.getLastResult.bind(this) as () => unknown);
        this.registerApi('bootloader.getInstance', this.getInstance.bind(this) as () => unknown);

        this.log('info', 'Loaded successfully');
    }

    protected async onUnload(): Promise<void> {
        this.log('info', 'Unloading...');
        this.bootloader = null;
        this.lastResult = null;
        this.log('info', 'Unloaded successfully');
    }

    private async loadPlugins(plugins: LoadablePlugin[]): Promise<BootloaderResult> {
        if (!this.bootloader) {
            throw new Error('Bootloader not initialized');
        }
        this.lastResult = await this.bootloader.load(plugins);
        return this.lastResult;
    }

    private getLastResult(): BootloaderResult | null {
        return this.lastResult;
    }

    private getInstance(): Bootloader | null {
        return this.bootloader;
    }
}

// Default export for dynamic loading
export default BootloaderPlugin;
