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
import { CheckboxWidget } from '../widgets/CheckboxWidget';

class BulletWidget extends WidgetType {
    toDOM() {
        const span = document.createElement('span');
        span.textContent = '•';
        span.className = 'cm-list-bullet';
        span.style.color = 'var(--nh-accent-primary)';
        span.style.marginRight = '0.5em';
        return span;
    }
}

/**
 * Toggle a task checkbox at the given position.
 * Reads current state from document and dispatches the change.
 */
function toggleCheckbox(view: EditorView, pos: number): boolean {
    // Find the TaskMarker at this position by reading the document
    // The TaskMarker is typically `[ ]` or `[x]`, and the checkbox character is at pos+1
    const from = pos;
    const text = view.state.sliceDoc(from, from + 3);

    console.log('[ListsPlugin] toggleCheckbox:', { pos, text });

    // Check if we're at a task marker
    if (!text.startsWith('[') || text.length < 3) {
        // Try to find the task marker by looking around
        const lineStart = view.state.doc.lineAt(pos).from;
        const lineText = view.state.doc.lineAt(pos).text;
        const taskMatch = lineText.match(/\[[ xX]\]/);

        if (taskMatch) {
            const markerPos = lineStart + (taskMatch.index || 0);
            const currentChar = view.state.sliceDoc(markerPos + 1, markerPos + 2);
            const newChar = (currentChar === ' ') ? 'x' : ' ';

            console.log('[ListsPlugin] Found task marker at', markerPos, 'current:', currentChar, 'new:', newChar);

            view.dispatch({
                changes: { from: markerPos + 1, to: markerPos + 2, insert: newChar },
                userEvent: 'input.toggleTask'
            });
            return true;
        }
        return false;
    }

    const currentChar = text.charAt(1);
    const newChar = (currentChar === ' ') ? 'x' : ' ';

    console.log('[ListsPlugin] Direct toggle, current:', currentChar, 'new:', newChar);

    view.dispatch({
        changes: { from: from + 1, to: from + 2, insert: newChar },
        userEvent: 'input.toggleTask'
    });
    return true;
}

class ListsPlugin {
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
                    const type = node.type.name;

                    // Logic: Iterate ListItem nodes
                    if (type === 'ListItem') {
                        let taskMarkerNode: { from: number, to: number } | null = null;
                        let listMarkNode: { from: number, to: number } | null = null;

                        // Scan children of ListItem
                        const cursor = node.node.cursor();

                        if (cursor.firstChild()) {
                            do {
                                const childType = cursor.type.name;

                                if (childType === 'ListMark') {
                                    listMarkNode = { from: cursor.from, to: cursor.to };
                                }

                                else if (childType === 'Task') {
                                    const taskCursor = cursor.node.cursor();
                                    if (taskCursor.firstChild()) {
                                        do {
                                            if (taskCursor.type.name === 'TaskMarker') {
                                                taskMarkerNode = { from: taskCursor.from, to: taskCursor.to };
                                                break;
                                            }
                                        } while (taskCursor.nextSibling());
                                    }
                                }
                                else if (childType === 'Paragraph' && !taskMarkerNode) {
                                    const pCursor = cursor.node.cursor();
                                    if (pCursor.firstChild()) {
                                        if (pCursor.type.name === 'TaskMarker') {
                                            taskMarkerNode = { from: pCursor.from, to: pCursor.to };
                                        }
                                    }
                                }
                                else if (childType === 'TaskMarker') {
                                    taskMarkerNode = { from: cursor.from, to: cursor.to };
                                }
                            } while (cursor.nextSibling());
                        }

                        // Determine overlapping state
                        const isTaskOverlapping = taskMarkerNode ? selection.ranges.some(
                            r => r.from <= taskMarkerNode!.to && r.to >= taskMarkerNode!.from
                        ) : false;

                        const isListMarkOverlapping = listMarkNode ? selection.ranges.some(
                            r => r.from <= listMarkNode!.to && r.to >= listMarkNode!.from
                        ) : false;

                        // Case 1: Task List Item
                        if (taskMarkerNode) {
                            if (listMarkNode && !isListMarkOverlapping && !isTaskOverlapping) {
                                widgets.push(
                                    Decoration.replace({}).range(listMarkNode.from, listMarkNode.to)
                                );
                            }

                            // Render Checkbox for TaskMarker
                            if (!isTaskOverlapping) {
                                const text = view.state.sliceDoc(taskMarkerNode.from, taskMarkerNode.to);
                                const checked = text.includes('x') || text.includes('X');

                                widgets.push(
                                    Decoration.replace({
                                        widget: new CheckboxWidget(checked),
                                        inclusive: true
                                    }).range(taskMarkerNode.from, taskMarkerNode.to)
                                );
                            }
                        }
                        // Case 2: Regular List Item
                        else if (listMarkNode) {
                            if (!isListMarkOverlapping) {
                                const text = view.state.sliceDoc(listMarkNode.from, listMarkNode.to);
                                if (/^[-*+]\s?$/.test(text)) {
                                    widgets.push(
                                        Decoration.replace({
                                            widget: new BulletWidget()
                                        }).range(listMarkNode.from, listMarkNode.to)
                                    );
                                } else {
                                    widgets.push(
                                        Decoration.mark({ class: 'cm-list-mark-ordered' }).range(listMarkNode.from, listMarkNode.to)
                                    );
                                }
                            }
                        }
                    }
                },
            });
        }

        return Decoration.set(widgets.sort((a, b) => a.from - b.from));
    }
}

// Official CodeMirror pattern: event handlers are registered in ViewPlugin options
export const listsPlugin = ViewPlugin.fromClass(ListsPlugin, {
    decorations: (v) => v.decorations,

    eventHandlers: {
        mousedown: (e: MouseEvent, view: EditorView) => {
            const target = e.target as HTMLElement;

            // Check if click is on any element inside our checkbox widget
            const checkboxWidget = target.closest('.nh-checkbox-widget');
            if (checkboxWidget) {
                e.preventDefault();
                e.stopPropagation();

                const pos = view.posAtDOM(checkboxWidget);
                console.log('[ListsPlugin] Checkbox clicked at pos:', pos);

                if (pos !== null) {
                    toggleCheckbox(view, pos);
                }
                return true;
            }
            return false;
        }
    }
});
