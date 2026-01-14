import type { IPlugin, PluginManifest, NotehubCore } from '@notehub/core';
import { KeybindingsView } from './components/KeybindingsView';

export class KeybindingsPlugin implements IPlugin {
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

    async load(app: NotehubCore): Promise<void> {
        console.log('[Keybindings] Loading plugin...');
        // Register custom settings view
        app.api.invoke('settings:register-tab', {
            id: 'keybindings',
            label: 'Hotkeys',
            icon: 'keyboard',
            order: 20
        });

        // Register custom view
        // The settings-manager API might need a specific structure or we register a view for the tab.
        // Based on settings-manager checking:
        // app.api.register('settings:register-custom-view', (args: { tabId: string; view: React.FC<any> }) => ...

        app.api.invoke('settings:register-custom-view', {
            tabId: 'keybindings',
            view: ({ app }: { app: NotehubCore }) => <KeybindingsView app={app} />
        });
    }

    async unload(app: NotehubCore): Promise<void> {
        app.api.invoke('settings:unregister-tab', 'keybindings');
    }
}

export default KeybindingsPlugin;
