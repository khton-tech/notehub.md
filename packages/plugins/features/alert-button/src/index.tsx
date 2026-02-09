/**
 * Alert Button Plugin
 * 
 * @module features.alert-button
 */

import { NotehubPlugin, PluginContext, PortalSpec } from '@notehub.md/api';
import { NotificationManager } from './components/NotificationContainer';
import { AlertButton } from './components/AlertButton';
import ApiInspectorView from './components/ApiInspectorView';

class FeaturesAlertButtonPlugin extends NotehubPlugin {
    private ctx: PluginContext | null = null;
    private portalId = 'alert-button-portal';

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
        } catch (e) {
            console.warn('[AlertButton] Failed to register API inspector', e);
        }

        // 1. Mount the notification container
        NotificationManager.mount();

        // 2. Register the portal for [[alert]] syntax
        try {
            // Updated regex to capture text content: [[alert:Message]]
            // Also supports legacy [[alert]] (match[1] will be undefined)
            const portalSpec: PortalSpec = {
                id: this.portalId,
                regex: /\[\[alert(?::(.*?))?\]\]/g,
                component: AlertButton,
                name: 'Alert Button'
            };

            await ctx.invokeApi('editor:register-portal', portalSpec);
            console.log('[AlertButton] Portal registered');

            // 3. Register Keybinding Command
            ctx.registerApi('alert-button:test', () => {
                NotificationManager.show('KeyBind Tested!', 'success');
            });

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
                // Fallback: just register the function as API so it can be called
                // (Already done above via registerApi, but that's for other plugins)
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
                await this.ctx.invokeApi('editor:unregister-portal', this.portalId);
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
}

export default new FeaturesAlertButtonPlugin();
