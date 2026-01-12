import {
    Decoration,
    type DecorationSet,
    EditorView,
    ViewPlugin,
    ViewUpdate,
    WidgetType,
} from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';
import { Range } from '@codemirror/state';

/**
 * Lezer Markdown node types for links:
 * - Link: The full `[text](url)` structure
 *   - LinkMark: `[`, `]`, `(`, `)`
 *   - URL: The URL portion
 */

/**
 * LinkWidget - Renders clickable link when cursor is outside
 */
class LinkWidget extends WidgetType {
    constructor(
        readonly text: string,
        readonly url: string
    ) {
        super();
    }

    eq(other: LinkWidget): boolean {
        return this.text === other.text && this.url === other.url;
    }

    toDOM(): HTMLElement {
        const link = document.createElement('a');
        link.href = this.url;
        link.textContent = this.text;
        link.className = 'cm-md-link';
        link.target = '_blank';
        link.rel = 'noopener noreferrer';

        // Prevent CodeMirror from handling the click
        // Prevent CodeMirror from handling the click
        const clickHandler = (e: MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();

            // Dispatch custom event for the host app to handle (Tauri shell open)
            const event = new CustomEvent('notehub:external-link', {
                detail: { url: this.url },
                bubbles: true,
                composed: true
            });
            link.dispatchEvent(event);

            return false;
        };

        // Handle both click and mousedown to capture interaction before CM
        link.addEventListener('click', clickHandler);
        link.addEventListener('mousedown', (e) => {
            // Stop CM from stealing the focus/selection change on mousedown
            e.preventDefault();
            e.stopPropagation();
        });

        return link;
    }

    ignoreEvent(): boolean {
        return true;
    }
}

class LinksPlugin {
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
        const { selection } = view.state;

        for (const { from, to } of ranges) {
            syntaxTree(view.state).iterate({
                from,
                to,
                enter: (node) => {
                    // Match Link nodes (standard Markdown links)
                    if (node.name !== 'Link') return;

                    // Check if cursor overlaps with this link
                    const isOverlapping = selection.ranges.some(
                        (r) => r.from <= node.to && r.to >= node.from
                    );

                    if (isOverlapping) {
                        // Cursor inside: Just style the link, keep raw syntax visible
                        widgets.push(
                            Decoration.mark({ class: 'cm-md-link-source' }).range(node.from, node.to)
                        );
                    } else {
                        // Cursor outside: Replace with rendered link widget
                        // Parse the link structure: [text](url)
                        const fullText = view.state.doc.sliceString(node.from, node.to);
                        const match = fullText.match(/^\[([^\]]*)\]\(([^)]*)\)$/);

                        if (match) {
                            const text = match[1] || '';
                            const url = match[2] || '';
                            widgets.push(
                                Decoration.replace({
                                    widget: new LinkWidget(text, url),
                                    inclusive: true,
                                }).range(node.from, node.to)
                            );
                        } else {
                            // Fallback: just style it
                            widgets.push(
                                Decoration.mark({ class: 'cm-md-link' }).range(node.from, node.to)
                            );
                        }
                    }
                },
            });
        }

        return Decoration.set(widgets.sort((a, b) => a.from - b.from));
    }
}

export const linksPlugin = ViewPlugin.fromClass(LinksPlugin, {
    decorations: (v) => v.decorations,
});
