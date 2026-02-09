
import React from 'react';
import { NotificationManager } from './NotificationContainer';

export interface AlertButtonProps {
    // Portal props usually include 'match' if regex was used
    match: RegExpExecArray | null;
}

export const AlertButton: React.FC<AlertButtonProps> = ({ match }) => {
    // Extract message from regex match group 1, or default
    const message = match && match[1] ? match[1] : 'Hello from Plugin!';

    return (
        <button
            onClick={() => NotificationManager.show(message, 'success')}
            className="nh-button nh-button-primary"
            style={{
                margin: '0 4px',
                padding: '2px 8px',
                fontSize: '0.9em',
                borderRadius: '4px',
                verticalAlign: 'middle'
            }}
        >
            🔔 {message}
        </button>
    );
};
