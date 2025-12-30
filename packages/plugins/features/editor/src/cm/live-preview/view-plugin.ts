/**
 * @fileoverview Live Preview ViewPlugin for Notehub
 * 
 * Handles dynamic decorators for:
 * - Callouts (Headers and Body styling)
 * - Block styling (Quotes, Code blocks)
 * 
 * @module @notehub/editor/cm/live-preview
 */

import {
    ViewPlugin,
    Decoration,
    EditorView,
    type ViewUpdate,
    type DecorationSet
} from '@codemirror/view';
import { syntaxTree, ensureSyntaxTree } from '@codemirror/language';
import { RangeSetBuilder, type EditorState, type Range } from '@codemirror/state';
import { CalloutHeaderWidget } from '../widgets/CalloutWidget';

// ----------------------------------------------------------------------------
// Types & Interfaces
// ----------------------------------------------------------------------------

interface TreeNode {
    from: number;
    to: number;
    node: {
        from: number;
        to: number;
        name: string;
        parent: TreeNode['node'] | null;
        nextSibling: TreeNode['node'] | null;
    };
}

// Colors from CalloutHeader for consistent styling
const DEFAULT_COLORS = { bg: 'rgba(158, 158, 158, 0.15)', border: '#9e9e9e' };

const TYPE_COLORS: Record<string, { bg: string; border: string }> = {
    // Info (Blue)
    INFO: { bg: 'rgba(74, 144, 226, 0.15)', border: '#4a90e2' },
    NOTE: { bg: 'rgba(74, 144, 226, 0.15)', border: '#4a90e2' },

    // Tips (Green)
    TIP: { bg: 'rgba(76, 175, 80, 0.15)', border: '#4caf50' },
    SUCCESS: { bg: 'rgba(76, 175, 80, 0.15)', border: '#4caf50' },
    CHECK: { bg: 'rgba(76, 175, 80, 0.15)', border: '#4caf50' },
    DONE: { bg: 'rgba(76, 175, 80, 0.15)', border: '#4caf50' },

    // Warnings (Orange)
    WARNING: { bg: 'rgba(255, 152, 0, 0.15)', border: '#ff9800' },
    WARN: { bg: 'rgba(255, 152, 0, 0.15)', border: '#ff9800' },

    // Danger (Red)
    DANGER: { bg: 'rgba(244, 67, 54, 0.15)', border: '#f44336' },
    ERROR: { bg: 'rgba(244, 67, 54, 0.15)', border: '#f44336' },
    BUG: { bg: 'rgba(244, 67, 54, 0.15)', border: '#f44336' },

    // Abstract (Cyan)
    ABSTRACT: { bg: 'rgba(0, 188, 212, 0.15)', border: '#00bcd4' },
    SUMMARY: { bg: 'rgba(0, 188, 212, 0.15)', border: '#00bcd4' },

    // Question (Purple)
    QUESTION: { bg: 'rgba(156, 39, 176, 0.15)', border: '#9c27b0' },
    FAQ: { bg: 'rgba(156, 39, 176, 0.15)', border: '#9c27b0' },

    // Quote (Gray)
    QUOTE: { bg: 'rgba(158, 158, 158, 0.15)', border: '#9e9e9e' },
};

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

/**
 * Clean callout type string (remove [! and ])
 * @example "[!INFO]" -> "INFO"
 */
function getCalloutType(state: EditorState, from: number, to: number): string {
    const raw = state.doc.sliceString(from, to);
    return raw.replace(/^\[!|\]$/g, '');
}

function getCalloutTitle(state: EditorState, node: TreeNode['node']): string {
    let sibling = node.nextSibling;
    while (sibling) {
        if (sibling.name === 'CalloutTitle') {
            return state.doc.sliceString(sibling.from, sibling.to).trim();
        }
        sibling = sibling.nextSibling;
    }
    return '';
}

function getLineRange(state: EditorState, pos: number) {
    const line = state.doc.lineAt(pos);
    return { from: line.from, to: line.to };
}

function cursorOverlapsRange(view: EditorView, from: number, to: number): boolean {
    if (!view.hasFocus) {
        return false;
    }
    for (const range of view.state.selection.ranges) {
        if (range.from <= to && range.to >= from) {
            return true;
        }
    }
    return false;
}

// ----------------------------------------------------------------------------
// Core Logic
// ----------------------------------------------------------------------------

/**
 * Build decorations for callouts in the visible range.
 */
