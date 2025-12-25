
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

    // private app: NotehubCore | null = null; // Unused
    private controller: ExplorerController | null = null;
    private unsubscribe: (() => void) | null = null;

    async load(app: NotehubCore): Promise<void> {
        // this.app = app;
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
        // We assume 'controller:register' is the method used by other plugins (e.g. ck-standard)
        await app.api.invoke('controller:register', 'explorer-tree', ExplorerTreeComponent);

        // Expose API to open a folder (e.g. from Vault Picker or Menu)
        // We assume 'api:register' is not how we register methods, usually we handle events or use a service registry
        // But since IPlugin is basic, let's subscribe to an event 'explorer:open'
        // Expose API ...
        const openHandler = async (payload: any) => {
            const path = typeof payload === 'string' ? payload : payload.path;
            if (path && this.controller) {
                await this.controller.setRoot(path);
            }
        };
        app.events.on('explorer:open', openHandler);
        this.unsubscribe = () => {
            app.events.off('explorer:open', openHandler);
        };

        // Also listen for 'vault:opened' if such event exists from previous tasks 
        // (Vault Persistence task mentioned 'vault.last-opened')
        // Let's assume there's a 'vault:opened' event.
        // Also listen for 'app:vault-opened' as emitted by Workbench/VaultPicker
        app.events.on('app:vault-opened', async (payload: any) => {
            const path = typeof payload === 'string' ? payload : payload.path;
            if (path && this.controller) {
                await this.controller.setRoot(path);
            }
        });

        console.log('Explorer plugin loaded');
    }

    async unload(_app: NotehubCore): Promise<void> {
        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
        }
        this.controller = null;
        // this.app = null;
    }
}

export default ExplorerPlugin;
