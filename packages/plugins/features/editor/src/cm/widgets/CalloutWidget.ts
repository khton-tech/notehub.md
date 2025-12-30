/**
 * @fileoverview CalloutWidget - CodeMirror widget for callout headers
 * 
 * Bridges CodeMirror decoration system with React CalloutHeader component
 * using the Portal Bridge pattern.
 * 
 * @module @notehub/editor/cm/widgets/CalloutWidget
 */

import { ReactBridgeWidget, portalStore } from '../../bridge';
import { CalloutHeader, type CalloutHeaderProps } from '../../components/widgets/CalloutHeader';

/**
 * CalloutWidget - Renders a callout header inside CodeMirror
 * 
 * Extends ReactBridgeWidget to render the CalloutHeader React component
 * via the Portal Bridge. Used with Decoration.replace to replace
 * the callout header source text.
 * 
 * @example
 * ```ts
 * const widget = new CalloutWidget('info', 'Important Note');
 * Decoration.replace({ widget, block: true });
 * ```
 */
export class CalloutWidget extends ReactBridgeWidget<CalloutHeaderProps> {
    /**
     * Creates a new CalloutWidget
     * 
     * @param type - Callout type (info, warning, danger, etc.)
     * @param title - Callout title text
     */
    constructor(type: string, title: string) {
        super(CalloutHeader, { type, title });
    }

    /**
     * Equality check for widget reuse optimization
     * 
     * CodeMirror calls this to determine if it can reuse an existing
     * widget DOM. We compare type and title for accurate reuse.
     */
    override eq(other: CalloutWidget): boolean {
        return (
            other instanceof CalloutWidget &&
            this.props.type === other.props.type &&
            this.props.title === other.props.title
        );
    }

    /**
     * Override toDOM to use block-level container for callout headers
     */
    override toDOM(): HTMLElement {
        const container = document.createElement('div');
        container.className = 'cm-react-widget cm-callout-header-widget';

        // Mount the React component via the portal store
        portalStore.mount(this.id, container, this.component, this.props);

        return container;
    }
}
