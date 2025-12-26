/**
 * Live Preview ViewPlugin
 * 
 * Implements the "Collapse Engine" from RFC-002.
 * Dynamically hides/shows Markdown syntax based on cursor position.
 */

import {
    ViewPlugin,
    ViewUpdate,
    Decoration,
    EditorView
} from '@codemirror/view';
import type { DecorationSet } from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';
import type { Range } from '@codemirror/state';
import { EditorState } from '@codemirror/state';
import type { SyntaxNode } from '@lezer/common';
import {
    hiddenSyntax,
    boldMark,
    italicMark,
    linkMark,
    headingMarks,
    headingLines
} from './decorations';
import type { HeadingLevel } from './decorations';

// ============================================================================
// TYPES
// ============================================================================

interface SelectionRange {
    from: number;
    to: number;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if selection overlaps with a node range
 * Returns true if cursor is inside or touches the node boundaries
 */
function isSelectionOverlapping(selection: SelectionRange, nodeFrom: number, nodeTo: number): boolean {
    // Cursor is inside the node if selection intersects with node range
    return selection.from <= nodeTo && selection.to >= nodeFrom;
}

/**
 * Get heading level from node name (ATXHeading1 -> 1)
 */
function getHeadingLevel(nodeName: string): HeadingLevel | null {
    const match = nodeName.match(/^ATXHeading(\d)$/);
    if (match && match[1]) {
        const level = parseInt(match[1], 10);
        if (level >= 1 && level <= 6) {
            return level as HeadingLevel;
        }
    }
    return null;
}

/**
 * Find a child node by name within a parent node
 */
function findChildNode(node: SyntaxNode, childName: string): SyntaxNode | null {
    let result: SyntaxNode | null = null;
    const cursor = node.cursor();

    if (cursor.firstChild()) {
        do {
            if (cursor.name === childName) {
                result = cursor.node;
                break;
            }
        } while (cursor.nextSibling());
    }

    return result;
}

/**
 * Get all child nodes of a specific name
 */
function findAllChildNodes(node: SyntaxNode, childName: string): SyntaxNode[] {
    const results: SyntaxNode[] = [];
    const cursor = node.cursor();

    if (cursor.firstChild()) {
        do {
            if (cursor.name === childName) {
                results.push(cursor.node);
            }
        } while (cursor.nextSibling());
    }

    return results;
}

// ============================================================================
// VIEW PLUGIN CLASS
// ============================================================================

class LivePreviewPluginClass {
    decorations: DecorationSet;
    /** Only replace decorations for atomicRanges - prevents cursor trapping without causing deletion bugs */
    atomicDecorations: DecorationSet;

    constructor(view: EditorView) {
        const result = this.buildDecorations(view);
        this.decorations = result.decorations;
        this.atomicDecorations = result.atomicDecorations;
    }

    update(update: ViewUpdate): void {
        // Skip during IME composition to prevent input disruption
        if (update.view.composing) {
            return;
        }

        // Rebuild decorations on relevant changes
        if (update.docChanged || update.selectionSet || update.viewportChanged) {
            const result = this.buildDecorations(update.view);
            this.decorations = result.decorations;
            this.atomicDecorations = result.atomicDecorations;
        }
    }

    buildDecorations(view: EditorView): { decorations: DecorationSet; atomicDecorations: DecorationSet } {
        const allWidgets: Range<Decoration>[] = [];
        const atomicWidgets: Range<Decoration>[] = [];
        const { state } = view;
        const selection: SelectionRange = {
            from: state.selection.main.from,
            to: state.selection.main.to
        };

        // Helper to add both atomic (replace) and regular decorations
        const addDecoration = (deco: Range<Decoration>, isAtomic: boolean) => {
            allWidgets.push(deco);
            if (isAtomic) {
                atomicWidgets.push(deco);
            }
        };

        // Iterate only over visible ranges for performance
        for (const { from, to } of view.visibleRanges) {
            syntaxTree(state).iterate({
                from,
                to,
                enter: (node) => {
                    // Handle StrongEmphasis (**bold**)
                    if (node.name === 'StrongEmphasis') {
                        this.buildStrongEmphasisDecorations(node.node, selection, addDecoration);
                        return false; // Don't descend into children
                    }

                    // Handle Emphasis (*italic*)
                    if (node.name === 'Emphasis') {
                        this.buildEmphasisDecorations(node.node, selection, addDecoration);
                        return false;
                    }

                    // Handle ATXHeading1-6
                    const headingLevel = getHeadingLevel(node.name);
                    if (headingLevel !== null) {
                        this.buildHeadingDecorations(node.node, headingLevel, selection, addDecoration, state);
                        return false;
                    }

                    // Handle Link
                    if (node.name === 'Link') {
                        this.buildLinkDecorations(node.node, selection, addDecoration, state);
                        return false;
                    }

                    // Continue iterating for other nodes
                    return true;
                }
            });
        }

        // Sort decorations by position (required by CodeMirror)
        allWidgets.sort((a, b) => a.from - b.from || a.value.startSide - b.value.startSide);
        atomicWidgets.sort((a, b) => a.from - b.from || a.value.startSide - b.value.startSide);

        return {
            decorations: Decoration.set(allWidgets, true),
            atomicDecorations: Decoration.set(atomicWidgets, true)
        };
    }

    // ========== DECORATION BUILDERS (now methods to access addDecoration helper) ==========

