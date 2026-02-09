<<<<<<< HEAD

import React from 'react';
import { NotificationManager } from './NotificationContainer';

export interface AlertButtonProps {
    // Portal props usually include 'match' if regex was used
=======
import React from 'react';
import { Bell } from 'lucide-react';
import { NotificationManager } from './NotificationContainer';

interface AlertButtonProps {
    // Portal props might include regex match, etc.
>>>>>>> dc6398e62aa418be5d2acd52a5ef4e9881962f58
    match: RegExpExecArray | null;
}

export const AlertButton: React.FC<AlertButtonProps> = ({ match }) => {
<<<<<<< HEAD
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
=======
    // Extract text from match group 1 (if available), default to "Alert"
    // Regex will be /\[\[alert:(.*?)\]\]/ or just /\[\[alert\]\]/
    // If it's the old syntax, match[1] might be undefined or we might need to handle both.
    // Let's assume the regex in index.tsx will be updated to `\[\[alert(?::(.*?))?\]\]` to support both?
    // Or just `\[\[alert:(.*?)\]\]` as requested. 
    // The user asked for `[[alert:text]]`.

    const text = match && match[1] ? match[1] : 'Alert';
    const linkText = text; // Text to show in notification
    const buttonLabel = text.length > 15 ? text.substring(0, 12) + '...' : text;

    const handleClick = () => {
        NotificationManager.show(linkText, 'info');
    };

    return (
        <button
            onClick={handleClick}
            title={`Show alert: ${linkText}`}
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 8px',
                borderRadius: '4px',
                border: '1px solid var(--nh-border-accent, #6b5ce7)',
                background: 'rgba(107, 92, 231, 0.1)',
                color: 'var(--nh-accent-primary, #6b5ce7)',
                fontSize: '12px',
                fontFamily: 'var(--nh-font-family, system-ui)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                verticalAlign: 'middle',
                margin: '0 4px',
                userSelect: 'none'
            }}
            onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(107, 92, 231, 0.2)';
            }}
            onMouseLeave={e => {
                e.currentTarget.style.background = 'rgba(107, 92, 231, 0.1)';
            }}
        >
            <Bell size={14} />
            <span>{buttonLabel}</span>
>>>>>>> dc6398e62aa418be5d2acd52a5ef4e9881962f58
        </button>
    );
};
