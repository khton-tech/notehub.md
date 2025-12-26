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
    headingLines,
    bulletPointWidget,
    codeBlockFenceHide,
    codeBlockLangBadge
} from './decorations';
import type { HeadingLevel } from './decorations';
import { CheckboxWidget } from '../widgets/CheckboxWidget';
import { CalloutHeaderWidget } from '../widgets/CalloutHeaderWidget';

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

                    // Handle TaskMarker (checkbox for task lists)
                    if (node.name === 'TaskMarker') {
                        this.buildTaskMarkerDecorations(node.node, selection, addDecoration, state);
                        return false;
                    }

                    // Handle ListMark (bullets)
                    if (node.name === 'ListMark') {
                        this.buildListMarkDecorations(node.node, selection, addDecoration, state);
                        return false;
                    }

                    // Handle FencedCode
                    if (node.name === 'FencedCode') {
                        this.buildCodeBlockDecorations(node.node, selection, addDecoration, state);
                        return false;
                    }

                    // Handle Blockquote (Callouts & Standard Quotes)
                    if (node.name === 'Blockquote') {
                        // Return false to prevent descending into children (QuoteMarks etc)
                        // because we handle everything line-by-line in the handler.
                        // Actually, wait. If we return false, we skip StrongEmphasis etc inside the quote?
                        // We must return TRUE to process inner syntax (bold, italic).
                        // BUT we must NOT process QuoteMark individually if we want to control it here.
                        this.buildBlockquoteDecorations(node.node, selection, addDecoration, state);
                        return true;
                    }

                    // Handle QuoteMark (> symbol) - REMOVED
                    // We handle QuoteMarks inside buildBlockquoteDecorations now.
                    // This prevents conflicts and allows selective hiding.
                    // if (node.name === 'QuoteMark') { ... }

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

    /**
     * Build decorations for task list markers (checkboxes)
     * 
     * TaskMarker nodes represent `[ ]` or `[x]` in task lists.
     * We replace them with interactive CheckboxWidget.
     */
    private buildTaskMarkerDecorations(
        node: SyntaxNode,
        selection: SelectionRange,
        addDecoration: (deco: Range<Decoration>, isAtomic: boolean) => void,
        state: EditorState
    ): void {
        const markerText = state.doc.sliceString(node.from, node.to);

        // Determine checked state from marker text
        // Valid markers: [ ], [x], [X]
        const isChecked = markerText === '[x]' || markerText === '[X]';
        const isValidMarker = isChecked || markerText === '[ ]';

        if (!isValidMarker) {
            return;
        }

        // Check if cursor is exactly on the task marker brackets
        // If cursor is on the brackets, show raw text for editing
        const isCursorOnMarker = isSelectionOverlapping(selection, node.from, node.to);

        if (isCursorOnMarker) {
            // Show raw text - don't replace with widget
            // Just apply styling to indicate it's a task marker
            return;
        }

        // Replace the marker with a CheckboxWidget
        // pos is the position of the `[` character for toggleCheckbox
        const widget = new CheckboxWidget(isChecked, node.from);
        const decoration = Decoration.replace({
            widget,
            inclusive: false
        });

        addDecoration(decoration.range(node.from, node.to), true);
    }

    /**
     * Build decorations for list markers
     * Replaces - or * with bullet point •
     */
    private buildListMarkDecorations(
        node: SyntaxNode,
        selection: SelectionRange,
        addDecoration: (deco: Range<Decoration>, isAtomic: boolean) => void,
        state: EditorState
    ): void {
        // If cursor overlaps, show original mark
        if (isSelectionOverlapping(selection, node.from, node.to)) {
            return;
        }

        // Check if this is a Task List item to hide the bullet.
        // Structure depends on parser:
        // 1. Task > ListMark, TaskMarker ...
        // 2. ListItem > ListMark, Paragraph > TaskMarker ...
        // 3. ListItem > ListMark, TaskMarker ...

        let isTask = false;
        const parent = node.parent;

        // Check 1: Parent is explicitly 'Task'
        if (parent?.name === 'Task') {
            isTask = true;
        }
        // Check 2: Direct sibling is TaskMarker
        else if (node.nextSibling?.name === 'TaskMarker') {
            isTask = true;
        }
        // Check 4: Parent has TaskMarker child (fallback)
        else if (parent?.getChild('TaskMarker')) {
            isTask = true;
        }

        // Check 5 (ROBUST FALLBACK): Check text content immediately following the ListMark
        // If the text looks like "... [ ]" or "... [x]", treat it as a task.
        // This handles cases where parser AST structure is unexpected.
        if (!isTask) {
            const nextChars = state.doc.sliceString(node.to, node.to + 10);
            if (/^\s*\[[ xX]\]/.test(nextChars)) {
                isTask = true;
            }
        }

        if (isTask) {
            // Hide the dash for task items
            addDecoration(hiddenSyntax.range(node.from, node.to), true);
            return;
        }

        // For regular lists (ListItem), replace with bullet
        addDecoration(bulletPointWidget.range(node.from, node.to), true);
    }

    private buildCodeBlockDecorations(
        node: SyntaxNode,
        selection: SelectionRange,
        addDecoration: (deco: Range<Decoration>, isAtomic: boolean) => void,
        state: EditorState
    ): void {
        const isOverlapping = isSelectionOverlapping(selection, node.from, node.to);
        const startLine = state.doc.lineAt(node.from);
        const endLine = state.doc.lineAt(node.to);

        // Apply background to all lines in the block
        for (let i = startLine.number; i <= endLine.number; i++) {
            const linePos = state.doc.line(i).from;
            let className = 'cm-code-block-bg';
            if (i === startLine.number) className += ' cm-code-block-first';
            if (i === endLine.number) className += ' cm-code-block-last';

            addDecoration(Decoration.line({ class: className }).range(linePos), false);
        }

        // If cursor inside, show everything (just background applied above)
        if (isOverlapping) {
            return;
        }

        // If cursor outside, apply fancy styling
        const infos = findAllChildNodes(node, 'CodeInfo');
        const marks = findAllChildNodes(node, 'CodeMark');

        // Hide fences
        marks.forEach(mark => {
            addDecoration(codeBlockFenceHide.range(mark.from, mark.to), true);
        });

        // Hide info string (language name)
        infos.forEach(info => {
            addDecoration(codeBlockFenceHide.range(info.from, info.to), true);
        });

        // Add Language Badge
        let lang = '';
        if (infos.length > 0) {
            lang = state.doc.sliceString(infos[0]!.from, infos[0]!.to);
        }
        if (lang) {
            addDecoration(codeBlockLangBadge(lang).range(node.from), false);
        }
    }

    private buildBlockquoteDecorations(
        node: SyntaxNode,
        selection: SelectionRange,
        addDecoration: (deco: Range<Decoration>, isAtomic: boolean) => void,
        state: EditorState
    ): void {
        const startLine = state.doc.lineAt(node.from);
        const endLine = state.doc.lineAt(node.to);
        const text = startLine.text;

        // ROBUST REGEX:
        // 1. Optional leading whitespace/tabs
        // 2. > character
        // 3. Optional whitespace
        // 4. [!TYPE] - case insensitive, dashes allowed
        // 5. Optional Title (rest of line)
        const match = text.match(/^[ \t]*>[ \t]*\[!([a-zA-Z0-9_-]+)\]\s*(.*)?$/);

        if (!match) {
            // Standard Blockquote (Card Style)
            for (let i = startLine.number; i <= endLine.number; i++) {
                const line = state.doc.line(i);
                const lineText = line.text;

                // Build class list for this line
                let className = 'cm-blockquote';
                if (i === startLine.number) className += ' cm-blockquote-first';
                if (i === endLine.number) className += ' cm-blockquote-last';

                // Apply line decoration for visual styling
                addDecoration(Decoration.line({ class: className }).range(line.from), false);

                // Hide the '>' marker if cursor is NOT on this line
                if (!isSelectionOverlapping(selection, line.from, line.to)) {
                    const markerMatch = lineText.match(/^[ \t]*>( ?)/);
                    if (markerMatch) {
                        const matchLen = markerMatch[0].length;
                        const markerStart = line.from + (markerMatch.index || 0);
                        const markerEnd = markerStart + matchLen;

                        addDecoration(hiddenSyntax.range(markerStart, markerEnd), true);
                    }
                }
            }
            return;
        }

        // Is Callout
        const type = match[1]!;
        const title = match[2] || type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
        const lowerType = type.toLowerCase();

        // 1. HEADER LINE
        const isCursorOnHeader = isSelectionOverlapping(selection, startLine.from, startLine.to);

        // Apply distinct class for the header line itself (optional, but good for specific styling)
        addDecoration(Decoration.line({ class: `cm-callout-header-line cm-callout-${lowerType}` }).range(startLine.from), false);

        if (!isCursorOnHeader) {
            addDecoration(Decoration.replace({
                widget: new CalloutHeaderWidget(type, title),
                inclusive: true
            }).range(startLine.from, startLine.to), true);
        }

        // 2. BODY LINES
        for (let i = startLine.number + 1; i <= endLine.number; i++) {
            const line = state.doc.line(i);
            const lineText = line.text;

            // Apply body styling
            let className = `cm-callout-body cm-callout-${lowerType}`;
            if (i === endLine.number) className += ` cm-callout-last`;

            addDecoration(Decoration.line({ class: className }).range(line.from), false);

            // Hide the marker ">" or "> " only if cursor is NOT on this line
            // This prevents "jiggling" and deletion bugs
            if (!isSelectionOverlapping(selection, line.from, line.to)) {
                // Find ">" at start of line
                // We use simple regex because we are identifying the marker visual
                const markerMatch = lineText.match(/^[ \t]*>( ?)/);
                if (markerMatch) {
                    const matchLen = markerMatch[0].length;
                    const markerStart = line.from + markerMatch.index!;
                    const markerEnd = markerStart + matchLen;

                    addDecoration(hiddenSyntax.range(markerStart, markerEnd), true);
                }
            }
        }
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
