import type { IPlugin, PluginManifest, NotehubCore } from '@notehub/core';
import { RibbonPlaceholder, EditorPlaceholder } from './components/Placeholders';
import { VaultSwitchButton } from './components/VaultSwitchButton';
import { SettingsButton } from './components/SettingsButton';

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

        // Restore active file
        // We delay slightly to ensure editor layout is ready and editor plugin is listening,
        // although layout:set should trigger mounting which might take a tick.
        setTimeout(async () => {
            try {
                const lastFile = await this.app?.api.invoke('config:get', 'workbench.last-active-file') as string;
                if (lastFile) {
                    this.log('info', `Restoring last active file: ${lastFile}`);
                    this.app?.api.invoke('editor:open', lastFile);
                }
            } catch (e) {
                this.log('warn', 'Failed to restore active file');
            }
        }, 100);
    };

    private handleFileOpened = (payload: unknown): void => {
        const path = payload as string;
        // Save active file
        // Note: editor:open sends path as string usually, or an object?
        // User provided: "Subscribe to editor:file-opened ... Handler: api.invoke('config:set'..."
        // We assume call sends path.
        if (typeof path === 'string') {
            this.app?.api.invoke('config:set', 'workbench.last-active-file', path);
        }
    };

    async load(app: NotehubCore): Promise<void> {
        this.app = app;
        this.log('info', 'Loading...');

        // Subscribe to vault opened event
        app.events.on('app:vault-opened', this.handleVaultOpened);

        // Subscribe to editor file opened
        app.events.on('editor:file-opened', this.handleFileOpened);

        // Register placeholders
        app.api.invoke('controller:register', 'ribbon-placeholder', RibbonPlaceholder);
        // app.api.invoke('controller:register', 'explorer-placeholder', ExplorerPlaceholder);
        app.api.invoke('controller:register', 'editor-placeholder', EditorPlaceholder);

        // Register ribbon-bottom controller (Close Vault button)
        app.api.invoke('controller:register', 'ribbon-bottom', VaultSwitchButton);

        // Register settings button
        app.api.invoke('controller:register', 'settings-button', SettingsButton);
        app.api.invoke('zone:register', 'ribbon-bottom', { component: 'settings-button', priority: 0 });

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

        this.app?.events.off('app:vault-opened', this.handleVaultOpened);
        this.app?.events.off('editor:file-opened', this.handleFileOpened);

        // We don't unregister controllers ideally, or we need a way to unregister them if API supports it.
        // controller:unregister is not in the interface I saw in ControllersManagerPlugin.
        // So we skip unregistering controllers for now.

        this.app = null;
        this.log('info', 'Unloaded');
    }
}

export default WorkbenchPlugin;
