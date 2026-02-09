import type { IPlugin, PluginManifest, NotehubCore } from '@notehub/core';
import type { IFileSystem, DirEntry, CreateDirOptions } from '@notehub/fs-manager';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';

import { FilePicker } from '@capawesome/capacitor-file-picker';

/**
 * FsDriverCapacitorPlugin - Capacitor file system driver
 */
export class FsDriverCapacitorPlugin implements IPlugin, IFileSystem {
    readonly manifest: PluginManifest = {
        id: 'nh.system.fs-driver-capacitor',
        name: 'FsDriverCapacitor',
        version: '0.1.0',
        type: 'system',
        dependencies: ['nh.system.logger', 'nh.system.fs-manager'],
    };

    private app: NotehubCore | null = null;
    private defaultDirectory = Directory.Documents;

    private log(level: 'info' | 'warn' | 'error', message: string): void {
        if (this.app) {
            this.app.api.invoke(`logger:${level}`, this.manifest.id, message);
        } else {
            console.log(`[${this.manifest.id}] [${level}] ${message}`);
        }
    }

    async load(app: NotehubCore): Promise<void> {
        this.app = app;
        this.log('info', 'Loading Capacitor FS Driver...');
        await app.api.invoke('fs:register-driver', this, 'Capacitor');

        // Request permissions on load
        try {
            const status = await Filesystem.checkPermissions();
            this.log('info', `Initial permission status: ${JSON.stringify(status)}`);
            if (status.publicStorage !== 'granted') {
                const request = await Filesystem.requestPermissions();
                this.log('info', `Permission request result: ${JSON.stringify(request)}`);
            }
        } catch (e) {
            this.log('warn', `Failed to check/request permissions: ${e}`);
        }

        this.log('info', 'Loaded and registered with fs-manager');
    }

    async unload(_app: NotehubCore): Promise<void> {
        this.log('info', 'Unloading...');
        this.app = null;
    }

    private parseAndroidUri(uri: string): { path: string, directory: Directory } | null {
        if (!uri.startsWith('content:')) return null;

        try {
            // Handle com.android.externalstorage.documents
            // Example: content://com.android.externalstorage.documents/tree/primary%3ADownload%2FHui
            if (uri.includes('com.android.externalstorage.documents')) {
                const parts = uri.split('primary%3A');
                if (parts.length > 1) {
                    const relativePath = decodeURIComponent(parts[1]);
                    return {
                        path: relativePath,
                        directory: Directory.ExternalStorage
                    };
                }
                const partsDecoded = uri.split('primary:');
                if (partsDecoded.length > 1) {
                    const relativePath = decodeURIComponent(partsDecoded[1]);
                    return {
                        path: relativePath,
                        directory: Directory.ExternalStorage
                    };
                }
            }
        } catch (e) {
            console.error('Failed to parse URI:', e);
        }

        return null;
    }

    private resolvePath(path: string): { path: string, directory: Directory } {
        this.log('info', `Resolving path: ${path}`);
        if (path.startsWith('content:')) {
            const parsed = this.parseAndroidUri(path);
            if (parsed) {
                this.log('info', `Parsed content URI: ${JSON.stringify(parsed)}`);
                // Ensure we don't start with / for ExternalStorage if it expects relative
                return {
                    path: parsed.path.replace(/^\/+/, ''),
                    directory: parsed.directory
                };
            }
            this.log('error', `Failed to parse content URI: ${path}`);
            // Fallback: try to just pass it through in case some plugins handle it, 
            // but log warning.
            return {
                path: path,
                // @ts-ignore
                directory: undefined
            };
        }

        return {
            path: this.normalizePath(path),
            directory: this.defaultDirectory
        };
    }

    private normalizePath(path: string): string {
        // If it's a content URI, don't strip leading slashes (though usually they don't have them in the wrong place)
        // actually, content:// URIs shouldn't be touched violently.
        if (path.startsWith('content:')) {
            return path;
        }
        return path.replace(/^\/+/, '');
    }