function buildDecorations(view: EditorView): DecorationSet {
    const { state } = view;
    const decorations: Array<Range<Decoration>> = [];
    const processedLines = new Set<number>();

    // Ensure syntax tree is available
    for (const { from: _from, to } of view.visibleRanges) {
        ensureSyntaxTree(state, to, 100);
    }

    const tree = syntaxTree(state);

    // Iterate over visible ranges to find decorations
    for (const { from, to } of view.visibleRanges) {
        tree.iterate({
            from,
            to,
            enter: (node) => {
                if (node.name !== 'CalloutType') {
                    return;
                }

                const calloutTypeNode = node.node;
                const headerLine = getLineRange(state, calloutTypeNode.from);

                if (processedLines.has(headerLine.from)) {
                    return;
                }

                processedLines.add(headerLine.from);
                const cursorInside = cursorOverlapsRange(view, headerLine.from, headerLine.to);
                const typeRaw = getCalloutType(state, calloutTypeNode.from, calloutTypeNode.to);
                const title = getCalloutTitle(state, calloutTypeNode);

                // Colors
                const normalizedType = typeRaw.toUpperCase();
                const colors = TYPE_COLORS[normalizedType] || DEFAULT_COLORS;

                // Common Styles (Inline to defeat specificity)
                const commonStyle = `
                    background-color: ${colors.bg};
                    border-left: 3px solid ${colors.border};
                    border-right: 1px solid ${colors.border};
                    margin-left: 4px;
                    margin-right: 4px;
                    padding-left: 16px;
                    padding-right: 16px;
                    box-sizing: border-box;
                `.replace(/\s+/g, ' ');

                // --- 1. Process Body First to determine hasBody state ---
                const bodyDecorations: Array<Range<Decoration>> = [];
                let hasBody = false;

                let currentLineNum = state.doc.lineAt(headerLine.from).number + 1;
                const totalLines = state.doc.lines;
                let isFirstBodyLine = true;

                while (currentLineNum <= totalLines) {
                    const line = state.doc.line(currentLineNum);
                    const lineText = line.text;
                    const trimmed = lineText.trimStart();

                    if (!trimmed.startsWith('>')) {
                        break;
                    }

                    hasBody = true;
                    processedLines.add(line.from);
                    const cursorOnBodyLine = cursorOverlapsRange(view, line.from, line.to);

                    if (!cursorOnBodyLine) {
                        const markerMatch = lineText.match(/^\s*(>\s?)/);
                        if (markerMatch && markerMatch[1]) {
                            const markerIndex = lineText.indexOf(markerMatch[1]);
                            const markerStart = line.from + markerIndex;
                            const markerEnd = markerStart + markerMatch[1].length;
                            bodyDecorations.push(Decoration.replace({}).range(markerStart, markerEnd));
                        }
                    }

                    let isLastLine = true;
                    if (currentLineNum < totalLines) {
                        const nextLine = state.doc.line(currentLineNum + 1);
                        if (nextLine.text.trimStart().startsWith('>')) {
                            isLastLine = false;
                        }
                    }

                    // Dynamic Body Style
                    let bodyStyle = `${commonStyle} border-top: none;`;

                    if (isFirstBodyLine) {
                        bodyStyle += ' padding-top: 8px;';
                        isFirstBodyLine = false;
                    }

                    if (isLastLine) {
                        bodyStyle += `
                            border-bottom: 1px solid ${colors.border};
                            border-bottom-left-radius: 4px;
                            border-bottom-right-radius: 4px;
                            margin-bottom: 0.5em;
                            padding-bottom: 12px;
                        `.replace(/\s+/g, ' ');
                    }

                    bodyDecorations.push(
                        Decoration.line({
                            class: 'cm-callout-body',
                            attributes: { style: bodyStyle }
                        }).range(line.from)
                    );

                    currentLineNum++;
                }

                // --- 2. Process Header with explicit state knowledge ---

                let headerStyle = `
                    ${commonStyle}
                    border-top: 1px solid ${colors.border};
                    border-top-left-radius: 4px;
                    border-top-right-radius: 4px;
                    padding-top: 12px;
                    padding-bottom: 12px;
                `.replace(/\s+/g, ' ');

                if (!hasBody) {
                    // Closed box look
                    headerStyle += `
                        border-bottom: 1px solid ${colors.border};
                        border-bottom-left-radius: 4px;
                        border-bottom-right-radius: 4px;
                        margin-bottom: 0.5em;
                    `.replace(/\s+/g, ' ');
                } else {
                    // Open bottom to merge
                    headerStyle += `
                        border-bottom: none;
                        border-bottom-left-radius: 0;
                        border-bottom-right-radius: 0;
                    `.replace(/\s+/g, ' ');
                }

                decorations.push(
                    Decoration.line({
                        class: 'cm-callout-header-wrapper',
                        attributes: { style: headerStyle }
                    }).range(headerLine.from)
                );

                if (!cursorInside) {
                    const widget = new CalloutHeaderWidget(typeRaw, title);
                    decorations.push(
                        Decoration.replace({
                            widget,
                            inclusive: true,
                        }).range(headerLine.from, headerLine.to)
                    );
                }

                // Append buffered body decorations
                decorations.push(...bodyDecorations);
            },
        });
    }

    decorations.sort((a, b) => {
        if (a.from !== b.from) return a.from - b.from;
        return a.value.startSide - b.value.startSide;
    });

    const builder = new RangeSetBuilder<Decoration>();
    for (const decoration of decorations) {
        builder.add(decoration.from, decoration.to, decoration.value);
    }
    return builder.finish();
}

// ----------------------------------------------------------------------------
// Plugin Implementation
// ----------------------------------------------------------------------------

class LivePreviewPlugin {
    decorations: DecorationSet;

    constructor(view: EditorView) {
        this.decorations = buildDecorations(view);
    }

    update(update: ViewUpdate) {
        if (update.docChanged || update.selectionSet || update.viewportChanged) {
            this.decorations = buildDecorations(update.view);
        }
    }
}

export const livePreviewPlugin = ViewPlugin.fromClass(LivePreviewPlugin, {
    decorations: (v) => v.decorations,
});

export const livePreviewExtension = [
    livePreviewPlugin
];
