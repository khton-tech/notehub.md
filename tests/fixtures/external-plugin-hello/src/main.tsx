import React from 'react';
import { NotehubPlugin, PluginContext } from '@notehub/api';

/**
 * Hello World External Plugin
 * 
 * This is a minimal fixture plugin to verify that:
 * 1. The Synapse loader correctly loads external plugins via SystemJS
 * 2. The @notehub/api shared scope is properly exposed
 * 3. API invocation and registration work from external context
 */
const HelloWorldPlugin: NotehubPlugin = {
    id: 'ext.hello-world',

    async onload(ctx: PluginContext): Promise<void> {
        // Test 1: Basic console logging
        console.log('🔥 HELLO FROM EXTERNAL PLUGIN 🔥');

        // Test 2: Invoke the logger API to verify API bus connectivity
        try {
            ctx.invokeApi('logger:info', 'ext.hello-world', 'I am alive!');
            console.log('✅ Successfully invoked logger:info API');
        } catch (error) {
            console.error('❌ Failed to invoke logger:info:', error);
        }

        // Test 3: Register a custom API command
        ctx.registerApi('ext.hello:greet', (name?: string) => {
            const greeting = `Hello, ${name || 'World'}! Greetings from ext.hello-world plugin.`;
            console.log('Command triggered:', greeting);

            // Try to invoke dialog API if available
            try {
                ctx.invokeApi('logger:info', 'ext.hello-world', greeting);
            } catch {
                // Dialog manager might not be loaded, that's okay for smoke test
            }

            return greeting;
        });

        console.log('✅ ext.hello:greet API registered');
        console.log('🎉 External plugin loaded successfully!');
    },

    async onunload(): Promise<void> {
        console.log('👋 GOODBYE FROM EXTERNAL PLUGIN 👋');
    }
};

export default HelloWorldPlugin;
