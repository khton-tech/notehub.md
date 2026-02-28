import { NotehubCore } from '@notehub/core';
import type { FsEvent, DirEntry } from '@notehub/fs-manager';
import type { FileNode } from '../types';
import { normalizePath, getParentPath, joinPath, getFileName } from './pathUtils';

/** Config key for show-hidden setting */
const EXPLORER_CONFIG_KEY_SHOW_HIDDEN = 'explorer.show-hidden';

export class ExplorerController {
    private app: NotehubCore;

    // State
    private nodes: Map<string, FileNode> = new Map();
    private expandedPaths: Set<string> = new Set();
    private rootPath: string | null = null;

    // Active file tracking
    private _activeFilePath: string | null = null;
    private _selectedPath: string | null = null;
    private _renamingPath: string | null = null;

    // Subscribers
    private listeners: Set<() => void> = new Set();
    private eventCleanups: Array<() => void> = [];

    // Concurrency & Watcher control
    private pendingRename: Promise<boolean> | null = null;
    private ignoredPaths: Set<string> = new Set();
    private unwatch: (() => void) | null = null;
    private isDestroyed: boolean = false;

    // Debounce timers map for watcher events (path -> timer)
    private watcherTimers: Map<string, NodeJS.Timeout> = new Map();

    // Data version for react-arborist to force updates when needed
    private _dataVersion: number = 0;

    constructor(app: NotehubCore) {
        this.app = app;
    }

    // ========== Getters ==========

    get activeFilePath(): string | null { return this._activeFilePath; }
    get renamingPath(): string | null { return this._renamingPath; }
    get selectedPath(): string | null { return this._selectedPath; }
    get root(): string | null { return this.rootPath; }

    /** Возвращает Set раскрытых путей для синхронизации с react-arborist */
    getExpandedPaths(): Set<string> { return this.expandedPaths; }

    // ========== Settings ==========

    private showHidden: boolean = false;
    private confirmDelete: boolean = true;
    private singleClickOpen: boolean = true;

    // Getters for settings
    getSettings() {
        return {
            showHidden: this.showHidden,
            confirmDelete: this.confirmDelete,
            singleClickOpen: this.singleClickOpen
        };
    }

    private handleShowHiddenChange(value: unknown): void {
        if (typeof value === 'boolean' && value !== this.showHidden) {
            this.showHidden = value;
            if (this.rootPath) {
                this.reloadAll();
            }
        }
    }

    private async reloadAll(): Promise<void> {
        if (this.isDestroyed || !this.rootPath) return;
        // Reload root first to ensure structure exists
        await this.loadDir(this.rootPath);

        // Reload expanded paths
        const paths = Array.from(this.expandedPaths);
        for (const path of paths) {
            if (path !== this.rootPath) {
                await this.loadDir(path);
            }
        }
    }

    // ========== Lifecycle ==========

