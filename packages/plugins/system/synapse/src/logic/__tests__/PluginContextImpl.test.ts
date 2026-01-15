import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { PluginContextImpl } from '../PluginContextImpl';
import type { NotehubCore } from '@notehub/core';

/**
 * Mock NotehubCore instance for testing
 */
function createMockCore(): NotehubCore {
    const registeredApis = new Map<string, (...args: unknown[]) => unknown>();
    const eventHandlers = new Map<string, Set<(...args: unknown[]) => void>>();

    return {
        api: {
            register: vi.fn((name: string, handler: (...args: unknown[]) => unknown) => {
                if (registeredApis.has(name)) {
                    throw new Error(`API "${name}" is already registered`);
                }
                registeredApis.set(name, handler);
            }),
            unregister: vi.fn((name: string) => {
                const existed = registeredApis.has(name);
                registeredApis.delete(name);
                return existed;
            }),
            invoke: vi.fn(async (name: string, ...args: unknown[]) => {
                const handler = registeredApis.get(name);
                if (handler) {
                    return handler(...args);
                }
                // Return silently for APIs that are tracked but not registered in mock
                if (name.startsWith('logger:') ||
                    name.startsWith('editor:') ||
                    name.startsWith('settings:') ||
                    name.startsWith('config:')) {
                    return;
                }
                throw new Error(`Handler "${name}" is not registered`);
            }),
            has: vi.fn((name: string) => registeredApis.has(name)),
        },
        events: {
            on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
                if (!eventHandlers.has(event)) {
                    eventHandlers.set(event, new Set());
                }
                eventHandlers.get(event)!.add(handler);
            }),
            off: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
                const handlers = eventHandlers.get(event);
                if (handlers) {
                    handlers.delete(handler);
                }
            }),
            emit: vi.fn((event: string, payload: unknown) => {
                const handlers = eventHandlers.get(event);
                if (handlers) {
                    handlers.forEach(h => h(payload));
                }
            }),
        },
    } as unknown as NotehubCore;
}

