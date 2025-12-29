import type { IPlugin, PluginManifest, NotehubCore } from '@notehub/core';
import { RibbonPlaceholder, EditorPlaceholder } from './components/Placeholders';

export class WorkbenchPlugin implements IPlugin {
    readonly manifest: PluginManifest = {
        id: 'nh.features.workbench',
        name: 'Workbench',
        version: '0.0.0',
        type: 'feature',
    };

    private app: NotehubCore | null = null;

    private log(level: 'info' | 'warn' | 'error', message: string): void {
        if (this.app) {
            this.app.api.invoke(`logger:${level}`, this.manifest.id, message);
        }
    }

    private handleVaultOpened = (): void => {
        this.log('info', 'Vault opened, switching layout to editor');
        this.app?.api.invoke('layout:set', 'editor');
    };

    async load(app: NotehubCore): Promise<void> {
        this.app = app;
        this.log('info', 'Loading...');

        // Subscribe to vault opened event - react to VaultPicker's emission
        // BUG-005 fix: VaultPicker handles auto-open logic, Workbench only listens
        app.events.on('app:vault-opened', this.handleVaultOpened);

        // Register placeholders
        app.api.invoke('controller:register', 'ribbon-placeholder', RibbonPlaceholder);
        app.api.invoke('controller:register', 'editor-placeholder', EditorPlaceholder);

        this.log('info', 'Loaded successfully');
    }

    async unload(_app: NotehubCore): Promise<void> {
        this.log('info', 'Unloading...');

        this.app?.events.off('app:vault-opened', this.handleVaultOpened);

        // We don't unregister controllers ideally, or we need a way to unregister them if API supports it.
        // controller:unregister is not in the interface I saw in ControllersManagerPlugin.
        // So we skip unregistering controllers for now.

        this.app = null;
        this.log('info', 'Unloaded');
    }
}

export default WorkbenchPlugin;
