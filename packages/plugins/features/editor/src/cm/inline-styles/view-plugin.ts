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
 * CSS classes for inline styles
 */
const classNames = {
    bold: 'cm-md-bold',
    italic: 'cm-md-italic',
    code: 'cm-md-code',
    strikethrough: 'cm-md-strikethrough',
};

/**
 * Supported node types and their corresponding style classes
 */
const nodeTypes: Record<string, string> = {
    StrongEmphasis: classNames.bold,
    Emphasis: classNames.italic,
    InlineCode: classNames.code,
    StrikeThrough: classNames.strikethrough,
};

/**
 * Marker node types to look for within the parent nodes
 */
const markerTypes = new Set(['EmphasisMark', 'CodeMark', 'StrikeThroughMark']);

class InlineStylesPlugin {
    decorations: DecorationSet;
    atomicDeco: DecorationSet;

    constructor(view: EditorView) {
        const { decorations, atomicDeco } = this.computeDecorations(view);
        this.decorations = decorations;
        this.atomicDeco = atomicDeco;
    }

    update(update: ViewUpdate) {
        if (
            update.docChanged ||
            update.viewportChanged ||
            update.selectionSet
        ) {
            const { decorations, atomicDeco } = this.computeDecorations(update.view);
            this.decorations = decorations;
            this.atomicDeco = atomicDeco;
        }
    }

    computeDecorations(view: EditorView): { decorations: DecorationSet, atomicDeco: DecorationSet } {
        const widgets: Range<Decoration>[] = [];
        const atomicWidgets: Range<Decoration>[] = [];
        const ranges = view.visibleRanges;
        const { selection } = view.state;

        for (const { from, to } of ranges) {
            syntaxTree(view.state).iterate({
                from,
                to,
                enter: (node) => {
                    const styleClass = nodeTypes[node.type.name];
                    if (!styleClass) return;

                    // Check for intersection with cursor/selection
                    // Reveal markers if ANY selection range overlaps with the node.
                    const isCursorListener = selection.ranges.some(
                        (range) => range.from <= node.to && range.to >= node.from
                    );

                    if (isCursorListener) {
                        // Cursor is inside: Apply Mark Decoration ONLY (style the text, keep markers visible).
                        widgets.push(
                            Decoration.mark({ class: styleClass }).range(node.from, node.to)
                        );
                    } else {
                        // Cursor is outside: Hide markers, style content.

                        // 1. Identify marker ranges
                        const markerRanges: { from: number; to: number }[] = [];
                        let cursor = node.node.cursor();

                        if (cursor.firstChild()) {
                            do {
                                if (markerTypes.has(cursor.type.name)) {
                                    markerRanges.push({ from: cursor.from, to: cursor.to });
                                }
                            } while (cursor.nextSibling());
                        }

                        // 2. Hide markers
                        for (const range of markerRanges) {
                            const replaceDeco = Decoration.replace({}).range(range.from, range.to);
                            widgets.push(replaceDeco);
                            atomicWidgets.push(replaceDeco);
                        }

                        // 3. Style content (ranges that are NOT markers)
                        markerRanges.sort((a, b) => a.from - b.from);

                        let currentPos = node.from;
                        for (const range of markerRanges) {
                            if (currentPos < range.from) {
                                widgets.push(
                                    Decoration.mark({ class: styleClass }).range(currentPos, range.from)
                                );
                            }
                            currentPos = range.to;
                        }
                        // Add remaining content after the last marker (if any)
                        if (currentPos < node.to) {
                            widgets.push(
                                Decoration.mark({ class: styleClass }).range(currentPos, node.to)
                            );
                        }
                    }
                },
            });
        }

        const sortFn = (a: Range<Decoration>, b: Range<Decoration>) => {
            if (a.from !== b.from) return a.from - b.from;
            if (a.value.startSide !== b.value.startSide) return a.value.startSide - b.value.startSide;
            return a.to - b.to;
        };

        return {
            decorations: Decoration.set(widgets.sort(sortFn)),
            atomicDeco: Decoration.set(atomicWidgets.sort(sortFn)),
        };
    }
}

export const inlineStylesPlugin = ViewPlugin.fromClass(InlineStylesPlugin, {
    decorations: (v) => v.decorations,
    provide: (plugin) =>
        EditorView.atomicRanges.of((view) => {
            return view.plugin(plugin)?.atomicDeco || Decoration.none;
        }),
});
