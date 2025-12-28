import type React from 'react';
import { ReactWidget } from '@notehub/editor';
import { ButtonComponent, type ButtonComponentProps } from '../components/ButtonComponent';

/**
 * ButtonWidget - CodeMirror widget that renders a button via Portal Bridge
 * 
 * This widget extends ReactWidget to automatically handle the portal lifecycle.
 * It only needs to specify which React component to render.
 */
export class ButtonWidget extends ReactWidget<ButtonComponentProps> {
    /**
     * @param text - The text to display on the button
     * @param alertText - Optional alert message to show on click
     */
    constructor(text: string, alertText?: string) {
        super({ text, alertText });
    }

    /**
     * Specify the React component to render
     */
    protected getComponent(): React.FC<ButtonComponentProps> {
        return ButtonComponent;
    }

    /**
     * Widgets are inline elements
     */
    get estimatedHeight(): number {
        return -1; // Inline widget
    }
}
