import { SystemPlugin } from '@notehub/core';
import type { PluginManifest, NotehubCore } from '@notehub/core';
import { KeybindingsView } from './components/KeybindingsView';
import en from './locales/en';
import ru from './locales/ru';

export class KeybindingsPlugin extends SystemPlugin {
    readonly manifest: PluginManifest = {
        id: 'nh.features.keybindings',
        name: 'Hotkeys',
        version: '1.0.0',
        type: 'feature',
        dependencies: [
            'nh.ui.settings-manager',
            'nh.system.command-manager',
            'nh.system.keymap',
            'nh.system.i18n',
        ]
    };

    protected async onLoad(): Promise<void> {
        console.log('[Keybindings] Loading plugin...');

        this.app.api.invoke('i18n:register-namespace', 'keybindings', {
            en: en.keybindings,
            ru: ru.keybindings,
        });

        const t = (key: string) => this.app.api.invoke<string>('i18n:t', key);

        const registerTab = async () => {
            this.app.api.invoke('settings:register-tab', {
                id: 'keybindings',
                label: await t('keybindings.tab'),
                icon: 'keyboard',
                order: 20,
                category: 'core'
            });
        };

        await registerTab();

        this.registerEvent('i18n:language-changed', async () => {
            await registerTab();
        });

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
