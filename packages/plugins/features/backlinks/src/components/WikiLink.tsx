/**
 * @fileoverview WikiLink Component
 * 
 * Interactive component that renders [[WikiLinks]] in the editor.
 * Displays the alias (if provided) or the target path.
 * Clicking navigates to the linked file.
 */

import type { FC, MouseEvent } from 'react';
import { resolvePath } from '../logic/PathResolver';

// Global Core reference will be set by the plugin on load
let globalCore: {
    api: { invoke: (method: string, ...args: unknown[]) => Promise<unknown> };
    events: { emit: (event: string, payload: unknown) => void };
} | null = null;

// Cached vault root path
let vaultRoot: string | null = null;

/**
 * Set the Core reference for WikiLink components to use
 * @internal Called by plugin on load
 */
export function setWikiLinkCore(core: typeof globalCore): void {
    globalCore = core;
}

/**
 * Set the vault root path for resolving wiki links
 * @internal Called by plugin when vault opens
 */
export function setVaultRoot(path: string | null): void {
    vaultRoot = path;
}

interface WikiLinkProps {
    /** Regex match result: match[1] = target path, match[2] = alias */
    match: RegExpMatchArray;
}

/**
 * WikiLink - Interactive wikilink component
 * 
 * Renders `[[Path]]` or `[[Path|Alias]]` as a clickable link.
 * Uses theme CSS variables for consistent styling.
 */
export const WikiLink: FC<WikiLinkProps> = ({ match }) => {
    const targetPath = match[1] || '';
    const alias = match[2];

    // Display alias if provided, otherwise show target path
    const displayText = alias || targetPath;

    // Resolve the relative path (adds .md if needed)
    const resolvedRelativePath = resolvePath('', targetPath);

    /**
     * Handle link click - navigate to the target file
     * CRITICAL: Must prevent default and stop propagation
     * to avoid cursor jumping into widget range (Live Preview reveal)
     */
    const handleClick = (e: MouseEvent<HTMLSpanElement>): void => {
        e.preventDefault();
        e.stopPropagation();

        if (!globalCore || !vaultRoot) {
            console.warn('[WikiLink] Core or vault root not set');
            return;
        }

        // Build full path: vaultRoot + resolvedRelativePath
        const fullPath = `${vaultRoot}/${resolvedRelativePath}`;

        // Use the same event that explorer uses to open files
        globalCore.events.emit('explorer:file-selected', { path: fullPath });
    };

    return (
        <span
            onClick={handleClick}
            onMouseDown={(e) => {
                // CRITICAL: Prevent CodeMirror from trying to calculate
                // cursor position inside the widget (causes "Invalid child in posBefore" error)
                e.preventDefault();
                e.stopPropagation();
            }}
            style={{
                color: 'var(--nh-accent-primary)',
                cursor: 'pointer',
                textDecoration: 'none',
                transition: 'color 0.15s ease, text-decoration 0.15s ease',
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.textDecoration = 'underline';
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.textDecoration = 'none';
            }}
        >
            {displayText}
        </span>
    );
};

export default WikiLink;
