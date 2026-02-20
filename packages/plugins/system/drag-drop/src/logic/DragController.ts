/**
 * DragController - Manages Tauri file-drop events for plugin installation
 * 
 * Listens to Tauri's drag-drop events and handles .nhp file installation.
 * Provides state callbacks for UI overlay rendering.
 */

import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { NotehubCore } from '@notehub/core';
import JSZip from 'jszip';

/** Plugin manifest structure from NHP files */
interface PluginManifest {
    id: string;
    name: string;
    version: string;
    description?: string;
    author?: string;
    type?: 'system' | 'ui' | 'feature';
    dependencies?: string[];
}

/** Payload for file-drop events */
interface FileDropPayload {
    paths: string[];
    position: { x: number; y: number };
}

/** Payload for file-drop-hover events */
interface FileDropHoverPayload {
    paths: string[];
    position: { x: number; y: number };
}

export type DragType = 'plugin' | 'markdown' | 'mixed' | 'unknown';

export class DragController {
    private app: NotehubCore;
    private unlistenHover: UnlistenFn | null = null;
    private unlistenCancelled: UnlistenFn | null = null;
    private unlistenDrop: UnlistenFn | null = null;
    private onDragStateChange: (isDragging: boolean, dragType: DragType) => void;

    constructor(app: NotehubCore, onDragStateChange: (isDragging: boolean, dragType: DragType) => void) {
        this.app = app;
        // Wrap callback to track state internally
        this.onDragStateChange = (isDragging: boolean, dragType: DragType) => {
            this.isDragging = isDragging;
            onDragStateChange(isDragging, dragType);
        };
    }

    /**
     * Log a message via the Logger plugin
     */
    private log(level: 'info' | 'warn' | 'error', message: string): void {
        this.app.api.invoke(`logger:${level}`, 'nh.system.drag-drop', message);
    }

    /**
     * Determine the type of files being dragged
     */
    private determineDragType(paths: string[]): DragType {
        let hasNhp = false;
        let hasMd = false;
        let hasOther = false;

        for (const path of paths) {
            if (path.endsWith('.nhp')) {
                hasNhp = true;
            } else if (path.endsWith('.md')) {
                hasMd = true;
            } else {
                hasOther = true;
            }
        }

        if (hasNhp && !hasMd && !hasOther) return 'plugin';
        if (!hasNhp && hasMd && !hasOther) return 'markdown';
        if ((hasNhp || hasMd) && !hasOther) return 'mixed';

        // If we have supported files mixed with unsupported, treat as mixed/unknown or just unknown?
        // Let's allow mixed if at least one supported type is present, but for now stick to simple logic.
        // If there are ONLY supported files (mixed), return mixed.
        // If there are ANY unsupported files, return unknown for now (to avoid encouraging dropping trash).

        if (hasOther) return 'unknown';

        return 'unknown';
    }

    private isDragging = false;
    private isInternalDrag = false;

    /**
     * Window drag start handler
     */
    private handleGlobalDragStart = (): void => {
        this.isInternalDrag = true;
        console.log('[DragDrop] Global drag start detected (internal drag)');
    };

    /**
     * Window drag end handler
     */
    private handleGlobalDragEnd = (): void => {
        this.isInternalDrag = false;
        console.log('[DragDrop] Global drag end detected');
    };

