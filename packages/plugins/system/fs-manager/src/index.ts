import type { IPlugin, PluginManifest, NotehubCore } from '@notehub/core';
import type { IFileSystem, DirEntry, CreateDirOptions } from './types.js';

// Re-export types for consumers
export * from './types.js';

/**
 * FsManagerPlugin - File System abstraction layer
 * 
 * This plugin provides a unified file system API that proxies calls
 * to an active driver. The driver must be registered via the
 * `fs:register-driver` API method before any FS operations can be performed.
 * 
 * API Methods:
 * - `fs:register-driver` - Register a file system driver
 * - `fs:read-file` - Read file as binary
 * - `fs:read-text-file` - Read file as text
 * - `fs:write-file` - Write binary to file
 * - `fs:write-text-file` - Write text to file
 * - `fs:create-dir` - Create directory
 * - `fs:read-dir` - List directory contents
 * - `fs:exists` - Check if path exists
 * - `fs:pick-directory` - Open native directory picker dialog
 */
export class FsManagerPlugin implements IPlugin {
    readonly manifest: PluginManifest = {
        id: 'nh.system.fs-manager',
        name: 'FsManager',
        version: '0.0.0',
        type: 'system',
    };

    private driver: IFileSystem | null = null;
    private driverName: string = '';
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
     * Load the plugin and register API methods
     */
    async load(app: NotehubCore): Promise<void> {
        this.app = app;
        this.log('info', 'Loading...');

        // Register driver registration API
        app.api.register('fs:register-driver', this.registerDriver.bind(this));

        // Register proxy methods
        app.api.register('fs:read-file', this.readFile.bind(this));
        app.api.register('fs:read-text-file', this.readTextFile.bind(this));
        app.api.register('fs:write-file', this.writeFile.bind(this));
        app.api.register('fs:write-text-file', this.writeTextFile.bind(this));
        app.api.register('fs:create-dir', this.createDir.bind(this));
        app.api.register('fs:read-dir', this.readDir.bind(this));
        app.api.register('fs:exists', this.exists.bind(this));
        app.api.register('fs:pick-directory', this.pickDirectory.bind(this));
        app.api.register('fs:watch', this.watch.bind(this));

        this.log('info', 'Loaded - awaiting driver registration');
    }

    /**
     * Unload the plugin
     */
    async unload(app: NotehubCore): Promise<void> {
        this.log('info', 'Unloading...');

        // Unregister all API methods
        app.api.unregister('fs:register-driver');
        app.api.unregister('fs:read-file');
        app.api.unregister('fs:read-text-file');
        app.api.unregister('fs:write-file');
        app.api.unregister('fs:write-text-file');
        app.api.unregister('fs:create-dir');
        app.api.unregister('fs:read-dir');
        app.api.unregister('fs:exists');
        app.api.unregister('fs:pick-directory');
        app.api.unregister('fs:watch');

        this.driver = null;
        this.driverName = '';

        this.log('info', 'Unloaded');
        this.app = null;
    }

    /**
     * Register a file system driver
     * @param driver - Driver implementing IFileSystem
     * @param name - Human-readable driver name for logging
     */
    private registerDriver(driver: IFileSystem, name: string = 'Unknown'): void {
        if (this.driver) {
            this.log('warn', `Replacing existing driver "${this.driverName}" with "${name}"`);
        }

        this.driver = driver;
        this.driverName = name;
        this.log('info', `Driver registered: ${name}`);
    }

    /**
     * Ensure driver is available, throw if not
     */
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
        return this.ensureDriver().writeFile(path, data);
    }

    private async writeTextFile(path: string, content: string): Promise<void> {
        return this.ensureDriver().writeTextFile(path, content);
    }

    private async createDir(path: string, options?: CreateDirOptions): Promise<void> {
        return this.ensureDriver().createDir(path, options);
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
}

// Default export for dynamic loading
export default FsManagerPlugin;
