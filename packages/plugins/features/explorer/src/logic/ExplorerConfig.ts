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
} as const;

/**
 * Explorer settings interface.
 * Represents the current state of explorer configuration.
 */
export interface ExplorerSettings {
    /** Whether hidden files are visible */
    showHidden: boolean;
    /** Whether folders are shown before files */
    foldersFirst: boolean;
}

/**
 * Default values for explorer settings.
 * Used when config values are not set in storage.
 */
export const EXPLORER_CONFIG_DEFAULTS: ExplorerSettings = {
    showHidden: false,
    foldersFirst: true,
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
export function registerExplorerSettings(app: NotehubCore): void {
    // Register Files tab
    app.api.invoke('settings:register-tab', {
        id: 'files',
        label: 'Files',
        icon: 'folder',
        order: 20
    });

    // Register File Explorer group
    app.api.invoke('settings:register-group', {
        id: 'explorer-display',
        tabId: 'files',
        label: 'File Explorer',
        order: 10
    });

    // Register setting items
    app.api.invoke('settings:register-items', [
        {
            key: EXPLORER_CONFIG_KEYS.SHOW_HIDDEN,
            type: 'toggle',
            label: 'Show Hidden Files',
            description: 'Display files and folders starting with a dot',
            groupId: 'explorer-display',
            order: 10,
            defaultValue: EXPLORER_CONFIG_DEFAULTS.showHidden
        },
        {
            key: EXPLORER_CONFIG_KEYS.FOLDERS_FIRST,
            type: 'toggle',
            label: 'Folders First',
            description: 'Show folders before files in the tree',
            groupId: 'explorer-display',
            order: 20,
            defaultValue: EXPLORER_CONFIG_DEFAULTS.foldersFirst
        }
    ]);
}
