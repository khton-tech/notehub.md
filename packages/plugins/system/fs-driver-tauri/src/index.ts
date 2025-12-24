import type { IPlugin, PluginManifest, NotehubCore } from '@notehub/core';
import type { IFileSystem, DirEntry, CreateDirOptions } from '@notehub/fs-manager';
import * as tauriFs from '@tauri-apps/plugin-fs';

/**
 * FsDriverTauriPlugin - Tauri V2 file system driver
 * 
 * Implements IFileSystem using @tauri-apps/plugin-fs.
 * Registers itself with fs-manager on load.
 */
export class FsDriverTauriPlugin implements IPlugin, IFileSystem {
    readonly manifest: PluginManifest = {
        id: 'nh.system.fs-driver-tauri',
        name: 'FsDriverTauri',
        version: '0.0.0',
        type: 'system',
        dependencies: ['nh.system.logger', 'nh.system.fs-manager'],
    };

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
     * Load the driver and register with fs-manager
     */
    async load(app: NotehubCore): Promise<void> {
        this.app = app;
        this.log('info', 'Loading...');

        // Check if we're running in Tauri environment
        if (!this.isTauriEnvironment()) {
            this.log('warn', 'Not in Tauri environment, skipping registration');
            return;
        }

        // Register this driver with fs-manager
        await app.api.invoke('fs:register-driver', this, 'Tauri');

        this.log('info', 'Loaded and registered with fs-manager');
    }

    /**
     * Unload the driver
     */
    async unload(_app: NotehubCore): Promise<void> {
        this.log('info', 'Unloaded');
        this.app = null;
    }

    /**
     * Check if running in Tauri environment
     */
    private isTauriEnvironment(): boolean {
        // Tauri v2: check for __TAURI_INTERNALS__ which is the new global
        return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
    }

    // =============== IFileSystem Implementation ===============

    async readFile(path: string): Promise<Uint8Array> {
        return await tauriFs.readFile(path);
    }

    async readTextFile(path: string): Promise<string> {
        return await tauriFs.readTextFile(path);
    }

    async writeFile(path: string, data: Uint8Array): Promise<void> {
        await tauriFs.writeFile(path, data);
    }

    async writeTextFile(path: string, content: string): Promise<void> {
        await tauriFs.writeTextFile(path, content);
    }

    async createDir(path: string, options?: CreateDirOptions): Promise<void> {
        await tauriFs.mkdir(path, { recursive: options?.recursive ?? false });
    }

    async readDir(path: string): Promise<DirEntry[]> {
        const entries = await tauriFs.readDir(path);
        return entries.map(entry => ({
            name: entry.name,
            isDirectory: entry.isDirectory,
            isFile: entry.isFile,
        }));
    }

    async exists(path: string): Promise<boolean> {
        return await tauriFs.exists(path);
    }
}

// Default export for dynamic loading
export default FsDriverTauriPlugin;
