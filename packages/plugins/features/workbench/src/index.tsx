import type { IPlugin, PluginManifest, NotehubCore } from '@notehub/core';
import { RibbonPlaceholder, ExplorerPlaceholder, EditorPlaceholder } from './components/Placeholders';

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

        // Subscribe to vault opened event
        app.events.on('app:vault-opened', this.handleVaultOpened);

        // Register placeholders
        app.api.invoke('controller:register', 'ribbon-placeholder', RibbonPlaceholder);
        app.api.invoke('controller:register', 'explorer-placeholder', ExplorerPlaceholder);
        app.api.invoke('controller:register', 'editor-placeholder', EditorPlaceholder);

        // Auto-Login Check
        try {
            // Check if config-manager is available and get last opened vault
            const lastOpened = await app.api.invoke('config:get', 'vault.last-opened') as string;
            if (lastOpened && lastOpened.trim() !== '') {
                this.log('info', `Found last opened vault: ${lastOpened}, auto-opening...`);
                // Verify path exists (optional, but good practice if we had fs access here easily)
                // For now, just emit the event to simulate opening
                app.events.emit('app:vault-opened', { path: lastOpened });
            }
        } catch (error) {
            // state:get might fail if state-manager is not loaded or method not registered
            this.log('warn', 'Failed to check last opened vault or state-manager not ready');
        }

        this.log('info', 'Loaded successfully');
    }

    async unload(_app: NotehubCore): Promise<void> {
        this.log('info', 'Unloading...');

        app.events.off('app:vault-opened', this.handleVaultOpened);

        // We don't unregister controllers ideally, or we need a way to unregister them if API supports it.
        // controller:unregister is not in the interface I saw in ControllersManagerPlugin.
        // So we skip unregistering controllers for now.

        this.app = null;
        this.log('info', 'Unloaded');
    }
}

export default WorkbenchPlugin;
