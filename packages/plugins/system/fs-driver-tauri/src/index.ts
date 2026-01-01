import type { IPlugin, PluginManifest, NotehubCore } from '@notehub/core';
import type { IFileSystem, DirEntry, CreateDirOptions } from '@notehub/fs-manager';
import * as tauriFs from '@tauri-apps/plugin-fs';
import { open } from '@tauri-apps/plugin-dialog';

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

    /** Active file watchers for cleanup on unload */
    private activeWatchers: Set<() => void> = new Set();

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
        this.log('info', 'Unloading...');

        // Clean up all active file watchers
        if (this.activeWatchers.size > 0) {
            this.log('info', `Cleaning up ${this.activeWatchers.size} active file watcher(s)`);
            for (const unwatch of this.activeWatchers) {
                try {
                    unwatch();
                } catch (error) {
                    this.log('warn', `Error during watcher cleanup: ${error}`);
                }
            }
            this.activeWatchers.clear();
        }

        this.app = null;
        this.log('info', 'Unloaded - all watchers cleaned up');
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

    async pickDirectory(): Promise<string | null> {
        try {
            const result = await open({ directory: true });
            return result ?? null;
        } catch (error) {
            this.log('error', `pickDirectory failed: ${error}`);
            return null;
        }
    }

    async watch(path: string, onChange: (event: import('@notehub/fs-manager').FsEvent) => void): Promise<() => void> {
        try {
            // @tauri-apps/plugin-fs v2 watch returns a Promise<UnlistenFn>
            // The event structure needs to be mapped to our FsEvent
            const unwatch = await tauriFs.watch(path, (event) => {
                // Tauri watch event: { type: 'any', paths: string[], attrs: any }
                // or specific types depending on the platform/backend.
                // We simplify to 'modify' for now or try to map if possible.
                // Note: The actual event structure depends on the backend (e.g., notify crate in Rust).

                // Usually event contains `type` (or `kind`) and `paths`.
                // We map to our simplified event.

                // Basic implementation - we just treat everything as a modification on the watched path
                // or specific subpaths if provided.

                // Debug log to see what we get (optional)
                // this.log('info', `Watch event: ${JSON.stringify(event)}`);

                // We assume event might look like { type: 'modify', paths: [...] }
                const paths = (event as any).paths || [path];
                const typeStr = (event as any).type || 'any';

                let type: 'create' | 'modify' | 'remove' | 'any' = 'any';
                if (typeof typeStr === 'string') {
                    if (typeStr.includes('create')) type = 'create';
                    else if (typeStr.includes('remove')) type = 'remove';
                    else if (typeStr.includes('modify')) type = 'modify';
                } else if (typeof typeStr === 'object') {
                    // Sometimes type is an object like { modify: { kind: 'data' } }
                    if ('create' in typeStr) type = 'create';
                    else if ('remove' in typeStr) type = 'remove';
                    else if ('modify' in typeStr) type = 'modify';
                }

                paths.forEach((p: string) => {
                    onChange({
                        path: p,
                        type: type
                    });
                });
            }, { recursive: true });

            // Create a wrapped cleanup function that removes from tracking set
            const cleanup = () => {
                unwatch();
                this.activeWatchers.delete(cleanup);
            };

            // Track this watcher for cleanup on unload
            this.activeWatchers.add(cleanup);

            this.log('info', `File watcher registered for: ${path}`);
            return cleanup;
        } catch (error) {
            this.log('error', `watch failed for ${path}: ${error}`);
            // Return empty cleanup if failed
            return () => { };
        }
    }

    async removeFile(path: string): Promise<void> {
        await tauriFs.remove(path);
    }

    async removeDir(path: string, options?: { recursive?: boolean }): Promise<void> {
        await tauriFs.remove(path, { recursive: options?.recursive ?? false });
    }

    async rename(oldPath: string, newPath: string): Promise<void> {
        await tauriFs.rename(oldPath, newPath);
    }
}

// Default export for dynamic loading
export default FsDriverTauriPlugin;

