/**
 * @fileoverview Stress Test Plugin Entry Point
 */

import { NotehubPlugin, PluginContext } from '@notehub/api';
import React from 'react';

export default class StressTestPlugin extends NotehubPlugin {
    async onload(ctx: PluginContext): Promise<void> {
        console.log('[StressTest] Loading plugin...', React.version);

        // 1. Register Settings Tab
        ctx.invokeApi('settings:register-tab', {
            id: 'test-lab',
            label: 'Test Lab',
            icon: 'flask-conical',
            order: 100
        });

        // 2. Register Group
        ctx.invokeApi('settings:register-group', {
            id: 'test-controls',
            tabId: 'test-lab',
            label: 'Interactive Controls',
            order: 10
        });

        // 3. Register Items
        ctx.invokeApi('settings:register-items', [
            {
                key: 'ext.stress.enabled',
                type: 'toggle',
                label: 'Enable Hyper Mode',
                description: 'Activates the stress testing submodule',
                groupId: 'test-controls',
                order: 10,
                defaultValue: false
            },
            {
                key: 'ext.stress.name',
                type: 'text',
                label: 'Tester Name',
                description: 'Who is running this test?',
                groupId: 'test-controls',
                order: 20,
                placeholder: 'Enter name...'
            }
        ]);

        // 4. Register Command (API)
        ctx.registerApi('ext.stress:hello', async () => {
            await ctx.invokeApi('dialog:alert', 'Stress Test', 'Hello from the isolated world!');
        });

        console.log('[StressTest] Loaded successfully');
    }

    async onunload(): Promise<void> {
        console.log('[StressTest] Unloading...');
    }
}