    async init() {
        if (this.isDestroyed) return;

        try {
            const showHidden = await this.app.api.invoke<boolean>(
                'config:get',
                EXPLORER_CONFIG_KEY_SHOW_HIDDEN,
                false
            );
            this.showHidden = showHidden ?? false;

            const confirmDelete = await this.app.api.invoke<boolean>(
                'config:get',
                'explorer.confirm-delete',
                true
            );
            this.confirmDelete = confirmDelete ?? true;

            const singleClickOpen = await this.app.api.invoke<boolean>(
                'config:get',
                'explorer.single-click-open',
                true
            );
            this.singleClickOpen = singleClickOpen ?? true;

            // Restore expanded paths
            const expanded = await this.app.api.invoke<string[] | undefined>(
                'config:get',
                'explorer.expanded-paths',
                []
            );
            if (Array.isArray(expanded)) {
                // Filter out paths that don't belong to current root to avoid clutter (optional)
                this.expandedPaths = new Set(expanded);
            }
        } catch {
            this.showHidden = false;
            this.confirmDelete = true;
            this.singleClickOpen = true;
        }

        const configHandler = (payload: any) => {
            const { key, value } = payload as { key: string; value: unknown };
            if (key === EXPLORER_CONFIG_KEY_SHOW_HIDDEN) {
                this.handleShowHiddenChange(value);
            } else if (key === 'explorer.confirm-delete' && typeof value === 'boolean') {
                this.confirmDelete = value;
                this.notify();
            } else if (key === 'explorer.single-click-open' && typeof value === 'boolean') {
                this.singleClickOpen = value;
                this.notify();
            }
        };
        this.app.events.on('config:updated', configHandler);
        this.eventCleanups.push(() => this.app.events.off('config:updated', configHandler));

        const fileOpenedHandler = async (payload: any) => {
            const path = typeof payload === 'string' ? payload : payload?.path;
            if (path && path !== this._activeFilePath) {
                await this.forceSelect(path);
            }
        };

        // Listen to both events to be safe (WikiLinks might use editor:open)
        this.app.events.on('editor:file-opened', fileOpenedHandler);
        this.app.events.on('editor:open', fileOpenedHandler);

        // When the editor closes (e.g. last tab removed), clear active path so
        // that re-clicking the same file in the tree triggers a fresh open.
        const fileClosedHandler = () => {
            this._activeFilePath = null;
            this._selectedPath = null;
            this.notify();
        };
        this.app.events.on('editor:file-closed', fileClosedHandler);

        this.eventCleanups.push(() => {
            this.app.events.off('editor:file-opened', fileOpenedHandler);
            this.app.events.off('editor:open', fileOpenedHandler);
            this.app.events.off('editor:file-closed', fileClosedHandler);
        });

        // Subscribe to fs-manager events so the tree updates on ALL platforms
        // (critical for Capacitor where fs:watch is a no-op, but also useful on desktop
        //  for operations done by plugins other than the explorer itself)
        const fsWrittenHandler = (payload: any) => {
            const { path, isNew } = payload as { path: string; isNew: boolean };
            if (!path || !this.rootPath || !isNew) return; // Only care about new files
            if (this.ignoredPaths.has(path)) return;
            this.reloadForPath(getParentPath(path));
        };

        const fsDirCreatedHandler = (payload: any) => {
            const { path } = payload as { path: string };
            if (!path || !this.rootPath) return;
            if (this.ignoredPaths.has(path)) return;
            this.reloadForPath(getParentPath(path));
        };

        const fsDeletedHandler = (payload: any) => {
            const { path } = payload as { path: string; isDirectory: boolean };
            if (!path || !this.rootPath) return;
            if (this.ignoredPaths.has(path)) return;
            this.reloadForPath(getParentPath(path));
        };

        const fsRenamedHandler = (payload: any) => {
            const { oldPath, newPath } = payload as { oldPath: string; newPath: string };
            if (!oldPath || !newPath || !this.rootPath) return;
            if (this.ignoredPaths.has(oldPath) || this.ignoredPaths.has(newPath)) return;
            this.reloadForPath(getParentPath(oldPath));
            const oldParent = getParentPath(oldPath);
            const newParent = getParentPath(newPath);
            if (normalizePath(newParent) !== normalizePath(oldParent)) {
                this.reloadForPath(newParent);
            }
        };

        this.app.events.on('fs:written', fsWrittenHandler as any);
        this.app.events.on('fs:dir-created', fsDirCreatedHandler as any);
        this.app.events.on('fs:deleted', fsDeletedHandler as any);
        this.app.events.on('fs:renamed', fsRenamedHandler as any);
        this.eventCleanups.push(() => {
            this.app.events.off('fs:written', fsWrittenHandler as any);
            this.app.events.off('fs:dir-created', fsDirCreatedHandler as any);
            this.app.events.off('fs:deleted', fsDeletedHandler as any);
            this.app.events.off('fs:renamed', fsRenamedHandler as any);
        });
    }

    cleanup(): void {
        this.isDestroyed = true;

        for (const cleanup of this.eventCleanups) {
            try { cleanup(); } catch (e) { console.error(e); }
        }
        this.eventCleanups = [];
        this.listeners.clear();

        // Clear debounce timers
        for (const timer of this.watcherTimers.values()) {
            clearTimeout(timer);
        }
        this.watcherTimers.clear();

        if (this.unwatch) {
            this.unwatch();
            this.unwatch = null;
        }
    }

