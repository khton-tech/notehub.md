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

    // match[1] is target, match[2] is alias
    const targetPath = match?.[1] || '';
    const alias = match?.[2];
    const displayText = alias || targetPath;

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

            // Check if exists using API
            const exists = await app.api.invoke<boolean>('fs:exists', resolvedPath);

            if (exists) {
                // Open existing file
                await app.api.invoke('editor:open', resolvedPath);
            } else {
                // Auto-create logic
                const fileName = resolvedPath.split('/').pop() || targetPath;
                const title = fileName.replace(/\.md$/i, '');

                await app.api.invoke('fs:write-text-file', resolvedPath, `# ${title}\n\n`);
                await app.api.invoke('editor:open', resolvedPath);
            }
        } catch (err) {
            console.error('[WikiLink] Failed to handle link click:', err);
        }
    };

    return (
        <span
            className="text-[var(--nh-accent-primary)] underline decoration-dotted hover:decoration-solid cursor-pointer"
            onClick={handleClick}
            title={targetPath}
        >
            {displayText}
        </span>
    );
};
