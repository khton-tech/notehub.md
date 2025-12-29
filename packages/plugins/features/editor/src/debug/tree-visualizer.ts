/**
 * @fileoverview Debug Tree Visualizer for Lezer AST
 * 
 * Provides utilities to visualize the syntax tree structure
 * for debugging custom Lezer parsers.
 * 
 * ## Usage
 * 
 * ```typescript
 * import { debugTree, exposeDebugFunction } from './debug/tree-visualizer';
 * 
 * // Log tree to console
 * debugTree(editorState);
 * 
 * // Expose globally for DevTools access
 * exposeDebugFunction(editorView);
 * ```
 * 
 * @module @notehub/editor/debug/tree-visualizer
 */

import { syntaxTree } from '@codemirror/language';
import type { EditorState } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';

/**
 * Format a syntax tree node for display.
 * 
 * @param name - Node type name
 * @param from - Start position
 * @param to - End position
 * @param depth - Nesting depth for indentation
 * @param text - Optional text content preview
 * @returns Formatted string representation
 */
function formatNode(
    name: string,
    from: number,
    to: number,
    depth: number,
    text?: string
): string {
    const indent = '  '.repeat(depth);
    const range = `[${from}..${to}]`;
    const textPreview = text ? ` "${text.slice(0, 30)}${text.length > 30 ? '...' : ''}"` : '';
    return `${indent}${name} ${range}${textPreview}`;
}

/**
 * Generate a string representation of the syntax tree.
 * 
 * @param state - CodeMirror EditorState
 * @returns Multi-line string showing tree structure
 */
export function getTreeString(state: EditorState): string {
    const tree = syntaxTree(state);
    const lines: string[] = [];
    const doc = state.doc.toString();

    // Use cursor to walk the tree
    const cursor = tree.cursor();

    // Track depth manually since cursor doesn't expose it directly
    let depth = 0;
    const stack: number[] = [];

    do {
        // Adjust depth based on node position vs stack
        while (stack.length > 0) {
            const lastEnd = stack[stack.length - 1];
            if (lastEnd === undefined || cursor.from < lastEnd) break;
            stack.pop();
            depth--;
        }

        // Get text content for leaf nodes
        const isLeaf = !cursor.firstChild();
        if (!isLeaf) {
            cursor.parent();
        }

        const text = isLeaf ? doc.slice(cursor.from, cursor.to) : undefined;

        lines.push(formatNode(
            cursor.name,
            cursor.from,
            cursor.to,
            depth,
            text
        ));

        // Push end position to stack for tracking depth
        stack.push(cursor.to);
        depth++;

    } while (cursor.next());

    return lines.join('\n');
}

/**
 * Log the syntax tree to the console.
 * 
 * @param state - CodeMirror EditorState
 */
export function debugTree(state: EditorState): void {
    console.group('🌳 Notehub Syntax Tree');
    console.log(getTreeString(state));
    console.groupEnd();
}

/**
 * Get a simplified tree summary (node names only).
 * 
 * @param state - CodeMirror EditorState
 * @returns String with simplified tree representation
 */
export function getTreeSummary(state: EditorState): string {
    const tree = syntaxTree(state);
    // Use the built-in toString for a quick summary
    return tree.toString();
}

/**
 * Expose the debug function globally for DevTools access.
 * 
 * Call this from the editor component to enable:
 * ```javascript
 * // In browser console:
 * window.__notehub_debug_tree()
 * ```
 * 
 * @param view - CodeMirror EditorView instance
 */
export function exposeDebugFunction(view: EditorView): void {
    (window as unknown as Record<string, unknown>).__notehub_debug_tree = () => {
        debugTree(view.state);
        return getTreeSummary(view.state);
    };

    (window as unknown as Record<string, unknown>).__notehub_tree_string = () => {
        return getTreeString(view.state);
    };

    console.log(
        '%c🌳 Notehub Tree Debugger Ready',
        'color: #4CAF50; font-weight: bold;',
        '\n\nAvailable commands:',
        '\n  window.__notehub_debug_tree()  - Log tree structure',
        '\n  window.__notehub_tree_string() - Get tree as string'
    );
}

/**
 * Remove the debug function from window.
 */
export function removeDebugFunction(): void {
    delete (window as unknown as Record<string, unknown>).__notehub_debug_tree;
    delete (window as unknown as Record<string, unknown>).__notehub_tree_string;
}