    private buildStrongEmphasisDecorations(
        node: SyntaxNode,
        selection: SelectionRange,
        addDecoration: (deco: Range<Decoration>, isAtomic: boolean) => void
    ): void {
        const isOverlapping = isSelectionOverlapping(selection, node.from, node.to);
        const markers = findAllChildNodes(node, 'EmphasisMark');

        if (markers.length >= 2) {
            const openMarker = markers[0];
            const closeMarker = markers[markers.length - 1];

            if (openMarker && closeMarker) {
                if (isOverlapping) {
                    addDecoration(boldMark.range(node.from, node.to), false);
                } else {
                    addDecoration(hiddenSyntax.range(openMarker.from, openMarker.to), true);
                    addDecoration(boldMark.range(openMarker.to, closeMarker.from), false);
                    addDecoration(hiddenSyntax.range(closeMarker.from, closeMarker.to), true);
                }
            } else {
                addDecoration(boldMark.range(node.from, node.to), false);
            }
        } else {
            const markerLen = 2;
            if (node.to - node.from > markerLen * 2) {
                if (isOverlapping) {
                    addDecoration(boldMark.range(node.from, node.to), false);
                } else {
                    addDecoration(hiddenSyntax.range(node.from, node.from + markerLen), true);
                    addDecoration(boldMark.range(node.from + markerLen, node.to - markerLen), false);
                    addDecoration(hiddenSyntax.range(node.to - markerLen, node.to), true);
                }
            }
        }
    }

    private buildEmphasisDecorations(
        node: SyntaxNode,
        selection: SelectionRange,
        addDecoration: (deco: Range<Decoration>, isAtomic: boolean) => void
    ): void {
        const isOverlapping = isSelectionOverlapping(selection, node.from, node.to);
        const markers = findAllChildNodes(node, 'EmphasisMark');

        if (markers.length >= 2) {
            const openMarker = markers[0];
            const closeMarker = markers[markers.length - 1];

            if (openMarker && closeMarker) {
                if (isOverlapping) {
                    addDecoration(italicMark.range(node.from, node.to), false);
                } else {
                    addDecoration(hiddenSyntax.range(openMarker.from, openMarker.to), true);
                    addDecoration(italicMark.range(openMarker.to, closeMarker.from), false);
                    addDecoration(hiddenSyntax.range(closeMarker.from, closeMarker.to), true);
                }
            } else {
                addDecoration(italicMark.range(node.from, node.to), false);
            }
        } else {
            const markerLen = 1;
            if (node.to - node.from > markerLen * 2) {
                if (isOverlapping) {
                    addDecoration(italicMark.range(node.from, node.to), false);
                } else {
                    addDecoration(hiddenSyntax.range(node.from, node.from + markerLen), true);
                    addDecoration(italicMark.range(node.from + markerLen, node.to - markerLen), false);
                    addDecoration(hiddenSyntax.range(node.to - markerLen, node.to), true);
                }
            }
        }
    }

    private buildHeadingDecorations(
        node: SyntaxNode,
        level: HeadingLevel,
        selection: SelectionRange,
        addDecoration: (deco: Range<Decoration>, isAtomic: boolean) => void,
        state: EditorState
    ): void {
        const isOverlapping = isSelectionOverlapping(selection, node.from, node.to);
        const headerMark = findChildNode(node, 'HeaderMark');
        const linePos = state.doc.lineAt(node.from).from;

        addDecoration(headingLines[level].range(linePos), false);

        if (headerMark) {
            if (isOverlapping) {
                addDecoration(headingMarks[level].range(node.from, node.to), false);
            } else {
                addDecoration(hiddenSyntax.range(headerMark.from, headerMark.to), true);
                if (headerMark.to < node.to) {
                    addDecoration(headingMarks[level].range(headerMark.to, node.to), false);
                }
            }
        } else {
            const markerLen = level + 1;
            if (isOverlapping) {
                addDecoration(headingMarks[level].range(node.from, node.to), false);
            } else if (node.to - node.from > markerLen) {
                addDecoration(hiddenSyntax.range(node.from, node.from + markerLen), true);
                addDecoration(headingMarks[level].range(node.from + markerLen, node.to), false);
            }
        }
    }

    private buildLinkDecorations(
        node: SyntaxNode,
        selection: SelectionRange,
        addDecoration: (deco: Range<Decoration>, isAtomic: boolean) => void,
        state: EditorState
    ): void {
        const isOverlapping = isSelectionOverlapping(selection, node.from, node.to);

        if (isOverlapping) {
            addDecoration(linkMark.range(node.from, node.to), false);
            return;
        }

        const text = state.doc.sliceString(node.from, node.to);
        const closeBracketIdx = text.lastIndexOf('](');

        if (closeBracketIdx === -1) {
            addDecoration(linkMark.range(node.from, node.to), false);
            return;
        }

        const openBracket = node.from;
        const textStart = node.from + 1;
        const textEnd = node.from + closeBracketIdx;
        const urlSectionStart = node.from + closeBracketIdx;
        const urlSectionEnd = node.to;

        addDecoration(hiddenSyntax.range(openBracket, openBracket + 1), true);
        if (textStart < textEnd) {
            addDecoration(linkMark.range(textStart, textEnd), false);
        }
        addDecoration(hiddenSyntax.range(urlSectionStart, urlSectionEnd), true);
    }
}

// ============================================================================
// EXPORT
// ============================================================================

/**
 * LivePreview ViewPlugin
 * 
 * Usage: Include in EditorState.extensions array
 */
export const livePreviewPlugin = ViewPlugin.fromClass(LivePreviewPluginClass, {
    decorations: (v) => v.decorations
});
