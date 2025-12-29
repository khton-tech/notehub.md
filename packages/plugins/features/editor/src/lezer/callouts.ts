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

import type { BlockContext, MarkdownConfig, Line } from "@lezer/markdown";

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
    parseBlock: [{
        name: "CalloutMarker",
        before: "Blockquote",

        parse: (cx: BlockContext, line: Line): boolean => {
            // Check for '>' at the start
            if (line.next !== 62 /* '>' */) {
                return false;
            }

            // Get the text of the line
            const text = line.text.slice(line.pos);

            // Regex: Starts with '>', optional space, '[!TYPE]', optional title
            const match = /^>\s*\[!(\w+)\]\s*(.*)$/.exec(text);

            if (!match) {
                return false;
            }

            // Calculate absolute positions
            const start = cx.lineStart + line.pos;

            // Find type position (between [! and ])
            const bracketPos = text.indexOf('[!');
            const closeBracketPos = text.indexOf(']', bracketPos);

            if (bracketPos >= 0 && closeBracketPos > bracketPos) {
                const typeStart = start + bracketPos + 2;
                const typeEnd = start + closeBracketPos;
                cx.addElement(cx.elt(CalloutType, typeStart, typeEnd));
            }

            // Add title element if present
            const titleStr = match[2] || '';
            if (titleStr && titleStr.trim()) {
                const titleOffset = text.indexOf(titleStr, closeBracketPos);
                if (titleOffset >= 0) {
                    const titleStart = start + titleOffset;
                    const titleEnd = titleStart + titleStr.length;
                    cx.addElement(cx.elt(CalloutTitle, titleStart, titleEnd));
                }
            }

            // Return false - let Blockquote handle the block structure
            return false;
        }
    }]
};