    subscribe(listener: () => void) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    private notify() {
        if (this.isDestroyed) return;
        this._dataVersion++;
        this.listeners.forEach(l => l());
    }

    // ========== Watcher Logic ==========

    async startWatching(path: string) {
        if (this.unwatch) {
            this.unwatch();
            this.unwatch = null;
        }

        try {
            // Note: recursive watching depends on the backend implementation
            this.unwatch = await this.app.api.invoke('fs:watch', path, (event: FsEvent) => {
                this.handleFsEventDebounced(event);
            });
        } catch (err) {
            console.error('Failed to start watcher', err);
        }
    }

    /**
     * Debounces watcher events per directory to avoid flooding (e.g. during git operations)
     */
    private handleFsEventDebounced(event: FsEvent) {
        if (this.isDestroyed) return;

        // 1. Check ignored paths immediately
        if (this.ignoredPaths.has(event.path)) return;
        const parentPath = getParentPath(event.path);
        if (this.ignoredPaths.has(parentPath)) return;

        // 2. Schedule update
        // Use parentPath as key because generally we want to reload the folder containing the change
        const key = parentPath;

        if (this.watcherTimers.has(key)) {
            clearTimeout(this.watcherTimers.get(key));
        }

        const timer = setTimeout(() => {
            this.watcherTimers.delete(key);
            this.handleFsEvent(event.path, parentPath);
        }, 100); // 100ms debounce

        this.watcherTimers.set(key, timer);
    }

    /**
     * Reloads the nearest loaded ancestor directory for the given path.
     * Walks up the tree until it finds a node we know about, then reloads it.
     * Returns true if a reload was triggered.
     */
    private reloadForPath(path: string): boolean {
        if (!this.rootPath) return false;

        const rootNorm = normalizePath(this.rootPath);
        const pathNorm = normalizePath(path);

        // Only handle paths within the vault
        if (!pathNorm.startsWith(rootNorm)) return false;

        let current = path;
        while (true) {
            if (this.nodes.has(current)) {
                const node = this.nodes.get(current);
                if (node?.isDir) {
                    this.loadDir(current);
                    return true;
                }
            }

            // Stop after checking the root itself
            if (normalizePath(current) === rootNorm) break;

            const parent = getParentPath(current);
            if (parent === current) break; // reached filesystem root
            current = parent;
        }

        // Fallback: reload vault root
        if (this.nodes.has(this.rootPath)) {
            this.loadDir(this.rootPath);
            return true;
        }

        return false;
    }

    private handleFsEvent(eventPath: string, parentPath: string) {
        if (this.isDestroyed) return;

        // Try to reload nearest loaded ancestor of the parent directory.
        // If parentPath is outside the vault (e.g. eventPath IS the root), fall back to eventPath.
        if (!this.reloadForPath(parentPath)) {
            this.reloadForPath(eventPath);
        }
    }

    private async withWatcherIgnored(path: string, operation: () => Promise<void>) {
        this.ignoredPaths.add(path);
        try {
            await operation();
        } finally {
            // Keep ignore active briefly to catch trailing OS events
            setTimeout(() => {
                this.ignoredPaths.delete(path);
            }, 600);
        }
    }

    // ========== react-arborist Data Adapter ==========

    getTreeData(): FileNode[] {
        if (!this.rootPath) return [];
        const root = this.nodes.get(this.rootPath);
        // Return a new array reference if children exist to be safe, though not strictly required if mutation is handled well
        if (!root?.children) return [];
        return root.children;
    }

    isExpanded(path: string): boolean {
        return this.expandedPaths.has(path);
    }

    // ========== Internal Logic & Memory Management ==========

    /**
     * Recursively removes a node and all its children from the memory map.
     * Crucial for preventing memory leaks when folders are deleted externally.
     */
    private garbageCollectSubtree(path: string) {
        const node = this.nodes.get(path);
        if (!node) return;

        if (node.children) {
            for (const child of node.children) {
                this.garbageCollectSubtree(child.id);
            }
        }

        this.nodes.delete(path);
        this.expandedPaths.delete(path);
    }

