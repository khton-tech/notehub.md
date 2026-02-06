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

/**
 * WikiLinkWidget - Renders clickable internal link
 */
class WikiLinkWidget extends WidgetType {
    constructor(
        readonly text: string,
        readonly target: string
    ) {
        super();
    }

    eq(other: WikiLinkWidget): boolean {
        return this.text === other.text && this.target === other.target;
    }

    toDOM(): HTMLElement {
        const link = document.createElement('a');
        link.className = 'cm-md-link cm-wiki-link';
        link.style.cursor = 'pointer';
        // Mock href to help browser recognize it as interactive
        link.href = '#';

        const triggerNavigation = () => {
            console.log('[WikiLink] Triggering navigation to:', this.target);
            const event = new CustomEvent('notehub:wiki-link', {
                detail: { target: this.target },
                bubbles: true,
                composed: true
            });
            link.dispatchEvent(event);
        };

        const clickHandler = (e: MouseEvent | TouchEvent) => {
            console.log('[WikiLink] Interaction detected:', e.type);
            e.preventDefault();
            e.stopPropagation();
            triggerNavigation();
            return false;
        };

        link.addEventListener('click', clickHandler);
        link.addEventListener('mousedown', (e) => {
            console.log('[WikiLink] mousedown');
            e.preventDefault();
            e.stopPropagation();
        });

        // Robust Touch Handling
        let touchStartX = 0;
        let touchStartY = 0;
        let isScrolling = false;

        link.addEventListener('touchstart', (e: TouchEvent) => {
            console.log('[WikiLink] touchstart');
            // Stop propagation so CodeMirror doesn't see this and move cursor!
            e.stopPropagation();

            const touch = e.changedTouches[0];
            if (!touch) return;
            touchStartX = touch.clientX;
            touchStartY = touch.clientY;
            isScrolling = false;
            // Do NOT preventDefault, allowing browser to start scroll gesture
        }, { passive: false });

        link.addEventListener('touchmove', (e: TouchEvent) => {
            if (isScrolling) return;

            const touch = e.changedTouches[0];
            if (!touch) return;
            const dx = Math.abs(touch.clientX - touchStartX);
            const dy = Math.abs(touch.clientY - touchStartY);

            // If moved more than 10px, consider it a scroll
            if (dx > 10 || dy > 10) {
                isScrolling = true;
                console.log('[WikiLink] touchmove - scrolling detected');
            }
        }, { passive: true });

        link.addEventListener('touchend', (e: TouchEvent) => {
            console.log('[WikiLink] touchend. Scrolling?', isScrolling);
            e.stopPropagation();

            if (!isScrolling) {
                // It was a tap!
                e.preventDefault(); // Prevent phantom mouse events
                triggerNavigation();
            }
        });

        link.textContent = this.text;
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
                    const isCursorInside = (nFrom: number, nTo: number) => {
                        return selection.ranges.some(
                            (r) => r.from <= nTo && r.to >= nFrom
                        );
                    };

                    // --- Standard Markdown Links ---
                    if (node.name === 'Link') {
                        if (isCursorInside(node.from, node.to)) {
                            widgets.push(
                                Decoration.mark({ class: 'cm-md-link-source' }).range(node.from, node.to)
                            );
                        } else {
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
                                widgets.push(
                                    Decoration.mark({ class: 'cm-md-link' }).range(node.from, node.to)
                                );
                            }
                        }
                    }
                    // --- WikiLinks ---
                    else if (node.name === 'WikiLink') {
                        if (isCursorInside(node.from, node.to)) {
                            widgets.push(
                                Decoration.mark({ class: 'cm-md-link-source' }).range(node.from, node.to)
                            );
                        } else {
                            const fullText = view.state.doc.sliceString(node.from, node.to);
                            // Parse [[Target|Alias]] or [[Target]]
                            // Remove [[ and ]]
                            const content = fullText.slice(2, -2);
                            const pipeIndex = content.indexOf('|');

                            let target = '';
                            let text = '';

                            if (pipeIndex !== -1) {
                                target = content.substring(0, pipeIndex);
                                text = content.substring(pipeIndex + 1);
                            } else {
                                target = content;
                                text = content;
                            }

                            widgets.push(
                                Decoration.replace({
                                    widget: new WikiLinkWidget(text, target),
                                    inclusive: true,
                                }).range(node.from, node.to)
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
