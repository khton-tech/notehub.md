
import type { IPlugin, PluginManifest, NotehubCore } from '@notehub/core';
import { ExplorerController } from './logic/ExplorerController';
import { FileTree } from './components/FileTree';
import { registerExplorerSettings } from './logic/ExplorerConfig';
import { registerExplorerMenus } from './menus';

export class ExplorerPlugin implements IPlugin {
    readonly manifest: PluginManifest = {
        id: 'nh.features.explorer',
        name: 'Explorer',
        version: '0.0.2',
        type: 'feature',
        dependencies: [
            'nh.system.fs-manager',
            'nh.ui.icon-manager',
            'nh.ui.theme-manager',
            'nh.ui.context-menu',
            'nh.ui.dialog-manager'
        ]
    };

    private app: NotehubCore | null = null;
    private controller: ExplorerController | null = null;

    /** Event cleanup functions for lifecycle hygiene */
    private eventCleanups: Array<() => void> = [];

    /** Menu cleanup function */
    private menuCleanup: (() => void) | null = null;

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

        // Register settings with settings-manager for UI
        registerExplorerSettings(app);

        this.controller = new ExplorerController(app);

        // Initialize controller
        await this.controller.init();

        // Register context menu providers
        this.menuCleanup = registerExplorerMenus(app, this.controller);
        this.log('info', 'Registered context menu providers');

        // Wrap the component with the controller instance
        const ExplorerTreeComponent = () => {
            if (!this.controller) return null;

            return (
                <FileTree
                    controller={this.controller}
                />
            );
        };

        // Register the UI component in the registry
        await app.api.invoke('controller:register', 'explorer-tree', ExplorerTreeComponent);

        // Register API to get root path (needed for PathResolver)
        app.api.register('explorer:get-root', () => this.controller?.root || null);

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

        // 0. Unregister API
        app.api.unregister('explorer:get-root');

        // 1. Cleanup context menu providers
        if (this.menuCleanup) {
            this.menuCleanup();
            this.menuCleanup = null;
        }

        // 2. Cleanup controller event subscriptions
        if (this.controller) {
            this.controller.cleanup();
        }

        // 3. Unsubscribe all event handlers
        for (const cleanup of this.eventCleanups) {
            try {
                cleanup();
            } catch (error) {
                this.log('warn', `Error during event cleanup: ${error}`);
            }
        }
        this.eventCleanups = [];

        // 4. Unregister the controller component
        app.api.invoke('controller:unregister', 'explorer-tree');

        // 5. Clear controller reference
        this.controller = null;

        // 6. Clear app reference
        this.app = null;

        this.log('info', 'Unloaded - all listeners cleaned up');
    }
}

export default ExplorerPlugin;
