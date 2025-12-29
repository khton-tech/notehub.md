
import type { IPlugin, PluginManifest, NotehubCore } from '@notehub/core';
import { ExplorerController } from './logic/ExplorerController';
import { FileTree } from './components/FileTree';

export class ExplorerPlugin implements IPlugin {
    readonly manifest: PluginManifest = {
        id: 'nh.features.explorer',
        name: 'Explorer',
        version: '0.0.1',
        type: 'feature',
        dependencies: ['nh.system.fs-manager', 'nh.ui.icon-manager', 'nh.ui.theme-manager']
    };

    private app: NotehubCore | null = null;
    private controller: ExplorerController | null = null;

    /** Event cleanup functions for lifecycle hygiene */
    private eventCleanups: Array<() => void> = [];

    /**
     * Log a message via the Logger plugin
     */
    private log(level: 'info' | 'warn' | 'error', message: string): void {
        if (this.app) {
            this.app.api.invoke(`logger:${level}`, this.manifest.id, message);
        }
    }

    async load(app: NotehubCore): Promise<void> {
        this.app = app;
        this.log('info', 'Loading...');

        this.controller = new ExplorerController(app);

        // Initialize controller
        await this.controller.init();

        // Wrap the component with the controller instance
        // We use a functional component wrapper to pass the controller
        const ExplorerTreeComponent = () => {
            // In a real app we might want to use a context or a hook to access the controller
            // but here we have the instance in the closure.
            if (!this.controller) return null;

            return (
                <FileTree
                    controller={this.controller}
                />
            );
        };

        // Register the UI component in the registry
        await app.api.invoke('controller:register', 'explorer-tree', ExplorerTreeComponent);

        // === Event Handlers with proper cleanup tracking ===

        // Handler for 'explorer:open' event
        const openHandler = async (payload: any) => {
            const path = typeof payload === 'string' ? payload : payload.path;
            if (path && this.controller) {
                await this.controller.setRoot(path);
            }
        };
        app.events.on('explorer:open', openHandler);
        this.eventCleanups.push(() => app.events.off('explorer:open', openHandler));

        // Handler for 'app:vault-opened' event
        const vaultOpenedHandler = async (payload: any) => {
            const path = typeof payload === 'string' ? payload : payload.path;
            if (path && this.controller) {
                await this.controller.setRoot(path);
            }
        };
        app.events.on('app:vault-opened', vaultOpenedHandler);
        this.eventCleanups.push(() => app.events.off('app:vault-opened', vaultOpenedHandler));

        this.log('info', 'Loaded successfully');
    }

    async unload(app: NotehubCore): Promise<void> {
        this.log('info', 'Unloading...');

        // === LIFECYCLE HYGIENE: Proper cleanup ===

        // 1. Unsubscribe all event handlers
        for (const cleanup of this.eventCleanups) {
            try {
                cleanup();
            } catch (error) {
                this.log('warn', `Error during event cleanup: ${error}`);
            }
        }
        this.eventCleanups = [];

        // 2. Unregister the controller component
        app.api.invoke('controller:unregister', 'explorer-tree');

        // 3. Dispose controller (stops fs:watch, clears state) - BUG-002 fix
        if (this.controller) {
            this.controller.dispose();
            this.controller = null;
        }

        // 4. Clear app reference
        this.app = null;

        this.log('info', 'Unloaded - all listeners cleaned up');
    }
}

export default ExplorerPlugin;
