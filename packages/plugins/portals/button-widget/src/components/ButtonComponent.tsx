import React from 'react';
import { Button } from '@notehub/ck-standard';
import { useNotehub } from '@notehub/core';

/**
 * Props for the ButtonComponent
 */
export interface ButtonComponentProps {
    /** Text to display on the button */
    text: string;
    /** Optional alert message to show on click */
    alertText?: string;
}

/**
 * ButtonComponent - Renders an interactive button using ck-standard
 * 
 * This component is rendered inside CodeMirror via the Portal Bridge.
 * It uses theme variables for consistent styling.
 */
export const ButtonComponent: React.FC<ButtonComponentProps> = ({ text, alertText }) => {
    const app = useNotehub();

    const handleClick = () => {
        if (alertText) {
            // Show alert dialog using dialog-manager
            // API signature: dialog:alert(title: string, message: string)
            app.api.invoke('dialog:alert', text, alertText);
        } else {
            // Simple console log
            console.log(`[ButtonWidget] Button clicked: "${text}"`);
        }
    };

    return (
        <Button
            onClick={handleClick}
            variant="secondary"
            size="sm"
        >
            {text}
        </Button>
    );
};
