import { useState, useEffect } from 'react';
import type { FC } from 'react';
import { SystemPlugin } from '@notehub/core';
import type { PluginManifest, NotehubCore } from '@notehub/core';
import { Button, Label, Card, StatusBar, RibbonButton, EmptySlot, type StatusBarProps, Toggle, Select, Input } from './components';

export * from './components';
import { HotkeyRecorder } from './components/HotkeyRecorder';
export { HotkeyRecorder };

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

export class CKStandardPlugin extends SystemPlugin {
    readonly manifest: PluginManifest = {
        id: 'nh.ui.ck-standard',
        name: 'CKStandard',
        version: '1.0.0',
        type: 'ui',
    };

    protected async onLoad(): Promise<void> {
        this.log('info', 'Loading...');

        // Create Smart StatusBar that listens to EventBus
        const SmartStatusBar = createSmartStatusBar(this.app);

        // Register standard components as controllers
        this.app.api.invoke('controller:register', 'button', Button);
        this.app.api.invoke('controller:register', 'label', Label);
        this.app.api.invoke('controller:register', 'card', Card);
        this.app.api.invoke('controller:register', 'status-bar', SmartStatusBar);
        this.app.api.invoke('controller:register', 'ribbon-button', RibbonButton);
        this.app.api.invoke('controller:register', 'empty-slot', EmptySlot);
        this.app.api.invoke('controller:register', 'toggle', Toggle);
        this.app.api.invoke('controller:register', 'select', Select);
        this.app.api.invoke('controller:register', 'input', Input);
        this.app.api.invoke('controller:register', 'hotkey-recorder', HotkeyRecorder);

        this.log('info', 'Loaded successfully');
    }

    protected async onUnload(): Promise<void> {
        this.log('info', 'Unloading...');
        this.log('info', 'Unloaded');
    }
}

export default CKStandardPlugin;
