/**
 * Test Plugin Plugin
 * 
 * @module ext.test-plugin
 */

import { NotehubPlugin, PluginContext } from '@notehub/api';

class ExtTestPluginPlugin extends NotehubPlugin {
    async onload(ctx: PluginContext): Promise<void> {
        console.log('Test Plugin plugin loaded!');
        // написать в консоли "ЭТО КАК ТО РАБОТАЕТ!!!" красной ошибкой
        console.error('ЭТО КАК ТО РАБОТАЕТ!!!');
        // Register an API endpoint
        // ctx.registerApi('ext.test-plugin:hello', (name: string) => `Hello, ${name}!`);

        // Subscribe to events
        // ctx.subscribe('note:saved', (payload) => {
        //     console.log('Note saved:', payload);
        // });
    }

    async onunload(): Promise<void> {
        console.log('Test Plugin plugin unloaded!');
        // Cleanup is automatic for APIs and subscriptions
    }
}

export default new ExtTestPluginPlugin();
