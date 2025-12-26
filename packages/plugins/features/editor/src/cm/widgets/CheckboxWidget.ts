/**
 * Checkbox Widget for CodeMirror 6
 * 
 * A WidgetType that renders an interactive React Checkbox via Portal Bridge.
 * Handles mounting/unmounting and text manipulation for checkbox toggling.
 * 
 * @module widgets/CheckboxWidget
 */

import { WidgetType, EditorView } from '@codemirror/view';
import { bridgeService, generateWidgetId } from '../react-bridge';
import { Checkbox } from '@notehub/ck-standard';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Props passed to the Checkbox component via bridge
 */
interface CheckboxBridgeProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
}

// ============================================================================
// TOGGLE HELPER
// ============================================================================

/**
 * Toggle a task checkbox in the document
 * 
 * Dispatches a transaction to change `[ ]` to `[x]` or vice versa.
 * 
 * @param view - The CodeMirror EditorView
 * @param pos - Position of the `[` character in the TaskMarker
 */
export function toggleCheckbox(view: EditorView, pos: number): void {
    const { state } = view;
    const doc = state.doc;

    // Get the text at position: should be "[ ]" or "[x]"
    // The pos should point to the `[` character
    const markerText = doc.sliceString(pos, pos + 3);

    let newText: string;
    if (markerText === '[ ]') {
        newText = '[x]';
    } else if (markerText === '[x]' || markerText === '[X]') {
        newText = '[ ]';
    } else {
        // Not a valid task marker, bail out
        console.warn('[CheckboxWidget] Invalid task marker at position:', pos, 'text:', markerText);
        return;
    }

    // Dispatch the transaction
    view.dispatch({
        changes: {
            from: pos,
            to: pos + 3,
            insert: newText
        }
    });
}

// ============================================================================
// WIDGET CLASS
// ============================================================================

/**
 * CheckboxWidget - A CodeMirror WidgetType for interactive checkboxes
 * 
 * Uses the Portal Bridge to render a React Checkbox component.
 * The widget replaces the `[ ]` or `[x]` text in task list items.
 */
export class CheckboxWidget extends WidgetType {
    private widgetId: string;

    /**
     * @param checked - Whether the checkbox is checked
     * @param pos - Document position of the `[` character
     */
    constructor(
        private readonly checked: boolean,
        private readonly pos: number
    ) {
        super();
        this.widgetId = generateWidgetId();
    }

    /**
     * Determine widget equality for efficient updates
     */
    eq(other: CheckboxWidget): boolean {
        return this.checked === other.checked && this.pos === other.pos;
    }

    /**
     * Create the DOM element and mount the React component
     */
    toDOM(view: EditorView): HTMLElement {
        const container = document.createElement('span');
        container.className = 'cm-checkbox-widget';
        container.style.display = 'inline-flex';
        container.style.alignItems = 'center';
        container.style.verticalAlign = 'middle';

        // Create onChange handler that triggers document update
        const handleChange = (_newChecked: boolean) => {
            // One-way data flow: click -> update text -> re-parse -> update widget
            toggleCheckbox(view, this.pos);
        };

        // Mount the React Checkbox via bridge
        const props: CheckboxBridgeProps = {
            checked: this.checked,
            onChange: handleChange
        };

        bridgeService.mount(this.widgetId, container, Checkbox, props);

        return container;
    }

    /**
     * Clean up when widget is removed
     */
    destroy(_dom: HTMLElement): void {
        bridgeService.unmount(this.widgetId);
    }

    /**
     * Ignore events on the widget (let React handle them)
     */
    ignoreEvent(_event: Event): boolean {
        return true;
    }
}

export default CheckboxWidget;