describe('PluginContextImpl', () => {
    let ctx: PluginContextImpl;
    let mockCore: NotehubCore;

    beforeEach(() => {
        mockCore = createMockCore();
        ctx = new PluginContextImpl(mockCore, 'test-plugin');
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    // =========================================================================
    // Constructor & Basic State
    // =========================================================================

    describe('constructor', () => {
        it('should create context with initial state', () => {
            expect(ctx.isDisposed()).toBe(false);
            expect(ctx.getStats()).toEqual({
                registeredApis: 0,
                eventSubscriptions: 0,
                registeredWidgets: 0,
                settings: 0,
            });
        });
    });

    // =========================================================================
    // API Registration
    // =========================================================================

    describe('registerApi', () => {
        it('should register an API with the core', () => {
            const handler = vi.fn();
            ctx.registerApi('test:api', handler);

            expect(mockCore.api.register).toHaveBeenCalledWith('test:api', handler);
            expect(ctx.getStats().registeredApis).toBe(1);
        });

        it('should track multiple API registrations', () => {
            ctx.registerApi('test:api1', vi.fn());
            ctx.registerApi('test:api2', vi.fn());
            ctx.registerApi('test:api3', vi.fn());

            expect(ctx.getStats().registeredApis).toBe(3);
        });

        it('should throw if context is disposed', () => {
            ctx.cleanup();

            expect(() => ctx.registerApi('test:api', vi.fn())).toThrow(
                /Cannot call registerApi\(\) - context has been disposed/
            );
        });

        it('should propagate registration errors', () => {
            // Register once
            ctx.registerApi('test:api', vi.fn());

            // Try to register again (mock throws)
            expect(() => ctx.registerApi('test:api', vi.fn())).toThrow(
                /API "test:api" is already registered/
            );
        });
    });

    // =========================================================================
    // API Invocation
    // =========================================================================

    describe('invokeApi', () => {
        it('should invoke API through core', async () => {
            const handler = vi.fn().mockReturnValue('result');
            (mockCore.api.register as any)('test:api', handler);

            await ctx.invokeApi('test:api', 'arg1', 'arg2');

            expect(mockCore.api.invoke).toHaveBeenCalledWith('test:api', 'arg1', 'arg2');
        });

        it('should throw if context is disposed', async () => {
            ctx.cleanup();

            await expect(ctx.invokeApi('test:api')).rejects.toThrow(
                /Cannot call invokeApi\(\) - context has been disposed/
            );
        });
    });

    // =========================================================================
    // Portal Tracking (Critical for auto-cleanup)
    // =========================================================================

    describe('portal tracking', () => {
        it('should track portal registration for cleanup', async () => {
            await ctx.invokeApi('editor:register-portal', {
                id: 'my-portal',
                regex: /test/g,
                component: () => null,
            });

            expect(ctx.getStats().registeredWidgets).toBe(1);
        });

        it('should track multiple portals', async () => {
            await ctx.invokeApi('editor:register-portal', { id: 'portal-1', regex: /a/g, component: () => null });
            await ctx.invokeApi('editor:register-portal', { id: 'portal-2', regex: /b/g, component: () => null });
            await ctx.invokeApi('editor:register-portal', { id: 'portal-3', regex: /c/g, component: () => null });

            expect(ctx.getStats().registeredWidgets).toBe(3);
        });

        it('should NOT track if spec has no id', async () => {
            await ctx.invokeApi('editor:register-portal', { regex: /test/g, component: () => null });

            expect(ctx.getStats().registeredWidgets).toBe(0);
        });

        it('should NOT track non-portal APIs', async () => {
            await ctx.invokeApi('logger:info', 'test', 'message');
            await ctx.invokeApi('config:get', 'key');

            expect(ctx.getStats().registeredWidgets).toBe(0);
        });
    });

    // =========================================================================
    // Settings Tracking
    // =========================================================================

    describe('settings tracking', () => {
        it('should track tab registration', async () => {
            await ctx.invokeApi('settings:register-tab', { id: 'my-tab', label: 'My Tab' });

            expect(ctx.getStats().settings).toBe(1);
        });

        it('should track group registration', async () => {
            await ctx.invokeApi('settings:register-group', { id: 'my-group', tabId: 'my-tab' });

            expect(ctx.getStats().settings).toBe(1);
        });

        it('should track item registration', async () => {
            await ctx.invokeApi('settings:register-item', { key: 'my.setting', type: 'toggle' });

            expect(ctx.getStats().settings).toBe(1);
        });

        it('should track batch tab registration', async () => {
            await ctx.invokeApi('settings:register-tabs', [
                { id: 'tab-1' },
                { id: 'tab-2' },
            ]);

            expect(ctx.getStats().settings).toBe(2);
        });

        it('should track batch group registration', async () => {
            await ctx.invokeApi('settings:register-groups', [
                { id: 'group-1' },
                { id: 'group-2' },
                { id: 'group-3' },
            ]);

            expect(ctx.getStats().settings).toBe(3);
        });

        it('should track batch item registration', async () => {
            await ctx.invokeApi('settings:register-items', [
                { key: 'setting.a' },
                { key: 'setting.b' },
            ]);

            expect(ctx.getStats().settings).toBe(2);
        });
    });

    // =========================================================================
    // Event Subscriptions
    // =========================================================================

    describe('subscribe', () => {
        it('should subscribe to events', () => {
            const handler = vi.fn();
            ctx.subscribe('test:event', handler);

            expect(mockCore.events.on).toHaveBeenCalledWith('test:event', handler);
            expect(ctx.getStats().eventSubscriptions).toBe(1);
        });

        it('should track multiple subscriptions', () => {
            ctx.subscribe('event1', vi.fn());
            ctx.subscribe('event2', vi.fn());
            ctx.subscribe('event3', vi.fn());

            expect(ctx.getStats().eventSubscriptions).toBe(3);
        });

        it('should throw if context is disposed', () => {
            ctx.cleanup();

            expect(() => ctx.subscribe('event', vi.fn())).toThrow(
                /Cannot call subscribe\(\) - context has been disposed/
            );
        });
    });

    // =========================================================================
    // Cleanup (Most Critical)
    // =========================================================================

    describe('cleanup', () => {
        it('should unregister all APIs', () => {
            ctx.registerApi('api1', vi.fn());
            ctx.registerApi('api2', vi.fn());

            ctx.cleanup();

            expect(mockCore.api.unregister).toHaveBeenCalledWith('api1');
            expect(mockCore.api.unregister).toHaveBeenCalledWith('api2');
            expect(ctx.isDisposed()).toBe(true);
        });

        it('should unsubscribe all events', () => {
            const handler1 = vi.fn();
            const handler2 = vi.fn();
            ctx.subscribe('event1', handler1);
            ctx.subscribe('event2', handler2);

            ctx.cleanup();

            expect(mockCore.events.off).toHaveBeenCalledWith('event1', handler1);
            expect(mockCore.events.off).toHaveBeenCalledWith('event2', handler2);
        });

        it('should unregister all tracked portals', async () => {
            await ctx.invokeApi('editor:register-portal', { id: 'portal-1', regex: /a/g, component: () => null });
            await ctx.invokeApi('editor:register-portal', { id: 'portal-2', regex: /b/g, component: () => null });

            ctx.cleanup();

            // Should call unregister-portal for each tracked portal
            expect(mockCore.api.invoke).toHaveBeenCalledWith('editor:unregister-portal', 'portal-1');
            expect(mockCore.api.invoke).toHaveBeenCalledWith('editor:unregister-portal', 'portal-2');
        });

        it('should unregister all settings resources', async () => {
            await ctx.invokeApi('settings:register-tab', { id: 'tab-1' });
            await ctx.invokeApi('settings:register-group', { id: 'group-1' });
            await ctx.invokeApi('settings:register-item', { key: 'item-1' });

            ctx.cleanup();

            expect(mockCore.api.invoke).toHaveBeenCalledWith('settings:unregister-item', 'item-1');
            expect(mockCore.api.invoke).toHaveBeenCalledWith('settings:unregister-group', 'group-1');
            expect(mockCore.api.invoke).toHaveBeenCalledWith('settings:unregister-tab', 'tab-1');
        });

        it('should reset all stats after cleanup', async () => {
            ctx.registerApi('api', vi.fn());
            ctx.subscribe('event', vi.fn());
            await ctx.invokeApi('editor:register-portal', { id: 'portal', regex: /x/g, component: () => null });
            await ctx.invokeApi('settings:register-tab', { id: 'tab' });

            ctx.cleanup();

            expect(ctx.getStats()).toEqual({
                registeredApis: 0,
                eventSubscriptions: 0,
                registeredWidgets: 0,
                settings: 0,
            });
        });

        it('should be idempotent (second cleanup does nothing)', () => {
            ctx.registerApi('api', vi.fn());

            ctx.cleanup();
            const firstCallCount = (mockCore.api.unregister as any).mock.calls.length;

            ctx.cleanup(); // Second cleanup
            const secondCallCount = (mockCore.api.unregister as any).mock.calls.length;

            expect(secondCallCount).toBe(firstCallCount); // No new calls
        });

        it('should handle errors during cleanup gracefully', () => {
            ctx.registerApi('api', vi.fn());
            (mockCore.api.unregister as any).mockImplementation(() => {
                throw new Error('Unregister failed');
            });

            // Should not throw
            expect(() => ctx.cleanup()).not.toThrow();
            expect(ctx.isDisposed()).toBe(true);
        });
    });

    // =========================================================================
    // Disposed State
    // =========================================================================

    describe('disposed state', () => {
        it('should prevent all operations after disposal', async () => {
            ctx.cleanup();

            expect(() => ctx.registerApi('api', vi.fn())).toThrow(/disposed/);
            await expect(ctx.invokeApi('api')).rejects.toThrow(/disposed/);
            expect(() => ctx.subscribe('event', vi.fn())).toThrow(/disposed/);
        });

        it('isDisposed should return correct state', () => {
            expect(ctx.isDisposed()).toBe(false);
            ctx.cleanup();
            expect(ctx.isDisposed()).toBe(true);
        });
    });

    // =========================================================================
    // Edge Cases
    // =========================================================================

    describe('edge cases', () => {
        it('should handle empty portal spec gracefully', async () => {
            await ctx.invokeApi('editor:register-portal', null);
            await ctx.invokeApi('editor:register-portal', undefined);
            await ctx.invokeApi('editor:register-portal', {});

            expect(ctx.getStats().registeredWidgets).toBe(0);
        });

        it('should handle settings with missing fields', async () => {
            await ctx.invokeApi('settings:register-tab', {});
            await ctx.invokeApi('settings:register-group', { tabId: 'x' }); // no id
            await ctx.invokeApi('settings:register-item', { type: 'toggle' }); // no key

            expect(ctx.getStats().settings).toBe(0);
        });

        it('should handle numeric id in portal spec', async () => {
            await ctx.invokeApi('editor:register-portal', { id: 123, regex: /x/g, component: () => null });

            // Numeric id should not be tracked (we check typeof id === 'string')
            expect(ctx.getStats().registeredWidgets).toBe(0);
        });
    });
});
