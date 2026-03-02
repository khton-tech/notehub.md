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

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { Tree, TreeApi } from 'react-arborist';
import { ExplorerController } from '../logic/ExplorerController';
import { NodeRow } from './NodeRow';
import type { NodeRowProps } from './NodeRow';
import type { FileNode } from '../types';
import { Menu, MenuItem, MenuSeparator } from '@notehub/ck-standard';
import { Icon } from '@notehub/icon-manager';
import { useNotehub } from '@notehub/core';

interface FileTreeProps {
    controller: ExplorerController;
}

export const FileTree: React.FC<FileTreeProps> = ({ controller }) => {
    const app = useNotehub();
    const treeRef = useRef<TreeApi<FileNode>>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    const [data, setData] = useState<FileNode[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [showSearch, setShowSearch] = useState(false);
    const [showNewMenu, setShowNewMenu] = useState(false);
    const [containerHeight, setContainerHeight] = useState(400);
    const [rootName, setRootName] = useState<string>('');
    const [renamingId, setRenamingId] = useState<string | null>(null);
    const [renamingVersion, setRenamingVersion] = useState(0);

    // BUG-04 fix: read singleClickOpen once from the controller (which already loaded
    // it from config) and update it via controller subscription, instead of having
    // every NodeRow instance make its own config:get call and keep its own listener.
    const [singleClickOpen, setSingleClickOpen] = useState(
        () => controller.getSettings().singleClickOpen
    );

    // react-arborist uses the HTML5 DnD backend which doesn't fire on touch devices.
    // Disable drag on touch so there's no broken grab-but-nothing-moves experience.
    const isTouchDevice = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);

    // ⚡ selectedId напрямую привязан к activeFilePath — единый источник правды
    const selectedId = controller.activeFilePath;

    // Subscribe to controller changes
    useEffect(() => {
        const refresh = () => {
            // Force new array reference specifically to ensure react-arborist updates
            const treeData = controller.getTreeData();
            setData([...treeData]);

            const tree = controller.getTree();
            if (tree?.name) {
                try {
                    // Try to decode URI if it looks like one
                    const decoded = decodeURIComponent(tree.name);
                    // Get last segment, handling potential trailing slashes
                    const name = decoded.split('/').filter(Boolean).pop() || decoded;
                    setRootName(name);
                } catch {
                    setRootName(tree?.name || '');
                }
            } else {
                setRootName('');
            }

            // Sync renaming state using version counter to detect repeated renames of same path
            if (controller.renamingVersion !== renamingVersion) {
                setRenamingVersion(controller.renamingVersion);
                setRenamingId(controller.renamingPath);
            }

            // BUG-04 fix: sync singleClickOpen from controller settings on every
            // controller notification (covers the case where config:updated fires).
            setSingleClickOpen(controller.getSettings().singleClickOpen);

            // selectedId теперь вычисляемое значение из activeFilePath, не state
        };
        refresh();
        const unsubscribe = controller.subscribe(refresh);
        return () => { unsubscribe(); };
    }, [controller, renamingVersion]);

    // Sync renaming state to Arborist
    useEffect(() => {
        if (renamingId && treeRef.current) {
            treeRef.current.edit(renamingId);
        }
    }, [renamingId, renamingVersion]);

    // ... (existing code)

    // Measure container height for virtualization
    useEffect(() => {
        let animationFrameId: number;
        const updateHeight = () => {
            if (containerRef.current) {
                const newHeight = containerRef.current.clientHeight;

                // IGNORE 0 HEIGHT (prevents initial layout thrashing)
                if (newHeight === 0) return;

                setContainerHeight(prev => prev !== newHeight ? newHeight : prev);
            }
        };

        const observer = new ResizeObserver(() => {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = requestAnimationFrame(updateHeight);
        });

        if (containerRef.current) observer.observe(containerRef.current);

        // Initial measurement
        updateHeight();

        return () => {
            observer.disconnect();
            cancelAnimationFrame(animationFrameId);
        };
    }, []);

    // Ref для отслеживания предыдущего activeFilePath (избегаем кражи фокуса при ре-рендерах)
    const prevActiveFileRef = useRef<string | null>(null);

    // Sync expanded folders with react-arborist
    // Это нужно потому что controller.expandToPath() добавляет пути в expandedPaths,
    // но react-arborist имеет своё внутреннее состояние
    useEffect(() => {
        if (!treeRef.current) return;

        const expandedPaths = controller.getExpandedPaths();
        for (const path of expandedPaths) {
            // treeRef.open() работает только если node существует в data
            if (treeRef.current.get(path)) {
                treeRef.current.open(path);
            }
        }
    }, [data]); // Зависимость от data — пытаемся расширить после каждого обновления

    // Sync active file with tree selection — ЖЁСТКАЯ ПРИВЯЗКА
    useEffect(() => {
        const activeFile = controller.activeFilePath;
        const prevActiveFile = prevActiveFileRef.current;

        if (!activeFile || !treeRef.current) return;

        const node = treeRef.current.get(activeFile);
        const fileChanged = activeFile !== prevActiveFile;

        // Обновляем ref только при реальном изменении
        if (fileChanged) {
            prevActiveFileRef.current = activeFile;
        }

        // Если node существует и файл изменился — немедленно sync
        if (node && fileChanged) {
            treeRef.current.select(activeFile);
            treeRef.current.scrollTo(activeFile);
            return;
        }

        // Если node появился в data (после загрузки папок), но prevActiveFile ещё null
        // (первая загрузка после перезапуска) или node только что появился — sync
        if (node && !prevActiveFile) {
            prevActiveFileRef.current = activeFile;
            treeRef.current.select(activeFile);
            treeRef.current.scrollTo(activeFile);
        }
    }, [controller.activeFilePath, data]);

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
            controller.selectItem(node.id);
        } else {
            // Selection cleared (e.g. background click). 
            // We IGNORE this to maintain "Concrete Focus".
            // Since we use the `selection` prop, react-arborist will revert to the prop value on next render.
        }
    }, [controller]);

    // Handle rename
    const handleRename = useCallback(({ id, name }: { id: string; name: string }) => {
        controller.onRename({ id, name });
    }, [controller]);

    // Handle move (drag & drop)
    const handleMove = useCallback((args: {
        dragIds: string[];
        parentId: string | null;
        index: number;
    }) => {
        controller.onMove(args);
    }, [controller]);

    // BUG-04 fix: single memoized renderer that closes over singleClickOpen.
    // react-arborist re-renders rows (not remounts) when the component reference
    // changes, so this is safe and far cheaper than 200 individual subscriptions.
    const RowRenderer = useMemo(
        () => (props: NodeRowProps) => <NodeRow {...props} singleClickOpen={singleClickOpen} />,
        [singleClickOpen]
    );

    // Create handlers
    const handleCreateNote = () => {
        controller.createNote();
        setShowNewMenu(false);
    };

    const handleCreateFolder = () => {
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
            if (selected) {
                e.preventDefault();
                controller.setRenaming(selected);
            }
        }

        // Delete - Delete Item
        if (e.key === 'Delete') {
            const selected = controller.selectedPath;
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
        <>
            <style>{`
                /* Only suppress mouse-click focus outlines, keep keyboard focus visible */
                .react-arborist-tree *:focus:not(:focus-visible) {
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
                        className="text-xs font-semibold text-[var(--nh-text-muted)] truncate select-none"
                        title={rootName}
                    >
                        {rootName || 'Explorer'}
                    </span>

                    <div className="relative flex items-center gap-1">
                        {/* Search toggle */}
                        <button
                            className={`p-1 rounded transition-colors ${showSearch ? 'text-[var(--nh-accent-primary)] bg-[var(--nh-accent-secondary)]' : 'text-[var(--nh-text-secondary)] hover:bg-[var(--nh-bg-hover)]'}`}
                            onClick={() => {
                                setShowSearch(s => !s);
                                if (showSearch) setSearchTerm('');
                            }}
                            title="Search files"
                        >
                            <Icon name="search" size={15} />
                        </button>

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

                {/* Search/Filter Input — visible only when toggled */}
                {showSearch && (
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
                                autoFocus
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
                )}

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
                        <div className="flex flex-col items-center justify-center gap-3 px-4 py-10 text-center">
                            <Icon name="file" size={32} className="text-[var(--nh-text-muted)] opacity-40" />
                            <span className="text-xs text-[var(--nh-text-muted)]">Vault is empty</span>
                            <button
                                onClick={handleCreateNote}
                                className="text-xs text-[var(--nh-accent-primary)] hover:underline"
                            >
                                + Create first note
                            </button>
                        </div>
                    ) : (
                        <Tree
                            ref={treeRef}
                            data={data}
                            openByDefault={false}
                            width="100%"
                            height={containerHeight}
                            rowHeight={28}
                            indent={16}
                            searchTerm={searchTerm}
                            selection={selectedId || ''}
                            searchMatch={(node, term) => {
                                const lowerTerm = term.toLowerCase();
                                return node.data.name.toLowerCase().includes(lowerTerm) ||
                                    node.data.id.toLowerCase().includes(lowerTerm);
                            }}
                            onMove={handleMove}
                            onRename={handleRename}
                            onSelect={handleSelect}
                            onToggle={(id) => handleToggle(id)}
                            disableDrag={isTouchDevice}
                            disableDrop={isTouchDevice}
                            disableEdit={false}
                            className="outline-none"
                        >
                            {RowRenderer}
                        </Tree>
                    )}
                </div>
            </div>
        </>
    );
};

export default FileTree;
