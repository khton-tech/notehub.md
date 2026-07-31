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
import type { CursorProps } from 'react-arborist';
import { ExplorerController } from '../logic/ExplorerController';
import { NodeRow } from './NodeRow';
import type { NodeRowProps } from './NodeRow';
import type { FileNode } from '../types';
import { Menu, MenuItem, MenuSeparator } from '@notehub/ck-standard';
import { Icon } from '@notehub/icon-manager';
import { useNotehub } from '@notehub/core';

// Themed drop-line cursor that uses CSS design tokens instead of the default hardcoded blue
const ThemedCursor = React.memo(function ThemedCursor({ top, left, indent }: CursorProps) {
    return (
        <div style={{
            position: 'absolute',
            pointerEvents: 'none',
            top: top - 2 + 'px',
            left: left + 'px',
            right: indent + 'px',
            display: 'flex',
            alignItems: 'center',
            zIndex: 1,
        }}>
            <div style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                boxShadow: '0 0 0 2px var(--nh-accent-primary)',
                flexShrink: 0,
            }} />
            <div style={{
                flex: 1,
                height: '2px',
                background: 'var(--nh-accent-primary)',
                borderRadius: '1px',
            }} />
        </div>
    );
});

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

    // Drag state — tracked via native dragstart/dragend on the container
    const [draggingId, setDraggingId] = useState<string | null>(null);
    const [isOverRootZone, setIsOverRootZone] = useState(false);

    // Track mouse Y for edge-scroll during drag
    const mouseYRef = useRef(0);
    useEffect(() => {
        const track = (e: DragEvent) => { mouseYRef.current = e.clientY; };
        document.addEventListener('dragover', track);
        return () => document.removeEventListener('dragover', track);
    }, []);

    // Auto-scroll the tree list when dragging near the top/bottom edge
    useEffect(() => {
        if (!draggingId) return;
        let rafId: number;
        const ZONE = 60;   // px from edge that triggers scroll
        const MAX_SPEED = 10; // px per frame at the edge

        const scroll = () => {
            const el = treeRef.current?.listEl?.current;
            if (el) {
                const rect = el.getBoundingClientRect();
                const y = mouseYRef.current;
                if (y < rect.top + ZONE) {
                    const t = 1 - (y - rect.top) / ZONE;
                    el.scrollBy(0, -MAX_SPEED * Math.max(0, Math.min(1, t)));
                } else if (y > rect.bottom - ZONE) {
                    const t = 1 - (rect.bottom - y) / ZONE;
                    el.scrollBy(0, MAX_SPEED * Math.max(0, Math.min(1, t)));
                }
            }
            rafId = requestAnimationFrame(scroll);
        };
        rafId = requestAnimationFrame(scroll);
        return () => cancelAnimationFrame(rafId);
    }, [draggingId]);

    // BUG-04 fix: read singleClickOpen once from the controller (which already loaded
    // it from config) and update it via controller subscription, instead of having
    // every NodeRow instance make its own config:get call and keep its own listener.
    const [singleClickOpen, setSingleClickOpen] = useState(
        () => controller.getSettings().singleClickOpen
    );

    // react-arborist uses the HTML5 DnD backend which doesn't fire on touch devices.
    // Disable drag on touch so there's no broken grab-but-nothing-moves experience.
    const isTouchDevice = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);

    // selectedId: active file if one is open, otherwise the last selected folder/file.
    // This ensures the tree always has something highlighted when there is a context.
    const selectedId = controller.activeFilePath ?? controller.selectedPath;

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

    // Handle node toggle (expand/collapse directories).
    // IMPORTANT: sync to what react-arborist actually did, not to our own state.
    // Using controller.isExpanded() was wrong: when react-arborist programmatically
    // opens a folder (e.g. tree.open() after a DnD drop), onToggle fires with the
    // folder already OPEN — but if our state also said "open", we'd call collapseDir,
    // making the folder close right after a successful drop. Using treeRef.isOpen()
    // reads the tree's real current state and syncs ours to match it.
    const handleToggle = useCallback((id: string) => {
        // react-arborist fires onToggle with its internal ROOT_ID sentinel when
        // tree.open(null) is called (root-level drop). Ignore it — the root is
        // always open and has no corresponding node in our controller.
        if (id === '__REACT_ARBORIST_INTERNAL_ROOT__') return;

        const nowOpen = treeRef.current?.isOpen(id) ?? false;
        if (nowOpen) {
            controller.expandDir(id);
        } else {
            controller.collapseDir(id);
        }
    }, [controller]);

    // Helper: force react-arborist to restore the current selection.
    // react-arborist dispatches selection.clear() on background clicks, which wipes
    // its internal Redux state. Because our `selection` prop hasn't changed, the tree
    // won't re-apply it on its own. We must call treeRef.select() explicitly.
    //
    // IMPORTANT: tree.select(id) always calls onSelect(this.selectedNodes) synchronously.
    // If the target node lives inside a collapsed folder, tree.get(id) returns null
    // (node is not in the visible list), so selectedNodes=[] → handleSelect([]) fires →
    // restoreSelection() again → infinite recursion / stack overflow.
    // Guard: only call select() when the node is currently rendered (get(id) !== null).
    // The `selection` prop + tree.update() covers non-visible nodes on next re-render.
    const restoreSelection = useCallback(() => {
        const current = controller.activeFilePath ?? controller.selectedPath;
        if (!current || !treeRef.current) return;
        if (treeRef.current.get(current) !== null) {
            treeRef.current.select(current);
        }
    }, [controller]);

    // Handle node select
    const handleSelect = useCallback((nodes: any[]) => {
        if (nodes.length > 0) {
            controller.selectItem(nodes[0].id);
        } else {
            // Background click cleared react-arborist's internal selection state.
            // Immediately restore it — we never allow an empty selection when there
            // is a file or folder to highlight.
            restoreSelection();
        }
    }, [controller, restoreSelection]);

    // Handle rename
    const handleRename = useCallback(({ id, name }: { id: string; name: string }) => {
        controller.onRename({ id, name });
    }, [controller]);

    // Tracks whether react-arborist already called onMove for the current drag.
    // Used by the container's native onDrop to avoid double-moving when the drop
    // lands on a tree row (react-arborist handles it) vs empty space (we handle it).
    const moveHandledRef = useRef(false);

    // Handle move (drag & drop)
    const handleMove = useCallback((args: {
        dragIds: string[];
        parentId: string | null;
        index: number;
    }) => {
        moveHandledRef.current = true;
        controller.onMove(args);
    }, [controller]);

    // BUG-04 fix: single memoized renderer that closes over singleClickOpen.
    // Also closes over drag callbacks to track drag state without per-row subscriptions.
    const RowRenderer = useMemo(
        () => (props: NodeRowProps) => (
            <NodeRow
                {...props}
                singleClickOpen={singleClickOpen}
                onDragStart={setDraggingId}
                onDragEnd={() => setDraggingId(null)}
            />
        ),
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
                {/* Header / Toolbar — doubles as root drop zone when dragging */}
                <div
                    className={[
                        'flex items-center justify-between px-3 py-2 border-b border-[var(--nh-border-subtle)] bg-[var(--nh-bg-secondary)]',
                        'transition-colors duration-150',
                        draggingId
                            ? isOverRootZone
                                ? 'bg-[var(--nh-accent-secondary)] border-[var(--nh-accent-primary)]'
                                : 'border-dashed border-[var(--nh-accent-primary)] opacity-80'
                            : '',
                    ].join(' ')}
                    onContextMenu={handleRootContextMenu}
                    onDragOver={draggingId ? (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setIsOverRootZone(true); } : undefined}
                    onDragLeave={draggingId ? () => setIsOverRootZone(false) : undefined}
                    onDrop={draggingId ? (e) => {
                        e.preventDefault();
                        setIsOverRootZone(false);
                        const id = draggingId;
                        setDraggingId(null);
                        if (id) controller.onMove({ dragIds: [id], parentId: null, index: 0 });
                    } : undefined}
                >
                    <span
                        className="text-xs font-semibold truncate select-none transition-colors duration-150"
                        title={rootName}
                        style={{ color: draggingId && isOverRootZone ? 'var(--nh-accent-primary)' : 'var(--nh-text-muted)' }}
                    >
                        {draggingId
                            ? (isOverRootZone ? 'Move to root' : rootName || 'Explorer')
                            : (rootName || 'Explorer')
                        }
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

                {/* DnD blocked by search — warn the user */}
                {draggingId && searchTerm && (
                    <div className="px-3 py-1 text-[11px] text-[var(--nh-text-muted)] bg-[var(--nh-bg-hover)] border-b border-[var(--nh-border-subtle)] flex items-center gap-1.5">
                        <Icon name="alert-triangle" size={11} className="text-[var(--nh-accent-warning,var(--nh-text-muted))] flex-shrink-0" />
                        Clear search to enable drag
                    </div>
                )}

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
                    onClick={(e) => {
                        setShowNewMenu(false);
                        // If the click landed in empty space (not on a tree row),
                        // restore the selection as a belt-and-suspenders guard.
                        // This catches cases where react-arborist clears its internal
                        // state without going through onSelect([]).
                        if (!(e.target as HTMLElement).closest('[role="treeitem"]')) {
                            restoreSelection();
                        }
                    }}
                    onContextMenu={handleRootContextMenu}
                    onKeyDown={handleKeyDown}
                    tabIndex={0}
                    // Native DnD on the container so that drops landing in any empty
                    // area (between rows, below last item, or in ungrown space) move
                    // the dragged item to the vault root.
                    //
                    // Event ordering:
                    //   1. capture phase: react-dnd's handleTopDropCapture
                    //   2. bubble phase: this onDrop handler — queues a microtask
                    //   3. bubble phase: react-dnd's window-level handleTopDrop
                    //      → calls handleMove → moveHandledRef = true
                    //   4. microtask runs — checks the flag
                    //
                    // So by the time the microtask fires, react-arborist has either
                    // set the flag (it handled the drop) or not (we handle it).
                    onDragOver={draggingId ? (e) => e.preventDefault() : undefined}
                    onDrop={draggingId ? (e) => {
                        e.preventDefault();
                        const id = draggingId;
                        setDraggingId(null);
                        setIsOverRootZone(false);
                        queueMicrotask(() => {
                            if (!moveHandledRef.current && id) {
                                controller.onMove({ dragIds: [id], parentId: null, index: 0 });
                            }
                            moveHandledRef.current = false;
                        });
                    } : undefined}
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
                            rowHeight={26}
                            indent={14}
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
                            renderCursor={ThemedCursor}
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
