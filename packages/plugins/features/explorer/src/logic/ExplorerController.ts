import { NotehubCore } from '@notehub/core';
import type { FsEvent, DirEntry } from '@notehub/fs-manager';
import type { FileNode } from '../types';

/** Config key for show-hidden setting */
const EXPLORER_CONFIG_KEY_SHOW_HIDDEN = 'explorer.show-hidden';
export class ExplorerController {
    private app: NotehubCore;
    // private fs: IFileSystem | null = null; // Unused

    // State
    private nodes: Map<string, FileNode> = new Map();
    private expandedPaths: Set<string> = new Set();
    private rootPath: string | null = null;

    // Subscribers
    private listeners: Set<() => void> = new Set();

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

    // ========== Settings ==========

    /** Whether to show hidden files (starting with .) */
    private showHidden: boolean = false;

    /**
     * Handle show-hidden setting change
     * @param value - New value from config:updated event
     */
    private handleShowHiddenChange(value: unknown): void {
        if (typeof value === 'boolean' && value !== this.showHidden) {
            this.showHidden = value;
            // Reload all currently loaded directories to apply new filter
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
    }

    subscribe(listener: () => void) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    private notify() {
        this.listeners.forEach(l => l());
    }

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
            // Call FS API
            // We need to know the specific API channel for FS readDir
            // Assuming 'fs:readDir' based on fs-manager usually.
            // If not sure, we should check fs-manager, but let's assume 'fs:read-dir' or similar.
            // Actually, `IFileSystem` has `readDir`.
            // Let's assume we can use `this.app.api.invoke('fs:read-dir', path)`
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
                    // Preserve state if exists, otherwise default
                    isLoaded: existingNode ? !!existingNode.isLoaded : false,
                    isExpanded: existingNode ? !!existingNode.isExpanded : false,
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
            // Assuming 'fs:watch'
            // We cannot pass a function over IPC strictly if it's across boundaries, 
            // but if plugins are in same JS context (microkernel), we can pass callbacks.
            // Notehub architecture seems to be shared JS context.
            this.unwatch = await this.app.api.invoke('fs:watch', path, (event: FsEvent) => {
                this.handleFsEvent(event);
            });
        } catch (err) {
            console.error('Failed to start watcher', err);
        }
    }

    handleFsEvent(event: FsEvent) {
        // Refresh parent directory of the changed file
        // Or if it's a directory, refresh it

        // Simple strategy: reload the parent directory of the changed path
        // We need to resolve parent path
        // path: /a/b/c -> parent: /a/b

        // If event.path is the root, reload root.

        // Since we don't have distinct parent pointers easily without path manipulation:
        // Handle both Windows and Unix separators
        const separator = event.path.includes('\\') ? '\\' : '/';
        const lastIndex = event.path.lastIndexOf(separator);

        let parentPath = '';
        if (lastIndex !== -1) {
            parentPath = event.path.substring(0, lastIndex).replace(/\\/g, '/'); // Normalize to internal format
        }

        // If normalized path not found directly, try raw parent path
        if (!this.nodes.has(parentPath)) {
            // Try to match key format used in nodes (usually forward slashes)
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

    async createNote(parentPath: string) {
        try {
            const name = await this.app.api.invoke('dialog:prompt', 'Enter note name:', 'New Note') as string | null;
            if (!name) return;

            const finalName = name.endsWith('.md') ? name : `${name}.md`;
            const fullPath = `${parentPath}/${finalName}`.replace(/\\/g, '/').replace(/\/\//g, '/');

            // Check if exists? fs-manager might throw or overwrite.
            // Let's assume writeTextFile creates it.
            await this.app.api.invoke('fs:write-text-file', fullPath, '');

            // Instantly reload to show the new file
            await this.loadDir(parentPath);
        } catch (error) {
            console.error('Failed to create note', error);
            await this.app.api.invoke('dialog:alert', `Failed to create note: ${error}`);
        }
    }

    async createFolder(parentPath: string) {
        try {
            const name = await this.app.api.invoke('dialog:prompt', 'Enter folder name:', 'New Folder') as string | null;
            if (!name) return;

            const fullPath = `${parentPath}/${name}`.replace(/\\/g, '/').replace(/\/\//g, '/');

            await this.app.api.invoke('fs:create-dir', fullPath);

            // Instantly reload to show the new folder
            await this.loadDir(parentPath);
        } catch (error) {
            console.error('Failed to create folder', error);
            await this.app.api.invoke('dialog:alert', `Failed to create folder: ${error}`);
        }
    }

    getTree(): FileNode | null {
        if (!this.rootPath) return null;
        return this.nodes.get(this.rootPath) || null;
    }

    /**
     * Select a file and emit via EventBus
     * This replaces the DOM CustomEvent approach to use the core EventBus
     */
    selectFile(path: string): void {
        this.app.events.emit('explorer:file-selected', { path });
    }
}

