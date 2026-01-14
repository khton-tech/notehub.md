import type { Extension } from "@codemirror/state";
import { EditorView, Decoration, type DecorationSet, ViewPlugin, ViewUpdate, WidgetType } from "@codemirror/view";

class PlaceholderWidget extends WidgetType {
    toDOM() {
        const span = document.createElement("span");
        span.textContent = "..type / to open commands";
        span.style.pointerEvents = "none";
        span.style.color = "var(--nh-text-muted, rgba(150, 150, 150, 0.5))"; // Use CSS variable or fallback
        span.style.opacity = "0.6";
        span.style.fontSize = "0.9em"; // Slightly smaller to distinguish from text
        span.style.paddingLeft = "5px";
        return span;
    }
}

/**
 * ViewPlugin that adds a placeholder decoration to an empty line if it has the cursor.
 */
const placeholderPlugin = ViewPlugin.fromClass(
    class {
        decorations: DecorationSet;

        constructor(view: EditorView) {
            this.decorations = this.computeDecorations(view);
        }

        update(update: ViewUpdate) {
            if (update.docChanged || update.selectionSet) {
                this.decorations = this.computeDecorations(update.view);
            }
        }

        computeDecorations(view: EditorView): DecorationSet {
            const { state } = view;
            const selection = state.selection.main;

            // Only show if selection is a simple cursor (empty range)
            if (!selection.empty) {
                return Decoration.none;
            }

            const line = state.doc.lineAt(selection.head);

            // Only show if the line is completely empty
            if (line.length === 0) {
                return Decoration.set([
                    Decoration.widget({
                        widget: new PlaceholderWidget(),
                        side: 1 // Appear after the cursor
                    }).range(selection.head)
                ]);
            }

            return Decoration.none;
        }
    },
    {
        decorations: v => v.decorations
    }
);

export function slashPlaceholder(): Extension {
    return placeholderPlugin;
}
