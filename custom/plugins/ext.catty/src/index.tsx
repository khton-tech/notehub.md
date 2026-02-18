import { NotehubPlugin, PluginContext } from '@notehub.md/api';
import { CatStatusItem } from './CatStatusItem';

export default class CattyPlugin implements NotehubPlugin {
    private ctx: PluginContext | null = null;

    async onload(ctx: PluginContext): Promise<void> {
        this.ctx = ctx;
        console.log('[Catty] Loading...');

        // Register the component
        // Note: The API might expect 'controller:register' or similar. 
        // Based on analysis, 'controller:register' takes (name, component).
        ctx.registerApi('catty:get-status', () => 'Meowing');

        try {
            await ctx.invokeApi('controller:register', 'catty-status-item', CatStatusItem);

            // Add to status bar
            await ctx.invokeApi('statusbar:add-item', {
                id: 'catty-status',
                component: 'catty-status-item',
                position: 'right',
                priority: 100
            });
            console.log('[Catty] Meowing in status bar!');
        } catch (e) {
            console.error('[Catty] Failed to load:', e);
        }
    }

    async onunload(): Promise<void> {
        console.log('[Catty] Unloading...');
        if (this.ctx) {
            try {
                await this.ctx.invokeApi('statusbar:remove-item', 'catty-status');
                await this.ctx.invokeApi('controller:unregister', 'catty-status-item');
            } catch (e) {
                console.warn('[Catty] Error unloading:', e);
            }
        }
    }
}