    private moveNodeInternal(oldPath: string, newPath: string): FileNode | null {
        const oldNode = this.nodes.get(oldPath);
        if (!oldNode) return null;

        // 1. Remove old mapping
        this.nodes.delete(oldPath);
        if (this.expandedPaths.has(oldPath)) {
            this.expandedPaths.delete(oldPath);
            this.expandedPaths.add(newPath);
        }

        // 2. Create new node (shallow clone)
        // reuse existing object properties where possible
        const newNode: FileNode = {
            ...oldNode,
            id: newPath,
            name: getFileName(newPath)
        };

        // 3. Handle children recursively
        if (oldNode.children) {
            newNode.children = [];
            for (const child of oldNode.children) {
                const childNewPath = joinPath(newPath, child.name);
                // Recursively move children
                const newChild = this.moveNodeInternal(child.id, childNewPath);
                if (newChild) {
                    newNode.children.push(newChild);
                }
            }
        }

        // 4. Update Map
        this.nodes.set(newPath, newNode);

        // 5. Update State
        if (this._activeFilePath === oldPath) this._activeFilePath = newPath;
        if (this._selectedPath === oldPath) this._selectedPath = newPath;

        return newNode;
    }

    /**
     * Helper to update React state by bubbling changes
     */
    private touch(path: string | null) {
        if (!path || path === this.rootPath) return;

        const parentPath = getParentPath(path);
        const parentNode = this.nodes.get(parentPath);
        const changedNode = this.nodes.get(path);

        if (parentNode && parentNode.children && changedNode) {
            // Replace the child reference in the parent's array
            // This is needed for React to detect the change in the array
            parentNode.children = parentNode.children.map(child =>
                child.id === path ? changedNode : child
            );

            // If parent is not root, propagate up
            if (parentPath !== this.rootPath) {
                this.touch(parentPath);
            }
        }
    }

    private isDescendant(parent: string, child: string): boolean {
        if (parent === child) return true;
        if (child.startsWith(parent + '/')) return true; // POSIX
        if (child.startsWith(parent + '\\')) return true; // Windows
        return false;
    }

    // ========== Operations ==========

    async onMove(args: { dragIds: string[]; parentId: string | null; index: number }): Promise<void> {
        const { dragIds, parentId } = args;
        if (!parentId) return;

        const processed = new Set<string>();

        for (const dragId of dragIds) {
            if (processed.has(dragId)) continue;
            processed.add(dragId);

            const fileName = getFileName(dragId);
            const newPath = joinPath(parentId, fileName);

            // Checks
            if (dragId === newPath) continue;
            if (this.isDescendant(dragId, parentId)) {
                console.warn(`Cannot move "${dragId}" into its own child "${parentId}"`);
                continue;
            }

            const oldParentPath = getParentPath(dragId);
            const oldParentNode = this.nodes.get(oldParentPath);
            const newParentNode = this.nodes.get(parentId);

            // --- OPTIMISTIC UPDATE ---
            // 1. Remove from old parent
            if (oldParentNode && oldParentNode.children) {
                oldParentNode.children = oldParentNode.children.filter(c => c.id !== dragId);
                this.touch(oldParentPath);
            }

            // 2. Move internal logic
            const movedNode = this.moveNodeInternal(dragId, newPath);

            // 3. Add to new parent
            if (newParentNode && movedNode) {
                if (!newParentNode.children) newParentNode.children = [];
                // Check if name collision exists (simple UI fix, FS will fail)
                const exists = newParentNode.children.find(c => c.name === fileName);
                if (!exists) {
                    newParentNode.children.push(movedNode);
                    this.sortChildren(newParentNode.children);
                    this.touch(parentId);
                }
            }

            this.notify();

            // --- FS OPERATION ---
            try {
                // Ignore events for both source and destination
                this.ignoredPaths.add(dragId);
                this.ignoredPaths.add(newPath);

                await this.app.api.invoke('fs:rename' as any, dragId, newPath);
            } catch (error: any) {
                console.error('Failed to move:', error);
                await this.app.api.invoke('dialog:alert', 'Move Failed', error?.message || String(error));

                // Rollback: Force reload both affected directories
                // We don't try to manually undo the optimistic update because it's complex
                if (oldParentPath) await this.loadDir(oldParentPath);
                await this.loadDir(parentId);
            } finally {
                // Cleanup ignores after delay
                setTimeout(() => {
                    this.ignoredPaths.delete(dragId);
                    this.ignoredPaths.delete(newPath);
                }, 1000);
            }
        }
    }

