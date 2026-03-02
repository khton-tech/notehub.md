import { SystemPlugin } from '@notehub/core';
import type { PluginManifest } from '@notehub/core';
import type { IFileSystem, DirEntry, CreateDirOptions } from '@notehub/fs-manager';
import * as tauriFs from '@tauri-apps/plugin-fs';
import { open } from '@tauri-apps/plugin-dialog';
import { platform } from '@tauri-apps/plugin-os';
import { invoke } from '@tauri-apps/api/core';

/**
 * FsDriverTauriPlugin - Tauri V2 file system driver
 *
 * Implements IFileSystem using @tauri-apps/plugin-fs on desktop
 * and custom Rust commands via tauri-plugin-android-fs on Android.
 * Registers itself with fs-manager on load.
 */
export class FsDriverTauriPlugin extends SystemPlugin implements IFileSystem {
    readonly manifest: PluginManifest = {
        id: 'nh.system.fs-driver-tauri',
        name: 'FsDriverTauri',
        version: '0.0.0',
        type: 'system',
        dependencies: ['nh.system.logger', 'nh.system.fs-manager'],
    };

    /** Whether running on Android (uses Rust commands for content:// URIs) */
    private isAndroid: boolean = false;

    /** Active file watchers for cleanup on unload */
    private activeWatchers: Set<() => void> = new Set();

    /**
     * Load the driver and register with fs-manager
     */
    protected async onLoad(): Promise<void> {
        this.log('info', 'Loading...');

        // Check if we're running in Tauri environment
        if (!this.isTauriEnvironment()) {
            this.log('warn', 'Not in Tauri environment, skipping registration');
            return;
        }

        // Detect platform for Android-specific handling
        try {
            const currentPlatform = platform();
            this.isAndroid = currentPlatform === 'android';
            this.log('info', `Platform detected: ${currentPlatform}, isAndroid: ${this.isAndroid}`);
        } catch (error) {
            this.log('warn', `Could not detect platform: ${error}`);
        }

        // Register this driver with fs-manager
        await this.app.api.invoke('fs:register-driver', this, 'Tauri');

        this.log('info', `Loaded and registered with fs-manager (Android mode: ${this.isAndroid})`);
    }

