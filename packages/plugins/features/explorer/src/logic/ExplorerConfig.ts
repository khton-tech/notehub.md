/**
 * @fileoverview ExplorerConfig - Configuration Keys, Types, and Defaults
 *
 * This module defines the configuration schema for the explorer plugin,
 * including keys, default values, and settings-manager integration.
 *
 * ## Config Keys
 *
 * | Key                      | Type      | Default | Description                |
 * |--------------------------|-----------|---------|----------------------------|
 * | `explorer.show-hidden`   | boolean   | false   | Show hidden files          |
 * | `explorer.folders-first` | boolean   | true    | Show folders before files  |
 *
 * @module @notehub/explorer/logic/ExplorerConfig
 */

import type { NotehubCore } from '@notehub/core';

/**
 * Configuration keys for the explorer plugin.
 * Use these constants to avoid magic strings.
 */
export const EXPLORER_CONFIG_KEYS = {
    /** Show or hide hidden files (starting with .) */
    SHOW_HIDDEN: 'explorer.show-hidden',
    /** Show folders before files in the tree */
    FOLDERS_FIRST: 'explorer.folders-first',
    /** Confirm before deleting a file */
    CONFIRM_DELETE: 'explorer.confirm-delete',
    /** Open files with a single click */
    SINGLE_CLICK_OPEN: 'explorer.single-click-open',
} as const;

/**
 * Explorer settings interface.
 * Represents the current state of explorer configuration.
 */
export interface ExplorerSettings {
    showHidden: boolean;
    foldersFirst: boolean;
    confirmDelete: boolean;
    singleClickOpen: boolean;
}

/**
 * Default values for explorer settings.
 * Used when config values are not set in storage.
 */
export const EXPLORER_CONFIG_DEFAULTS: ExplorerSettings = {
    showHidden: false,
    foldersFirst: true,
    confirmDelete: true,
    singleClickOpen: true,
};

// ============================================================================
// Settings Manager Integration
// ============================================================================

/**
 * Register explorer settings with settings-manager.
 * This makes settings appear in the Settings modal UI.
 * 
 * @param app - NotehubCore instance
 */
export async function registerExplorerSettings(app: NotehubCore): Promise<void> {
    const tabLabel = await app.api.invoke<string>('i18n:t', 'explorer.settings.tab') || 'Files';
    const groupDisplay = await app.api.invoke<string>('i18n:t', 'explorer.settings.groups.display') || 'File Explorer';
    const groupBehavior = await app.api.invoke<string>('i18n:t', 'explorer.settings.groups.behavior') || 'Behavior';

    // Register Files tab
    app.api.invoke('settings:register-tab', {
        id: 'files',
        label: tabLabel,
        icon: 'folder',
        order: 20,
        category: 'core'
    });

    // Register File Explorer group
    app.api.invoke('settings:register-group', {
        id: 'explorer-display',
        tabId: 'files',
        label: groupDisplay,
        order: 10
    });

    // Register Behavior group
    app.api.invoke('settings:register-group', {
        id: 'explorer-behavior',
        tabId: 'files',
        label: groupBehavior,
        order: 20
    });

    const shLabel = await app.api.invoke<string>('i18n:t', 'explorer.settings.items.showHidden.label') || 'Show Hidden Files';
    const shDesc = await app.api.invoke<string>('i18n:t', 'explorer.settings.items.showHidden.description') || 'Display files and folders starting with a dot';
    const ffLabel = await app.api.invoke<string>('i18n:t', 'explorer.settings.items.foldersFirst.label') || 'Folders First';
    const ffDesc = await app.api.invoke<string>('i18n:t', 'explorer.settings.items.foldersFirst.description') || 'Show folders before files in the tree';
    const scLabel = await app.api.invoke<string>('i18n:t', 'explorer.settings.items.singleClick.label') || 'Single Click to Open';
    const scDesc = await app.api.invoke<string>('i18n:t', 'explorer.settings.items.singleClick.description') || 'Open files with a single click instead of double click';
    const cdLabel = await app.api.invoke<string>('i18n:t', 'explorer.settings.items.confirmDelete.label') || 'Confirm File Deletion';
    const cdDesc = await app.api.invoke<string>('i18n:t', 'explorer.settings.items.confirmDelete.description') || 'Ask for confirmation before moving files to trash';

    // Register setting items
    app.api.invoke('settings:register-items', [
        {
            key: EXPLORER_CONFIG_KEYS.SHOW_HIDDEN,
            type: 'toggle',
            label: shLabel,
            description: shDesc,
            groupId: 'explorer-display',
            order: 10,
            defaultValue: EXPLORER_CONFIG_DEFAULTS.showHidden
        },
        {
            key: EXPLORER_CONFIG_KEYS.FOLDERS_FIRST,
            type: 'toggle',
            label: ffLabel,
            description: ffDesc,
            groupId: 'explorer-display',
            order: 20,
            defaultValue: EXPLORER_CONFIG_DEFAULTS.foldersFirst
        },
        {
            key: EXPLORER_CONFIG_KEYS.SINGLE_CLICK_OPEN,
            type: 'toggle',
            label: scLabel,
            description: scDesc,
            groupId: 'explorer-behavior',
            order: 10,
            defaultValue: EXPLORER_CONFIG_DEFAULTS.singleClickOpen
        },
        {
            key: EXPLORER_CONFIG_KEYS.CONFIRM_DELETE,
            type: 'toggle',
            label: cdLabel,
            description: cdDesc,
            groupId: 'explorer-behavior',
            order: 20,
            defaultValue: EXPLORER_CONFIG_DEFAULTS.confirmDelete
        }
    ]);
}
