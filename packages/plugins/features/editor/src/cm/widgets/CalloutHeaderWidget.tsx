/**
 * Callout Header Widget for CodeMirror 6
 * 
 * A WidgetType that renders a callout header via Portal Bridge.
 * Uses icon-manager for consistent icon display.
 * 
 * @module widgets/CalloutHeaderWidget
 */

import { WidgetType, EditorView } from '@codemirror/view';
import { bridgeService, generateWidgetId } from '../react-bridge';
import React from 'react';
import { Icon } from '@notehub/icon-manager';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Props passed to CalloutHeader component via bridge
 */
interface CalloutHeaderProps {
    type: string;
    title: string;
}

// =============================================================================
// REACT COMPONENT
// =============================================================================

/**
 * CalloutHeader React Component
 * Renders the callout header with icon from icon-manager
 */
const CalloutHeaderComponent: React.FC<CalloutHeaderProps> = ({ type, title }) => {
    // Map callout types to icon names from icon-manager
    const iconMap: Record<string, string> = {
        'note': 'info',
        'info': 'info',
        'warning': 'alert-triangle',
        'caution': 'alert-triangle',
        'danger': 'alert-circle',
        'error': 'alert-circle',
        'success': 'check-circle',
        'check': 'check-circle',
        'tip': 'lightbulb',
        'important': 'lightbulb',
        'quote': 'quote',
        'abstract': 'file-text',
        'summary': 'file-text',
        'tldr': 'file-text'
    };

    const iconName = iconMap[type.toLowerCase()] || 'info';

    return (
        <div className= "cm-callout-header" >
        <div className="cm-callout-icon" >
            <Icon name={ iconName } size = { 18} />
                </div>
                < span > { title } </span>
                </div>
    );
};

// =============================================================================
// WIDGET CLASS
// =============================================================================

/**
 * CalloutHeaderWidget - A CodeMirror WidgetType for callout headers
 * 
 * Uses the Portal Bridge to render a React component with icon-manager icons.
 */
export class CalloutHeaderWidget extends WidgetType {
    private widgetId: string;

    constructor(
        readonly type: string,
        readonly title: string
    ) {
        super();
        this.widgetId = generateWidgetId();
    }

    /**
     * Determine widget equality for efficient updates
     */
    eq(other: CalloutHeaderWidget): boolean {
        return this.type === other.type && this.title === other.title;
    }

    /**
     * Create the DOM element and mount the React component
     */
    toDOM(_view: EditorView): HTMLElement {
        const container = document.createElement('div');
        container.style.display = 'block';

        // Mount the React component via bridge
        const props: CalloutHeaderProps = {
            type: this.type,
            title: this.title
        };

        bridgeService.mount(
            this.widgetId,
            container,
            CalloutHeaderComponent,
            props
        );

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

export default CalloutHeaderWidget;
