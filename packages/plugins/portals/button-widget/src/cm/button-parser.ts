import { EditorView, Decoration, type DecorationSet } from '@codemirror/view';
import { ViewPlugin, type ViewUpdate } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';
import { ButtonWidget } from '../widgets/ButtonWidget';

/**
 * Regular expression to match button syntax:
 * - [BUTTON::TEXT] - Simple button
 * - [BUTTON::TEXT::ALERT TEXT] - Button with alert
 * 
 * CRITICAL: 
 * - Must NOT match across line breaks! CodeMirror forbids replacing \n
 * - Must NOT match wikilinks like [[BUTTON::text]] - negative lookbehind/lookahead
 * 
 * Capture groups:
 * 1: Button text (required) - no colons or newlines
 * 2: Alert text (optional) - no closing bracket or newlines
 */
const BUTTON_REGEX = /(?<!\[)\[BUTTON::([^:\n\r]+)(?:::([^\]\n\r]+))?\](?!\])/g;

/**
 * ButtonParserPlugin - CodeMirror ViewPlugin that parses [BUTTON::{TEXT}] syntax
 * 
 * This plugin:
 * - Scans visible document ranges
 * - Matches button syntax using regex
 * - Creates ButtonWidget decorations
 * - Handles widget lifecycle via Portal Bridge
 * 
 * Performance:
 * - Only processes visible viewport
 * - Uses RangeSetBuilder for efficient decoration management
 */
export const buttonParserPlugin = ViewPlugin.fromClass(
    class {
        decorations: DecorationSet;

        constructor(view: EditorView) {
            this.decorations = this.buildDecorations(view);
        }

        update(update: ViewUpdate): void {
            // Rebuild decorations if document changed or viewport changed
            if (update.docChanged || update.viewportChanged) {
                this.decorations = this.buildDecorations(update.view);
            }
        }

        /**
         * Build decorations for all button syntax in the viewport
         */
        buildDecorations(view: EditorView): DecorationSet {
            const builder = new RangeSetBuilder<Decoration>();

            console.log('[ButtonParser] Building decorations...');

            // Iterate through visible ranges
            for (const { from, to } of view.visibleRanges) {
                const text = view.state.doc.sliceString(from, to);

                console.log('[ButtonParser] Scanning range', from, '-', to, 'text length:', text.length);

                // Find all button matches in this range
                let match: RegExpExecArray | null;
                BUTTON_REGEX.lastIndex = 0; // Reset regex state

                while ((match = BUTTON_REGEX.exec(text)) !== null) {
                    const matchStart = from + match.index;
                    const matchEnd = matchStart + match[0].length;
                    const buttonText = match[1].trim();
                    const alertText = match[2] ? match[2].trim() : undefined;

                    console.log('[ButtonParser] ✓ Found button:', buttonText, alertText ? `with alert: "${alertText}"` : '(no alert)', 'at positions', matchStart, '-', matchEnd);

                    // Create widget decoration
                    const widget = new ButtonWidget(buttonText, alertText);
                    const decoration = Decoration.replace({
                        widget,
                        inclusive: false,
                        block: false,
                    });

                    builder.add(matchStart, matchEnd, decoration);
                }
            }

            const decorations = builder.finish();
            console.log('[ButtonParser] Finished building decorations, size:', decorations.size);
            return decorations;
        }

        destroy(): void {
            // Cleanup handled by Portal Bridge automatically
        }
    },
    {
        decorations: (value: { decorations: DecorationSet }) => value.decorations,
    }
);
