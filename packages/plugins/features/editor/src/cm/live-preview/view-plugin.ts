/**
 * @fileoverview Live Preview ViewPlugin - Transforms AST to visual decorations
 * 
 * This ViewPlugin iterates the syntax tree to find callout markers and
 * creates visual decorations when the cursor is outside the header range.
 * 
 * ## Logic:
 * 1. Search for `CalloutType` nodes directly (flat AST structure)
 * 2. When found, identify the header line containing CalloutType
 * 3. If cursor is outside header → apply Decoration.replace with CalloutHeaderWidget
 * 4. Find parent Blockquote and apply .cm-callout-body to subsequent lines
 * 
 * @module @notehub/editor/cm/live-preview/view-plugin
 * @author Notehub Team
 */

import {
    ViewPlugin,
    Decoration,
    EditorView,
    type ViewUpdate,
    type DecorationSet,
} from '@codemirror/view';
import { syntaxTree, ensureSyntaxTree } from '@codemirror/language';
import { RangeSetBuilder, type EditorState, type Range } from '@codemirror/state';
import { CalloutHeaderWidget } from '../widgets/CalloutWidget';

/**
 * Simple node interface matching the shape returned by syntaxTree iterate.
 */
interface TreeNode {
    name: string;
    from: number;
    to: number;
    node: {
        from: number;
        to: number;
        name: string;
        nextSibling: TreeNode['node'] | null;
        parent: TreeNode['node'] | null;
    };
}

/**
 * Check if the cursor selection overlaps with a given range.
 * Only considers overlap if the editor has focus (user is actively editing).
 * 
 * @param view - Editor view (to check focus)
 * @param from - Start of range
 * @param to - End of range
 * @returns true if any selection overlaps AND editor has focus
 */
function cursorOverlapsRange(view: EditorView, from: number, to: number): boolean {
    // If editor doesn't have focus, cursor position doesn't matter
    // This ensures decorations are shown on initial load
    if (!view.hasFocus) {
        return false;
    }

    for (const range of view.state.selection.ranges) {
        // Check if selection overlaps with [from, to]
        if (range.from <= to && range.to >= from) {
            return true;
        }
    }
    return false;
}

/**
 * Extract callout type string from the document.
 * 
 * @param state - Editor state
 * @param from - Start position
 * @param to - End position
 * @returns Callout type string (e.g., "INFO", "WARNING")
 */
function getCalloutType(state: EditorState, from: number, to: number): string {
    return state.doc.sliceString(from, to);
}

/**
 * Extract callout title from the document.
 * Looks for a sibling CalloutTitle node.
 * 
 * @param state - Editor state
 * @param node - The node with nextSibling property
 * @returns Title string or empty
 */
function getCalloutTitle(state: EditorState, node: TreeNode['node']): string {
    // Look for CalloutTitle as a sibling after CalloutType
    let sibling = node.nextSibling;
    while (sibling) {
        if (sibling.name === 'CalloutTitle') {
            return state.doc.sliceString(sibling.from, sibling.to).trim();
        }
        sibling = sibling.nextSibling;
    }
    return '';
}

/**
 * Find the line range for a given position.
 * 
 * @param state - Editor state
 * @param pos - Position in document
 * @returns Object with from and to positions for the line
 */
function getLineRange(state: EditorState, pos: number): { from: number; to: number } {
    const line = state.doc.lineAt(pos);
    return { from: line.from, to: line.to };
}

/**
 * Find the parent Blockquote node.
 * 
 * @param node - Starting node
 * @returns Blockquote node or null
 */
function findParentBlockquote(node: TreeNode['node']): TreeNode['node'] | null {
    let current: TreeNode['node'] | null = node;
    while (current) {
        if (current.name === 'Blockquote') {
            return current;
        }
        current = current.parent;
    }
    return null;
}

/**
 * Build decorations for callouts in the visible range.
 * 
 * @param view - Editor view
 * @returns DecorationSet with callout decorations
 */
