import type React from 'react';
import { WidgetType } from '@codemirror/view';
import { getBridgeService } from '../../lib/portal-bridge/BridgeService';

// Simple counter for generating unique IDs
let widgetIdCounter = 0;

/**
 * ReactWidget - Abstract base class for CodeMirror widgets that render React components.
 *
 * This class handles the boilerplate of:
 * - Creating a unique ID for the widget
 * - Creating a DOM container element
 * - Mounting/updating/unmounting the React component via BridgeService
 *
 * Subclasses only need to:
 * - Implement `getComponent()` to specify which React component to render
 * - Pass props to the constructor
 *
 * @template P - The props type for the React component
 *
 * @example
 * ```typescript
 * interface CalloutProps {
 *   type: string;
 *   content: string;
 * }
 *
 * class CalloutWidget extends ReactWidget<CalloutProps> {
 *   protected getComponent(): React.FC<CalloutProps> {
 *     return CalloutComponent;
 *   }
 * }
 *
 * // Usage
 * const widget = new CalloutWidget({ type: 'info', content: 'Hello' });
 * ```
 */
export abstract class ReactWidget<P = unknown> extends WidgetType {
    protected readonly id: string;
    protected readonly props: P;
    private domElement: HTMLElement | null = null;
    private bridge = getBridgeService();

    /**
     * @param props - Props to pass to the React component
     */
    constructor(props: P) {
        super();
        this.id = `react-widget-${++widgetIdCounter}`;
        this.props = props;
    }

    /**
     * Get the React component to render.
     * This must be implemented by subclasses.
     */
    protected abstract getComponent(): React.FC<P>;

    /**
     * Create the DOM element and mount the React component.
     * Called by CodeMirror when the widget is first inserted.
     */
    toDOM(): HTMLElement {
        // Create container element
        const container = document.createElement('div');
        container.dataset.portalId = this.id;
        container.className = 'cm-react-widget';

        this.domElement = container;

        // Mount React component via bridge
        this.bridge.mount(this.id, container, this.getComponent(), this.props);

        return container;
    }

    /**
     * Update the React component's props.
     * Called by CodeMirror when the widget needs to update.
     *
     * @returns true to indicate the DOM was updated
     */
    updateDOM(dom: HTMLElement): boolean {
        // Verify this is the same DOM element
        if (dom !== this.domElement) {
            return false;
        }

        // Update props via bridge
        this.bridge.update(this.id, this.props);

        return true;
    }

    /**
     * Clean up the React component and resources.
     * Called by CodeMirror when the widget is removed.
     */
    destroy(_dom: HTMLElement): void {
        // Unmount React component via bridge
        this.bridge.unmount(this.id);
        this.domElement = null;
    }

    /**
     * Widgets with different IDs are considered non-equal, forcing proper updates.
     */
    eq(other: ReactWidget<P>): boolean {
        return this.id === other.id && this === other;
    }
}
