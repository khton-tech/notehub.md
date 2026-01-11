import React from 'react';

/**
 * Definition for a Portal (formerly Dynamic Widget).
 * Portals are regex-matched components that are rendered inline within the editor.
 */
export interface PortalSpec {
    /**
     * Unique identifier for the portal (e.g., 'ext.progress-bar')
     */
    id: string;

    /**
     * The regex pattern to match in the document text.
     * Matches will be replaced/decorated with the component.
     * Example: /\[([*|]+)\]/g
     */
    regex: RegExp;

    /**
     * The React component to render for the match.
     * Receives the regex match array as props.
     */
    component: React.FC<{ match: RegExpExecArray }>;

    /**
     * Optional friendly name for debugging purposes.
     */
    name?: string;
}
