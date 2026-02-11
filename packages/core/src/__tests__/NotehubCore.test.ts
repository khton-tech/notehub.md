import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotehubCore } from '../index.js';
import type { IPlugin, PluginManifest } from '../types.js';

function createMockPlugin(id: string, overrides?: Partial<IPlugin>): IPlugin {
    return {
        manifest: { id, name: id, version: '0.1.0', type: 'system' } as PluginManifest,
        load: vi.fn(),
        unload: vi.fn(),
        ...overrides,
    };
}

describe('NotehubCore', () => {
    let core: NotehubCore<any>;

    beforeEach(() => {
        vi.spyOn(console, 'log').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});
        core = new NotehubCore();
    });

    describe('constructor', () => {
        it('should create EventBus and ApiBus instances', () => {
            expect(core.events).toBeDefined();
            expect(core.api).toBeDefined();
        });

        it('should register built-in API discovery methods', () => {
            expect(core.api.has('api:list')).toBe(true);
            expect(core.api.has('api:has')).toBe(true);
            expect(core.api.has('api:info')).toBe(true);
            expect(core.api.has('api:list-with-metadata')).toBe(true);
        });

        it('should not be initialized on creation', () => {
            expect(core.isInitialized()).toBe(false);
        });
    });

    describe('registerPlugin', () => {
        it('should register a plugin', () => {
            const plugin = createMockPlugin('test-plugin');
            core.registerPlugin(plugin);

            expect(core.getPlugin('test-plugin')).toBe(plugin);
            expect(core.getPluginIds()).toContain('test-plugin');
        });

        it('should throw on duplicate registration', () => {
            core.registerPlugin(createMockPlugin('dup'));
            expect(() => core.registerPlugin(createMockPlugin('dup'))).toThrow('already registered');
        });
    });

    describe('unregisterPlugin', () => {
        it('should remove a registered plugin', () => {
            core.registerPlugin(createMockPlugin('p1'));
            expect(core.unregisterPlugin('p1')).toBe(true);
            expect(core.getPlugin('p1')).toBeUndefined();
        });

        it('should return false for non-existent plugin', () => {
            expect(core.unregisterPlugin('nope')).toBe(false);
        });
    });

    describe('getPlugins', () => {
        it('should iterate over all plugins', () => {
            core.registerPlugin(createMockPlugin('a'));
            core.registerPlugin(createMockPlugin('b'));

            const ids = Array.from(core.getPlugins()).map(([id]) => id);
            expect(ids).toEqual(['a', 'b']);
        });
    });

    describe('init', () => {
        it('should call load() on all plugins in order', async () => {
            const order: string[] = [];
            const p1 = createMockPlugin('p1', { load: vi.fn(async () => { order.push('p1'); }) });
            const p2 = createMockPlugin('p2', { load: vi.fn(async () => { order.push('p2'); }) });

            core.registerPlugin(p1);
            core.registerPlugin(p2);
            await core.init();

            expect(order).toEqual(['p1', 'p2']);
            expect(core.isInitialized()).toBe(true);
        });

        it('should pass core instance to load()', async () => {
            const plugin = createMockPlugin('p');
            core.registerPlugin(plugin);
            await core.init();

            expect(plugin.load).toHaveBeenCalledWith(core);
        });

        it('should call onReady after all plugins are loaded', async () => {
            const onReady = vi.fn();
            const plugin = createMockPlugin('p', { onReady });
            core.registerPlugin(plugin);
            await core.init();

            expect(onReady).toHaveBeenCalledWith(core);
        });

        it('should not double-initialize', async () => {
            core.registerPlugin(createMockPlugin('p'));
            await core.init();
            const plugin = core.getPlugin('p')!;
            (plugin.load as ReturnType<typeof vi.fn>).mockClear();

            await core.init(); // second call should be no-op
            expect(plugin.load).not.toHaveBeenCalled();
        });

        it('should throw if a plugin load fails', async () => {
            const plugin = createMockPlugin('bad', {
                load: vi.fn(async () => { throw new Error('boom'); }),
            });
            core.registerPlugin(plugin);

            await expect(core.init()).rejects.toThrow('boom');
        });
    });

    describe('callOnReady', () => {
        it('should not throw if onReady fails for a plugin', async () => {
            const plugin = createMockPlugin('p', {
                onReady: vi.fn(async () => { throw new Error('ready fail'); }),
            });
            core.registerPlugin(plugin);
            core.setInitialized(true);

            await expect(core.callOnReady()).resolves.toBeUndefined();
        });

        it('should skip plugins without onReady', async () => {
            const plugin = createMockPlugin('p');
            delete (plugin as any).onReady;
            core.registerPlugin(plugin);

            await expect(core.callOnReady()).resolves.toBeUndefined();
        });
    });

    describe('shutdown', () => {
        it('should call unload on all plugins in reverse order', async () => {
            const order: string[] = [];
            const p1 = createMockPlugin('p1', { unload: vi.fn(async () => { order.push('p1'); }) });
            const p2 = createMockPlugin('p2', { unload: vi.fn(async () => { order.push('p2'); }) });

            core.registerPlugin(p1);
            core.registerPlugin(p2);
            core.setInitialized(true);
            await core.shutdown();

            expect(order).toEqual(['p2', 'p1']); // reverse order
            expect(core.isInitialized()).toBe(false);
        });

        it('should not throw if a plugin unload fails', async () => {
            const plugin = createMockPlugin('bad', {
                unload: vi.fn(async () => { throw new Error('unload fail'); }),
            });
            core.registerPlugin(plugin);
            core.setInitialized(true);

            await expect(core.shutdown()).resolves.toBeUndefined();
        });

        it('should be no-op if not initialized', async () => {
            const plugin = createMockPlugin('p');
            core.registerPlugin(plugin);

            await core.shutdown();
            expect(plugin.unload).not.toHaveBeenCalled();
        });
    });

    describe('API discovery built-ins', () => {
        it('api:list should return registered methods', async () => {
            const methods = await core.api.invoke<string[]>('api:list');
            expect(methods).toContain('api:list');
            expect(methods).toContain('api:has');
        });

        it('api:has should check method existence', async () => {
            expect(await core.api.invoke('api:has', 'api:list')).toBe(true);
            expect(await core.api.invoke('api:has', 'nonexistent')).toBe(false);
        });
    });
});