    async onRename(args: { id: string; name: string }): Promise<void> {
        await this.submitRename(args.id, args.name);
    }

    async onCreate(args: { parentId: string | null; type: 'file' | 'folder' }): Promise<void> {
        const parentPath = args.parentId || this.rootPath;
        if (!parentPath) return;

        if (args.type === 'file') {
            await this.createNote(parentPath);
        } else {
            await this.createFolder(parentPath);
        }
    }

    setRenaming(path: string | null): void {
        this._renamingPath = path;
        this.notify();
    }

    async submitRename(oldPath: string, newName: string): Promise<boolean> {
        if (!newName || newName.trim() === '' || newName === getFileName(oldPath)) {
            this._renamingPath = null;
            this.notify();
            return false;
        }

        if (this.pendingRename) {
            await this.pendingRename;
        }

        // Prevent double-submission: if the file is no longer marked for renaming
        // (likely because the previous pending rename finished successfully), abort.
        if (this._renamingPath !== oldPath) {
            return true;
        }

        this.pendingRename = this._doRename(oldPath, newName.trim());
        const result = await this.pendingRename;
        this.pendingRename = null;
        return result;
    }

    private async _doRename(oldPath: string, newName: string): Promise<boolean> {
        const parentPath = getParentPath(oldPath);
        const newPath = joinPath(parentPath, newName);

        // Snapshot state for rollback


        // --- OPTIMISTIC ---
        const node = this.nodes.get(oldPath);
        if (node) {
            node.name = newName;
            // Important: we must update the ID in the map and children recursively
            this.moveNodeInternal(oldPath, newPath);

            const parentNode = this.nodes.get(parentPath);
            if (parentNode && parentNode.children) {
                this.sortChildren(parentNode.children);
                this.touch(parentPath);
            }
            this.notify();
        }

        // --- FS ---
        try {
            await this.withWatcherIgnored(newPath, async () => {
                await this.withWatcherIgnored(oldPath, async () => {
                    await this.app.api.invoke('fs:rename' as any, oldPath, newPath);
                });
            });
            this._renamingPath = null;
            return true;
        } catch (error: any) {
            console.error('Failed to rename:', error);
            await this.app.api.invoke('dialog:alert', 'Rename Failed', error?.message);

            // Revert state by reloading parent (safest way to sync ID maps)
            await this.loadDir(parentPath);

            this._renamingPath = null; // Exit rename mode on error
            this.notify();
            return false;
        }
    }

    cancelRename(): void {
        this._renamingPath = null;
        this.notify();
    }

    async deleteItem(path: string): Promise<boolean> {
        const node = this.nodes.get(path);
        const itemName = node?.name || getFileName(path);
        const isDirectory = node?.isDir;

        if (this.confirmDelete) {
            const confirmed = await this.app.api.invoke<boolean>(
                'dialog:confirm',
                'Confirm Delete',
                `Are you sure you want to delete "${itemName}"?`
            );

            if (!confirmed) return false;
        }

        const parentPath = getParentPath(path);
        const parentNode = this.nodes.get(parentPath);

        // --- OPTIMISTIC ---
        if (parentNode && parentNode.children) {
            parentNode.children = parentNode.children.filter(c => c.id !== path);
            this.touch(parentPath);
        }

        // Remove from memory immediately
        this.garbageCollectSubtree(path);

        if (this._activeFilePath === path) this._activeFilePath = null;
        if (this._selectedPath === path) this._selectedPath = null;

        this.notify();

        // --- FS ---
        try {
            // Suppress both the deleted path AND its parent directory to prevent
            // the OS watcher from triggering a stale reload before deletion completes.
            await this.withWatcherIgnored(parentPath, async () => {
                await this.withWatcherIgnored(path, async () => {
                    if (isDirectory) {
                        await this.app.api.invoke('fs:remove-dir' as any, path, { recursive: true });
                    } else {
                        await this.app.api.invoke('fs:remove-file' as any, path);
                    }
                });
            });
        } catch (error: any) {
            console.error('Failed to delete:', error);
            await this.app.api.invoke('dialog:alert', 'Delete Failed', error?.message);
            // Revert: reload parent to restore item
            if (parentPath) await this.loadDir(parentPath);
            return false;
        }

        return true;
    }

