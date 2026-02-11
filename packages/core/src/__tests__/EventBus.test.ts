import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventBus } from '../buses/EventBus.js';

type TestEvents = {
    'test:event': { value: number };
    'test:other': string;
};

describe('EventBus', () => {
    let bus: EventBus<TestEvents>;

    beforeEach(() => {
        bus = new EventBus<TestEvents>();
    });

    describe('on / emit', () => {
        it('should invoke handler on emit', async () => {
            const handler = vi.fn();
            bus.on('test:event', handler);

            await bus.emit('test:event', { value: 42 });

            expect(handler).toHaveBeenCalledOnce();
            expect(handler).toHaveBeenCalledWith(
                { value: 42 },
                expect.objectContaining({ defaultPrevented: false })
            );
        });

        it('should handle multiple listeners', async () => {
            const h1 = vi.fn();
            const h2 = vi.fn();
            bus.on('test:event', h1);
            bus.on('test:event', h2);

            await bus.emit('test:event', { value: 1 });

            expect(h1).toHaveBeenCalledOnce();
            expect(h2).toHaveBeenCalledOnce();
        });

        it('should emit to correct event only', async () => {
            const h1 = vi.fn();
            const h2 = vi.fn();
            bus.on('test:event', h1);
            bus.on('test:other', h2);

            await bus.emit('test:event', { value: 1 });

            expect(h1).toHaveBeenCalledOnce();
            expect(h2).not.toHaveBeenCalled();
        });
    });

    describe('off', () => {
        it('should remove listener', async () => {
            const handler = vi.fn();
            bus.on('test:event', handler);
            bus.off('test:event', handler);

            await bus.emit('test:event', { value: 1 });

            expect(handler).not.toHaveBeenCalled();
        });

        it('should only remove the specific listener', async () => {
            const h1 = vi.fn();
            const h2 = vi.fn();
            bus.on('test:event', h1);
            bus.on('test:event', h2);
            bus.off('test:event', h1);

            await bus.emit('test:event', { value: 1 });

            expect(h1).not.toHaveBeenCalled();
            expect(h2).toHaveBeenCalledOnce();
        });
    });

    describe('priority', () => {
        it('should invoke higher priority listeners first', async () => {
            const order: number[] = [];
            bus.on('test:event', () => { order.push(1); }, { priority: 10 });
            bus.on('test:event', () => { order.push(2); }, { priority: 20 });
            bus.on('test:event', () => { order.push(3); }, { priority: 5 });

            await bus.emit('test:event', { value: 0 });

            expect(order).toEqual([2, 1, 3]);
        });
    });

    describe('condition', () => {
        it('should skip listener when condition returns false', async () => {
            const handler = vi.fn();
            bus.on('test:event', handler, {
                condition: (payload) => (payload as any).value > 10
            });

            await bus.emit('test:event', { value: 5 });
            expect(handler).not.toHaveBeenCalled();

            await bus.emit('test:event', { value: 15 });
            expect(handler).toHaveBeenCalledOnce();
        });
    });

    describe('preventDefault / stopPropagation', () => {
        it('should report defaultPrevented', async () => {
            bus.on('test:event', (_payload, ctx) => {
                ctx.preventDefault();
            });

            const result = await bus.emit('test:event', { value: 1 });
            expect(result.defaultPrevented).toBe(true);
        });

        it('should stop calling listeners on stopPropagation', async () => {
            const h1 = vi.fn((_p: any, ctx: any) => ctx.stopPropagation());
            const h2 = vi.fn();
            bus.on('test:event', h1, { priority: 10 });
            bus.on('test:event', h2, { priority: 5 });

            const result = await bus.emit('test:event', { value: 1 });

            expect(h1).toHaveBeenCalledOnce();
            expect(h2).not.toHaveBeenCalled();
            expect(result.propagationStopped).toBe(true);
        });
    });

    describe('once', () => {
        it('should fire only once', async () => {
            const handler = vi.fn();
            bus.once('test:event', handler);

            await bus.emit('test:event', { value: 1 });
            await bus.emit('test:event', { value: 2 });

            expect(handler).toHaveBeenCalledOnce();
        });
    });

    describe('clear', () => {
        it('should clear listeners for a specific event', async () => {
            const h1 = vi.fn();
            const h2 = vi.fn();
            bus.on('test:event', h1);
            bus.on('test:other', h2);
            bus.clear('test:event');

            await bus.emit('test:event', { value: 1 });
            await bus.emit('test:other', 'hello');

            expect(h1).not.toHaveBeenCalled();
            expect(h2).toHaveBeenCalledOnce();
        });

        it('should clear all listeners when no event specified', async () => {
            bus.on('test:event', vi.fn());
            bus.on('test:other', vi.fn());
            bus.clear();

            expect(bus.listenerCount('test:event')).toBe(0);
            expect(bus.listenerCount('test:other')).toBe(0);
        });
    });

    describe('listenerCount', () => {
        it('should return correct count', () => {
            expect(bus.listenerCount('test:event')).toBe(0);
            bus.on('test:event', vi.fn());
            expect(bus.listenerCount('test:event')).toBe(1);
            bus.on('test:event', vi.fn());
            expect(bus.listenerCount('test:event')).toBe(2);
        });
    });

    describe('error handling', () => {
        it('should not throw when listener throws', async () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            bus.on('test:event', () => { throw new Error('boom'); });
            const h2 = vi.fn();
            bus.on('test:event', h2);

            await expect(bus.emit('test:event', { value: 1 })).resolves.toBeDefined();
            expect(h2).toHaveBeenCalledOnce();
            consoleSpy.mockRestore();
        });
    });
});
