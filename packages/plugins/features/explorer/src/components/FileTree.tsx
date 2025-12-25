import React, { useEffect, useState } from 'react';
import { ExplorerController } from '../logic/ExplorerController';
import { FileTreeItem } from './FileTreeItem';
import type { FileNode } from '../types';

interface FileTreeProps {
    controller: ExplorerController;
    defaultPath?: string;
}

import { Button, Card } from '@notehub/ck-standard';
import { Icon } from '@notehub/icon-manager';

export const FileTree: React.FC<FileTreeProps> = ({ controller, defaultPath }) => {
    // Determine how to sync state. 
    // ExplorerController does not implement a specific store interface but has `subscribe`.
    // We can use useSyncExternalStore or a simple useEffect/useState wrapper.
    const [rootNode, setRootNode] = useState<FileNode | null>(controller.getTree());
    const [selectedPath, setSelectedPath] = useState<string | null>(null);
    const [showNewMenu, setShowNewMenu] = useState(false);

    useEffect(() => {
        // Initial load if needed
        if (defaultPath) {
            controller.setRoot(defaultPath);
        }

        const unsubscribe = controller.subscribe(() => {
            setRootNode(prev => {
                // Return new obj if needed
                if (!prev && !controller.getTree()) return null;
                const newVal = controller.getTree();
                return newVal ? { ...newVal } : null;
            });
        });

        return () => {
            unsubscribe();
        };
    }, [controller, defaultPath]);

    const handleToggle = (path: string) => {
        controller.toggleDir(path);
    };

    const handleSelect = (path: string) => {
        setSelectedPath(path);
        // Despatch global event
        const event = new CustomEvent('explorer:file-selected', { detail: { path } });
        window.dispatchEvent(event);
    };

    const handleCreateNote = () => {
        if (rootNode) {
            controller.createNote(rootNode.path);
            setShowNewMenu(false);
        }
    };

    const handleCreateFolder = () => {
        if (rootNode) {
            controller.createFolder(rootNode.path);
            setShowNewMenu(false);
        }
    };

    if (!rootNode) {
        return <div className="p-4 text-[var(--nh-text-muted)] text-sm">No folder opened</div>;
    }

    return (
        <div className="w-full h-full flex flex-col select-none">
            {/* Header / Toolbar */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--nh-border-color)] bg-[var(--nh-bg-secondary)]">
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--nh-text-muted)] truncate select-none" title={rootNode.name}>
                    {rootNode.name}
                </span>

                <div className="relative">
                    <button
                        className="p-1 rounded hover:bg-[var(--nh-bg-hover)] text-[var(--nh-text-secondary)] transition-colors"
                        onClick={() => setShowNewMenu(!showNewMenu)}
                        title="Create New..."
                    >
                        <Icon name="plus" size={16} />
                    </button>

                    {/* Popup Menu */}
                    {showNewMenu && (
                        <div className="absolute right-0 top-full mt-1 z-50">
                            <Card className="w-48 p-1 flex flex-col gap-0.5 shadow-xl border-[var(--nh-border-color)]">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="justify-start px-2 h-8 text-xs font-normal w-full whitespace-nowrap"
                                    onClick={handleCreateNote}
                                >
                                    <Icon name="file" size={16} className="mr-3 text-[var(--nh-text-secondary)]" />
                                    New Note
                                </Button>

                                <div className="h-px bg-[var(--nh-border-color)] mx-1 my-0.5" />

                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="justify-start px-2 h-8 text-xs font-normal w-full whitespace-nowrap"
                                    onClick={handleCreateFolder}
                                >
                                    <Icon name="folder" size={16} className="mr-3 text-[var(--nh-text-secondary)]" />
                                    New Folder
                                </Button>
                            </Card>
                        </div>
                    )}
                </div>
            </div>

            {/* Tree Content */}
            <div
                className="flex-1 overflow-y-auto overflow-x-hidden py-1"
                onClick={() => setShowNewMenu(false)} // Close menu on click outside
            >
                {rootNode.children && rootNode.children.map(child => (
                    <FileTreeItem
                        key={child.path}
                        node={child}
                        depth={0}
                        onToggle={handleToggle}
                        onSelect={handleSelect}
                        selectedPath={selectedPath}
                    />
                ))}

                {(!rootNode.children || rootNode.children.length === 0) && (
                    <div className="px-4 py-8 text-center text-xs text-[var(--nh-text-muted)] italic">
                        Empty vault
                    </div>
                )}
            </div>
        </div>
    );
};
