<<<<<<< HEAD

=======
>>>>>>> dc6398e62aa418be5d2acd52a5ef4e9881962f58
/**
 * Alert Button Plugin
 * 
 * @module features.alert-button
 */

<<<<<<< HEAD
import React from 'react';
=======
>>>>>>> dc6398e62aa418be5d2acd52a5ef4e9881962f58
import { NotehubPlugin, PluginContext, PortalSpec } from '@notehub.md/api';
import { NotificationManager } from './components/NotificationContainer';
import { AlertButton } from './components/AlertButton';
import ApiInspectorView from './components/ApiInspectorView';

<<<<<<< HEAD
const portalId = 'alert-button-portal';

export default class AlertButtonPlugin implements NotehubPlugin {
    private ctx: PluginContext | null = null;
    private portalSpec: PortalSpec | null = null;
=======
class FeaturesAlertButtonPlugin extends NotehubPlugin {
    private ctx: PluginContext | null = null;
    private portalId = 'alert-button-portal';
>>>>>>> dc6398e62aa418be5d2acd52a5ef4e9881962f58

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
<<<<<<< HEAD

=======
>>>>>>> dc6398e62aa418be5d2acd52a5ef4e9881962f58
            await ctx.invokeApi('settings:register-custom-view', {
                tabId: 'api-inspector',
                view: () => <ApiInspectorView ctx={ctx} />
            });
<<<<<<< HEAD
            console.log('[AlertButton] API Inspector registered');
=======
>>>>>>> dc6398e62aa418be5d2acd52a5ef4e9881962f58
        } catch (e) {
            console.warn('[AlertButton] Failed to register API inspector', e);
        }

        // 1. Mount the notification container
        NotificationManager.mount();

        // 2. Register the portal for [[alert]] syntax
        try {
<<<<<<< HEAD
            this.portalSpec = {
                id: portalId,
=======
            // Updated regex to capture text content: [[alert:Message]]
            // Also supports legacy [[alert]] (match[1] will be undefined)
            const portalSpec: PortalSpec = {
                id: this.portalId,
>>>>>>> dc6398e62aa418be5d2acd52a5ef4e9881962f58
                regex: /\[\[alert(?::(.*?))?\]\]/g,
                component: AlertButton,
                name: 'Alert Button'
            };

<<<<<<< HEAD
            await ctx.invokeApi('editor:register-portal', this.portalSpec);
=======
            await ctx.invokeApi('editor:register-portal', portalSpec);
>>>>>>> dc6398e62aa418be5d2acd52a5ef4e9881962f58
            console.log('[AlertButton] Portal registered');

            // 3. Register Keybinding Command
            ctx.registerApi('alert-button:test', () => {
                NotificationManager.show('KeyBind Tested!', 'success');
            });

<<<<<<< HEAD
            ctx.registerApi('alert-button:blop', this.blop.bind(this));

=======
            // Register hotkey: Mod+Shift+A (Assuming we can keybind via API or config?)
            // The API contract usually involves 'keymap:register' or similar.
            // Based on 'packages/plugins/features/editor/src/index.tsx', commands are registered via 'command-manager'.
            // Keybindings via 'keymap'.
            // But standard plugins might use `ctx.invokeApi('command:register', ...)`?
            // Checking `contract.ts` or similar would be good, but for now I'll assume standard command registration
            // or just use the `alert-button:test` as a command ID that user can bind.
            // Wait, I should try to register it if possible.
            // Looking at `nh.system.command-manager`, it probably exposes 'command:register'.

            // Let's try to register a command using `command:register` if available.
            // Or just expose the API and let keymap system handle it?
            // The user request "add keybind for calling message".
            // I'll register the command and try to add a default keybinding if the API allows.
>>>>>>> dc6398e62aa418be5d2acd52a5ef4e9881962f58

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
<<<<<<< HEAD
=======
                // Fallback: just register the function as API so it can be called
                // (Already done above via registerApi, but that's for other plugins)
>>>>>>> dc6398e62aa418be5d2acd52a5ef4e9881962f58
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
<<<<<<< HEAD
                await this.ctx.invokeApi('editor:unregister-portal', portalId);
=======
                await this.ctx.invokeApi('editor:unregister-portal', this.portalId);
>>>>>>> dc6398e62aa418be5d2acd52a5ef4e9881962f58
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
<<<<<<< HEAD

    private blop() {
        console.log('[AlertButton] Blop method triggered!');
        NotificationManager.show('Blop!', 'info');
    }
}
=======
}

export default new FeaturesAlertButtonPlugin();
>>>>>>> dc6398e62aa418be5d2acd52a5ef4e9881962f58