function buildDecorations(view: EditorView): DecorationSet {
    const { state } = view;
    const decorations: Range<Decoration>[] = [];
    const processedLines = new Set<number>();

    console.log('[LivePreview] buildDecorations called, doc length:', state.doc.length);

    // Force synchronous tree parsing for visible ranges
    // This ensures the tree is ready before we iterate
    for (const { from: _from, to } of view.visibleRanges) {
        const tree = ensureSyntaxTree(state, to, 100); // 100ms timeout
        console.log('[LivePreview] ensureSyntaxTree result:', tree ? 'got tree' : 'null', 'to:', to);
    }

    let foundNodes = 0;

    // Iterate syntax tree looking for CalloutType nodes
    for (const { from, to } of view.visibleRanges) {
        console.log('[LivePreview] Iterating visible range:', from, '-', to);
        syntaxTree(state).iterate({
            from,
            to,
            enter: (node) => {
                // Log all node types for debugging
                if (node.name === 'CalloutType' || node.name === 'CalloutTitle' || node.name === 'Blockquote') {
                    console.log('[LivePreview] Found node:', node.name, 'at', node.from, '-', node.to);
                }

                // Only process CalloutType nodes
                if (node.name !== 'CalloutType') {
                    return;
                }

                foundNodes++;

                const calloutTypeNode = node.node;

                // Get the header line range
                const headerLine = getLineRange(state, calloutTypeNode.from);

                // Skip if already processed (avoid duplicates)
                if (processedLines.has(headerLine.from)) {
                    return;
                }
                processedLines.add(headerLine.from);

                // Check cursor intersection with header line
                const cursorInside = cursorOverlapsRange(view, headerLine.from, headerLine.to);

                if (!cursorInside) {
                    // Cursor outside: replace header with widget
                    const type = getCalloutType(state, calloutTypeNode.from, calloutTypeNode.to);
                    const title = getCalloutTitle(state, calloutTypeNode);

                    const widget = new CalloutHeaderWidget(type, title);

                    // Replace the entire header line content (keep newline)
                    decorations.push(
                        Decoration.replace({
                            widget,
                            inclusive: true,
                            // Note: block: true is NOT allowed in ViewPlugins
                        }).range(headerLine.from, headerLine.to)
                    );
                }

                // Find parent Blockquote for body styling
                const blockquote = findParentBlockquote(calloutTypeNode);
                if (blockquote) {
                    // Get all lines after the header within the blockquote
                    const headerLineNum = state.doc.lineAt(headerLine.from).number;
                    const blockquoteEndLine = state.doc.lineAt(blockquote.to).number;

                    for (let lineNum = headerLineNum + 1; lineNum <= blockquoteEndLine; lineNum++) {
                        const line = state.doc.line(lineNum);

                        // Skip if already processed
                        if (processedLines.has(line.from)) {
                            continue;
                        }
                        processedLines.add(line.from);

                        // Add line decoration for callout body
                        decorations.push(
                            Decoration.line({
                                class: 'cm-callout-body',
                            }).range(line.from)
                        );
                    }
                }
            },
        });
    }

    console.log('[LivePreview] buildDecorations result:', foundNodes, 'CalloutType nodes found,', decorations.length, 'decorations created');

    // Sort decorations by position (required by CodeMirror)
    decorations.sort((a, b) => a.from - b.from);

    // Build the RangeSet
    const builder = new RangeSetBuilder<Decoration>();
    for (const deco of decorations) {
        builder.add(deco.from, deco.to, deco.value);
    }

    return builder.finish();
}

/**
 * CSS styles for callout body lines.
 */
const calloutBodyTheme = EditorView.baseTheme({
    '.cm-callout-body': {
        backgroundColor: 'rgba(74, 144, 226, 0.05)',
        borderLeft: '3px solid rgba(74, 144, 226, 0.3)',
        paddingLeft: '12px',
        marginLeft: '-3px',
    },
});

/**
 * Live Preview ViewPlugin
 * 
 * Transforms callout AST nodes into visual decorations.
 * When cursor is outside the header, replaces raw markdown with styled widget.
 */
export const livePreviewPlugin = ViewPlugin.fromClass(
    class LivePreviewPlugin {
        decorations: DecorationSet;

        constructor(view: EditorView) {
            console.log('[LivePreview] Plugin constructor called');
            this.decorations = buildDecorations(view);
        }

        update(update: ViewUpdate) {
            console.log('[LivePreview] Plugin update called, docChanged:', update.docChanged);
            // Always rebuild decorations on any update
            // This ensures decorations are ready immediately after tree parsing
            this.decorations = buildDecorations(update.view);
        }
    },
    {
        decorations: (v) => v.decorations,

        // Make replaced widgets atomic (cursor skips over them)
        provide: (plugin) => EditorView.atomicRanges.of((view) => {
            return view.plugin(plugin)?.decorations ?? Decoration.none;
        }),
    }
);

/**
 * Combined extension for live preview.
 * Includes the ViewPlugin and base theme.
 */
export const livePreviewExtension = [
    livePreviewPlugin,
    calloutBodyTheme,
];
