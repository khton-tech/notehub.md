import React, { useEffect, useState, useCallback, useRef } from 'react';
import { ExplorerController } from '../logic/ExplorerController';
import { FileTreeItem } from './FileTreeItem';
import type { FileNode } from '../types';

interface FileTreeProps {
    controller: ExplorerController;
    defaultPath?: string;
}

import { Button, Card } from '@notehub/ck-standard';
import { Icon } from '@notehub/icon-manager';

/**
 * Flatten the tree to get an array of visible nodes for keyboard navigation
 */
function flattenTree(node: FileNode | null): FileNode[] {
    if (!node) return [];

    const result: FileNode[] = [];

    const traverse = (n: FileNode) => {
        result.push(n);
        if (n.kind === 'directory' && n.isExpanded && n.children) {
            for (const child of n.children) {
                traverse(child);
            }
        }
    };

    // Start from children of root (don't include root itself)
    if (node.children) {
        for (const child of node.children) {
            traverse(child);
        }
    }

    return result;
}

export const FileTree: React.FC<FileTreeProps> = ({ controller, defaultPath }) => {
    const [rootNode, setRootNode] = useState<FileNode | null>(controller.getTree());
    const [selectedPath, setSelectedPath] = useState<string | null>(null);
    const [focusedIndex, setFocusedIndex] = useState<number>(-1);
    const [showNewMenu, setShowNewMenu] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (defaultPath) {
            controller.setRoot(defaultPath);
        }

        const unsubscribe = controller.subscribe(() => {
            setRootNode(prev => {
                if (!prev && !controller.getTree()) return null;
                const newVal = controller.getTree();
                return newVal ? { ...newVal } : null;
            });
        });

        return () => {
            unsubscribe();
        };
    }, [controller, defaultPath]);

    const flatNodes = flattenTree(rootNode);

    const handleToggle = useCallback((path: string) => {
        controller.toggleDir(path);
    }, [controller]);

    const handleSelect = useCallback((path: string) => {
        setSelectedPath(path);
        // Update focused index to match selected
        const idx = flatNodes.findIndex(n => n.path === path);
        if (idx !== -1) setFocusedIndex(idx);
        // Emit via EventBus (through controller)
        controller.selectFile(path);
    }, [flatNodes, controller]);

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

    // Keyboard navigation handler
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (flatNodes.length === 0) return;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setFocusedIndex(prev => Math.min(prev + 1, flatNodes.length - 1));
                break;
            case 'ArrowUp':
                e.preventDefault();
                setFocusedIndex(prev => Math.max(prev - 1, 0));
                break;
            case 'Enter':
            case ' ': {
                e.preventDefault();
                const focusedNode = flatNodes[focusedIndex];
                if (focusedNode) {
                    if (focusedNode.kind === 'directory') {
                        handleToggle(focusedNode.path);
                    } else {
                        handleSelect(focusedNode.path);
                    }
                }
                break;
            }
            case 'ArrowRight': {
                e.preventDefault();
                const focusedNode = flatNodes[focusedIndex];
                if (focusedNode && focusedNode.kind === 'directory' && !focusedNode.isExpanded) {
                    handleToggle(focusedNode.path);
                }
                break;
            }
            case 'ArrowLeft': {
                e.preventDefault();
                const focusedNode = flatNodes[focusedIndex];
                if (focusedNode && focusedNode.kind === 'directory' && focusedNode.isExpanded) {
                    handleToggle(focusedNode.path);
                }
                break;
            }
            case 'Home':
                e.preventDefault();
                setFocusedIndex(0);
                break;
            case 'End':
                e.preventDefault();
                setFocusedIndex(flatNodes.length - 1);
                break;
        }
    }, [flatNodes, focusedIndex, handleToggle, handleSelect]);

    // Get focused path
    const focusedPath = focusedIndex >= 0 && focusedIndex < flatNodes.length
        ? flatNodes[focusedIndex]?.path
        : null;

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

            {/* Tree Content with keyboard navigation */}
            <div
                ref={containerRef}
                className="flex-1 overflow-y-auto overflow-x-hidden py-1 outline-none"
                onClick={() => setShowNewMenu(false)}
                onKeyDown={handleKeyDown}
                tabIndex={0}
                role="tree"
                aria-label="File explorer"
            >
                {rootNode.children && rootNode.children.map(child => (
                    <FileTreeItem
                        key={child.path}
                        node={child}
                        depth={0}
                        onToggle={handleToggle}
                        onSelect={handleSelect}
                        selectedPath={selectedPath}
                        focusedPath={focusedPath}
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

