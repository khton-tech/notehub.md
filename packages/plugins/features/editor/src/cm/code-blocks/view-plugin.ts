import {
    Decoration,
    type DecorationSet,
    EditorView,
    ViewPlugin,
    ViewUpdate,
} from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';
import { Range } from '@codemirror/state';

/**
 * CodeBlocksPlugin - Handles styling of fenced code blocks
 * match node: `FencedCode`
 */
class CodeBlocksPlugin {
    decorations: DecorationSet;

    constructor(view: EditorView) {
        this.decorations = this.computeDecorations(view);
    }

    update(update: ViewUpdate) {
        if (
            update.docChanged ||
            update.viewportChanged ||
            update.selectionSet
        ) {
            this.decorations = this.computeDecorations(update.view);
        }
    }

    computeDecorations(view: EditorView): DecorationSet {
        const widgets: Range<Decoration>[] = [];
        const ranges = view.visibleRanges;

        for (const { from, to } of ranges) {
            syntaxTree(view.state).iterate({
                from,
                to,
                enter: (node) => {
                    if (node.name !== 'FencedCode') return;

                    // Get line info for styling
                    const startLine = view.state.doc.lineAt(node.from);
                    const endLine = view.state.doc.lineAt(node.to);

                    // Check for invalid range to prevent errors
                    if (startLine.number > endLine.number) return;

                    // Apply block background to all lines in the code block
                    for (let i = startLine.number; i <= endLine.number; i++) {
                        const line = view.state.doc.line(i);

                        // Create block styling
                        const style = `
                            background-color: var(--nh-bg-secondary, rgba(128, 128, 128, 0.05));
                            font-family: var(--nh-font-family-mono, monospace);
                        `.replace(/\s+/g, ' ');

                        // Add padding/radius to first/last lines if needed, 
                        // but usually simply setting bg on the line element is enough for a "block" feel
                        // if we want a contiguous block look, line decorations are good.

                        widgets.push(
                            Decoration.line({
                                class: 'cm-code-block-line',
                                attributes: { style }
                            }).range(line.from)
                        );
                    }

                    // Handle language identifier (CodeInfo)
                    // We can mute it or style it differently
                    const cursor = node.node.cursor();
                    if (cursor.firstChild()) {
                        do {
                            if (cursor.name === 'CodeInfo') {
                                widgets.push(
                                    Decoration.mark({ class: 'cm-code-info' }).range(cursor.from, cursor.to)
                                );
                            }
                            // The markers ``` are usually named CodeMark
                            else if (cursor.name === 'CodeMark') {
                                widgets.push(
                                    Decoration.mark({ class: 'cm-code-mark' }).range(cursor.from, cursor.to)
                                );
                            }
                        } while (cursor.nextSibling());
                    }
                },
            });
        }

        return Decoration.set(widgets.sort((a, b) => a.from - b.from));
    }
}

export const codeBlocksPlugin = ViewPlugin.fromClass(CodeBlocksPlugin, {
    decorations: (v) => v.decorations,
});
