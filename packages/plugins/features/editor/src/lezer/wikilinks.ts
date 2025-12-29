/**
 * @fileoverview WikiLink InlineParser for @lezer/markdown
 * 
 * Parses Obsidian-style wiki links:
 * - Simple: `[[Page Name]]`
 * - With alias: `[[Page Name|Display Text]]`
 * 
 * ## AST Structure
 * 
 * ```
 * WikiLink
 * ├── WikiLinkMark    (opening [[)
 * ├── WikiLinkPage    (target page name)
 * ├── WikiLinkAlias?  (optional display text)
 * └── WikiLinkMark    (closing ]])
 * ```
 * 
 * ## Implementation Notes
 * 
 * - Triggers on `[[` delimiter
 * - Stops at `]]` or newline (no multi-line links)
 * - Pipe `|` separates page name from alias
 * 
 * @module @notehub/editor/lezer/wikilinks
 */

import type { InlineParser, MarkdownConfig, InlineContext } from '@lezer/markdown';

/**
 * Node type IDs for WikiLink syntax tree.
 */
export const WikiLinkNodeTypes = {
    WikiLink: 'WikiLink',
    WikiLinkMark: 'WikiLinkMark',
    WikiLinkPage: 'WikiLinkPage',
    WikiLinkAlias: 'WikiLinkAlias',
} as const;

/**
 * Character codes for parsing.
 */
const CHAR_OPEN_BRACKET = 91;   // [
const CHAR_CLOSE_BRACKET = 93;  // ]
const CHAR_PIPE = 124;          // |
const CHAR_NEWLINE = 10;        // \n
const CHAR_CARRIAGE_RETURN = 13; // \r

/**
 * InlineParser for WikiLinks.
 * 
 * Parses `[[Page]]` and `[[Page|Alias]]` syntax into structured nodes.
 */
const wikiLinkParser: InlineParser = {
    name: 'WikiLink',

    /**
     * Parse a WikiLink at the current position.
     * 
     * @param cx - Inline parsing context
     * @param next - Current character code
     * @param pos - Current position in the document
     * @returns -1 if not a wiki link, otherwise end position
     */
    parse(cx: InlineContext, next: number, pos: number): number {
        // Must start with `[`
        if (next !== CHAR_OPEN_BRACKET) {
            return -1;
        }

        // Check for second `[`
        if (cx.char(pos + 1) !== CHAR_OPEN_BRACKET) {
            return -1;
        }

        // Found `[[` - now scan for `]]`
        const start = pos;
        const openMarkEnd = pos + 2;

        let current = openMarkEnd;
        let pipePos = -1;
        let closePos = -1;

        // Scan until we find `]]`, newline, or end of text
        while (current < cx.end) {
            const char = cx.char(current);

            // Stop at newlines (links shouldn't span lines)
            if (char === CHAR_NEWLINE || char === CHAR_CARRIAGE_RETURN) {
                return -1;
            }

            // Check for `]]` closing
            if (char === CHAR_CLOSE_BRACKET && cx.char(current + 1) === CHAR_CLOSE_BRACKET) {
                closePos = current;
                break;
            }

            // Track pipe position for alias
            if (char === CHAR_PIPE && pipePos === -1) {
                pipePos = current;
            }

            current++;
        }

        // Must have closing `]]`
        if (closePos === -1) {
            return -1;
        }

        // Calculate end position (after `]]`)
        const end = closePos + 2;

        // Build child elements
        const children: ReturnType<InlineContext['elt']>[] = [];

        // Opening mark `[[`
        children.push(cx.elt(WikiLinkNodeTypes.WikiLinkMark, start, openMarkEnd));

        if (pipePos !== -1) {
            // Has alias: [[Page|Alias]]
            // Page name is between `[[` and `|`
            children.push(cx.elt(WikiLinkNodeTypes.WikiLinkPage, openMarkEnd, pipePos));
            // Alias is between `|` and `]]`
            children.push(cx.elt(WikiLinkNodeTypes.WikiLinkAlias, pipePos + 1, closePos));
        } else {
            // No alias: [[Page]]
            children.push(cx.elt(WikiLinkNodeTypes.WikiLinkPage, openMarkEnd, closePos));
        }

        // Closing mark `]]`
        children.push(cx.elt(WikiLinkNodeTypes.WikiLinkMark, closePos, end));

        // Add the complete WikiLink node
        return cx.addElement(cx.elt(WikiLinkNodeTypes.WikiLink, start, end, children));
    },
};

/**
 * MarkdownConfig extension for WikiLink parsing.
 */
export const WikiLinkExtension: MarkdownConfig = {
    defineNodes: [
        { name: WikiLinkNodeTypes.WikiLink },
        { name: WikiLinkNodeTypes.WikiLinkMark },
        { name: WikiLinkNodeTypes.WikiLinkPage },
        { name: WikiLinkNodeTypes.WikiLinkAlias },
    ],
    parseInline: [wikiLinkParser],
};