    // ========== Directory Loading ==========

    async setRoot(path: string) {
        // Guard: если уже на том же root, не перезагружаем
        if (this.rootPath === path) {
            return;
        }

        this.rootPath = path;
        this.nodes.clear();
        this.watcherTimers.clear();

        const rootNode: FileNode = {
            id: path,
            name: getFileName(path),
            isDir: true,
            isLoaded: false,
            children: []
        };
        this.nodes.set(path, rootNode);

        // Восстанавливаем expandedPaths из конфига (для персистентности)
        try {
            const savedPaths = await this.app.api.invoke<string[] | undefined>(
                'config:get',
                'explorer.expanded-paths',
                []
            );
            this.expandedPaths = new Set([path]);
            if (Array.isArray(savedPaths)) {
                for (const p of savedPaths) {
                    if (p.startsWith(path)) {
                        this.expandedPaths.add(p);
                    }
                }
            }
        } catch (err) {
            console.error('[Explorer] Failed to load savedPaths:', err);
            this.expandedPaths = new Set([path]);
        }

        // Загружаем root
        await this.loadDir(path);

        // Загружаем expanded директории в порядке от корня к листьям
        const sortedPaths = Array.from(this.expandedPaths)
            .filter(p => p !== path)
            .sort((a, b) => a.length - b.length);

        for (const expandedPath of sortedPaths) {
            const parentPath = getParentPath(expandedPath);
            if (this.nodes.has(parentPath)) {
                await this.loadDir(expandedPath);
            }
        }

        this.startWatching(path);
        this.notify();
    }

    /**
     * Loads directory content, re-using existing nodes to preserve referential integrity.
     * Also garbage collects nodes that no longer exist on disk.
     */
    async loadDir(path: string) {
        if (this.isDestroyed) return;
        const node = this.nodes.get(path);
        if (!node || !node.isDir) return;

        try {
            const entries: DirEntry[] = await this.app.api.invoke('fs:read-dir', path);

            const visibleEntries = this.showHidden
                ? entries
                : entries.filter(e => !e.name.startsWith('.'));

            const foundIds = new Set<string>();
            const newChildren: FileNode[] = [];

            for (const entry of visibleEntries) {
                const childPath = joinPath(path, entry.name);
                foundIds.add(childPath);

                let childNode = this.nodes.get(childPath);

                if (childNode) {
                    // Update existing node properties if changed
                    if (childNode.isDir !== entry.isDirectory) {
                        childNode.isDir = entry.isDirectory;
                    }
                    // Keep existing children/loaded state
                } else {
                    // Create new node
                    childNode = {
                        id: childPath,
                        name: entry.name,
                        isDir: entry.isDirectory,
                        isLoaded: false,
                    };
                    this.nodes.set(childPath, childNode);
                }

                if (entry.isDirectory && !childNode.children) {
                    childNode.children = [];
                }

                newChildren.push(childNode);
            }

            // Garbage Collection: Identify orphaned nodes (in memory but not in FS result)
            if (node.children) {
                for (const oldChild of node.children) {
                    if (!foundIds.has(oldChild.id)) {
                        this.garbageCollectSubtree(oldChild.id);
                    }
                }
            }

            this.sortChildren(newChildren);

            // Assign new children array
            node.children = newChildren;
            node.isLoaded = true;

            this.touch(path);
            this.notify();

        } catch (error) {
            console.error(`Failed to load directory ${path}`, error);
            // Optionally set error state on node
        }
    }

