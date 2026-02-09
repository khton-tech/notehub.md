
/**
 * Alert Button Plugin
 * 
 * @module features.alert-button
 */

import React from 'react';
import { NotehubPlugin, PluginContext, PortalSpec } from '@notehub.md/api';
import { NotificationManager } from './components/NotificationContainer';
import { AlertButton } from './components/AlertButton';
import ApiInspectorView from './components/ApiInspectorView';

const portalId = 'alert-button-portal';

export default class AlertButtonPlugin implements NotehubPlugin {
    private ctx: PluginContext | null = null;
    private portalSpec: PortalSpec | null = null;

    async onload(ctx: PluginContext): Promise<void> {
        this.ctx = ctx;
        console.log('[AlertButton] Loading...');

        // Register API Inspector
        try {
            await ctx.invokeApi('settings:register-tab', {
                id: 'api-inspector',
                label: 'API List',
                icon: 'list',
                order: 100
            });

            await ctx.invokeApi('settings:register-custom-view', {
                tabId: 'api-inspector',
                view: () => <ApiInspectorView ctx={ctx} />
            });
            console.log('[AlertButton] API Inspector registered');
        } catch (e) {
            console.warn('[AlertButton] Failed to register API inspector', e);
        }

        // 1. Mount the notification container
        NotificationManager.mount();

        // 2. Register the portal for [[alert]] syntax
        try {
            this.portalSpec = {
                id: portalId,
                regex: /\[\[alert(?::(.*?))?\]\]/g,
                component: AlertButton,
                name: 'Alert Button'
            };

            await ctx.invokeApi('editor:register-portal', this.portalSpec);
            console.log('[AlertButton] Portal registered');

            // 3. Register Keybinding Command
            ctx.registerApi('alert-button:test', () => {
                NotificationManager.show('KeyBind Tested!', 'success');
            });

            ctx.registerApi('alert-button:blop', this.blop.bind(this));


            try {
                await ctx.invokeApi('command:register', {
                    id: 'alert-button:test',
                    name: 'Test Alert Keybinding',
                    description: 'Triggers a test alert notification',
                    handler: () => NotificationManager.show('KeyBind Tested!', 'success'),
                    defaultHotkey: 'Mod+Shift+A'
                });
            } catch (e) {
                console.warn('[AlertButton] Failed to register command:', e);
            }

        } catch (error) {
            console.error('[AlertButton] Failed to initialize:', error);
        }
    }

    async onunload(): Promise<void> {
        console.log('[AlertButton] Unloading...');

        // 1. Unmount notification container
        NotificationManager.unmount();

        // 2. Unregister portal
        if (this.ctx) {
            try {
                await this.ctx.invokeApi('editor:unregister-portal', portalId);
                console.log('[AlertButton] Portal unregistered');
            } catch (error) {
                console.warn('[AlertButton] Failed to unregister portal', error);
            }

            try {
                await this.ctx.invokeApi('settings:unregister-tab', 'api-inspector');
            } catch (e) {
                console.warn('[AlertButton] Failed to unregister settings tab', e);
            }

            this.ctx = null;
        }
    }

    private blop() {
        console.log('[AlertButton] Blop method triggered!');
        NotificationManager.show('Blop!', 'info');
    }
}