    async readFile(path: string): Promise<Uint8Array> {
        try {
            const { path: resolvedPath, directory } = this.resolvePath(path);
            const result = await Filesystem.readFile({
                path: resolvedPath,
                directory: directory,
            });

            if (typeof result.data === 'string') {
                const binaryString = atob(result.data);
                const len = binaryString.length;
                const bytes = new Uint8Array(len);
                for (let i = 0; i < len; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                return bytes;
            } else {
                return new Uint8Array(0);
            }
        } catch (e) {
            // Diagnostic logging for ENOENT
            try {
                this.log('error', `readFile failed for ${path}: ${e}`);

                // Try to list parent dir to see what IS there
                const parentPath = path.substring(0, path.lastIndexOf('/'));
                const fileName = path.substring(path.lastIndexOf('/') + 1);

                this.log('info', `Listing parent dir: ${parentPath} to look for ${fileName}`);
                const parentEntries = await this.readDir(parentPath);

                const found = parentEntries.find(f => f.name === fileName);
                this.log('info', `File ${fileName} found in listing? ${!!found}`);

                // Log char codes of requested name
                const charCodes = fileName.split('').map(c => c.charCodeAt(0)).join(',');
                this.log('info', `Requested Name CharCodes: ${charCodes}`);

                // Log all entries
                parentEntries.forEach(entry => {
                    const entryCodes = entry.name.split('').map(c => c.charCodeAt(0)).join(',');
                    this.log('info', `Entry: ${entry.name} [${entryCodes}] (Match: ${entry.name === fileName})`);
                });

            } catch (err2) {
                this.log('error', `Failed to run diagnostics: ${err2}`);
            }

            throw new Error(`readFile failed: ${e}`);
        }
    }

    async readTextFile(path: string): Promise<string> {
        try {
            const { path: resolvedPath, directory } = this.resolvePath(path);
            const result = await Filesystem.readFile({
                path: resolvedPath,
                directory: directory,
                encoding: Encoding.UTF8,
            });
            return result.data as string;
        } catch (e) {
            throw new Error(`readTextFile failed: ${e}`);
        }
    }

    async writeFile(path: string, data: Uint8Array): Promise<void> {
        try {
            const { path: resolvedPath, directory } = this.resolvePath(path);
            let binary = '';
            const len = data.byteLength;
            for (let i = 0; i < len; i++) {
                binary += String.fromCharCode(data[i]);
            }
            const base64 = btoa(binary);

            await Filesystem.writeFile({
                path: resolvedPath,
                data: base64,
                directory: directory,
            });
        } catch (e) {
            throw new Error(`writeFile failed: ${e}`);
        }
    }

    async writeTextFile(path: string, content: string): Promise<void> {
        try {
            const { path: resolvedPath, directory } = this.resolvePath(path);
            await Filesystem.writeFile({
                path: resolvedPath,
                data: content,
                directory: directory,
                encoding: Encoding.UTF8,
            });
        } catch (e) {
            throw new Error(`writeTextFile failed: ${e}`);
        }
    }

    async createDir(path: string, options?: CreateDirOptions): Promise<void> {
        try {
            const { path: resolvedPath, directory } = this.resolvePath(path);
            await Filesystem.mkdir({
                path: resolvedPath,
                directory: directory,
                recursive: options?.recursive ?? false,
            });
        } catch (e) {
            if (e instanceof Error && e.message.includes('exists') && options?.recursive) {
                return;
            }
            throw new Error(`createDir failed: ${e}`);
        }
    }

    async readDir(path: string): Promise<DirEntry[]> {
        try {
            const { path: resolvedPath, directory } = this.resolvePath(path);
            const result = await Filesystem.readdir({
                path: resolvedPath,
                directory: directory,
            });

            return result.files.map(f => ({
                name: f.name,
                isDirectory: f.type === 'directory',
                isFile: f.type === 'file',
            }));
        } catch (e) {
            throw new Error(`readDir failed: ${e}`);
        }
    }

    async exists(path: string): Promise<boolean> {
        try {
            const { path: resolvedPath, directory } = this.resolvePath(path);
            await Filesystem.stat({
                path: resolvedPath,
                directory: directory,
            });
            return true;
        } catch (e) {
            return false;
        }
    }

    async pickDirectory(): Promise<string | null> {
        try {
            const result = await FilePicker.pickDirectory();
            if (result.path) {
                return result.path;
            }
            return null;
        } catch (error) {
            this.log('warn', `pickDirectory failed/cancelled: ${error}`);
            return null;
        }
    }

    async watch(_path: string, _onChange: (event: any) => void): Promise<() => void> {
        this.log('warn', 'watch not implemented on Capacitor');
        return () => { };
    }

    async removeFile(path: string): Promise<void> {
        const { path: resolvedPath, directory } = this.resolvePath(path);
        await Filesystem.deleteFile({
            path: resolvedPath,
            directory: directory,
        });
    }

    async removeDir(path: string, options?: { recursive?: boolean }): Promise<void> {
        const { path: resolvedPath, directory } = this.resolvePath(path);
        await Filesystem.rmdir({
            path: resolvedPath,
            directory: directory,
            recursive: options?.recursive,
        });
    }

    async rename(oldPath: string, newPath: string): Promise<void> {
        // For rename, we need to handle mixed cases? 
        // Usually oldPath and newPath are in the same context.
        // If oldPath is content URI, newPath should be too? 
        // Or Capacitor Rename might not support content URIs easily if they are different roots.
        // But typically rename is within the same dir.

        const resolvedOld = this.resolvePath(oldPath);
        const resolvedNew = this.resolvePath(newPath);

        await Filesystem.rename({
            from: resolvedOld.path,
            to: resolvedNew.path,
            directory: resolvedOld.directory,
            toDirectory: resolvedNew.directory,
        });
    }
}

export default FsDriverCapacitorPlugin;
