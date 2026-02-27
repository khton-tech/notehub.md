import { SystemPlugin } from '@notehub/core';
import type { PluginManifest, NotehubCore } from '@notehub/core';
import { KeybindingsView } from './components/KeybindingsView';

export class KeybindingsPlugin extends SystemPlugin {
    readonly manifest: PluginManifest = {
        id: 'nh.features.keybindings',
        name: 'Hotkeys',

        version: '1.0.0',
        type: 'feature',
        dependencies: [
            "nh.ui.settings-manager",
            "nh.system.command-manager",
            "nh.system.keymap"
        ]
    };

    protected async onLoad(): Promise<void> {
        console.log('[Keybindings] Loading plugin...');
        // Register custom settings view
        this.app.api.invoke('settings:register-tab', {
            id: 'keybindings',
            label: 'Hotkeys',
            icon: 'keyboard',
            order: 20,
            category: 'core'
        });

        // Register custom view
        // The settings-manager API might need a specific structure or we register a view for the tab.
        // Based on settings-manager checking:
        // app.api.register('settings:register-custom-view', (args: { tabId: string; view: React.FC<any> }) => ...

        this.app.api.invoke('settings:register-custom-view', {
            tabId: 'keybindings',
            view: ({ app }: { app: NotehubCore }) => <KeybindingsView app={app} />
        });
    }

    protected async onUnload(): Promise<void> {
        this.app.api.invoke('settings:unregister-tab', 'keybindings');
    }
}

export default KeybindingsPlugin;
