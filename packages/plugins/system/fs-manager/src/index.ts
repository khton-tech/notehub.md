import { SystemPlugin } from '@notehub/core';
import type { PluginManifest } from '@notehub/core';
import type { IFileSystem, DirEntry, CreateDirOptions } from './types.js';

// Re-export types for consumers
export * from './types.js';

/**
 * FsManagerPlugin - File System abstraction layer
 */
export class FsManagerPlugin extends SystemPlugin {
    readonly manifest: PluginManifest = {
        id: 'nh.system.fs-manager',
        name: 'FsManager',
        version: '0.0.0',
        type: 'system',
    };

    private driver: IFileSystem | null = null;
    private driverName: string = '';

    // Write locks per file path to prevent concurrent writes
    private writeLocks = new Map<string, Promise<void>>();

    /** Timeout for waiting on an existing write lock (ms) */
    private static readonly WRITE_LOCK_TIMEOUT = 30_000;

    protected async onLoad(): Promise<void> {
        this.log('info', 'Loading...');

        this.registerApi('fs:register-driver', this.registerDriver.bind(this));
        this.registerApi('fs:read-file', this.readFile.bind(this));
        this.registerApi('fs:read-text-file', this.readTextFile.bind(this));
        this.registerApi('fs:write-file', this.writeFile.bind(this));
        this.registerApi('fs:write-text-file', this.writeTextFile.bind(this));
        this.registerApi('fs:create-dir', this.createDir.bind(this));
        this.registerApi('fs:read-dir', this.readDir.bind(this));
        this.registerApi('fs:exists', this.exists.bind(this));
        this.registerApi('fs:pick-directory', this.pickDirectory.bind(this));
        this.registerApi('fs:watch', this.watch.bind(this));
        this.registerApi('fs:remove-file', this.removeFile.bind(this));
        this.registerApi('fs:remove-dir', this.removeDir.bind(this));
        this.registerApi('fs:rename', this.rename.bind(this));

        this.log('info', 'Loaded - awaiting driver registration');
    }

    protected async onUnload(): Promise<void> {
        this.log('info', 'Unloading...');
        this.driver = null;
        this.driverName = '';
        this.log('info', 'Unloaded');
    }

    private registerDriver(driver: IFileSystem, name: string = 'Unknown'): void {
        if (this.driver) {
            this.log('warn', `Replacing existing driver "${this.driverName}" with "${name}"`);
        }
        this.driver = driver;
        this.driverName = name;
        this.log('info', `Driver registered: ${name}`);
    }

    private ensureDriver(): IFileSystem {
        if (!this.driver) {
            const error = 'No FS Driver available';
            this.log('error', error);
            throw new Error(error);
        }
        return this.driver;
    }

    // =============== Proxy Methods ===============

    private async readFile(path: string): Promise<Uint8Array> {
        return this.ensureDriver().readFile(path);
    }

    private async readTextFile(path: string): Promise<string> {
        return this.ensureDriver().readTextFile(path);
    }

    private async writeFile(path: string, data: Uint8Array): Promise<void> {
        let isNew = false;
        try {
            isNew = !(await this.ensureDriver().exists(path));
        } catch { /* assume existing */ }

        const existingLock = this.writeLocks.get(path);
        const newLock = (async () => {
            if (existingLock) {
                await Promise.race([
                    existingLock.catch(() => {}),
                    new Promise<void>(resolve => setTimeout(resolve, FsManagerPlugin.WRITE_LOCK_TIMEOUT))
                ]);
            }
            await this.ensureDriver().writeFile(path, data);
        })();
        this.writeLocks.set(path, newLock);
        try {
            await newLock;
            this.app.events.emit('fs:written', { path, isNew });
        } finally {
            if (this.writeLocks.get(path) === newLock) {
                this.writeLocks.delete(path);
            }
        }
    }

    private async writeTextFile(path: string, content: string): Promise<void> {
        // Check if file exists before write to determine isNew
        let isNew = false;
        try {
            isNew = !(await this.ensureDriver().exists(path));
        } catch { /* assume existing */ }

        const existingLock = this.writeLocks.get(path);
        const newLock = (async () => {
            if (existingLock) {
                await Promise.race([
                    existingLock.catch(() => {}),
                    new Promise<void>(resolve => setTimeout(resolve, FsManagerPlugin.WRITE_LOCK_TIMEOUT))
                ]);
            }
            await this.ensureDriver().writeTextFile(path, content);
        })();
        this.writeLocks.set(path, newLock);
        try {
            await newLock;
            this.app.events.emit('fs:written', { path, isNew });
        } finally {
            if (this.writeLocks.get(path) === newLock) {
                this.writeLocks.delete(path);
            }
        }
    }

    private async createDir(path: string, options?: CreateDirOptions): Promise<void> {
        await this.ensureDriver().createDir(path, options);
        this.app.events.emit('fs:dir-created', { path });
    }

    private async readDir(path: string): Promise<DirEntry[]> {
        return this.ensureDriver().readDir(path);
    }

    private async exists(path: string): Promise<boolean> {
        return this.ensureDriver().exists(path);
    }

    private async pickDirectory(): Promise<string | null> {
        return this.ensureDriver().pickDirectory();
    }

    private async watch(path: string, onChange: (event: import('./types.js').FsEvent) => void): Promise<() => void> {
        return this.ensureDriver().watch(path, onChange);
    }

    private async removeFile(path: string): Promise<void> {
        await this.ensureDriver().removeFile(path);
        this.app.events.emit('fs:deleted', { path, isDirectory: false });
    }

    private async removeDir(path: string, options?: { recursive?: boolean }): Promise<void> {
        await this.ensureDriver().removeDir(path, options);
        this.app.events.emit('fs:deleted', { path, isDirectory: true });
    }

    private async rename(oldPath: string, newPath: string): Promise<void> {
        await this.ensureDriver().rename(oldPath, newPath);
        this.app.events.emit('fs:renamed', { oldPath, newPath });
    }
}

// Default export for dynamic loading
export default FsManagerPlugin;
