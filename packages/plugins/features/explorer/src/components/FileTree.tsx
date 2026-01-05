/**
 * FileTree - react-arborist based file tree component
 * 
 * Features:
 * - Virtualized rendering for performance
 * - Drag-and-drop support (via react-dnd)
 * - Keyboard navigation (built-in)
 * - Search/filter
 * - Active file sync with editor
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Tree, TreeApi } from 'react-arborist';
import { ExplorerController } from '../logic/ExplorerController';
import { NodeRow } from './NodeRow';
import type { FileNode } from '../types';
import { Menu, MenuItem, MenuSeparator } from '@notehub/ck-standard';
import { Icon } from '@notehub/icon-manager';
import { useNotehub } from '@notehub/core';

interface FileTreeProps {
    controller: ExplorerController;
}

import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';

export const FileTree: React.FC<FileTreeProps> = ({ controller }) => {
    const app = useNotehub();
    const treeRef = useRef<TreeApi<FileNode>>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    const [data, setData] = useState<FileNode[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [showNewMenu, setShowNewMenu] = useState(false);
    const [containerHeight, setContainerHeight] = useState(400);
    const [rootName, setRootName] = useState<string>('');
    const [renamingId, setRenamingId] = useState<string | null>(null);

    // Subscribe to controller changes
    useEffect(() => {
        const refresh = () => {
            // Force new array reference specifically to ensure react-arborist updates
            const treeData = controller.getTreeData();
            console.log('FileTree: Refreshing data', treeData.length, 'nodes');
            setData([...treeData]);

            const tree = controller.getTree();
            setRootName(tree?.name || '');

            // Sync renaming state
            if (controller.renamingPath !== renamingId) {
                setRenamingId(controller.renamingPath);
            }
        };
        refresh();
        const unsubscribe = controller.subscribe(refresh);
        return () => { unsubscribe(); };
    }, [controller, renamingId]);

    // Sync renaming state to Arborist
    useEffect(() => {
        if (renamingId && treeRef.current) {
            console.log('FileTree: Starting rename for', renamingId);
            treeRef.current.edit(renamingId);
        }
    }, [renamingId]);

    // Measure container height for virtualization
    useEffect(() => {
        // ... existing height logic ...
        const updateHeight = () => {
            if (containerRef.current) {
                setContainerHeight(containerRef.current.clientHeight);
            }
        };
        updateHeight();
        const observer = new ResizeObserver(updateHeight);
        if (containerRef.current) observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    // Sync active file with tree selection
    useEffect(() => {
        if (controller.activeFilePath && treeRef.current) {
            // Focus and select the active file
            console.log('FileTree: Syncing active file', controller.activeFilePath);

            // 1. Expand ancestors visually
            let parent = controller.activeFilePath;
            while (parent && parent.length > (controller.root?.length || 0)) {
                parent = parent.substring(0, Math.max(parent.lastIndexOf('/'), parent.lastIndexOf('\\')));
                if (parent && parent.length >= (controller.root?.length || 0)) {
                    treeRef.current.open(parent);
                }
            }

            // 2. Select and Scroll
            const node = treeRef.current.get(controller.activeFilePath);
            if (node) {
                if (!node.isSelected) {
                    treeRef.current.select(controller.activeFilePath);
                }
                treeRef.current.scrollTo(controller.activeFilePath);
            }
        }
    }, [controller.activeFilePath, data]); // Add data dependency to retry if node wasn't loaded yet

    // ... (click away handler) ...
    // Click-away and Escape handler for popup menu
    useEffect(() => {
        if (!showNewMenu) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setShowNewMenu(false);
            }
        };
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setShowNewMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleEscape);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [showNewMenu]);

    // Handle node toggle (expand/collapse directories)
    const handleToggle = useCallback((id: string) => {
        console.log('FileTree: Toggle', id);
        if (controller.isExpanded(id)) {
            controller.collapseDir(id);
        } else {
            controller.expandDir(id);
        }
    }, [controller]);

    // Handle node select
    const handleSelect = useCallback((nodes: any[]) => {
        if (nodes.length > 0) {
            const node = nodes[0];
            console.log('FileTree: Selected', node.id);
            controller.selectItem(node.id);
        }
    }, [controller]);

    // Handle rename
    const handleRename = useCallback(({ id, name }: { id: string; name: string }) => {
        console.log('FileTree: Rename submitted', id, '->', name);
        controller.onRename({ id, name });
    }, [controller]);

    // Handle move (drag & drop)
    const handleMove = useCallback((args: {
        dragIds: string[];
        parentId: string | null;
        index: number;
    }) => {
        console.log('FileTree: Move', args);
        controller.onMove(args);
    }, [controller]);

    // Create handlers
    const handleCreateNote = () => {
        console.log('FileTree: Create Note Triggered');
        controller.createNote();
        setShowNewMenu(false);
    };

    const handleCreateFolder = () => {
        console.log('FileTree: Create Folder Triggered');
        controller.createFolder();
        setShowNewMenu(false);
    };


    // Handle keyboard shortcuts (Enter, F2, Delete)
    const handleKeyDown = (e: React.KeyboardEvent) => {
        // Enter - Open file or toggle folder
        if (e.key === 'Enter') {
            const selected = controller.selectedPath;
            if (selected) {
                e.preventDefault();
                const tree = controller.getTree();
                const findNode = (nodes: FileNode[] | undefined, path: string): FileNode | null => {
                    if (!nodes) return null;
                    for (const node of nodes) {
                        if (node.id === path) return node;
                        if (node.children) {
                            const found = findNode(node.children, path);
                            if (found) return found;
                        }
                    }
                    return null;
                };
                const node = findNode(tree?.children, selected);
                if (node) {
                    if (node.isDir) {
                        controller.toggleDir(selected);
                    } else {
                        app.events.emit('explorer:file-selected', { path: selected });
                    }
                }
            }
        }

        // F2 - Rename
        if (e.key === 'F2') {
            const selected = controller.selectedPath;
            console.log('FileTree: F2 pressed, selected:', selected);
            if (selected) {
                e.preventDefault();
                controller.setRenaming(selected);
            }
        }

        // Delete - Delete Item
        if (e.key === 'Delete') {
            const selected = controller.selectedPath;
            console.log('FileTree: Delete pressed, selected:', selected);
            if (selected) {
                e.preventDefault();
                controller.deleteItem(selected);
            }
        }
    };

    // Root context menu
    const handleRootContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        const rootPath = controller.root;
        if (rootPath) {
            app.api.invoke(
                'context-menu:trigger' as any,
                e.nativeEvent,
                'explorer-root',
                { path: rootPath }
            );
        }
    };

    // Determine if we should show empty state
    const isEmpty = data.length === 0;

    return (
        <DndProvider backend={HTML5Backend}>
            <style>{`
                /* Remove browser default outline on all tree elements */
                .react-arborist-tree * {
                    outline: none !important;
                }
            `}</style>
            <div className="w-full h-full flex flex-col select-none bg-[var(--nh-bg-secondary)]">
                {/* Header / Toolbar */}
                <div
                    className="flex items-center justify-between px-3 py-2 border-b border-[var(--nh-border-subtle)] bg-[var(--nh-bg-secondary)]"
                    onContextMenu={handleRootContextMenu}
                >
                    <span
                        className="text-xs font-bold uppercase tracking-wider text-[var(--nh-text-muted)] truncate select-none"
                        title={rootName}
                    >
                        {rootName || 'EXPLORER'}
                    </span>

                    <div className="relative flex items-center gap-1">
                        {/* New button */}
                        <button
                            className="p-1 rounded hover:bg-[var(--nh-bg-hover)] text-[var(--nh-text-secondary)] transition-colors"
                            onClick={() => setShowNewMenu(!showNewMenu)}
                            title="Create New..."
                        >
                            <Icon name="plus" size={16} />
                        </button>

                        {/* Popup Menu */}
                        {showNewMenu && (
                            <div ref={menuRef} className="absolute right-0 top-full mt-1 z-50">
                                <Menu className="w-40 bg-[var(--nh-bg-surface)] border border-[var(--nh-border-subtle)] shadow-lg rounded">
                                    <MenuItem onClick={handleCreateNote} icon={<Icon name="file" size={14} />}>
                                        New Note
                                    </MenuItem>

                                    <MenuSeparator className="bg-[var(--nh-border-subtle)]" />

                                    <MenuItem onClick={handleCreateFolder} icon={<Icon name="folder" size={14} />}>
                                        New Folder
                                    </MenuItem>
                                </Menu>
                            </div>
                        )}
                    </div>
                </div>

                {/* Search/Filter Input */}
                <div className="px-2 py-1.5 border-b border-[var(--nh-border-subtle)]">
                    <div className="relative">
                        <Icon
                            name="search"
                            size={14}
                            className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--nh-text-muted)]"
                        />
                        <input
                            type="text"
                            placeholder="Filter files..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="
                                w-full pl-7 pr-2 py-1 text-xs
                                bg-[var(--nh-bg-main)] 
                                border border-[var(--nh-border-subtle)]
                                rounded outline-none
                                text-[var(--nh-text-primary)]
                                placeholder:text-[var(--nh-text-muted)]
                                focus:border-[var(--nh-accent-primary)]
                                transition-colors
                            "
                        />
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm('')}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--nh-text-muted)] hover:text-[var(--nh-text-primary)]"
                            >
                                <Icon name="x" size={12} />
                            </button>
                        )}
                    </div>
                </div>

                {/* Tree Content */}
                <div
                    ref={containerRef}
                    className="react-arborist-tree flex-1 overflow-hidden outline-none"
                    onClick={() => setShowNewMenu(false)}
                    onContextMenu={handleRootContextMenu}
                    onKeyDown={handleKeyDown}
                    tabIndex={0}
                >
                    {isEmpty ? (
                        <div className="px-4 py-8 text-center text-xs text-[var(--nh-text-muted)] italic">
                            Empty vault
                        </div>
                    ) : (
                        <Tree
                            ref={treeRef}
                            data={data}
                            openByDefault={false}
                            width="100%"
                            height={containerHeight}
                            rowHeight={24}
                            indent={16}
                            searchTerm={searchTerm}
                            searchMatch={(node, term) => {
                                const lowerTerm = term.toLowerCase();
                                return node.data.name.toLowerCase().includes(lowerTerm) ||
                                    node.data.id.toLowerCase().includes(lowerTerm);
                            }}
                            onMove={handleMove}
                            onRename={handleRename}
                            onSelect={handleSelect}
                            onToggle={(id) => handleToggle(id)}
                            disableDrag={false}
                            disableDrop={false}
                            disableEdit={true}
                            className="outline-none"
                        >
                            {NodeRow}
                        </Tree>
                    )}
                </div>
            </div>
        </DndProvider>
    );
};

export default FileTree;