    private sortChildren(children: FileNode[]) {
        children.sort((a, b) => {
            if (a.isDir === b.isDir) return a.name.localeCompare(b.name, undefined, { numeric: true });
            return a.isDir ? -1 : 1;
        });
    }

    async toggleDir(path: string) {
        if (this.expandedPaths.has(path)) {
            this.collapseDir(path);
        } else {
            await this.expandDir(path);
        }
    }

    async expandDir(path: string): Promise<void> {
        const node = this.nodes.get(path);
        if (!node || !node.isDir) return;

        if (!this.expandedPaths.has(path)) {
            this.expandedPaths.add(path);
            this.saveExpandedPaths();
        }

        // Always reload to be fresh when expanding by user action
        await this.loadDir(path);
        this.notify();
    }

    async expandToPath(path: string): Promise<void> {
        let parent = getParentPath(path);
        const root = this.rootPath;
        if (!root) return;

        const pathParts: string[] = [];
        // Walk up to root
        while (parent && parent !== root && parent.length > root.length) {
            pathParts.push(parent);
            parent = getParentPath(parent);
        }
        if (parent === root) pathParts.push(root);

        // Expand downwards and load
        const toExpand = pathParts.reverse();
        for (const p of toExpand) {
            if (!this.expandedPaths.has(p)) {
                this.expandedPaths.add(p);
            }
            // Ensure loaded
            await this.loadDir(p);
        }
        this.saveExpandedPaths();
    }

    collapseDir(path: string): void {
        this.expandedPaths.delete(path);
        this.saveExpandedPaths();
        this.notify();
    }

    private saveTimeout: NodeJS.Timeout | null = null;
    private saveExpandedPaths() {
        if (this.saveTimeout) clearTimeout(this.saveTimeout);
        this.saveTimeout = setTimeout(() => {
            const paths = Array.from(this.expandedPaths);
            this.app.api.invoke('config:set', 'explorer.expanded-paths', paths).catch(console.error);
        }, 1000);
    }

    // ========== Creation ==========

    async findUniqueName(parentPath: string, baseName: string, extension: string = ''): Promise<string> {
        let counter = 0;
        const parentNode = this.nodes.get(parentPath);

        // Simple heuristic: check current memory cache first to avoid FS hammer
        const usedNames = new Set(parentNode?.children?.map(c => c.name) || []);

        while (counter < 1000) {
            let name = counter === 0 ? `${baseName}${extension}` : `${baseName} ${counter}${extension}`;

            if (!usedNames.has(name)) {
                // Double check with FS to be safe
                const fullPath = joinPath(parentPath, name);
                try {
                    const exists = await this.app.api.invoke<boolean>('fs:exists', fullPath);
                    if (!exists) return name;
                } catch {
                    // ignore check errors
                }
            }
            counter++;
        }
        return `${baseName} ${Date.now()}${extension}`;
    }

    async createNote(contextPath?: string) {
        await this.createItem(contextPath, 'file');
    }

    async createFolder(contextPath?: string) {
        await this.createItem(contextPath, 'folder');
    }

    private log(level: 'info' | 'warn' | 'error', message: string): void {
        this.app.api.invoke(`logger:${level}`, 'nh.features.explorer', message);
    }

