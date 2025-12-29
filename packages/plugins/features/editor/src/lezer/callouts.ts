/**
 * @fileoverview Callout BlockParser for @lezer/markdown
 * 
 * Parses Obsidian-style callouts:
 * ```
 * > [!INFO] Title
 * > Body content
 * > More content
 * ```
 * 
 * ## AST Structure
 * 
 * The parser adds inline elements to identify callout parts:
 * - CalloutType: The type identifier (INFO, WARNING, etc.)
 * - CalloutTitle: Optional title text after the type
 * 
 * The block structure uses standard Blockquote parsing.
 * 
 * ## Key Implementation Notes
 * 
 * - Uses `before: "Blockquote"` priority to add elements before blockquote parses
 * - Adds inline decorations for header elements via `addElement`
 * - Returns false to let Blockquote handle the actual block structure
 * 
 * @module @notehub/editor/lezer/callouts
 */

import type { MarkdownConfig } from '@lezer/markdown';

/**
 * Node type IDs for the callout syntax tree.
 */
export const CalloutNodeTypes = {
    CalloutType: 'CalloutType',
    CalloutTitle: 'CalloutTitle',
} as const;

/**
 * Regex to match callout header: `[!TYPE]` with optional title
 * Groups: [1] = type (e.g., "INFO"), [2] = title (optional)
 */
const CALLOUT_HEADER_REGEX = /^\s*\[!([A-Za-z0-9_-]+)\]\s*(.*)?$/;

/**
 * MarkdownConfig extension for Callout parsing.
 * 
 * Uses a simple approach: detect callout pattern, add type/title elements,
 * then let the standard Blockquote parser handle the block structure.
 */
export const CalloutExtension: MarkdownConfig = {
    defineNodes: [
        { name: CalloutNodeTypes.CalloutType },
        { name: CalloutNodeTypes.CalloutTitle },
    ],
    parseBlock: [
        {
            name: 'Callout',
            before: 'Blockquote',
            parse(cx, line) {
                // Must start with `>`
                if (line.next !== 62 /* '>' */) {
                    return false;
                }

                // Get content after `>` (skip `>` and optional space)
                const lineText = line.text;
                const afterMarker = lineText.slice(line.pos + 1).replace(/^\s/, '');

                // Check for callout pattern [!TYPE]
                const match = afterMarker.match(CALLOUT_HEADER_REGEX);
                if (!match) {
                    // Not a callout - let standard Blockquote handle it
                    return false;
                }

                const calloutTitle = match[2] || '';

                // Calculate positions for header elements
                const typeStart = lineText.indexOf('[!', line.pos) + 2;
                const typeEnd = lineText.indexOf(']', typeStart);

                // Add CalloutType element
                if (typeStart >= 0 && typeEnd > typeStart) {
                    cx.addElement(
                        cx.elt(CalloutNodeTypes.CalloutType,
                            cx.lineStart + typeStart,
                            cx.lineStart + typeEnd)
                    );
                }

                // Add CalloutTitle element (if present)
                if (calloutTitle.trim()) {
                    const titleSearchStart = typeEnd + 1;
                    const trimmedTitle = calloutTitle.trim();
                    const titlePos = lineText.indexOf(trimmedTitle, titleSearchStart);
                    if (titlePos >= 0) {
                        cx.addElement(
                            cx.elt(CalloutNodeTypes.CalloutTitle,
                                cx.lineStart + titlePos,
                                cx.lineStart + titlePos + trimmedTitle.length)
                        );
                    }
                }

                // Return false to let Blockquote parser handle the block structure
                // Our elements are added as inline decorations
                return false;
            },
        },
    ],
};
