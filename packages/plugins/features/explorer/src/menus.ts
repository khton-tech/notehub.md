/**
 * Explorer Context Menus
 * 
 * Registers menu providers for the context menu system.
 */

import type { NotehubCore } from '@notehub/core';
import type { ExplorerController } from './logic/ExplorerController';
import type { MenuItem } from '@notehub/context-menu';

/**
 * Payload passed to explorer-item context menu
 */
export interface ExplorerItemPayload {
    path: string;
    kind: 'file' | 'directory';
}

/**
 * Payload passed to explorer-root/folder context menu
 */
export interface ExplorerFolderPayload {
    path: string;
}

/**
 * Register context menu providers for Explorer
 * 
 * @param app - NotehubCore instance
 * @param controller - ExplorerController instance
 * @returns Cleanup function to unregister all providers
 */
export function registerExplorerMenus(
    app: NotehubCore,
    controller: ExplorerController
): () => void {
    const cleanups: Array<() => void> = [];

    // ========== explorer-item context ==========
    // Right-click on a file or folder item (but NOT directories - those only get rename/delete)
    const itemProvider = (payload: ExplorerItemPayload): MenuItem[] => {
        const items: MenuItem[] = [];

        // File-specific items first
        if (payload.kind === 'file') {
            // Files just get rename and delete
            items.push(
                {
                    type: 'action',
                    id: 'rename',
                    label: 'Rename',
                    icon: 'edit',
                    onClick: () => {
                        controller.setRenaming(payload.path);
                    },
                },
                {
                    type: 'action',
                    id: 'delete',
                    label: 'Delete',
                    icon: 'trash-2',
                    color: 'var(--nh-danger, #ef4444)',
                    onClick: () => {
                        controller.deleteItem(payload.path);
                    },
                }
            );
        } else {
            // Directories get create options + rename/delete
            items.push(
                {
                    type: 'action',
                    id: 'new-note',
                    label: 'New Note',
                    icon: 'file',
                    onClick: () => {
                        controller.createNote(payload.path);
                    },
                },
                {
                    type: 'action',
                    id: 'new-folder',
                    label: 'New Folder',
                    icon: 'folder',
                    onClick: () => {
                        controller.createFolder(payload.path);
                    },
                },
                { type: 'separator' },
                {
                    type: 'action',
                    id: 'rename',
                    label: 'Rename',
                    icon: 'edit',
                    onClick: () => {
                        controller.setRenaming(payload.path);
                    },
                },
                {
                    type: 'action',
                    id: 'delete',
                    label: 'Delete',
                    icon: 'trash-2',
                    color: 'var(--nh-danger, #ef4444)',
                    onClick: () => {
                        controller.deleteItem(payload.path);
                    },
                }
            );
        }

        return items;
    };

    // Register and get unsubscribe function directly (not via Promise)
    const unsubItem = app.api.invoke<() => void>(
        'context-menu:register' as any,
        'explorer-item',
        itemProvider
    );

    // The invoke returns the unsubscribe function directly (synchronously in this case)
    if (typeof unsubItem === 'function') {
        cleanups.push(unsubItem);
    }

    // ========== explorer-root context ==========
    // Right-click on root header or empty area
    const rootProvider = (payload: ExplorerFolderPayload): MenuItem[] => {
        return [
            {
                type: 'action',
                id: 'new-note',
                label: 'New Note',
                icon: 'file',
                onClick: () => {
                    controller.createNote(payload.path);
                },
            },
            {
                type: 'action',
                id: 'new-folder',
                label: 'New Folder',
                icon: 'folder',
                onClick: () => {
                    controller.createFolder(payload.path);
                },
            },
        ];
    };

    const unsubRoot = app.api.invoke<() => void>(
        'context-menu:register' as any,
        'explorer-root',
        rootProvider
    );

    if (typeof unsubRoot === 'function') {
        cleanups.push(unsubRoot);
    }

    // Return cleanup function
    return () => {
        for (const cleanup of cleanups) {
            try {
                cleanup();
            } catch (e) {
                console.error('Error cleaning up explorer menu:', e);
            }
        }
    };
}
