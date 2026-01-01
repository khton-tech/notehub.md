/**
 * @fileoverview EditorConfig - Configuration Keys, Types, and Defaults
 *
 * This module defines the configuration schema for the editor plugin,
 * including keys, default values, and TypeScript interfaces.
 *
 * ## Config Keys
 *
 * | Key                         | Type      | Default | Description                |
 * |-----------------------------|-----------|---------|----------------------------|
 * | `editor.show-line-numbers`  | boolean   | true    | Show/hide line numbers     |
 * | `editor.word-wrap`          | boolean   | true    | Enable/disable word wrap   |
 * | `editor.font-size`          | number    | 16      | Font size in pixels        |
 *
 * @module @notehub/editor/logic/EditorConfig
 */

/**
 * Configuration keys for the editor plugin.
 * Use these constants to avoid magic strings.
 */
export const EDITOR_CONFIG_KEYS = {
    /** Show or hide line numbers in the gutter */
    SHOW_LINE_NUMBERS: 'editor.show-line-numbers',
    /** Enable word wrap for long lines */
    WORD_WRAP: 'editor.word-wrap',
    /** Font size in pixels */
    FONT_SIZE: 'editor.font-size',
} as const;

/**
 * Editor settings interface.
 * Represents the current state of editor configuration.
 */
export interface EditorSettings {
    /** Whether line numbers are visible */
    showLineNumbers: boolean;
    /** Whether word wrap is enabled */
    wordWrap: boolean;
    /** Font size in pixels */
    fontSize: number;
}

/**
 * Default values for editor settings.
 * Used when config values are not set in storage.
 */
export const EDITOR_CONFIG_DEFAULTS: EditorSettings = {
    showLineNumbers: true,
    wordWrap: true,
    fontSize: 16,
};

// ============================================================================
// Settings Manager Integration
// ============================================================================

import type { NotehubCore } from '@notehub/core';

/**
 * Register editor settings with settings-manager.
 * This makes settings appear in the Settings modal UI.
 * 
 * @param app - NotehubCore instance
 */
export function registerEditorSettings(app: NotehubCore): void {
    // Register Editor tab
    app.api.invoke('settings:register-tab', {
        id: 'editor',
        label: 'Editor',
        icon: 'edit-3',
        order: 10
    });

    // Register Typography group
    app.api.invoke('settings:register-group', {
        id: 'editor-typography',
        tabId: 'editor',
        label: 'Typography',
        order: 10
    });

    // Register Display group
    app.api.invoke('settings:register-group', {
        id: 'editor-display',
        tabId: 'editor',
        label: 'Display',
        order: 20
    });

    // Register setting items
    app.api.invoke('settings:register-items', [
        {
            key: EDITOR_CONFIG_KEYS.FONT_SIZE,
            type: 'number',
            label: 'Font Size',
            description: 'Editor font size in pixels',
            groupId: 'editor-typography',
            order: 10,
            min: 8,
            max: 32,
            defaultValue: EDITOR_CONFIG_DEFAULTS.fontSize
        },
        {
            key: EDITOR_CONFIG_KEYS.SHOW_LINE_NUMBERS,
            type: 'toggle',
            label: 'Show Line Numbers',
            description: 'Display line numbers in the gutter',
            groupId: 'editor-display',
            order: 10,
            defaultValue: EDITOR_CONFIG_DEFAULTS.showLineNumbers
        },
        {
            key: EDITOR_CONFIG_KEYS.WORD_WRAP,
            type: 'toggle',
            label: 'Word Wrap',
            description: 'Wrap long lines to fit the editor width',
            groupId: 'editor-display',
            order: 20,
            defaultValue: EDITOR_CONFIG_DEFAULTS.wordWrap
        }
    ]);
}
