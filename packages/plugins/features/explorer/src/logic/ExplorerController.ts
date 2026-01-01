import { NotehubCore } from '@notehub/core';
import type { FsEvent, DirEntry } from '@notehub/fs-manager';
import type { FileNode } from '../types';

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
        this.listeners.forEach(l => l());
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
        if (!newName || newName.trim() === '') {
            this._renamingPath = null;
            this.notify();
            return false;
        }

        // Calculate new path
        const separator = oldPath.includes('\\') ? '\\' : '/';
        const lastIndex = oldPath.lastIndexOf(separator);
        const parentPath = lastIndex !== -1 ? oldPath.substring(0, lastIndex) : '';
        const newPath = parentPath ? `${parentPath}/${newName}` : newName;
        const normalizedNewPath = newPath.replace(/\\/g, '/').replace(/\/\//g, '/');

        try {
            await this.app.api.invoke('fs:rename' as any, oldPath, normalizedNewPath);

            // --- Optimistic Update ---

            // 1. Update node itself
            const node = this.nodes.get(oldPath);
            if (node) {
                node.name = newName;
                // Recursively update paths in the tree map
                this.updateNodePath(oldPath, normalizedNewPath);

                // 2. Update parent's reference
                const parentNode = this.nodes.get(parentPath);
                if (parentNode && parentNode.children) {
                    // Update path in children array but keeping object reference
                    // (Actually updateNodePath logic above handles the object properties, 
                    // but we might need to re-sort if we want strict sorting)
                    parentNode.children.sort((a, b) => {
                        if (a.kind === b.kind) return a.name.localeCompare(b.name);
                        return a.kind === 'directory' ? -1 : 1;
                    });
                }
            }

            // 3. Update active/selected/renaming references
            if (this._activeFilePath === oldPath) this._activeFilePath = normalizedNewPath;
            if (this._selectedPath === oldPath) this._selectedPath = normalizedNewPath;
            this._renamingPath = null;

            this.notify();
            return true;
        } catch (error: any) {
            console.error('Failed to rename:', error);
            await this.app.api.invoke(
                'dialog:alert',
                'Rename Failed',
                `Failed to rename: ${error?.message || error}`
            );
            // Revert/Reload on error
            if (this.rootPath) await this.loadDir(this.rootPath);

            this._renamingPath = null;
            this.notify();
            return false;
        }
    }

    /**
     * Recursively update paths in the nodes map
     */
    private updateNodePath(oldPath: string, newPath: string) {
        const node = this.nodes.get(oldPath);
        if (!node) return;

        // Update map key
        this.nodes.delete(oldPath);
        this.nodes.set(newPath, node);

        // Update node property
        node.path = newPath;

        // Update expanded paths
        if (this.expandedPaths.has(oldPath)) {
            this.expandedPaths.delete(oldPath);
            this.expandedPaths.add(newPath);
        }

        // Recursively update children
        if (node.children) {
            for (const child of node.children) {
                const childOldPath = child.path;
                const childNewPath = `${newPath}/${child.name}`;
                this.updateNodePath(childOldPath, childNewPath);
            }
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
    /**
     * Delete an item with confirmation
     */
    async deleteItem(path: string): Promise<boolean> {
        const node = this.nodes.get(path);
        const itemName = node?.name || path.split(/[\\/]/).pop() || path;
        const isDirectory = node?.kind === 'directory';

        const confirmed = await this.app.api.invoke<boolean>(
            'dialog:confirm',
            'Confirm Delete',
            `Are you sure you want to delete "${itemName}"?${isDirectory ? '\n\nThis will delete all contents inside.' : ''}`
        );

        if (!confirmed) {
            return false;
        }

        try {
            if (isDirectory) {
                await this.app.api.invoke('fs:remove-dir' as any, path, { recursive: true });
            } else {
                await this.app.api.invoke('fs:remove-file' as any, path);
            }

            // --- Optimistic Update ---

            // 1. Remove from parent's children list
            const parentPath = path.substring(0, path.lastIndexOf('/'));
            const parentNode = this.nodes.get(parentPath);
            if (parentNode && parentNode.children) {
                parentNode.children = parentNode.children.filter(c => c.path !== path);
            }

            // 2. Remove from nodes map (recursive for directories)
            const deleteRecursively = (targetPath: string) => {
                const targetNode = this.nodes.get(targetPath);
                if (targetNode && targetNode.children) {
                    targetNode.children.forEach(child => deleteRecursively(child.path));
                }
                this.nodes.delete(targetPath);
                this.expandedPaths.delete(targetPath);
            };
            deleteRecursively(path);

            // 3. Update state references
            if (this._activeFilePath === path) this._activeFilePath = null;
            if (this._selectedPath === path) this._selectedPath = null;
            if (this._renamingPath === path) this._renamingPath = null;

            this.notify();
            return true;
        } catch (error: any) {
            console.error('Failed to delete:', error);
            await this.app.api.invoke(
                'dialog:alert',
                'Delete Failed',
                `Failed to delete: ${error?.message || error}`
            );
            // Revert/Reload on error to ensure consistency
            if (this.rootPath) await this.loadDir(this.rootPath);
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
            path,
            name: path.split(/[\\/]/).pop() || path,
            kind: 'directory',
            isLoaded: false,
            isExpanded: true
        };
        this.nodes.set(path, rootNode);
        this.expandedPaths.add(path);

        await this.loadDir(path);
        this.startWatching(path);
        this.notify();
    }

    async loadDir(path: string) {
        const node = this.nodes.get(path);
        if (!node || node.kind !== 'directory') return;

        try {
            const entries: DirEntry[] = await this.app.api.invoke('fs:read-dir', path);

            // Filter hidden files/folders based on showHidden setting
            const visibleEntries = this.showHidden
                ? entries
                : entries.filter(e => !e.name.startsWith('.'));

            // sort: folders first, then files
            visibleEntries.sort((a, b) => {
                if (a.isDirectory === b.isDirectory) {
                    return a.name.localeCompare(b.name);
                }
                return a.isDirectory ? -1 : 1;
            });

            const children: FileNode[] = visibleEntries.map(entry => {
                const childPath = `${path}/${entry.name}`.replace(/\\/g, '/').replace(/\/\//g, '/');

                // Check if node already exists to preserve state
                const existingNode = this.nodes.get(childPath);

                const childNode: FileNode = {
                    path: childPath,
                    name: entry.name,
                    kind: entry.isDirectory ? 'directory' : 'file',
                    isLoaded: existingNode ? !!existingNode.isLoaded : false,
                    isExpanded: this.expandedPaths.has(childPath), // Use strict source of truth
                    children: existingNode?.children || []
                };

                this.nodes.set(childPath, childNode);
                return childNode;
            });

            node.children = children;
            node.isLoaded = true;
            this.notify();
        } catch (error) {
            console.error(`Failed to load directory ${path}`, error);
        }
    }

    toggleDir(path: string) {
        const node = this.nodes.get(path);
        if (!node || node.kind !== 'directory') return;

        if (this.expandedPaths.has(path)) {
            this.expandedPaths.delete(path);
            node.isExpanded = false;
        } else {
            this.expandedPaths.add(path);
            node.isExpanded = true;
            if (!node.isLoaded) {
                this.loadDir(path);
            }
        }
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
        const separator = event.path.includes('\\') ? '\\' : '/';
        const lastIndex = event.path.lastIndexOf(separator);

        let parentPath = '';
        if (lastIndex !== -1) {
            parentPath = event.path.substring(0, lastIndex).replace(/\\/g, '/');
        }

        if (!this.nodes.has(parentPath)) {
            const normalizedEventPath = event.path.replace(/\\/g, '/');
            const lastSlash = normalizedEventPath.lastIndexOf('/');
            if (lastSlash !== -1) {
                parentPath = normalizedEventPath.substring(0, lastSlash);
            }
        }

        if (this.nodes.has(parentPath)) {
            const parentNode = this.nodes.get(parentPath);
            if (parentNode && (parentNode.isLoaded || parentNode.isExpanded)) {
                this.loadDir(parentPath);
            }
        } else if (this.rootPath && (parentPath === this.rootPath.replace(/\\/g, '/'))) {
            this.loadDir(this.rootPath);
        }
    }

    async findUniqueName(parentPath: string, baseName: string, extension: string = ''): Promise<string> {
        try {
            const entries: DirEntry[] = await this.app.api.invoke('fs:read-dir', parentPath);
            const names = new Set(entries.map(e => e.name));

            let name = `${baseName}${extension}`;
            if (!names.has(name)) return name;

            let counter = 1;
            while (true) {
                name = `${baseName} ${counter}${extension}`;
                if (!names.has(name)) return name;
                counter++;
            }
        } catch (error) {
            console.error('Failed to find unique name', error);
            // Fallback to timestamp if read-dir fails
            return `${baseName} ${Date.now()}${extension}`;
        }
    }

    async createNote(contextPath?: string) {
        let parentPath = contextPath || this._selectedPath || this.rootPath;
        if (!parentPath) return;

        // If path is a file, use its parent
        const node = this.nodes.get(parentPath);
        if (node && node.kind === 'file') {
            const separator = parentPath.includes('\\') ? '\\' : '/';
            const lastIndex = parentPath.lastIndexOf(separator);
            if (lastIndex !== -1) {
                parentPath = parentPath.substring(0, lastIndex);
            }
        }

        try {
            const name = await this.findUniqueName(parentPath, 'Untitled Note', '.md');
            const fullPath = `${parentPath}/${name}`.replace(/\\/g, '/').replace(/\/\//g, '/');

            await this.app.api.invoke('fs:write-text-file', fullPath, '');
            // Reveal the new file
            await this.loadDir(parentPath);

            // Select and start renaming
            this._selectedPath = fullPath;
            this.setRenaming(fullPath);
            this.notify();
        } catch (error) {
            console.error('Failed to create note', error);
            await this.app.api.invoke('dialog:alert', 'Error', `Failed to create note: ${error}`);
        }
    }

    async createFolder(contextPath?: string) {
        let parentPath = contextPath || this._selectedPath || this.rootPath;
        if (!parentPath) return;

        // If path is a file, use its parent
        const node = this.nodes.get(parentPath);
        if (node && node.kind === 'file') {
            const separator = parentPath.includes('\\') ? '\\' : '/';
            const lastIndex = parentPath.lastIndexOf(separator);
            if (lastIndex !== -1) {
                parentPath = parentPath.substring(0, lastIndex);
            }
        }

        try {
            const name = await this.findUniqueName(parentPath, 'New Folder');
            const fullPath = `${parentPath}/${name}`.replace(/\\/g, '/').replace(/\/\//g, '/');

            await this.app.api.invoke('fs:create-dir', fullPath);
            await this.loadDir(parentPath);

            // Select and start renaming
            // For folder, we might want to expand parent first? Handled by loadDir usually if structure allows.
            this._selectedPath = fullPath;
            this.setRenaming(fullPath);
            this.notify();
        } catch (error) {
            console.error('Failed to create folder', error);
            await this.app.api.invoke('dialog:alert', 'Error', `Failed to create folder: ${error}`);
        }
    }

    getTree(): FileNode | null {
        if (!this.rootPath) return null;
        return this.nodes.get(this.rootPath) || null;
    }

    /**
     * Select a file and emit via EventBus
     */
    /**
     * Select an item
     */
    selectItem(path: string): void {
        this._selectedPath = path;

        const node = this.nodes.get(path);

        // Only emit file-selected if it's a file
        if (node && node.kind !== 'directory') {
            this.app.events.emit('explorer:file-selected', { path });
        }

        this.notify();
    }
}
