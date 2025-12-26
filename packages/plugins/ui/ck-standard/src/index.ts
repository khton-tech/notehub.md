import type { IPlugin, PluginManifest, NotehubCore } from '@notehub/core';
import { Button, Label, Card, StatusBar, RibbonButton, EmptySlot, Checkbox } from './components';

export * from './components';

export class CKStandardPlugin implements IPlugin {
    readonly manifest: PluginManifest = {
        id: 'nh.ui.ck-standard',
        name: 'CKStandard',
        version: '1.0.0',
        type: 'ui',
    };

    private app: NotehubCore | null = null;

    private log(level: 'info' | 'warn' | 'error', message: string): void {
        if (this.app) {
            this.app.api.invoke(`logger:${level}`, this.manifest.id, message);
        }
    }

    async load(app: NotehubCore): Promise<void> {
        this.app = app;
        this.log('info', 'Loading...');

        // Register standard components as controllers
        app.api.invoke('controller:register', 'button', Button);
        app.api.invoke('controller:register', 'label', Label);
        app.api.invoke('controller:register', 'card', Card);
        app.api.invoke('controller:register', 'status-bar', StatusBar);
        app.api.invoke('controller:register', 'ribbon-button', RibbonButton);
        app.api.invoke('controller:register', 'empty-slot', EmptySlot);
        app.api.invoke('controller:register', 'checkbox', Checkbox);

        this.log('info', 'Loaded successfully');
    }

    async unload(_app: NotehubCore): Promise<void> {
        this.log('info', 'Unloading...');
        this.app = null;
        this.log('info', 'Unloaded');
    }
}

export default CKStandardPlugin;
