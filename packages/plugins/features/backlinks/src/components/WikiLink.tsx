import React from 'react';
import type { EditorView } from '@codemirror/view';
import { useNotehub } from '@notehub/core';
import { PathResolver } from '../logic/PathResolver';

interface WikiLinkProps {
    match: RegExpExecArray;
    view?: EditorView;
}

export const WikiLink: React.FC<WikiLinkProps> = ({ match }) => {
    // 1. Get API via hook (Architecture Constraint)
    const app = useNotehub();
    const [exists, setExists] = React.useState<boolean | null>(null);

    // match[1] is target, match[2] is alias
    const targetPath = match?.[1] || '';
    const alias = match?.[2];
    const displayText = alias || targetPath;

    // Check existence on mount for "Ghost Link" styling
    React.useEffect(() => {
        let isMounted = true;
        const checkExistence = async () => {
            if (!app) return;
            try {
                const resolver = new PathResolver(app);
                const resolvedPath = await resolver.resolveLink(targetPath);
                const fileExists = await app.api.invoke<boolean>('fs:exists', resolvedPath);
                if (isMounted) setExists(fileExists);
            } catch (err) {
                console.warn('[WikiLink] Existence check failed:', err);
            }
        };
        checkExistence();
        return () => { isMounted = false; };
    }, [app, targetPath]);

    const handleClick = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (!app) {
            console.warn('[WikiLink] App context missing, cannot resolve link');
            return;
        }

        const resolver = new PathResolver(app);

        try {
            const resolvedPath = await resolver.resolveLink(targetPath);

            // Check if exists using API (re-check on click to be safe)
            const exists = await app.api.invoke<boolean>('fs:exists', resolvedPath);

            if (exists) {
                // Open existing file
                await app.api.invoke('editor:open', resolvedPath);
            } else {
                // Auto-create logic
                const fileName = resolvedPath.split(/[\\/]/).pop() || targetPath;
                const title = fileName.replace(/\.md$/i, '');

                // Ensure parent directory exists
                const parentDir = resolvedPath.substring(0, resolvedPath.lastIndexOf(fileName));
                if (parentDir) {
                    // Clean up trailing slash if present
                    const cleanParentDir = parentDir.replace(/[\\/]$/, '');
                    await app.api.invoke('fs:create-dir', cleanParentDir, { recursive: true });
                }

                await app.api.invoke('fs:write-text-file', resolvedPath, `# ${title}\n\n`);
                await app.api.invoke('editor:open', resolvedPath);

                // Update local state to reflect creation
                setExists(true);
            }
        } catch (err) {
            console.error('[WikiLink] Failed to handle link click:', err);
        }
    };

    return (
        <span
            className={`text-[var(--nh-accent-primary)] underline decoration-dotted hover:decoration-solid cursor-pointer ${exists === false ? 'opacity-50' : ''}`}
            onClick={handleClick}
            title={exists === false ? `${targetPath} (creates new file)` : targetPath}
        >
            {displayText}
        </span>
    );
};
