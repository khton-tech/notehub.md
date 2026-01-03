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

    // Active file tracking (sync with editor)
    private _activeFilePath: string | null = null;

    // Selected item tracking
    private _selectedPath: string | null = null;

    // Renaming state
    private _renamingPath: string | null = null;

    // Subscribers
    private listeners: Set<() => void> = new Set();

    // Event cleanup functions
    private eventCleanups: Array<() => void> = [];

    // Rename operation queue to prevent race conditions
    private pendingRename: Promise<boolean> | null = null;

    // Data version for react-arborist re-render triggering
    private _dataVersion: number = 0;

    constructor(app: NotehubCore) {
        this.app = app;

        // Subscribe to config changes
        this.app.events.on('config:updated', (payload) => {
            const { key, value } = payload as { key: string; value: unknown };
            if (key === EXPLORER_CONFIG_KEY_SHOW_HIDDEN) {
                this.handleShowHiddenChange(value);
            }
        });
    }

    // ========== Getters ==========

    /** Get currently active file path (synced with editor) */
    get activeFilePath(): string | null {
        return this._activeFilePath;
    }

    /** Get path of item currently being renamed */
    get renamingPath(): string | null {
        return this._renamingPath;
    }

    /** Get currently selected path */
    get selectedPath(): string | null {
        return this._selectedPath;
    }

    /** Get root path */
    get root(): string | null {
        return this.rootPath;
    }

    // ========== Settings ==========

    /** Whether to show hidden files (starting with .) */
    private showHidden: boolean = false;

    /**
     * Handle show-hidden setting change
     */
    private handleShowHiddenChange(value: unknown): void {
        if (typeof value === 'boolean' && value !== this.showHidden) {
            this.showHidden = value;
            if (this.rootPath) {
                this.reloadAll();
            }
        }
    }

    /**
     * Reload all expanded directories
     */
    private async reloadAll(): Promise<void> {
        for (const path of this.expandedPaths) {
            await this.loadDir(path);
        }
    }

    /**
     * Initialize controller
     */
    async init() {
        // Load show-hidden setting from config
        try {
            const showHidden = await this.app.api.invoke<boolean>(
                'config:get',
                EXPLORER_CONFIG_KEY_SHOW_HIDDEN,
                false
            );
            this.showHidden = showHidden ?? false;
        } catch {
            this.showHidden = false;
        }

        // Subscribe to editor file opened events for active file sync
        const fileOpenedHandler = (payload: any) => {
            const path = typeof payload === 'string' ? payload : payload?.path;
            if (path && path !== this._activeFilePath) {
                this._activeFilePath = path;
                // Also select the file in the tree
                this._selectedPath = path;
                this.notify();
            }
        };
        this.app.events.on('editor:file-opened', fileOpenedHandler);
        this.eventCleanups.push(() => this.app.events.off('editor:file-opened', fileOpenedHandler));
    }

    /**
     * Cleanup event subscriptions
     */
    cleanup(): void {
        for (const cleanup of this.eventCleanups) {
            try {
                cleanup();
            } catch (e) {
                console.error('ExplorerController cleanup error:', e);
            }
        }
        this.eventCleanups = [];
    }

    subscribe(listener: () => void) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    private notify() {
        this._dataVersion++;
        this.listeners.forEach(l => l());
    }

    // ========== react-arborist Data Adapter ==========

    /**
     * Get tree data for react-arborist
     * Returns array of root-level FileNodes with nested children
     * Always returns a fresh array to trigger re-render
     */
    getTreeData(): FileNode[] {
        if (!this.rootPath) return [];
        const root = this.nodes.get(this.rootPath);
        if (!root?.children) return [];
        // Return fresh reference to trigger react-arborist re-render
        return [...root.children];
    }

    /**
     * Check if a path is expanded
     */
    isExpanded(path: string): boolean {
        return this.expandedPaths.has(path);
    }

    /**
     * Handle drag-and-drop move operation
     */
    async onMove(args: {
        dragIds: string[];
        parentId: string | null;
        index: number
    }): Promise<void> {
        console.log('ExplorerController: onMove', args);
        const { dragIds, parentId } = args;
        if (!parentId) return;

        // Process moves
        for (const dragId of dragIds) {
            console.log('ExplorerController: Moving', dragId, 'to', parentId);
            const fileName = getFileName(dragId);
            const newPath = joinPath(parentId, fileName);

            // Skip if no change (dropped on same parent) - though react-arborist handles this
            if (dragId === newPath) continue;

            const oldParentPath = getParentPath(dragId);
            const oldParentNode = this.nodes.get(oldParentPath);
            const newParentNode = this.nodes.get(parentId);
            const movedNode = this.nodes.get(dragId);

            // --- OPTIMISTIC UI UPDATE ---
            if (movedNode) {
                // 1. Remove from old parent
                if (oldParentNode && oldParentNode.children) {
                    oldParentNode.children = oldParentNode.children.filter(c => c.id !== dragId);
                }

                // 2. Update path (and recursively update children paths if directory)
                this.updateNodePath(dragId, newPath);

                // 3. Add to new parent
                if (newParentNode) {
                    if (!newParentNode.children) newParentNode.children = [];
                    // Check if exists
                    const exists = newParentNode.children.find(c => c.name === fileName);
                    if (!exists) {
                        newParentNode.children.push(movedNode);
                        this.sortChildren(newParentNode.children);
                    }
                }

                this.notify();
            }

            // Yield to let UI update before blocking on FS op
            await new Promise(resolve => setTimeout(resolve, 0));

            try {
                // Perform actual FS operation
                console.log('ExplorerController: Invoking fs:rename', dragId, newPath);
                await this.app.api.invoke('fs:rename' as any, dragId, newPath);
            } catch (error: any) {
                console.error('Failed to move:', error);

                // Rollback would be complex here, so we rely on reload
                if (this.rootPath) await this.loadDir(this.rootPath);

                await this.app.api.invoke(
                    'dialog:alert',
                    'Move Failed',
                    `Failed to move: ${error?.message || error}`
                );
            }
        }
    }

    /**
     * Updates a node and its children's paths recursively
     */
    private updateNodePath(oldPath: string, newPath: string) {
        const node = this.nodes.get(oldPath);
        if (!node) return;

        // Remove old mapping
        this.nodes.delete(oldPath);

        // Update node
        node.id = newPath;

        // Add new mapping
        this.nodes.set(newPath, node);

        // Recursive children update
        if (node.children) {
            for (const child of node.children) {
                const childOldPath = joinPath(oldPath, child.name);
                const childNewPath = joinPath(newPath, child.name);
                // Note: child object is same reference, so we just need to recurse
                // But we need to make sure we update the mappings in this.nodes
                // The 'child' object itself needs its ID updated? 
                // Wait, if I update child.id, does it affect the map? No.
                // The map holds references. 

                // We must recursively generic path update
                // But wait, getTreeData uses traversing from root. so as long as links are correct...
                // But we use this.nodes to lookup by path. So we MUST update keys.

                // Since I already changed node.id above, I need to be careful not to double update?
                // Actually, if I iterate children now, their IDs are still old.
                // Wait, child.children is array of FileNodes. 
                // So I need to find the node in the map.

                // Actually, I should inspect the child object in the array.
                // It still has the old ID.
                this.updateNodePath(childOldPath, childNewPath);
            }
        }

        // Update active/selection/expansion states
        if (this._activeFilePath === oldPath) this._activeFilePath = newPath;
        if (this._selectedPath === oldPath) this._selectedPath = newPath;
        if (this._renamingPath === oldPath) this._renamingPath = null;
        if (this.expandedPaths.has(oldPath)) {
            this.expandedPaths.delete(oldPath);
            this.expandedPaths.add(newPath);
        }
    }

    /**
     * Handle rename from react-arborist
     */
    async onRename(args: { id: string; name: string }): Promise<void> {
        await this.submitRename(args.id, args.name);
    }

    /**
     * Handle create from react-arborist or external calls
     */
    async onCreate(args: {
        parentId: string | null;
        type: 'file' | 'folder'
    }): Promise<void> {
        const parentPath = args.parentId || this.rootPath;
        if (!parentPath) return;

        if (args.type === 'file') {
            await this.createNote(parentPath);
        } else {
            await this.createFolder(parentPath);
        }
    }

    // ========== Renaming ==========

    /**
     * Start renaming mode for a specific path
     */
    setRenaming(path: string | null): void {
        this._renamingPath = path;
        this.notify();
    }

    /**
     * Submit rename operation
     */
    async submitRename(oldPath: string, newName: string): Promise<boolean> {
        console.log('ExplorerController: submitRename', oldPath, '->', newName);
        if (!newName || newName.trim() === '') {
            this._renamingPath = null;
            this.notify();
            return false;
        }

        // Wait for any pending rename to complete (prevents race condition)
        if (this.pendingRename) {
            console.log('ExplorerController: Waiting for pending rename...');
            await this.pendingRename;
        }

        this.pendingRename = this._doRename(oldPath, newName.trim());
        const result = await this.pendingRename;
        this.pendingRename = null;
        return result;
    }

    /**
     * Internal rename implementation
     */
    private async _doRename(oldPath: string, newName: string): Promise<boolean> {
        const parentPath = getParentPath(oldPath);
        const newPath = joinPath(parentPath, newName);

        // --- OPTIMISTIC UI UPDATE ---
        const node = this.nodes.get(oldPath);
        const parentNode = this.nodes.get(parentPath);

        if (node) {
            node.name = newName;
            this.updateNodePath(oldPath, newPath);

            // Re-sort parent children
            if (parentNode && parentNode.children) {
                this.sortChildren(parentNode.children);
            }

            this.notify();
        }

        try {
            await this.app.api.invoke('fs:rename' as any, oldPath, newPath);
            // Optimistic update already handled state
            return true;
        } catch (error: any) {
            console.error('Failed to rename:', error);
            await this.app.api.invoke(
                'dialog:alert',
                'Rename Failed',
                `Failed to rename: ${error?.message || error}`
            );

            // Revert state (lazy way: reload parent)
            await this.loadDir(parentPath);

            this._renamingPath = null;
            this.notify();
            return false;
        }
    }

    /**
     * Cancel rename operation
     */
    cancelRename(): void {
        this._renamingPath = null;
        this.notify();
    }

    // ========== Delete ==========

    /**
     * Delete an item with confirmation
     */
    async deleteItem(path: string): Promise<boolean> {
        const node = this.nodes.get(path);
        const itemName = node?.name || getFileName(path);
        const isDirectory = node?.isDir;

        const confirmed = await this.app.api.invoke<boolean>(
            'dialog:confirm',
            'Confirm Delete',
            `Are you sure you want to delete "${itemName}"?${isDirectory ? '\n\nThis will delete all contents inside.' : ''}`
        );

        if (!confirmed) {
            return false;
        }

        // --- OPTIMISTIC UI UPDATE ---
        const parentPath = getParentPath(path);
        const parentNode = this.nodes.get(parentPath);

        // Remove from parent children
        if (parentNode && parentNode.children) {
            parentNode.children = parentNode.children.filter(c => c.id !== path);
        }

        // Remove from map (recursive)
        const deleteFromMap = (targetPath: string) => {
            const targetNode = this.nodes.get(targetPath);
            if (targetNode && targetNode.children) {
                targetNode.children.forEach(child => deleteFromMap(child.id));
            }
            this.nodes.delete(targetPath);
            this.expandedPaths.delete(targetPath);
        };
        deleteFromMap(path);

        // Clear references
        if (this._activeFilePath === path) this._activeFilePath = null;
        if (this._selectedPath === path) this._selectedPath = null;
        if (this._renamingPath === path) this._renamingPath = null;

        this.notify();

        // Yield to let UI update (optimistic delete)
        await new Promise(resolve => setTimeout(resolve, 0));

        try {
            if (isDirectory) {
                await this.app.api.invoke('fs:remove-dir' as any, path, { recursive: true });
            } else {
                await this.app.api.invoke('fs:remove-file' as any, path);
            }
            return true;
        } catch (error: any) {
            console.error('Failed to delete:', error);
            await this.app.api.invoke(
                'dialog:alert',
                'Delete Failed',
                `Failed to delete: ${error?.message || error}`
            );
            // Revert (reload parent)
            if (parentNode) await this.loadDir(parentNode.id);
            return false;
        }
    }

    // ========== Directory Operations ==========

    /**
     * Set root directory and load it
     */
    async setRoot(path: string) {
        this.rootPath = path;
        this.nodes.clear();
        this.expandedPaths.clear();

        // Create root node
        const rootNode: FileNode = {
            id: path,
            name: getFileName(path),
            isDir: true,
            isLoaded: false
        };
        this.nodes.set(path, rootNode);
        this.expandedPaths.add(path);

        await this.loadDir(path);
        this.startWatching(path);
        this.notify();
    }

    async loadDir(path: string) {
        const node = this.nodes.get(path);
        if (!node || !node.isDir) return;

        try {
            const entries: DirEntry[] = await this.app.api.invoke('fs:read-dir', path);

            // Filter hidden files/folders based on showHidden setting
            const visibleEntries = this.showHidden
                ? entries
                : entries.filter(e => !e.name.startsWith('.'));

            const children: FileNode[] = visibleEntries.map(entry => {
                const childPath = joinPath(path, entry.name);

                // Check if node already exists to preserve state
                const existingNode = this.nodes.get(childPath);

                const childNode: FileNode = {
                    id: childPath,
                    name: entry.name,
                    isDir: entry.isDirectory,
                    isLoaded: existingNode ? !!existingNode.isLoaded : false,
                };

                // Only set children for directories
                if (entry.isDirectory) {
                    childNode.children = existingNode?.children ?? [];
                }

                this.nodes.set(childPath, childNode);
                return childNode;
            });

            // Sort
            this.sortChildren(children);

            node.children = children;
            node.isLoaded = true;
            this.notify();
        } catch (error) {
            console.error(`Failed to load directory ${path}`, error);
        }
    }

    private sortChildren(children: FileNode[]) {
        children.sort((a, b) => {
            if (a.isDir === b.isDir) return a.name.localeCompare(b.name);
            return a.isDir ? -1 : 1;
        });
    }

    /**
     * Toggle directory expansion
     */
    toggleDir(path: string) {
        const node = this.nodes.get(path);
        if (!node || !node.isDir) return;

        if (this.expandedPaths.has(path)) {
            this.expandedPaths.delete(path);
        } else {
            this.expandedPaths.add(path);
            if (!node.isLoaded) {
                this.loadDir(path);
            }
        }
        this.notify();
    }

    /**
     * Expand a directory (for react-arborist onToggle)
     */
    async expandDir(path: string): Promise<void> {
        const node = this.nodes.get(path);
        if (!node || !node.isDir) return;

        this.expandedPaths.add(path);
        if (!node.isLoaded) {
            await this.loadDir(path);
        }
        this.notify();
    }

    /**
     * Collapse a directory
     */
    collapseDir(path: string): void {
        this.expandedPaths.delete(path);
        this.notify();
    }

    private unwatch: (() => void) | null = null;

    async startWatching(path: string) {
        if (this.unwatch) {
            this.unwatch();
            this.unwatch = null;
        }

        try {
            this.unwatch = await this.app.api.invoke('fs:watch', path, (event: FsEvent) => {
                this.handleFsEvent(event);
            });
        } catch (err) {
            console.error('Failed to start watcher', err);
        }
    }

    handleFsEvent(event: FsEvent) {
        let parentPath = getParentPath(event.path);
        const normalizedRootPath = this.rootPath ? normalizePath(this.rootPath) : '';

        // Debounce or check complexity?
        // For now, reload parent
        if (this.nodes.has(parentPath)) {
            const parentNode = this.nodes.get(parentPath);
            if (parentNode && (parentNode.isLoaded || this.expandedPaths.has(parentPath))) {
                this.loadDir(parentPath);
            }
        } else if (parentPath === normalizedRootPath) {
            this.loadDir(this.rootPath!);
        }
    }

    async findUniqueName(parentPath: string, baseName: string, extension: string = ''): Promise<string> {
        // Optimistic check against local nodes first
        const parentNode = this.nodes.get(parentPath);
        const existingNames = new Set<string>();
        if (parentNode && parentNode.children) {
            parentNode.children.forEach(c => existingNames.add(c.name));
        }

        let name = `${baseName}${extension}`;
        if (!existingNames.has(name)) return name;

        let counter = 1;
        while (true) {
            name = `${baseName} ${counter}${extension}`;
            if (!existingNames.has(name)) return name;
            counter++;
        }
    }

    async createNote(contextPath?: string) {
        let parentPath = contextPath || this._selectedPath || this.rootPath;
        if (!parentPath) {
            console.warn('ExplorerController: createNote failed - no parent path available');
            return;
        }

        // If path is a file, use its parent
        const node = this.nodes.get(parentPath);
        if (node && !node.isDir) {
            parentPath = getParentPath(parentPath);
        }
        const parentNode = this.nodes.get(parentPath!);

        // Expand parent folder
        if (!this.expandedPaths.has(parentPath!)) {
            this.expandedPaths.add(parentPath!);
        }

        try {
            const name = await this.findUniqueName(parentPath!, 'Untitled Note', '.md');
            const fullPath = joinPath(parentPath!, name);

            // --- OPTIMISTIC UI UPDATE ---
            // Create dummy node
            const newNode: FileNode = {
                id: fullPath,
                name: name,
                isDir: false,
                isLoaded: false
            };

            this.nodes.set(fullPath, newNode);

            if (parentNode) {
                if (!parentNode.children) parentNode.children = [];
                parentNode.children.push(newNode);
                this.sortChildren(parentNode.children);
                // Mark loaded so it shows up?
                if (!parentNode.isLoaded) parentNode.isLoaded = true;
            }

            this._selectedPath = fullPath;
            this.setRenaming(fullPath);
            this.notify();

            // Yield for UI render
            await new Promise(resolve => setTimeout(resolve, 0));

            // FS Op
            await this.app.api.invoke('fs:write-text-file', fullPath, '');

            // Open file
            this.app.events.emit('explorer:file-selected', { path: fullPath });

        } catch (error) {
            console.error('Failed to create note', error);
            await this.app.api.invoke('dialog:alert', 'Error', `Failed to create note: ${error}`);
            // Revert (reload parent)
            if (parentNode) await this.loadDir(parentNode.id);
        }
    }

    async createFolder(contextPath?: string) {
        let parentPath = contextPath || this._selectedPath || this.rootPath;
        if (!parentPath) return;

        const node = this.nodes.get(parentPath);
        if (node && !node.isDir) {
            parentPath = getParentPath(parentPath);
        }
        const parentNode = this.nodes.get(parentPath!);

        // Expand parent folder
        if (!this.expandedPaths.has(parentPath!)) {
            this.expandedPaths.add(parentPath!);
        }

        try {
            const name = await this.findUniqueName(parentPath!, 'New Folder');
            const fullPath = joinPath(parentPath!, name);

            // --- OPTIMISTIC UI UPDATE ---
            const newNode: FileNode = {
                id: fullPath,
                name: name,
                isDir: true,
                isLoaded: true,
                children: [] // empty folder
            };

            this.nodes.set(fullPath, newNode);

            if (parentNode) {
                if (!parentNode.children) parentNode.children = [];
                parentNode.children.push(newNode);
                this.sortChildren(parentNode.children);
                if (!parentNode.isLoaded) parentNode.isLoaded = true;
            }

            this._selectedPath = fullPath;
            this.setRenaming(fullPath);
            this.notify();

            // Yield for UI render
            await new Promise(resolve => setTimeout(resolve, 0));

            // FS Op
            await this.app.api.invoke('fs:create-dir', fullPath);

        } catch (error) {
            console.error('Failed to create folder', error);
            await this.app.api.invoke('dialog:alert', 'Error', `Failed to create folder: ${error}`);
            // Revert
            if (parentNode) await this.loadDir(parentNode.id);
        }
    }

    /**
     * Get tree structure (legacy compatibility)
     */
    getTree(): FileNode | null {
        if (!this.rootPath) return null;
        return this.nodes.get(this.rootPath) || null;
    }

    /**
     * Select an item
     */
    selectItem(path: string): void {
        this._selectedPath = path;

        const node = this.nodes.get(path);

        // Only emit file-selected if it's a file
        if (node && !node.isDir) {
            this.app.events.emit('explorer:file-selected', { path });
        }

        this.notify();
    }
}
