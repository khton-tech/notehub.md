/**
 * @fileoverview Abstract React Bridge Widget for CodeMirror 6
 * 
 * Base class for creating CodeMirror widgets that render React components
 * using the Portal Pattern (RFC-005). Handles lifecycle management and
 * communication with the Portal Store.
 * 
 * ## Usage
 * 
 * ```ts
 * class MyButtonWidget extends ReactBridgeWidget<ButtonProps> {
 *     constructor(props: ButtonProps) {
 *         super(ButtonComponent, props);
 *     }
 * }
 * ```
 * 
 * @module @notehub/editor/bridge/widget
 */

import { WidgetType } from '@codemirror/view';
import type { FC } from 'react';
import { portalStore } from './store';

/**
 * Abstract base class for React-rendered CodeMirror widgets.
 * 
 * Extends CodeMirror's `WidgetType` and integrates with the Portal Store
 * to render React components without using `ReactDOM.createRoot` inside
 * the widget (which would be a performance killer).
 * 
 * @typeParam P - Props type for the React component
 */
export abstract class ReactBridgeWidget<P = unknown> extends WidgetType {
    /** Unique identifier for this widget instance */
    protected readonly id: string;

    /** React component to render */
    protected readonly component: FC<P>;

    /** Current props for the component */
    protected props: P;

    /**
     * Creates a new ReactBridgeWidget instance.
     * 
     * @param component - React component to render
     * @param props - Initial props for the component
     */
    constructor(component: FC<P>, props: P) {
        super();
        this.id = crypto.randomUUID();
        this.component = component;
        this.props = props;
    }

    /**
     * Creates the DOM container and registers with the Portal Store.
     * Called by CodeMirror when the widget is first rendered.
     * 
     * @returns DOM element containing the widget
     */
    toDOM(): HTMLElement {
        const container = document.createElement('span');
        container.className = 'cm-react-widget';

        // Register with portal store for React rendering
        portalStore.mount(this.id, container, this.component, this.props);

        return container;
    }

    /**
     * Updates the widget props without recreating the DOM.
     * Called by CodeMirror when decorations are recalculated.
     * 
     * @param _dom - Existing DOM element (unused, kept for interface)
     * @returns `true` to prevent CodeMirror from recreating the DOM
     */
    updateDOM(_dom: HTMLElement): boolean {
        // Update props in the portal store
        portalStore.update(this.id, this.props);
        return true;
    }

    /**
     * Cleanup: unregisters from the Portal Store.
     * Called by CodeMirror when the widget is removed.
     * 
     * @param _dom - DOM element being destroyed (unused)
     */
    destroy(_dom: HTMLElement): void {
        portalStore.unmount(this.id);
    }

    /**
     * Equality check for widget reuse.
     * Override in subclasses for custom comparison logic.
     * 
     * @param other - Widget to compare against
     * @returns `true` if widgets are equivalent
     */
    eq(other: WidgetType): boolean {
        if (!(other instanceof ReactBridgeWidget)) {
            return false;
        }
        // Default: compare by component reference
        return this.component === other.component;
    }

    /**
     * Whether the widget participates in text cursor movement.
     * Default: `true` (cursor skips over the widget).
     */
    get estimatedHeight(): number {
        return -1; // Let browser calculate height
    }

    /**
     * Whether line breaks affect the widget.
     */
    get lineBreaks(): number {
        return 0; // Inline widget
    }
}
