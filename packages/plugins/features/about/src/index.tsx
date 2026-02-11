import { SystemPlugin } from '@notehub/core';
import type { PluginManifest } from '@notehub/core';
import { AboutView } from './components/AboutView';
import { GitPullRequest, Send } from 'lucide-react';

export class AboutPlugin extends SystemPlugin {
    readonly manifest: PluginManifest = {
        id: 'nh.features.about',
        name: 'About',
        version: '1.0.0',
        type: 'feature',

    };

    protected async onLoad(): Promise<void> {
        this.log('info', 'Loading...');

        // Register custom icons needed for the view
        this.app.api.invoke('icon:register', 'git-pull-request', GitPullRequest);
        this.app.api.invoke('icon:register', 'send', Send);

        // Register Settings Tab
        this.app.api.invoke('settings:register-tab', {
            id: 'about',
            label: 'About',
            icon: 'info',
            order: 999
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

        // Unregister tab
        this.app.api.invoke('settings:unregister-tab', 'about');

        this.log('info', 'Unloaded');
    }
}

export default AboutPlugin;
