import { Extension } from '@codemirror/state';
import { EditorView, Decoration, DecorationSet, ViewPlugin, ViewUpdate } from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';

/**
 * Block Styling Plugin
 * 
 * Applies visual styling to block-level elements:
 * - Fenced Code Blocks
 * - Blockquotes (including basic callout support)
 */
const blockStylingPlugin = ViewPlugin.fromClass(class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
        this.decorations = this.computeDecorations(view);
    }

    update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged) {
            this.decorations = this.computeDecorations(update.view);
        }
    }

    computeDecorations(view: EditorView): DecorationSet {
        const widgets: any[] = [];

        for (const { from, to } of view.visibleRanges) {
            syntaxTree(view.state).iterate({
                from,
                to,
                enter: (node) => {
                    if (node.name === 'FencedCode') {
                        // Apply style to the entire block line-by-line
                        // We use Decoration.line to style the background of the line
                        // This requires iterating over lines in the node range
                        const startLine = view.state.doc.lineAt(node.from);
                        const endLine = view.state.doc.lineAt(node.to);

                        for (let i = startLine.number; i <= endLine.number; i++) {
                            const line = view.state.doc.line(i);
                            widgets.push(Decoration.line({
                                class: 'cm-code-block'
                            }).range(line.from));
                        }
                    } else if (node.name === 'Blockquote') {
                        const startLine = view.state.doc.lineAt(node.from);
                        const endLine = view.state.doc.lineAt(node.to);

                        // Check for callout syntax: > [!INFO]
                        let isCallout = false;
                        const firstLineText = startLine.text;
                        // Regex to check for > [!something]
                        // Note: Markdown blockquote starts with >, but the node content might include it or not depending on parser.
                        // Standard markdown parser includes the > marks in the node range.

                        if (firstLineText.match(/^\s*>\s*\[!/)) {
                            isCallout = true;
                        }

                        for (let i = startLine.number; i <= endLine.number; i++) {
                            const line = view.state.doc.line(i);
                            widgets.push(Decoration.line({
                                class: isCallout ? 'cm-blockquote cm-callout-base' : 'cm-blockquote'
                            }).range(line.from));
                        }
                    }
                }
            });
        }

        return Decoration.set(widgets.sort((a, b) => a.from - b.from));
    }
}, {
    decorations: v => v.decorations
});

export const blockStyling = (): Extension => {
    return [
        blockStylingPlugin
    ];
};
