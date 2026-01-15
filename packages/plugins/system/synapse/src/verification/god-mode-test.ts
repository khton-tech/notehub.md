/**
 * @fileoverview Wave 3 God Mode Verification Test
 * @module nh.system.synapse/verification
 * 
 * This test verifies that the Unsafe Context and Shared Runtime are working correctly.
 * Run this as a plugin to test the entire chain:
 * 1. Unsafe Context provides access to EditorView
 * 2. Shared Runtime prevents Dual Package Hazard (instanceof works)
 * 3. Transaction dispatch works correctly
 */

import type { PluginContext } from '@notehub.md/api';
import { EditorView } from '@codemirror/view';

/**
 * Test function to verify God Mode functionality.
 * 
 * @param ctx - Plugin context with unsafe access
 * @returns true if all tests pass
 * @throws Error with details if any test fails
 */
export async function runGodModeTest(ctx: PluginContext): Promise<boolean> {
    console.group('🧪 God Mode Verification Test');

    try {
        // Step 1: Test EditorView retrieval
        console.log('Step 1: Retrieving EditorView via unsafe context...');
        const view = ctx.unsafe.getActiveEditorView() as EditorView | null;

        if (!view) {
            throw new Error('EditorView not found. Is an editor tab open and focused?');
        }
        console.log('✅ Step 1 PASSED: EditorView reference obtained');

        // Step 2: Test instanceof check (Shared Runtime verification)
        console.log('Step 2: Verifying instanceof EditorView...');
        if (!(view instanceof EditorView)) {
            console.error('Expected constructor:', EditorView.name);
            console.error('Actual constructor:', (view as object).constructor?.name);
            throw new Error(
                'instanceof check FAILED - Dual Package Hazard detected. ' +
                'Plugin and core have different @codemirror/view instances.'
            );
        }
        console.log('✅ Step 2 PASSED: Shared Runtime is operational');

        // Step 3: Test transaction dispatch
        console.log('Step 3: Testing transaction dispatch...');
        const testText = '/* God Mode Test: ' + new Date().toISOString() + ' */\n';

        const transaction = view.state.update({
            changes: { from: 0, insert: testText },
            scrollIntoView: true
        });

        view.dispatch(transaction);
        console.log('✅ Step 3 PASSED: Transaction dispatched successfully');

        // Step 4: Verify the change was applied
        console.log('Step 4: Verifying document change...');
        const docContent = view.state.doc.toString();
        if (!docContent.startsWith('/* God Mode Test:')) {
            throw new Error('Document content does not reflect the inserted text');
        }
        console.log('✅ Step 4 PASSED: Document updated correctly');

        console.log('');
        console.log('🎉 ALL TESTS PASSED - God Mode is operational!');
        console.groupEnd();

        return true;

    } catch (error) {
        console.error('❌ TEST FAILED:', error);
        console.groupEnd();
        throw error;
    }
}

/**
 * Command handler for developer:god-mode-test
 * Register this with the command system for easy testing.
 */
export function createGodModeCommand(ctx: PluginContext) {
    return async () => {
        try {
            await runGodModeTest(ctx);
            // Show success notification if available
            ctx.invokeApi('notification:show', {
                type: 'success',
                message: 'God Mode Test PASSED - Check console for details'
            }).catch(() => {
                // Notification API might not exist, that's fine
            });
        } catch (error) {
            ctx.invokeApi('notification:show', {
                type: 'error',
                message: `God Mode Test FAILED: ${error instanceof Error ? error.message : String(error)}`
            }).catch(() => {
                // Notification API might not exist, that's fine
            });
        }
    };
}
