/**
 * @fileoverview Live Preview ViewPlugin - Callout rendering
 * 
 * CodeMirror ViewPlugin that provides live preview for callouts.
 * Uses AST-based detection via the Lezer parser's CalloutType nodes.
 * 
 * ## Cursor Dance Algorithm
 * 
 * - When cursor is INSIDE the callout header line: show raw source
 * - When cursor is OUTSIDE: replace header with CalloutWidget
 * 
 * @module @notehub/editor/cm/live-preview/view-plugin
 */

import {
    ViewPlugin,
    type ViewUpdate,
    Decoration,
    type DecorationSet,
    EditorView,
    type PluginValue,
} from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';
import { RangeSetBuilder } from '@codemirror/state';
import type { SyntaxNode } from '@lezer/common';
import { CalloutWidget } from '../widgets/CalloutWidget';

/**
 * Check if cursor is on a specific line
 */
function isCursorOnLine(view: EditorView, lineFrom: number, lineTo: number): boolean {
    const { state } = view;
    const selection = state.selection.main;

    // Get the line numbers
    const cursorLine = state.doc.lineAt(selection.head).number;
    const startLine = state.doc.lineAt(lineFrom).number;
    const endLine = state.doc.lineAt(lineTo).number;

    return cursorLine >= startLine && cursorLine <= endLine;
}

/**
 * Extract callout type from a CalloutType node
 */
function extractCalloutType(view: EditorView, node: SyntaxNode): string {
    const text = view.state.doc.sliceString(node.from, node.to);
    // CalloutType contains the type text like "INFO" or "WARNING"
    return text.trim();
}

/**
 * Extract callout title from sibling nodes or remaining header text
 */
function extractCalloutTitle(view: EditorView, calloutTypeNode: SyntaxNode): string {
    // Look for a sibling CalloutTitle node
    let sibling = calloutTypeNode.nextSibling;
    while (sibling) {
        if (sibling.name === 'CalloutTitle') {
            return view.state.doc.sliceString(sibling.from, sibling.to).trim();
        }
        sibling = sibling.nextSibling;
    }

    // Fallback: get the rest of the line after the closing bracket
    const line = view.state.doc.lineAt(calloutTypeNode.from);
    const afterType = view.state.doc.sliceString(calloutTypeNode.to, line.to);
    // Remove leading "] " if present
    const match = afterType.match(/^\]?\s*(.*)$/);
    return match?.[1]?.trim() ?? '';
}

/**
 * Find the full header line range (from start of line to end)
 */
function getHeaderLineRange(view: EditorView, node: SyntaxNode): { from: number; to: number } {
    const line = view.state.doc.lineAt(node.from);
    return { from: line.from, to: line.to };
}

/**
 * LivePreviewPlugin - Manages callout decorations
 */
class LivePreviewPlugin implements PluginValue {
    decorations: DecorationSet;

    constructor(view: EditorView) {
        this.decorations = this.buildDecorations(view);
    }

    update(update: ViewUpdate) {
        // Rebuild decorations if document changed, viewport changed, or selection changed
        if (update.docChanged || update.viewportChanged || update.selectionSet) {
            this.decorations = this.buildDecorations(update.view);
        }
    }

    destroy() {
        // Cleanup handled by widget's destroy() method
    }

    /**
     * Build decorations by iterating the syntax tree
     */
    private buildDecorations(view: EditorView): DecorationSet {
        const builder = new RangeSetBuilder<Decoration>();
        const { state } = view;
        const tree = syntaxTree(state);

        // Track which lines are callout body lines
        const calloutBodyLines = new Set<number>();

        // Iterate over visible ranges for performance
        for (const { from, to } of view.visibleRanges) {
            tree.iterate({
                from,
                to,
                enter: (node) => {
                    // Look for CalloutType nodes
                    if (node.name === 'CalloutType') {
                        this.processCalloutType(view, node.node, builder, calloutBodyLines);
                    }
                },
            });
        }

        // Apply body styling to callout body lines
        this.applyBodyStyling(view, calloutBodyLines, builder);

        return builder.finish();
    }

    /**
     * Process a CalloutType node and create decorations
     */
    private processCalloutType(
        view: EditorView,
        node: SyntaxNode,
        builder: RangeSetBuilder<Decoration>,
        calloutBodyLines: Set<number>
    ) {
        const headerRange = getHeaderLineRange(view, node);

        // Check cursor position - if cursor is on this line, skip decoration
        if (isCursorOnLine(view, headerRange.from, headerRange.to)) {
            return;
        }

        // Extract type and title
        const type = extractCalloutType(view, node);
        const title = extractCalloutTitle(view, node);

        // Create the widget
        const widget = new CalloutWidget(type, title);

        // Replace the entire header line with the widget
        const decoration = Decoration.replace({
            widget,
            block: true,
        });

        builder.add(headerRange.from, headerRange.to, decoration);

        // Find and mark body lines (lines starting with > after the header)
        this.markBodyLines(view, headerRange.to, calloutBodyLines);
    }

    /**
     * Mark lines that are part of the callout body
     */
    private markBodyLines(
        view: EditorView,
        headerEnd: number,
        calloutBodyLines: Set<number>
    ) {
        const doc = view.state.doc;
        let lineNum = doc.lineAt(headerEnd).number + 1;

        while (lineNum <= doc.lines) {
            const line = doc.line(lineNum);
            const lineText = line.text;

            // Check if line starts with > (continuation of callout/quote)
            if (/^>\s*/.test(lineText)) {
                calloutBodyLines.add(lineNum);
                lineNum++;
            } else {
                // End of callout body
                break;
            }
        }
    }

    /**
     * Apply styling to callout body lines
     */
    private applyBodyStyling(
        view: EditorView,
        calloutBodyLines: Set<number>,
        builder: RangeSetBuilder<Decoration>
    ) {
        const doc = view.state.doc;
        const lineDecoration = Decoration.line({ class: 'cm-callout-body' });

        // Sort line numbers to maintain order for RangeSetBuilder
        const sortedLines = Array.from(calloutBodyLines).sort((a, b) => a - b);

        for (const lineNum of sortedLines) {
            if (lineNum >= 1 && lineNum <= doc.lines) {
                const line = doc.line(lineNum);
                builder.add(line.from, line.from, lineDecoration);
            }
        }
    }
}

/**
 * Live preview extension for callouts
 * 
 * @example
 * ```ts
 * const extensions = [
 *     markdown(),
 *     calloutLivePreview,
 * ];
 * ```
 */
export const calloutLivePreview = ViewPlugin.fromClass(LivePreviewPlugin, {
    decorations: (v) => v.decorations,
});