    /**
     * Unload the driver
     */
    protected async onUnload(): Promise<void> {
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
    // Each method checks isAndroid and routes to Rust commands or standard Tauri FS

    /**
     * Helper to resolve a path to { baseUri, relativePath } for Android SAF
     * Expects path format: /saf-root/<ENCODED_URI>/<RELATIVE_PATH>
     */
    private resolveSafPath(path: string): { baseUri: string, relativePath: string } {
        if (!path.startsWith('/saf-root/')) {
            throw new Error(`Invalid SAF path format: ${path}`);
        }

        // Remove prefix
        const cleanPath = path.substring('/saf-root/'.length);

        // Find first slash which separates URI from relative path
        const firstSlash = cleanPath.indexOf('/');

        if (firstSlash === -1) {
            // No slash means it's just the root URI
            return {
                baseUri: decodeURIComponent(cleanPath),
                relativePath: ''
            };
        }

        const encodedUri = cleanPath.substring(0, firstSlash);
        const relativePath = cleanPath.substring(firstSlash + 1);

        return {
            baseUri: decodeURIComponent(encodedUri),
            relativePath: relativePath
        };
    }

    // =============== IFileSystem Implementation ===============

    async readFile(path: string): Promise<Uint8Array> {
        if (this.isAndroid) {
            const { baseUri, relativePath } = this.resolveSafPath(path);
            const data = await invoke<number[]>('android_fs_read_file', { baseUri, path: relativePath });
            return new Uint8Array(data);
        }
        return await tauriFs.readFile(path);
    }

    async readTextFile(path: string): Promise<string> {
        if (this.isAndroid) {
            const { baseUri, relativePath } = this.resolveSafPath(path);
            return await invoke<string>('android_fs_read_text_file', { baseUri, path: relativePath });
        }
        return await tauriFs.readTextFile(path);
    }

    async writeFile(path: string, data: Uint8Array): Promise<void> {
        if (this.isAndroid) {
            const { baseUri, relativePath } = this.resolveSafPath(path);
            await invoke('android_fs_write_file', { baseUri, path: relativePath, data: Array.from(data) });
            return;
        }
        await tauriFs.writeFile(path, data);
    }

    async writeTextFile(path: string, content: string): Promise<void> {
        if (this.isAndroid) {
            const { baseUri, relativePath } = this.resolveSafPath(path);
            await invoke('android_fs_write_text_file', { baseUri, path: relativePath, content });
            return;
        }
        await tauriFs.writeTextFile(path, content);
    }

    async createDir(path: string, options?: CreateDirOptions): Promise<void> {
        if (this.isAndroid) {
            const { baseUri, relativePath } = this.resolveSafPath(path);
            const recursive = options?.recursive ?? false;
            await invoke('android_fs_create_dir', { baseUri, path: relativePath, recursive });
            return;
        }
        await tauriFs.mkdir(path, { recursive: options?.recursive ?? false });
    }

    async readDir(path: string): Promise<DirEntry[]> {
        if (this.isAndroid) {
            const { baseUri, relativePath } = this.resolveSafPath(path);
            const entries = await invoke<Array<{ name: string; isDirectory: boolean; isFile: boolean; uri: string }>>('android_fs_read_dir', { baseUri, path: relativePath });
            return entries.map(entry => ({
                name: entry.name,
                isDirectory: entry.isDirectory,
                isFile: entry.isFile,
            }));
        }
        const entries = await tauriFs.readDir(path);
        return entries.map(entry => ({
            name: entry.name,
            isDirectory: entry.isDirectory,
            isFile: entry.isFile,
        }));
    }

    async exists(path: string): Promise<boolean> {
        if (this.isAndroid) {
            const { baseUri, relativePath } = this.resolveSafPath(path);
            return await invoke<boolean>('android_fs_exists', { baseUri, path: relativePath });
        }
        return await tauriFs.exists(path);
    }

    async pickDirectory(): Promise<string | null> {
        this.log('info', '[pickDirectory] Starting directory picker...');

        try {
            // Detect current platform
            let currentPlatform = 'unknown';
            try {
                currentPlatform = platform();
                this.log('info', `[pickDirectory] Detected platform: ${currentPlatform}`);
            } catch (platformError) {
                this.log('warn', `[pickDirectory] Could not detect platform: ${platformError}`);
            }

            const isAndroid = currentPlatform === 'android';
            this.log('info', `[pickDirectory] Is Android: ${isAndroid}`);

            // On Android, use the native SAF folder picker
            if (isAndroid) {
                return await this.pickDirectoryAndroid();
            }

            // On Desktop, use the standard dialog
            return await this.pickDirectoryDesktop();
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const errorStack = error instanceof Error ? error.stack : 'No stack trace';
            this.log('error', `[pickDirectory] FAILED: ${errorMessage}`);
            this.log('error', `[pickDirectory] Stack: ${errorStack}`);
            return null;
        }
    }

    /**
     * Android-native folder picker using SAF (Storage Access Framework)
     * Calls the custom Rust command that uses tauri-plugin-android-fs
     */
    private async pickDirectoryAndroid(): Promise<string | null> {
        this.log('info', '[pickDirectoryAndroid] Using Android SAF picker via Rust command...');

        try {
            // Call our custom Rust command for Android folder picking
            this.log('info', '[pickDirectoryAndroid] Invoking pick_folder_android command...');
            const uri = await invoke<string | null>('pick_folder_android');

            this.log('info', `[pickDirectoryAndroid] Command returned: ${uri ?? 'null'}`);

            if (!uri) {
                this.log('info', '[pickDirectoryAndroid] User cancelled or no folder selected');
                return null;
            }

            // Encode the URI and prefix it so we can split it later
            const finalPath = `/saf-root/${encodeURIComponent(uri)}`;
            this.log('info', `[pickDirectoryAndroid] Final Path: ${finalPath}`);
            return finalPath;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.log('error', `[pickDirectoryAndroid] FAILED: ${errorMessage}`);
            return null;
        }
    }

    /**
     * Desktop folder picker using standard Tauri dialog
     */
    private async pickDirectoryDesktop(): Promise<string | null> {
        this.log('info', '[pickDirectoryDesktop] Using standard dialog picker...');

        try {
            const result = await open({
                directory: true,
                recursive: true,
            });

            this.log('info', `[pickDirectoryDesktop] open() returned: ${result === null ? 'null' : result}`);

            if (result === null || result === undefined) {
                this.log('info', '[pickDirectoryDesktop] User cancelled or no directory selected');
                return null;
            }

            return typeof result === 'string' ? result : String(result);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.log('error', `[pickDirectoryDesktop] FAILED: ${errorMessage}`);
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
        if (this.isAndroid) {
            const { baseUri, relativePath } = this.resolveSafPath(path);
            await invoke('android_fs_remove_file', { baseUri, path: relativePath });
            return;
        }
        await tauriFs.remove(path);
    }

    async removeDir(path: string, options?: { recursive?: boolean }): Promise<void> {
        if (this.isAndroid) {
            const { baseUri, relativePath } = this.resolveSafPath(path);
            const recursive = options?.recursive ?? false;
            await invoke('android_fs_remove_dir', { baseUri, path: relativePath, recursive });
            return;
        }
        await tauriFs.remove(path, { recursive: options?.recursive ?? false });
    }

    async rename(oldPath: string, newPath: string): Promise<void> {
        if (this.isAndroid) {
            // BUG-01 fix: pass the full relative destination path, not just the filename.
            // The previous implementation used only newPath.split('/').pop(), which made
            // cross-directory moves (DnD) behave as in-place renames on Android SAF.
            const { baseUri, relativePath: oldRelative } = this.resolveSafPath(oldPath);
            const { relativePath: newRelative } = this.resolveSafPath(newPath);
            await invoke('android_fs_rename', { baseUri, oldPath: oldRelative, newPath: newRelative });
            return;
        }
        await tauriFs.rename(oldPath, newPath);
    }

    async pickFile(options?: { extensions?: string[]; mimeTypes?: string[] }): Promise<string | null> {
        const dialogOptions = options?.extensions
            ? { directory: false as const, multiple: false as const, filters: [{ name: 'Allowed Files', extensions: options.extensions }] }
            : { directory: false as const, multiple: false as const };
        const result = await open(dialogOptions);
        if (result === null || result === undefined) return null;
        return typeof result === 'string' ? result : String(result);
    }
}

// Default export for dynamic loading
export default FsDriverTauriPlugin;