    private async createItem(contextPath: string | undefined, type: 'file' | 'folder') {
        this.log('info', `Creating ${type}, contextPath: ${contextPath || 'none'}`);

        let parentPath = contextPath || this._selectedPath || this.rootPath;
        if (!parentPath) {
            this.log('warn', 'Cannot create item: no parent path available');
            return;
        }

        // Check if the path is a file, if so use its parent directory
        const node = this.nodes.get(parentPath);
        if (node && !node.isDir) {
            parentPath = getParentPath(parentPath);
            this.log('info', `Context was a file, using parent: ${parentPath}`);
        }

        // If the node is not in cache, check if it's a directory and load it
        let parentNode = this.nodes.get(parentPath!);
        if (!parentNode) {
            this.log('info', `Parent node not in cache, checking if path exists: ${parentPath}`);

            // Check if the path exists and is a directory on disk
            try {
                const exists = await this.app.api.invoke<boolean>('fs:exists', parentPath);
                if (!exists) {
                    this.log('warn', `Parent path does not exist: ${parentPath}`);
                    // Fall back to root
                    parentPath = this.rootPath;
                    parentNode = parentPath ? this.nodes.get(parentPath) : undefined;
                } else {
                    // Path exists on disk but not in cache - use root instead
                    // (the path might be outside our current vault or in an unloaded area)
                    this.log('info', `Parent path exists but not loaded, falling back to root`);
                    parentPath = this.rootPath;
                    parentNode = parentPath ? this.nodes.get(parentPath) : undefined;
                }
            } catch (error) {
                this.log('error', `Failed to check path existence: ${error}`);
                // Fall back to root
                parentPath = this.rootPath;
                parentNode = parentPath ? this.nodes.get(parentPath) : undefined;
            }
        }

        if (!parentNode || !parentPath) {
            this.log('error', 'Cannot create item: parent node not found even after fallback');
            return;
        }

        this.log('info', `Creating ${type} in: ${parentPath}`);

        if (!this.expandedPaths.has(parentPath)) {
            this.expandedPaths.add(parentPath);
        }

        try {
            const baseName = type === 'file' ? 'Untitled Note' : 'New Folder';
            const ext = type === 'file' ? '.md' : '';
            const name = await this.findUniqueName(parentPath!, baseName, ext);
            const fullPath = joinPath(parentPath!, name);

            // --- FS FIRST (Safer for creation) ---
            // We create empty file first, then UI updates via event or manual insertion
            await this.withWatcherIgnored(fullPath, async () => {
                if (type === 'file') {
                    await this.app.api.invoke('fs:write-text-file', fullPath, '');
                } else {
                    await this.app.api.invoke('fs:create-dir', fullPath);
                }
            });

            // --- UPDATE UI MANUALLY ---
            // (Don't wait for watcher for responsiveness)
            const newNode: FileNode = {
                id: fullPath,
                name: name,
                isDir: type === 'folder',
                isLoaded: type === 'folder',
                ...(type === 'folder' ? { children: [] } : {})
            };
            this.nodes.set(fullPath, newNode);

            if (!parentNode.children) parentNode.children = [];
            parentNode.children.push(newNode);
            this.sortChildren(parentNode.children);
            this.touch(parentPath!);

            this._selectedPath = fullPath;
            this.setRenaming(fullPath);
            this.notify();

            // For files, notify app
            if (type === 'file') {
                this.app.events.emit('explorer:file-selected', { path: fullPath });
            }

        } catch (error) {
            console.error('Failed to create item', error);
            await this.app.api.invoke('dialog:alert', 'Error', `Failed: ${error}`);
            if (parentNode) await this.loadDir(parentNode.id);
        }
    }

    getTree(): FileNode | null {
        if (!this.rootPath) return null;
        return this.nodes.get(this.rootPath) || null;
    }

    /**
     * Forces the explorer to sync with an external file opening.
     * Expands the tree to the file, loads necessary data, and selects it.
     */
    async forceSelect(path: string): Promise<void> {
        this._activeFilePath = path;
        this._selectedPath = path;

        // 1. Expand properties first so we don't flash collapsed
        await this.expandToPath(path);

        // 2. Load the directory of the file itself (crucial for visual existence)
        const parent = getParentPath(path);
        if (parent && parent !== this.rootPath) {
            await this.loadDir(parent);
        } else if (this.rootPath) {
            // If file is in root, ensure root is loaded
            await this.loadDir(this.rootPath);
        }

        // 3. Notify UI
        this.notify();
    }

    selectItem(path: string): void {
        this._selectedPath = path;
        const node = this.nodes.get(path);

        if (node && !node.isDir) {
            // Update activeFilePath immediately BEFORE emitting event and notify()
            // This prevents race condition where FileTree sync effect sees old path
            this._activeFilePath = path;
            this.app.events.emit('explorer:file-selected', { path });
        }
        this.notify();
    }
}