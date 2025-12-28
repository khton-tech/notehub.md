/**
 * @fileoverview Smart Button Widget - Proof of Concept Portal Widget
 * 
 * Renders a React button component via the Portal Bridge when the
 * cursor is outside the [[BUTTON::label]] syntax range.
 * 
 * @module @notehub/editor/cm/widgets/SmartButtonWidget
 */

import React from 'react';
import type { ReactNode } from 'react';
import type { WidgetType } from '@codemirror/view';
import { BridgeWidget } from '../../bridge/BridgeWidget';

/**
 * SmartButtonWidget - Renders an interactive React button
 * 
 * This widget extends BridgeWidget to render a React button component
 * when the [[BUTTON::label]] syntax is not being edited.
 */
export class SmartButtonWidget extends BridgeWidget {
    private readonly label: string;

    /**
     * Create a SmartButtonWidget
     * @param label - The button text to display
     */
    constructor(label: string) {
        super();
        this.label = label;
    }

    /**
     * Create the React button component
     */
    protected renderComponent(): ReactNode {
        return (
            <button
                className="nh-smart-button"
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log(`[SmartButton] Clicked: ${this.label}`);
                }}
                style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0.25rem 0.75rem',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    borderRadius: '0.375rem',
                    border: '1px solid var(--nh-border-accent, #6366f1)',
                    backgroundColor: 'var(--nh-accent-primary, #6366f1)',
                    color: 'var(--nh-button-text, #ffffff)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    margin: '0 0.125rem',
                    verticalAlign: 'middle',
                    lineHeight: 1.4
                }}
                onMouseEnter={(e) => {
                    (e.target as HTMLButtonElement).style.opacity = '0.9';
                }}
                onMouseLeave={(e) => {
                    (e.target as HTMLButtonElement).style.opacity = '1';
                }}
            >
                {this.label}
            </button>
        );
    }

    /**
     * CSS class for the widget container
     */
    protected containerClassName(): string {
        return 'nh-bridge-widget nh-smart-button-container';
    }

    /**
     * Compare widgets for equality
     * Two SmartButtonWidgets are equal if they have the same label
     */
    eq(other: WidgetType): boolean {
        return other instanceof SmartButtonWidget && other.label === this.label;
    }
}
