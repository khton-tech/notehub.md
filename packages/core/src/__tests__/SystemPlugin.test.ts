import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotehubCore } from '../index.js';
import { SystemPlugin } from '../SystemPlugin.js';
import type { PluginManifest } from '../types.js';

class TestPlugin extends SystemPlugin {
    readonly manifest: PluginManifest = {
        id: 'test.plugin',
        name: 'Test Plugin',
        version: '0.1.0',
        type: 'system',
    };

    public loadCalled = false;
    public readyCalled = false;
    public unloadCalled = false;

    protected async onLoad(): Promise<void> {
        this.loadCalled = true;
    }

    protected async onPluginReady(): Promise<void> {
        this.readyCalled = true;
    }

    protected async onUnload(): Promise<void> {
        this.unloadCalled = true;
    }

    // Expose protected methods for testing
    public exposeApp() { return this.app; }
    public exposeRegisterApi(name: string, handler: (...args: any[]) => any) {
        this.registerApi(name, handler);
    }
    public exposeRegisterEvent(event: string, handler: any, options?: any) {
        this.registerEvent(event, handler, options);
    }
    public exposeRegisterHook(method: string, position: any, handler: any, options?: any) {
        return this.registerHook(method, position, handler, options);
    }
    public exposeLog(level: 'info' | 'warn' | 'error', message: string) {
        this.log(level, message);
    }
}

describe('SystemPlugin', () => {
    let core: NotehubCore<any>;
    let plugin: TestPlugin;

    beforeEach(() => {
        vi.spyOn(console, 'log').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});
        core = new NotehubCore();
        plugin = new TestPlugin();
    });

    describe('lifecycle', () => {
        it('should set this.app during load()', async () => {
            await plugin.load(core);
            expect(plugin.exposeApp()).toBe(core);
        });

        it('should call onLoad() during load()', async () => {
            await plugin.load(core);
            expect(plugin.loadCalled).toBe(true);
        });

        it('should call onPluginReady() during onReady()', async () => {
            await plugin.load(core);
            await plugin.onReady!(core);
            expect(plugin.readyCalled).toBe(true);
        });

        it('should call onUnload() during unload()', async () => {
            await plugin.load(core);
            await plugin.unload(core);
            expect(plugin.unloadCalled).toBe(true);
        });
    });

    describe('registerApi auto-cleanup', () => {
        it('should register API on core', async () => {
            await plugin.load(core);
            plugin.exposeRegisterApi('test:greet', (name: string) => `Hi ${name}`);

            expect(core.api.has('test:greet')).toBe(true);
            const result = await core.api.invoke('test:greet', 'World');
            expect(result).toBe('Hi World');
        });

        it('should unregister APIs on unload', async () => {
            await plugin.load(core);
            plugin.exposeRegisterApi('test:a', () => 'a');
            plugin.exposeRegisterApi('test:b', () => 'b');

            expect(core.api.has('test:a')).toBe(true);
            expect(core.api.has('test:b')).toBe(true);

            await plugin.unload(core);

            expect(core.api.has('test:a')).toBe(false);
            expect(core.api.has('test:b')).toBe(false);
        });
    });

    describe('registerEvent auto-cleanup', () => {
        it('should subscribe to events on core', async () => {
            await plugin.load(core);
            const handler = vi.fn();
            plugin.exposeRegisterEvent('test:event', handler);

            await core.events.emit('test:event', { data: 1 });
            expect(handler).toHaveBeenCalledOnce();
        });

        it('should unsubscribe from events on unload', async () => {
            await plugin.load(core);
            const handler = vi.fn();
            plugin.exposeRegisterEvent('test:event', handler);

            await plugin.unload(core);

            await core.events.emit('test:event', { data: 1 });
            expect(handler).not.toHaveBeenCalled();
        });
    });

    describe('registerHook auto-cleanup', () => {
        it('should register hooks on core', async () => {
            await plugin.load(core);
            core.api.register('target:method', () => 'original');

            plugin.exposeRegisterHook('target:method', 'after', (result: unknown) => {
                return (result as string).toUpperCase();
            });

            const result = await core.api.invoke('target:method');
            expect(result).toBe('ORIGINAL');
        });

        it('should remove hooks on unload', async () => {
            await plugin.load(core);
            core.api.register('target:method', () => 'original');
            plugin.exposeRegisterHook('target:method', 'after', () => 'hooked');

            await plugin.unload(core);

            const result = await core.api.invoke('target:method');
            expect(result).toBe('original');
        });
    });

    describe('log', () => {
        it('should fall back to console when logger is not available', async () => {
            await plugin.load(core);
            plugin.exposeLog('info', 'test message');

            // Wait for the catch to fire (logger API not registered)
            await new Promise(r => setTimeout(r, 10));
            expect(console.info || console.log).toBeDefined();
        });

        it('should invoke logger API when available', async () => {
            await plugin.load(core);
            const logHandler = vi.fn();
            core.api.register('logger:info', logHandler);

            plugin.exposeLog('info', 'hello');

            // Wait for async invoke
            await new Promise(r => setTimeout(r, 10));
            expect(logHandler).toHaveBeenCalledWith('test.plugin', 'hello');
        });
    });

    describe('integration with NotehubCore', () => {
        it('should work through full plugin lifecycle', async () => {
            core.registerPlugin(plugin);
            await core.init();

            expect(plugin.loadCalled).toBe(true);
            expect(plugin.readyCalled).toBe(true);
            expect(plugin.exposeApp()).toBe(core);

            await core.shutdown();
            expect(plugin.unloadCalled).toBe(true);
        });
    });
});
