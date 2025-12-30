/**
 * @fileoverview CalloutWidget - Bridge widget for callout headers
 * 
 * Concrete implementation of ReactBridgeWidget that renders
 * CalloutHeader React component in CodeMirror decorations.
 * 
 * @module @notehub/editor/cm/widgets/CalloutWidget
 * @author Notehub Team
 */

import { ReactBridgeWidget } from '../../bridge/widget';
import { CalloutHeader, type CalloutHeaderProps } from '../../components/CalloutHeader';

/**
 * CalloutHeaderWidget - Widget for rendering callout headers
 * 
 * This widget creates a visual representation of a callout header
 * using the CalloutHeader React component via the Portal Bridge.
 * 
 * @example
 * ```ts
 * const widget = new CalloutHeaderWidget('INFO', 'Important Note');
 * Decoration.replace({ widget });
 * ```
 */
export class CalloutHeaderWidget extends ReactBridgeWidget<CalloutHeaderProps> {
    /** Callout type for equality comparison */
    private readonly type: string;

    /** Callout title for equality comparison */
    private readonly title: string;

    /**
     * Creates a new CalloutHeaderWidget.
     * 
     * @param type - Callout type (e.g., "INFO", "WARNING")
     * @param title - Optional title text
     */
    constructor(type: string, title: string = '') {
        super(CalloutHeader, { type, title });
        this.type = type;
        this.title = title;
    }

    /**
     * Compare widgets for equality.
     * Two widgets are equal if they have the same type and title.
     * 
     * @param other - Widget to compare against
     * @returns true if widgets are equal
     */
    eq(other: CalloutHeaderWidget): boolean {
        return (
            other instanceof CalloutHeaderWidget &&
            this.type === other.type &&
            this.title === other.title
        );
    }

    /**
     * Estimate the break cost for line wrapping.
     * Higher values make the widget less likely to break.
     */
    get estimatedHeight(): number {
        return 30; // Approximate height in pixels
    }
}
