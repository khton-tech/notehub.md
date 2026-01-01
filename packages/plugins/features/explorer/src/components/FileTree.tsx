import React, { useEffect, useState, useCallback, useRef } from 'react';
import { ExplorerController } from '../logic/ExplorerController';
import { FileTreeItem } from './FileTreeItem';
import type { FileNode } from '../types';
import { Menu, MenuItem, MenuSeparator } from '@notehub/ck-standard';
import { Icon } from '@notehub/icon-manager';
import { useNotehub } from '@notehub/core';


interface FileTreeProps {
    controller: ExplorerController;
    defaultPath?: string;
}

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
    const app = useNotehub();
    const [rootNode, setRootNode] = useState<FileNode | null>(controller.getTree());
    const [selectedPath, setSelectedPath] = useState<string | null>(null);
    const [focusedIndex, setFocusedIndex] = useState<number>(-1);
    const [activeFilePath, setActiveFilePath] = useState<string | null>(controller.activeFilePath);
    const [renamingPath, setRenamingPath] = useState<string | null>(controller.renamingPath);
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
            setActiveFilePath(controller.activeFilePath);
            setRenamingPath(controller.renamingPath);
            setSelectedPath(controller.selectedPath);
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
        // Update focused index to match selected
        const idx = flatNodes.findIndex(n => n.path === path);
        if (idx !== -1) setFocusedIndex(idx);
        // Delegate selection logic to controller
        controller.selectItem(path);
    }, [flatNodes, controller]);

    const handleRenameSubmit = useCallback((oldPath: string, newName: string) => {
        controller.submitRename(oldPath, newName);
    }, [controller]);

    const handleRenameCancel = useCallback(() => {
        controller.cancelRename();
    }, [controller]);

    const handleCreateNote = () => {
        if (rootNode) {
            controller.createNote();
            setShowNewMenu(false);
        }
    };

    const handleCreateFolder = () => {
        if (rootNode) {
            controller.createFolder();
            setShowNewMenu(false);
        }
    };

    const handleRootContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        if (rootNode) {
            app.api.invoke(
                'context-menu:trigger' as any,
                e.nativeEvent,
                'explorer-root',
                { path: rootNode.path }
            );
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
                        // Enter on directory toggles expanded state AND selects it
                        handleSelect(focusedNode.path);
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
            case 'F2': {
                // Start rename on F2
                e.preventDefault();
                const focusedNode = flatNodes[focusedIndex];
                if (focusedNode) {
                    controller.setRenaming(focusedNode.path);
                }
                break;
            }
            case 'Delete': {
                // Delete on Delete key
                e.preventDefault();
                const focusedNode = flatNodes[focusedIndex];
                if (focusedNode) {
                    controller.deleteItem(focusedNode.path);
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
    }, [flatNodes, focusedIndex, handleToggle, handleSelect, controller]);

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
            <div
                className="flex items-center justify-between px-3 py-2 border-b border-[var(--nh-border-subtle,#333333)] bg-[var(--nh-bg-secondary,#2a2a2a)]"
                onContextMenu={handleRootContextMenu}
            >
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--nh-text-muted)] truncate select-none" title={rootNode.name}>
                    {rootNode.name}
                </span>

                <div className="relative">
                    <button
                        className="p-1 rounded hover:bg-[var(--nh-bg-hover,#3a3a3a)] text-[var(--nh-text-secondary,#a0a0a0)] transition-colors"
                        onClick={() => setShowNewMenu(!showNewMenu)}
                        title="Create New..."
                    >
                        <Icon name="plus" size={16} />
                    </button>

                    {/* Popup Menu */}
                    {showNewMenu && (
                        <div className="absolute right-0 top-full mt-1 z-50">
                            <Menu className="w-40 bg-[var(--nh-bg-surface,#2a2a2a)] border-[var(--nh-border-subtle,#333333)]">
                                <MenuItem onClick={handleCreateNote} icon={<Icon name="file" size={14} />}>
                                    New Note
                                </MenuItem>

                                <MenuSeparator className="bg-[var(--nh-border-subtle,#333333)]" />

                                <MenuItem onClick={handleCreateFolder} icon={<Icon name="folder" size={14} />}>
                                    New Folder
                                </MenuItem>
                            </Menu>
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
                onContextMenu={handleRootContextMenu}
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
                        activeFilePath={activeFilePath}
                        renamingPath={renamingPath}
                        onRenameSubmit={handleRenameSubmit}
                        onRenameCancel={handleRenameCancel}
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
