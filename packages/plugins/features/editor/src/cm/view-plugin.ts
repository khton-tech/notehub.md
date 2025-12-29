/**
 * @fileoverview Live Preview View Plugin
 * 
 * Scans the document for [[BUTTON::label]] patterns and replaces them
 * with interactive React widgets when the cursor is outside the range.
 * 
 * Key Features:
 * - Cursor-aware: Shows raw text when editing, widget when viewing
 * - Atomic Ranges: Cursor skips over widgets when navigating
 * - Efficient: Uses DecorationSet for O(log n) updates
 * 
 * @module @notehub/editor/cm/view-plugin
 */

import {
    ViewPlugin,
    ViewUpdate,
    Decoration,
    DecorationSet,
    EditorView,
    type PluginValue
} from '@codemirror/view';
import type { Range } from '@codemirror/state';
import { SmartButtonWidget } from './widgets/SmartButtonWidget';

// ============================================================================
// Pattern Matching
// ============================================================================

/**
 * Regex pattern for [[BUTTON::label]] syntax
 * Captures the label text between ::]] 
 */
const BUTTON_PATTERN = /\[\[BUTTON::(.+?)\]\]/g;

/**
 * Match result with position information
 */
interface PatternMatch {
    from: number;
    to: number;
    label: string;
}

/**
 * Find all button patterns in the document
 */
function findPatterns(text: string): PatternMatch[] {
    const matches: PatternMatch[] = [];
    let match: RegExpExecArray | null;

    // Reset lastIndex to ensure consistent matching
    BUTTON_PATTERN.lastIndex = 0;

    while ((match = BUTTON_PATTERN.exec(text)) !== null) {
        matches.push({
            from: match.index,
            to: match.index + match[0].length,
            label: match[1]
        });
    }

    return matches;
}

// ============================================================================
// Cursor Intersection Check
// ============================================================================

/**
 * Check if any selection intersects with the given range
 */
function selectionIntersectsRange(
    view: EditorView,
    from: number,
    to: number
): boolean {
    const selection = view.state.selection;

    for (const range of selection.ranges) {
        // Check if the selection range overlaps with the pattern range
        if (range.from <= to && range.to >= from) {
            return true;
        }
    }

    return false;
}

// ============================================================================
// View Plugin Implementation
// ============================================================================

/**
 * Live Preview Plugin Value
 * Manages decorations based on cursor position
 */
class LivePreviewPluginValue implements PluginValue {
    decorations: DecorationSet;

    constructor(view: EditorView) {
        this.decorations = this.buildDecorations(view);
    }

    update(update: ViewUpdate): void {
        // Rebuild decorations if document changed or selection changed
        if (update.docChanged || update.selectionSet) {
            this.decorations = this.buildDecorations(update.view);
        }
    }

    /**
     * Build the decoration set based on current document and cursor position
     */
    private buildDecorations(view: EditorView): DecorationSet {
        const decorations: Range<Decoration>[] = [];
        const docText = view.state.doc.toString();
        const matches = findPatterns(docText);

        for (const match of matches) {
            const { from, to, label } = match;

            // Check if cursor/selection is inside this range
            const isEditing = selectionIntersectsRange(view, from, to);

            if (!isEditing) {
                // Cursor is outside - replace with widget
                const widget = new SmartButtonWidget(label);
                const decoration = Decoration.replace({
                    widget,
                    inclusive: false
                });
                decorations.push(decoration.range(from, to));
            }
            // If editing, no decoration - show raw text
        }

        return Decoration.set(decorations, true);
    }

    destroy(): void {
        // Cleanup handled by BridgeWidget.destroy()
    }
}

// ============================================================================
// Plugin Factory
// ============================================================================

/**
 * Create the Live Preview ViewPlugin
 */
export const livePreviewPlugin = ViewPlugin.fromClass(LivePreviewPluginValue, {
    decorations: (v) => v.decorations
});

// ============================================================================
// Atomic Ranges Extension
// ============================================================================

/**
 * Atomic Ranges extension for proper cursor navigation
 * When a range is replaced by a widget, the cursor should skip over it
 */
export const livePreviewAtomicRanges = EditorView.atomicRanges.of((view) => {
    const plugin = view.plugin(livePreviewPlugin);
    return plugin?.decorations ?? Decoration.none;
});

// ============================================================================
// Combined Extension
// ============================================================================

/**
 * Complete Live Preview extension
 * Includes the view plugin and atomic ranges for proper UX
 */
export const livePreviewExtension = [
    livePreviewPlugin,
    livePreviewAtomicRanges
];

export default livePreviewExtension;
