/**
 * @fileoverview Notehub Markdown Extension Module
 * 
 * Combines all custom Lezer parsers into a single CodeMirror extension.
 * 
 * ## Usage
 * 
 * ```typescript
 * import { notehubMarkdown } from './lezer';
 * 
 * const extensions = [
 *     notehubMarkdown(),
 *     // ... other extensions
 * ];
 * ```
 * 
 * ## Included Extensions
 * 
 * - **Callouts**: `> [!TYPE] Title` block syntax
 * - **WikiLinks**: `[[Page]]` and `[[Page|Alias]]` inline syntax
 * 
 * @module @notehub/editor/lezer
 */

import { markdown } from '@codemirror/lang-markdown';
import { GFM, type MarkdownConfig } from '@lezer/markdown';
import type { Extension } from '@codemirror/state';
import { CalloutExtension } from './callouts';
import { WikiLinkExtension } from './wikilinks';

/**
 * Combined Notehub markdown extensions.
 * 
 * Includes:
 * - GFM (Task lists, strikethrough, tables, autolinks)
 * - Callout parser (block-level)
 * - WikiLink parser (inline-level)
 */
export const notehubMarkdownExtensions: MarkdownConfig[] = [
    ...GFM,
    CalloutExtension,
    WikiLinkExtension,
];

/**
 * Create a CodeMirror extension for Notehub-flavored Markdown.
 * 
 * This wraps the standard `markdown()` language with our custom
 * Callout and WikiLink parsers.
 * 
 * @returns CodeMirror extension with Notehub markdown support
 * 
 * @example
 * ```typescript
 * const state = EditorState.create({
 *     doc: '> [!INFO] Hello\n[[My Page]]',
 *     extensions: [notehubMarkdown()]
 * });
 * ```
 */
export function notehubMarkdown(): Extension {
    return markdown({
        extensions: notehubMarkdownExtensions,
    });
}

// Re-export node types for external use
export { CalloutNodeTypes } from './callouts';
export { WikiLinkNodeTypes } from './wikilinks';
