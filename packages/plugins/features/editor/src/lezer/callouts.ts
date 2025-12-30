/**
 * @fileoverview Callout Parser for @lezer/markdown
 * 
 * ## Implementation Note
 * 
 * After extensive testing, `startComposite` causes infinite loops/crashes
 * in all configurations tested. This is a known limitation of the
 * lezer-markdown composite block API for custom syntax.
 * 
 * **Solution:** Use inline marker elements only. The block structure
 * uses standard Blockquote, and Live Preview will use ViewPlugin
 * decorations for full visual styling.
 * 
 * ## AST Output
 * 
 * ```
 * Blockquote
 * ├── CalloutType    ← Marks the type inside [!TYPE]
 * ├── CalloutTitle   ← Marks the title text
 * └── Paragraph...   ← Standard blockquote content
 * ```
 * 
 * @module @notehub/editor/lezer/callouts
 */

import type { MarkdownConfig } from "@lezer/markdown";

// Node type names
const CalloutType = "CalloutType";
const CalloutTitle = "CalloutTitle";

// Re-export for external use
export const CalloutNodeTypes = {
    CalloutType,
    CalloutTitle,
} as const;

/**
 * MarkdownConfig extension for Callout parsing.
 * 
 * SAFE IMPLEMENTATION:
 * - Adds inline CalloutType and CalloutTitle markers
 * - Returns false to let Blockquote handle block structure
 * - No startComposite (causes crashes)
 */
export const CalloutExtension: MarkdownConfig = {
    defineNodes: [
        { name: CalloutType },
        { name: CalloutTitle }
    ],
    parseInline: [{
        name: "CalloutMarker",
        parse: (cx, next, pos) => {
            // Looking for '[!TYPE]'
            if (next !== 91 /* '[' */) return -1;

            // Peek ahead to see if it matches [!...
            if (cx.char(pos + 1) !== 33 /* '!' */) return -1;

            // Simple regex match from current position
            // Note: Inline parsing sees text content (block markers like > are already handled)
            const text = cx.slice(pos, cx.end);
            const match = /^\[!(\w+)\]/.exec(text);

            if (!match) return -1;

            // Found a callout marker!
            const fullMatch = match[0]; // [!INFO]

            // Add CalloutType node
            const typeStart = cx.elt(CalloutType, pos, pos + fullMatch.length);
            cx.addElement(typeStart);

            // Check for title
            // The title is everything after the marker until end of line
            const afterMarker = pos + fullMatch.length;
            const remaining = text.slice(fullMatch.length);

            // Skip spaces
            const titleStartOffset = remaining.search(/\S/);

            if (titleStartOffset >= 0) {
                const titleStart = afterMarker + titleStartOffset;

                // Stop at newline or end of context
                let titleEnd = cx.end;
                const newlineIndex = remaining.indexOf('\n');
                if (newlineIndex !== -1) {
                    titleEnd = Math.min(titleEnd, pos + fullMatch.length + newlineIndex);
                }

                if (titleEnd > titleStart) {
                    cx.addElement(cx.elt(CalloutTitle, titleStart, titleEnd));
                }
                return titleEnd; // Consumed up to end of title
            }

            return afterMarker; // Consumed marker
        },
        before: "Link" // Run before Link parser to capture [!TYPE] before it becomes a link
    }]
};
