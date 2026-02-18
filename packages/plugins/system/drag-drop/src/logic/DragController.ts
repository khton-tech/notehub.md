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

export class DragController {
    private app: NotehubCore;
    private unlistenHover: UnlistenFn | null = null;
    private unlistenCancelled: UnlistenFn | null = null;
    private unlistenDrop: UnlistenFn | null = null;
    private onDragStateChange: (isDragging: boolean) => void;

    constructor(app: NotehubCore, onDragStateChange: (isDragging: boolean) => void) {
        this.app = app;
        // Wrap callback to track state internally
        this.onDragStateChange = (isDragging: boolean) => {
            this.isDragging = isDragging;
            onDragStateChange(isDragging);
        };
    }

    /**
     * Log a message via the Logger plugin
     */
    private log(level: 'info' | 'warn' | 'error', message: string): void {
        this.app.api.invoke(`logger:${level}`, 'nh.system.drag-drop', message);
    }

    /**
     * Start listening for Tauri file-drop events
     */
    async start(): Promise<void> {
        this.log('info', 'Starting drag controller...');
        console.log('[DragDrop] Starting drag controller...');

        // Listen for drag enter (when files first enter window)
        const unlistenEnter = await listen<FileDropHoverPayload>('tauri://drag-enter', (event) => {
            console.log('[DragDrop] drag-enter event:', event.payload);
            this.log('info', `Drag entered with ${event.payload.paths.length} files: ${JSON.stringify(event.payload.paths)}`);
            // Show overlay for all file drags - will filter on drop
            this.onDragStateChange(true);
        });

        // Listen for file hover (continuous while dragging over)
        this.unlistenHover = await listen<FileDropHoverPayload>('tauri://drag-over', (event) => {
            // Don't spam logs, but keep overlay visible
            if (!this.isDragging) {
                console.log('[DragDrop] drag-over event:', event.payload);
                this.onDragStateChange(true);
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
            console.log('[DragDrop] drag-leave event');
            this.log('info', 'Drag left window');
            this.onDragStateChange(false);
        });

        // Listen for file drop
        this.unlistenDrop = await listen<FileDropPayload>('tauri://drag-drop', async (event) => {
            console.log('[DragDrop] drag-drop event:', event.payload);
            this.log('info', `Drop received with ${event.payload.paths.length} files`);
            this.onDragStateChange(false);
            await this.handleFileDrop(event.payload.paths);
        });

        this.log('info', 'Drag controller started - listeners registered');
        console.log('[DragDrop] Drag controller started - all listeners registered');
    }

    private isDragging = false;

    /**
     * Stop listening for events and cleanup
     */
    stop(): void {
        this.log('info', 'Stopping drag controller...');

        this.unlistenHover?.();
        this.unlistenCancelled?.();
        this.unlistenDrop?.();

        this.unlistenHover = null;
        this.unlistenCancelled = null;
        this.unlistenDrop = null;

        this.log('info', 'Drag controller stopped');
    }

    /**
     * Handle dropped files - filter for .nhp and install
     */
    private async handleFileDrop(paths: string[]): Promise<void> {
        // Filter for .nhp files only
        const nhpFiles = paths.filter(path => path.endsWith('.nhp'));

        if (nhpFiles.length === 0) {
            this.log('info', 'No .nhp files in drop, ignoring');
            return;
        }

        this.log('info', `Received ${nhpFiles.length} .nhp file(s)`);

        // Process each .nhp file
        for (const filePath of nhpFiles) {
            await this.installPlugin(filePath);
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