    /**
     * Start listening for Tauri file-drop events
     */
    async start(): Promise<void> {
        this.log('info', 'Starting drag controller...');
        console.log('[DragDrop] Starting drag controller...');

        // Listen for internal drags
        window.addEventListener('dragstart', this.handleGlobalDragStart);
        window.addEventListener('dragend', this.handleGlobalDragEnd);
        window.addEventListener('drop', this.handleGlobalDragEnd); // Ensure reset on drop too

        // Listen for drag enter (when files first enter window)
        const unlistenEnter = await listen<FileDropHoverPayload>('tauri://drag-enter', (event) => {
            if (this.isInternalDrag) {
                console.log('[DragDrop] Ignoring drag-enter (internal drag)');
                return;
            }
            if (!event.payload.paths || event.payload.paths.length === 0) {
                return;
            }
            console.log('[DragDrop] drag-enter event:', event.payload);
            this.log('info', `Drag entered with ${event.payload.paths.length} files`);

            const dragType = this.determineDragType(event.payload.paths);
            this.onDragStateChange(true, dragType);
        });

        // Listen for file hover (continuous while dragging over)
        this.unlistenHover = await listen<FileDropHoverPayload>('tauri://drag-over', (event) => {
            if (this.isInternalDrag) {
                return;
            }
            if (!event.payload.paths || event.payload.paths.length === 0) {
                return;
            }
            // Don't spam logs, but keep overlay visible
            if (!this.isDragging) {
                console.log('[DragDrop] drag-over event:', event.payload);
                const dragType = this.determineDragType(event.payload.paths);
                this.onDragStateChange(true, dragType);
            }
        });

        // Store enter listener for cleanup
        const originalHover = this.unlistenHover;
        this.unlistenHover = () => {
            unlistenEnter();
            originalHover?.();
        };

        // Listen for drag cancelled (drag leave)
        this.unlistenCancelled = await listen<void>('tauri://drag-leave', () => {
            // We don't check isInternalDrag here because if it's internal, we simply want 
            // to ignore start/hover. If leave happens, ensuring UI is hidden is fine.
            // But technically if it's internal, we never showed UI, so hiding it is a no-op.
            console.log('[DragDrop] drag-leave event');

            if (!this.isInternalDrag) {
                this.log('info', 'Drag left window');
            }
            this.onDragStateChange(false, 'unknown');
        });

        // Listen for file drop
        this.unlistenDrop = await listen<FileDropPayload>('tauri://drag-drop', async (event) => {
            if (this.isInternalDrag) {
                console.log('[DragDrop] Ignoring drag-drop (internal drag)');
                return;
            }
            console.log('[DragDrop] drag-drop event:', event.payload);
            this.log('info', `Drop received with ${event.payload.paths.length} files`);
            this.onDragStateChange(false, 'unknown');
            await this.handleFileDrop(event.payload.paths);
        });

        this.log('info', 'Drag controller started - listeners registered');
        console.log('[DragDrop] Drag controller started - all listeners registered');
    }

    /**
     * Stop listening for events and cleanup
     */
    stop(): void {
        this.log('info', 'Stopping drag controller...');

        window.removeEventListener('dragstart', this.handleGlobalDragStart);
        window.removeEventListener('dragend', this.handleGlobalDragEnd);
        window.removeEventListener('drop', this.handleGlobalDragEnd);

        this.unlistenHover?.();
        this.unlistenCancelled?.();
        this.unlistenDrop?.();

        this.unlistenHover = null;
        this.unlistenCancelled = null;
        this.unlistenDrop = null;

        this.log('info', 'Drag controller stopped');
    }

    /**
     * Handle dropped files - filter for .nhp and .md files
     */
    private async handleFileDrop(paths: string[]): Promise<void> {
        // Filter for .nhp files
        const nhpFiles = paths.filter(path => path.endsWith('.nhp'));
        // Filter for .md files
        const mdFiles = paths.filter(path => path.endsWith('.md'));

        if (nhpFiles.length === 0 && mdFiles.length === 0) {
            this.log('info', 'No supported files (.nhp, .md) in drop, ignoring');
            return;
        }

        this.log('info', `Received ${nhpFiles.length} .nhp file(s) and ${mdFiles.length} .md file(s)`);

        // Process .nhp files
        for (const filePath of nhpFiles) {
            await this.installPlugin(filePath);
        }

        // Process .md files
        for (const filePath of mdFiles) {
            await this.importMarkdown(filePath);
        }
    }

    /**
     * Import a single .md file
     */
    private async importMarkdown(sourcePath: string): Promise<void> {
        // Extract filename from path
        const filename = sourcePath.split(/[/\\]/).pop() || 'untitled.md';

        this.log('info', `Importing markdown: ${filename}`);

        try {
            // Confirm import
            const confirmed = await this.app.api.invoke(
                'dialog:confirm',
                `Import "${filename}"?`,
                `Do you want to import "${filename}" into your vault?`
            );

            if (!confirmed) {
                this.log('info', 'User cancelled markdown import');
                return;
            }

            // Get vault path from config
            const vaultPath = await this.app.api.invoke('config:get', 'vault.last-opened') as string;
            if (!vaultPath) {
                throw new Error('No vault path configured');
            }

            // Determine destination path
            const destinationPath = `${vaultPath}/${filename}`;

            // Check if file already exists
            const exists = await this.app.api.invoke('fs:exists', destinationPath);
            if (exists) {
                const overwrite = await this.app.api.invoke(
                    'dialog:confirm',
                    'File already exists',
                    `"${filename}" already exists in the vault. Overwrite?`
                );
                if (!overwrite) {
                    this.log('info', 'User cancelled overwrite');
                    return;
                }
            }

            this.log('info', `Copying to: ${destinationPath}`);

            // Read source file
            const fileData = await this.app.api.invoke('fs:read-file', sourcePath) as Uint8Array;

            // Write to destination
            await this.app.api.invoke('fs:write-file', destinationPath, fileData);

            this.log('info', `Imported ${filename}`);

            // Notify user
            await this.app.api.invoke(
                'dialog:alert',
                'Imported',
                `"${filename}" has been imported.`
            );

            // Open the file in editor
            await this.app.api.invoke('editor:open', destinationPath);

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.log('error', `Failed to import markdown: ${errorMessage}`);
            await this.app.api.invoke(
                'dialog:alert',
                'Import Failed',
                `Failed to import "${filename}": ${errorMessage}`
            );
        }
    }

