import { useState, useEffect } from 'react';
import type { FC } from 'react';
import type { IPlugin, PluginManifest, NotehubCore } from '@notehub/core';
import { Button, Label, Card, StatusBar, RibbonButton, EmptySlot, type StatusBarProps } from './components';

export * from './components';

/**
 * Status report payload from EventBus
 */
interface StatusReport {
    source: string;
    status: 'ready' | 'saving' | 'error';
    message: string;
}

/**
 * Create a StatusBar wrapper that subscribes to EventBus for status updates
 */
function createSmartStatusBar(app: NotehubCore): FC<Partial<StatusBarProps>> {
    return function SmartStatusBar(props: Partial<StatusBarProps>) {
        const [status, setStatus] = useState<'ready' | 'saving' | 'error'>('ready');
        const [message, setMessage] = useState<string>('Ready');

        useEffect(() => {
            const handleStatusReport = (payload: unknown) => {
                const report = payload as StatusReport;
                if (report && report.status && report.message) {
                    setStatus(report.status);
                    setMessage(report.message);
                }
            };

            app.events.on('app:status-report', handleStatusReport);

            return () => {
                app.events.off('app:status-report', handleStatusReport);
            };
        }, []);

        // Props can override EventBus state if provided
        return (
            <StatusBar
                status={props.status ?? status}
                message={props.message ?? message}
            />
        );
    };
}

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

        // Create Smart StatusBar that listens to EventBus
        const SmartStatusBar = createSmartStatusBar(app);

        // Register standard components as controllers
        app.api.invoke('controller:register', 'button', Button);
        app.api.invoke('controller:register', 'label', Label);
        app.api.invoke('controller:register', 'card', Card);
        app.api.invoke('controller:register', 'status-bar', SmartStatusBar);
        app.api.invoke('controller:register', 'ribbon-button', RibbonButton);
        app.api.invoke('controller:register', 'empty-slot', EmptySlot);

        this.log('info', 'Loaded successfully');
    }

    async unload(_app: NotehubCore): Promise<void> {
        this.log('info', 'Unloading...');
        this.app = null;
        this.log('info', 'Unloaded');
    }
}

export default CKStandardPlugin;
