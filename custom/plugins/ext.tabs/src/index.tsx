
import { NotehubPlugin, PluginContext } from '@notehub.md/api';
import { TabBar } from './components/TabBar';
import React from 'react';

export default class TabsPlugin extends NotehubPlugin {
    private ctx: PluginContext | null = null;

    async onload(ctx: PluginContext): Promise<void> {
        this.ctx = ctx;
        console.log('[Tabs] Loading...');

        // 1. Register the component as a controller
        // We wrap it to pass the context prop
        const TabBarComponent = () => <TabBar ctx={ctx} />;

        try {
            await ctx.invokeApi('controller:register', 'ext.tabs:tab-bar', TabBarComponent);

            // 2. Register into the Layout Zone
            // ZoneId.TABBAR = 'tabbar'
            await ctx.invokeApi('zone:register', 'tabbar', {
                component: 'ext.tabs:tab-bar',
                priority: 10
            });

            console.log('[Tabs] Registered in tabbar zone');
        } catch (e) {
            console.error('[Tabs] Failed to register:', e);
        }
    }

    async onunload(): Promise<void> {
        console.log('[Tabs] Unloading...');
        // SystemPlugin handles unregistering API calls automatically.
        // We just clear our reference.
        this.ctx = null;
    }
}
