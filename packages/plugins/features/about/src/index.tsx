import { SystemPlugin } from '@notehub/core';
import type { PluginManifest } from '@notehub/core';
import { AboutView } from './components/AboutView';
import { GitPullRequest, Send } from 'lucide-react';
import en from './locales/en';
import ru from './locales/ru';

export class AboutPlugin extends SystemPlugin {
    readonly manifest: PluginManifest = {
        id: 'nh.features.about',
        name: 'About',
        version: '1.0.0',
        type: 'feature',
        dependencies: [
            'nh.ui.settings-manager',
            'nh.ui.icon-manager',
            'nh.system.i18n',
        ],
    };

    protected async onLoad(): Promise<void> {
        this.log('info', 'Loading...');

        this.app.api.invoke('i18n:register-namespace', 'about', {
            en: en.about,
            ru: ru.about,
        });

        // Register custom icons needed for the view
        this.app.api.invoke('icon:register', 'git-pull-request', GitPullRequest);
        this.app.api.invoke('icon:register', 'send', Send);

        const t = (key: string) => this.app.api.invoke<string>('i18n:t', key);

        const registerTab = async () => {
            this.app.api.invoke('settings:register-tab', {
                id: 'about',
                label: await t('about.tab'),
                icon: 'info',
                order: 999,
                category: 'core'
            });
        };

        await registerTab();

        this.registerEvent('i18n:language-changed', async () => {
            await registerTab();
        });

        // Register Custom View
        this.app.api.invoke('settings:register-custom-view', {
            tabId: 'about',
            view: AboutView,
        });

        this.log('info', 'Loaded successfully');
    }

    protected async onUnload(): Promise<void> {
        this.log('info', 'Unloading...');
        this.app.api.invoke('settings:unregister-tab', 'about');
        this.log('info', 'Unloaded');
    }
}

export default AboutPlugin;