    /**
     * Install a single .nhp plugin file
     */
    private async installPlugin(sourcePath: string): Promise<void> {
        // Extract filename from path
        const filename = sourcePath.split(/[/\\]/).pop() || 'plugin.nhp';

        this.log('info', `Installing plugin: ${filename}`);

        try {
            // Read the NHP file as binary
            const fileData = await this.app.api.invoke('fs:read-file', sourcePath) as Uint8Array;

            // Extract manifest from NHP (ZIP) file
            let manifest: PluginManifest | null = null;
            try {
                const zip = await JSZip.loadAsync(fileData);
                const manifestFile = zip.file('manifest.json');
                if (manifestFile) {
                    const manifestContent = await manifestFile.async('string');
                    manifest = JSON.parse(manifestContent) as PluginManifest;
                }
            } catch (zipError) {
                this.log('warn', `Could not read manifest: ${zipError}`);
            }

            // Build confirmation message with plugin info
            let confirmTitle = 'Install Plugin?';
            let confirmMessage: string;

            if (manifest) {
                confirmTitle = `Install "${manifest.name}"?`;
                const lines: string[] = [];
                lines.push(`Name: ${manifest.name}`);
                lines.push(`Version: ${manifest.version}`);
                if (manifest.author) {
                    lines.push(`Author: ${manifest.author}`);
                }
                if (manifest.description) {
                    lines.push(``);
                    lines.push(manifest.description);
                }
                if (manifest.dependencies && manifest.dependencies.length > 0) {
                    lines.push(``);
                    lines.push(`Dependencies: ${manifest.dependencies.join(', ')}`);
                }
                confirmMessage = lines.join('\n');
            } else {
                confirmMessage = `Do you want to install "${filename}"?\n\nWarning: Could not read plugin manifest.`;
            }

            // Show confirmation dialog with plugin info
            const confirmed = await this.app.api.invoke(
                'dialog:confirm',
                confirmTitle,
                confirmMessage
            );

            if (!confirmed) {
                this.log('info', 'User cancelled plugin installation');
                return;
            }

            // Get vault path from config (stored by vault-picker when vault is opened)
            const vaultPath = await this.app.api.invoke('config:get', 'vault.last-opened') as string;
            if (!vaultPath) {
                throw new Error('No vault path configured');
            }

            // Determine destination path
            const destinationPath = `${vaultPath}/.notehub/plugins/${filename}`;

            this.log('info', `Copying to: ${destinationPath}`);

            // Ensure plugins directory exists
            const pluginsDir = `${vaultPath}/.notehub/plugins`;
            const pluginsDirExists = await this.app.api.invoke('fs:exists', pluginsDir);
            if (!pluginsDirExists) {
                await this.app.api.invoke('fs:create-dir', pluginsDir, { recursive: true });
            }

            // Write to destination (fileData already read above)
            await this.app.api.invoke('fs:write-file', destinationPath, fileData);

            this.log('info', 'File copied, loading plugin...');

            // Load the plugin via Synapse
            const result = await this.app.api.invoke('synapse:load-plugin', destinationPath) as {
                success: boolean;
                pluginId?: string;
                error?: string;
            };

            if (result.success) {
                this.log('info', `Plugin loaded successfully: ${result.pluginId}`);
                await this.app.api.invoke(
                    'dialog:alert',
                    'Success!',
                    `Plugin "${filename}" has been installed and loaded.`
                );
            } else {
                throw new Error(result.error || 'Failed to load plugin');
            }

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.log('error', `Failed to install plugin: ${errorMessage}`);
            await this.app.api.invoke(
                'dialog:alert',
                'Installation Failed',
                `Failed to install "${filename}": ${errorMessage}`
            );
        }
    }
}
