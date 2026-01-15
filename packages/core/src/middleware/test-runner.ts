/**
 * @fileoverview Test Runner for Middleware System
 * @module @notehub/core/middleware/test-runner
 * 
 * Verification script for Wave 2 Interceptor Engine.
 * Run with: npx tsx src/middleware/test-runner.ts
 */

import { ApiBus } from '../buses/ApiBus.js';
import { Priority } from './types.js';
import { HooksAPI } from './hooks.js';

console.log('='.repeat(60));
console.log('Wave 2 Middleware System - Verification Test');
console.log('='.repeat(60));
console.log();

async function runTests() {
    let passed = 0;
    let failed = 0;

    // Helper to run a test
    async function test(name: string, fn: () => Promise<void>) {
        try {
            await fn();
            console.log(`✅ PASS: ${name}`);
            passed++;
        } catch (error) {
            console.log(`❌ FAIL: ${name}`);
            console.error(`   Error: ${error instanceof Error ? error.message : error}`);
            failed++;
        }
    }

    // Helper for assertions
    function assertEqual<T>(actual: T, expected: T, message?: string) {
        if (actual !== expected) {
            throw new Error(
                `${message || 'Assertion failed'}: expected "${expected}", got "${actual}"`
            );
        }
    }

    function assertThrows(fn: () => any, expectedMessage?: string) {
        let threw = false;
        let actualMessage = '';
        try {
            fn();
        } catch (e) {
            threw = true;
            actualMessage = e instanceof Error ? e.message : String(e);
        }
        if (!threw) {
            throw new Error('Expected function to throw, but it did not');
        }
        if (expectedMessage && !actualMessage.includes(expectedMessage)) {
            throw new Error(`Expected error to contain "${expectedMessage}", got "${actualMessage}"`);
        }
    }

    // =========================================================================
    // Test 1: Basic Echo with Before/After Hooks (Main Scenario)
    // =========================================================================
    await test('Basic echo with before/after hooks transforms "hello" to "[HELLO]"', async () => {
        const api = new ApiBus();

        // Register core handler: returns input as-is
        api.register('test:echo', (input: string) => input);

        // Register before hook (HIGH priority): uppercase the first argument
        api.registerHook('test:echo', async (ctx, next) => {
            ctx.args[0] = (ctx.args[0] as string).toUpperCase();
            await next();
        }, Priority.HIGH, 'test-before');

        // Register after hook (LOW priority): wrap result in brackets
        api.registerHook('test:echo', async (ctx, next) => {
            await next();
            ctx.result = `[${ctx.result}]`;
        }, Priority.LOW, 'test-after');

        // Execute
        const result = await api.invoke('test:echo', 'hello');

        assertEqual(result, '[HELLO]', 'Echo transformation');
    });

    // =========================================================================
    // Test 2: HooksAPI Facade
    // =========================================================================
    await test('HooksAPI facade provides before/after/replace sugar methods', async () => {
        const api = new ApiBus();
        const hooks = new HooksAPI(api.getRunner(), 'test-plugin');

        // Register core handler
        api.register('greeting:say', (name: string) => `Hello, ${name}!`);

        // Use before() to prefix the name
        hooks.before('greeting:say', (ctx) => {
            ctx.args[0] = 'Dr. ' + ctx.args[0];
        });

        // Use after() to add suffix
        hooks.after('greeting:say', (ctx) => {
            ctx.result = ctx.result + ' Welcome!';
        });

        const result = await api.invoke('greeting:say', 'Smith');
        assertEqual(result, 'Hello, Dr. Smith! Welcome!', 'HooksAPI facade');
    });

    // =========================================================================
    // Test 3: Replace Hook (Short-Circuit)
    // =========================================================================
    await test('Replace hook bypasses core handler', async () => {
        const api = new ApiBus();
        const hooks = new HooksAPI(api.getRunner(), 'test-plugin');
        let coreWasCalled = false;

        // Register core handler
        api.register('legacy:broken', () => {
            coreWasCalled = true;
            return 'BROKEN';
        });

        // Replace with working implementation
        hooks.replace('legacy:broken', async () => {
            return 'FIXED';
        });

        const result = await api.invoke('legacy:broken');
        assertEqual(result, 'FIXED', 'Replace result');
        assertEqual(coreWasCalled, false, 'Core should not be called');
    });

    // =========================================================================
    // Test 4: Glob Pattern Matching
    // =========================================================================
    await test('Glob patterns match multiple commands', async () => {
        const api = new ApiBus();
        const log: string[] = [];

        // Register handlers
        api.register('fs:read', () => 'read-data');
        api.register('fs:write', () => 'write-ok');
        api.register('ui:render', () => 'rendered');

        // Register glob hook for all fs:* commands
        api.registerHook('fs:*', async (ctx, next) => {
            log.push(`fs-hook:${ctx.commandId}`);
            await next();
        }, Priority.NORMAL, 'fs-logger');

        // Execute
        await api.invoke('fs:read');
        await api.invoke('fs:write');
        await api.invoke('ui:render');

        assertEqual(log.length, 2, 'Only fs commands should trigger hook');
        assertEqual(log[0], 'fs-hook:fs:read', 'First log entry');
        assertEqual(log[1], 'fs-hook:fs:write', 'Second log entry');
    });

    // =========================================================================
    // Test 5: Priority Ordering
    // =========================================================================
    await test('Middlewares execute in priority order', async () => {
        const api = new ApiBus();
        const order: string[] = [];

        api.register('priority:test', () => {
            order.push('core');
            return 'done';
        });

        // Register in wrong order to test sorting
        api.registerHook('priority:test', async (ctx, next) => {
            order.push('low-start');
            await next();
            order.push('low-end');
        }, Priority.LOW, 'low');

        api.registerHook('priority:test', async (ctx, next) => {
            order.push('high-start');
            await next();
            order.push('high-end');
        }, Priority.HIGH, 'high');

        api.registerHook('priority:test', async (ctx, next) => {
            order.push('normal-start');
            await next();
            order.push('normal-end');
        }, Priority.NORMAL, 'normal');

        await api.invoke('priority:test');

        // Expected order (Onion model):
        // Downstream: high -> normal -> low -> core
        // Upstream: low <- normal <- high
        const expected = [
            'high-start',
            'normal-start',
            'low-start',
            'core',
            'low-end',
            'normal-end',
            'high-end'
        ];

        assertEqual(order.join(','), expected.join(','), 'Execution order');
    });

    // =========================================================================
    // Test 6: Recursion Limit (via Middleware with Context Propagation)
    // =========================================================================
    await test('Recursion limit prevents infinite loops in middleware', async () => {
        const api = new ApiBus();
        let callCount = 0;

        // Register a simple handler
        api.register('recursive:call', () => {
            callCount++;
            return 'done';
        });

        // Register a middleware that creates infinite recursion by calling the same command
        // This properly passes context for loop detection
        api.registerHook('recursive:call', async (ctx, next) => {
            // Pass current context to enable loop detection
            await api.execute('recursive:call', [], ctx);
            await next();
        }, Priority.HIGH, 'recursive-hook');

        let caughtError: Error | null = null;
        try {
            await api.invoke('recursive:call');
        } catch (e) {
            caughtError = e as Error;
        }

        if (!caughtError) {
            throw new Error('Expected recursion error to be thrown');
        }
        if (!caughtError.message.includes('Recursion Limit')) {
            throw new Error(`Wrong error: ${caughtError.message}`);
        }
        // Loop detection should kick in before too many calls
        // Depth 0 -> 1 -> 2 -> ... -> 17 (throws at depth > 16)
        if (callCount > 20) {
            throw new Error(`Too many calls (${callCount}), expected <= 17`);
        }
    });

    // =========================================================================
    // Test 7: Dispose Function
    // =========================================================================
    await test('Dispose function removes hook', async () => {
        const api = new ApiBus();
        let hookCalled = false;

        api.register('dispose:test', () => 'result');

        const dispose = api.registerHook('dispose:test', async (ctx, next) => {
            hookCalled = true;
            await next();
        }, Priority.NORMAL, 'temp');

        // Call once - hook should run
        await api.invoke('dispose:test');
        assertEqual(hookCalled, true, 'Hook should be called initially');

        // Dispose and reset
        dispose();
        hookCalled = false;

        // Call again - hook should NOT run
        await api.invoke('dispose:test');
        assertEqual(hookCalled, false, 'Hook should not be called after dispose');
    });

    // =========================================================================
    // Test 8: Error Propagation
    // =========================================================================
    await test('Errors propagate through middleware chain', async () => {
        const api = new ApiBus();
        let cleanupRan = false;

        api.register('error:test', () => {
            throw new Error('Core error');
        });

        api.registerHook('error:test', async (ctx, next) => {
            try {
                await next();
            } catch (e) {
                cleanupRan = true;
                throw e; // Re-throw
            }
        }, Priority.HIGH, 'error-handler');

        let caughtError = false;
        try {
            await api.invoke('error:test');
        } catch (e) {
            caughtError = true;
        }

        assertEqual(caughtError, true, 'Error should propagate');
        assertEqual(cleanupRan, true, 'Middleware should catch error');
    });

    // =========================================================================
    // Summary
    // =========================================================================
    console.log();
    console.log('='.repeat(60));
    console.log(`Results: ${passed} passed, ${failed} failed`);
    console.log('='.repeat(60));

    if (failed > 0) {
        process.exit(1);
    }
}

runTests().catch(err => {
    console.error('Test runner failed:', err);
    process.exit(1);
});
