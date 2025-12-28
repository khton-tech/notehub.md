import React from 'react';
import { Icon } from '@notehub/icon-manager';

interface EditorHeaderProps {
    /** Current file path */
    filePath: string | null;
    /** Whether file has unsaved changes */
    isDirty: boolean;
}

/**
 * EditorHeader - Displays current file name and status
 */
export const EditorHeader: React.FC<EditorHeaderProps> = ({ filePath, isDirty }) => {
    // Extract filename from path
    const fileName = filePath ? filePath.split(/[/\\]/).pop() || 'Untitled' : 'No file open';

    // Extract directory path
    const dirPath = filePath ? filePath.split(/[/\\]/).slice(0, -1).join('/') : null;

    return (
        <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--nh-border-color)] bg-[var(--nh-bg-secondary)]">
            <div className="flex items-center gap-2 min-w-0 flex-1">
                <Icon
                    name="file"
                    size={14}
                    className="text-[var(--nh-text-muted)] flex-shrink-0"
                />
                <div className="flex flex-col min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium text-[var(--nh-text-primary)] truncate">
                            {fileName}
                        </span>
                        {isDirty && (
                            <span
                                className="w-1.5 h-1.5 rounded-full bg-[var(--nh-accent-primary)] flex-shrink-0"
                                title="Unsaved changes"
                            />
                        )}
                    </div>
                    {dirPath && (
                        <span className="text-xs text-[var(--nh-text-muted)] truncate">
                            {dirPath}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};
