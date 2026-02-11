import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ApiBus } from '../buses/ApiBus.js';

describe('ApiBus', () => {
    let api: ApiBus;

    beforeEach(() => {
        api = new ApiBus();
    });

    describe('register / invoke', () => {
        it('should register and invoke a handler', async () => {
            api.register('test:greet', (name: unknown) => `Hello, ${name}!`);
            const result = await api.invoke('test:greet', 'World');
            expect(result).toBe('Hello, World!');
        });

        it('should throw on duplicate registration', () => {
            api.register('test:method', () => 'a');
            expect(() => api.register('test:method', () => 'b')).toThrow('already registered');
        });

        it('should throw when invoking unregistered method', async () => {
            await expect(api.invoke('nonexistent')).rejects.toThrow('not registered');
        });
    });

    describe('unregister', () => {
        it('should unregister a handler', () => {
            api.register('test:method', () => 'a');
            expect(api.unregister('test:method')).toBe(true);
            expect(api.has('test:method')).toBe(false);
        });

        it('should return false for non-existent method', () => {
            expect(api.unregister('nonexistent')).toBe(false);
        });

        it('should allow re-registration after unregister', async () => {
            api.register('test:method', () => 'v1');
            api.unregister('test:method');
            api.register('test:method', () => 'v2');
            const result = await api.invoke('test:method');
            expect(result).toBe('v2');
        });
    });

    describe('has', () => {
        it('should return true for registered methods', () => {
            api.register('test:method', () => {});
            expect(api.has('test:method')).toBe(true);
            expect(api.has('other')).toBe(false);
        });
    });

    describe('getRegisteredMethods', () => {
        it('should return all registered method names', () => {
            api.register('a', () => {});
            api.register('b', () => {});
            expect(api.getRegisteredMethods()).toEqual(expect.arrayContaining(['a', 'b']));
        });
    });

    describe('hooks - before', () => {
        it('should modify args via before hook', async () => {
            api.register('test:add', (a: unknown, b: unknown) => (a as number) + (b as number));
            api.hook('test:add', 'before', (args) => {
                return [args[0], (args[1] as number) * 2];
            });

            const result = await api.invoke('test:add', 3, 5);
            expect(result).toBe(13); // 3 + 5*2
        });

        it('should chain multiple before hooks by priority', async () => {
            const order: string[] = [];
            api.register('test:method', () => 'result');

            api.hook('test:method', 'before', () => { order.push('low'); }, { priority: 5 });
            api.hook('test:method', 'before', () => { order.push('high'); }, { priority: 10 });

            await api.invoke('test:method');
            expect(order).toEqual(['high', 'low']);
        });
    });

    describe('hooks - after', () => {
        it('should modify result via after hook', async () => {
            api.register('test:method', () => 'hello');
            api.hook('test:method', 'after', (result) => {
                return (result as string).toUpperCase();
            });

            const result = await api.invoke('test:method');
            expect(result).toBe('HELLO');
        });
    });

    describe('hooks - around', () => {
        it('should wrap handler via around hook', async () => {
            api.register('test:method', () => 'original');
            api.hook('test:method', 'around', async (args, next) => {
                const result = await next(args);
                return `wrapped(${result})`;
            });

            const result = await api.invoke('test:method');
            expect(result).toBe('wrapped(original)');
        });

        it('should chain multiple around hooks', async () => {
            api.register('test:method', () => 'core');
            api.hook('test:method', 'around', async (args, next) => {
                return `outer(${await next(args)})`;
            }, { priority: 10 });
            api.hook('test:method', 'around', async (args, next) => {
                return `inner(${await next(args)})`;
            }, { priority: 5 });

            const result = await api.invoke('test:method');
            expect(result).toBe('outer(inner(core))');
        });
    });

    describe('hooks - condition', () => {
        it('should skip hook when condition returns false', async () => {
            api.register('test:method', (x: unknown) => x);
            const hookFn = vi.fn((args: unknown[]) => args);
            api.hook('test:method', 'before', hookFn, {
                condition: (args) => (args[0] as number) > 10
            });

            await api.invoke('test:method', 5);
            expect(hookFn).not.toHaveBeenCalled();

            await api.invoke('test:method', 15);
            expect(hookFn).toHaveBeenCalledOnce();
        });
    });

    describe('hooks - unsubscribe', () => {
        it('should remove hook when unsubscribe is called', async () => {
            api.register('test:method', () => 'original');
            const unsub = api.hook('test:method', 'after', () => 'modified');

            expect(await api.invoke('test:method')).toBe('modified');

            unsub();
            expect(await api.invoke('test:method')).toBe('original');
        });
    });

    describe('hooks - error handling', () => {
        it('should continue on before hook error', async () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            api.register('test:method', () => 'result');
            api.hook('test:method', 'before', () => { throw new Error('hook error'); });

            const result = await api.invoke('test:method');
            expect(result).toBe('result');
            consoleSpy.mockRestore();
        });

        it('should fallthrough on around hook error', async () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            api.register('test:method', () => 'result');
            api.hook('test:method', 'around', () => { throw new Error('around error'); });

            const result = await api.invoke('test:method');
            expect(result).toBe('result');
            consoleSpy.mockRestore();
        });
    });

    describe('getMethodInfo', () => {
        it('should return method info with hook counts', () => {
            api.register('test:method', () => {});
            api.hook('test:method', 'before', () => {});
            api.hook('test:method', 'after', () => {});
            api.hook('test:method', 'around', async (_, next) => next(_));

            const info = api.getMethodInfo('test:method');
            expect(info.exists).toBe(true);
            expect(info.hookCount).toEqual({ before: 1, after: 1, around: 1 });
        });
    });
});
