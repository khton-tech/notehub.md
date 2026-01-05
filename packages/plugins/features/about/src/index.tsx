import type { IPlugin, PluginManifest, NotehubCore } from '@notehub/core';
import { AboutView } from './components/AboutView';
import { GitPullRequest, Send } from 'lucide-react';

export class AboutPlugin implements IPlugin {
    readonly manifest: PluginManifest = {
        id: 'nh.features.about',
        name: 'About',
        version: '1.0.0',
        type: 'feature',

    };

    private app: NotehubCore | null = null;
    private logPrefix = '[About]';

    private log(message: string) {
        if (this.app) {
            this.app.api.invoke('logger:info', this.manifest.id, message);
        }
    }

    async load(app: NotehubCore): Promise<void> {
        this.app = app;
        this.log('Loading...');

        // Register custom icons needed for the view
        app.api.invoke('icon:register', 'git-pull-request', GitPullRequest);
        app.api.invoke('icon:register', 'send', Send);

        // Register Settings Tab
        app.api.invoke('settings:register-tab', {
            id: 'about',
            label: 'About',
            icon: 'info',
            order: 999
        });

        // Register Custom View
        app.api.invoke('settings:register-custom-view', {
            tabId: 'about',
            view: AboutView,
        });

        this.log('Loaded successfully');
    }

    async unload(app: NotehubCore): Promise<void> {
        this.log('Unloading...');

        // Unregister tab
        app.api.invoke('settings:unregister-tab', 'about');

        this.app = null;
        this.log('Unloaded');
    }
}

export default AboutPlugin;
