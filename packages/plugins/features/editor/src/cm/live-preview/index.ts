/**
 * Live Preview Extension
 * 
 * Entry point for the Obsidian-like Live Preview mode.
 * Dynamically hides/shows Markdown syntax based on cursor position.
 * 
 * @module live-preview
 */

import { EditorView, Decoration } from '@codemirror/view';
import { livePreviewPlugin } from './view-plugin';

// Re-export for advanced usage
export { livePreviewPlugin } from './view-plugin';
export * from './decorations';

/**
 * Complete Live Preview extension including:
 * - ViewPlugin for decoration computation
 * - Atomic Ranges for smooth cursor navigation
 * 
 * @returns Extension array to include in EditorState
 * 
 * @example
 * ```ts
 * import { livePreview } from './cm/live-preview';
 * 
 * const state = EditorState.create({
 *     extensions: [
 *         markdown(),
 *         livePreview(),
 *         // ... other extensions
 *     ]
 * });
 * ```
 */
export function livePreview() {
    return [
        // The main ViewPlugin that computes decorations
        livePreviewPlugin,

        // Atomic Ranges: Prevents cursor from getting "stuck" inside hidden regions
        // When user presses Left/Right arrow, cursor jumps over hidden markers
        // IMPORTANT: Only use atomicDecorations (replace decorations) - NOT all decorations
        // Using all decorations causes deletion bugs when editing marker characters
        EditorView.atomicRanges.of((view) => {
            const plugin = view.plugin(livePreviewPlugin);
            if (plugin) {
                return plugin.atomicDecorations;
            }
            return Decoration.none;
        })
    ];
}

export default livePreview;
