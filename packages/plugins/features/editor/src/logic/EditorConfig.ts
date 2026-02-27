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
    /** Tab size in spaces */
    TAB_SIZE: 'editor.tab-size',
    /** Auto-close brackets and quotes */
    AUTO_CLOSE_BRACKETS: 'editor.auto-close-brackets',
    /** Custom font family */
    FONT_FAMILY: 'editor.font-family',
    /** Format on save */
    FORMAT_ON_SAVE: 'editor.format-on-save',
    /** Auto-save file when contents change */
    AUTOSAVE: 'file.autosave',
    /** Auto-save delay in milliseconds */
    AUTOSAVE_DELAY: 'file.autosave-delay',
} as const;

/**
 * Editor settings interface.
 * Represents the current state of editor configuration.
 */
export interface EditorSettings {
    showLineNumbers: boolean;
    wordWrap: boolean;
    fontSize: number;
    tabSize: number;
    autoCloseBrackets: boolean;
    fontFamily: string;
    formatOnSave: boolean;
    autosave: boolean;
    autosaveDelay: number;
}

/**
 * Default values for editor settings.
 * Used when config values are not set in storage.
 */
export const EDITOR_CONFIG_DEFAULTS: EditorSettings = {
    showLineNumbers: true,
    wordWrap: true,
    fontSize: 16,
    tabSize: 4,
    autoCloseBrackets: true,
    fontFamily: "",
    formatOnSave: false,
    autosave: false,
    autosaveDelay: 1000,
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
        icon: 'edit',
        order: 10,
        category: 'core'
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

    // Register Behavior group
    app.api.invoke('settings:register-group', {
        id: 'editor-behavior',
        tabId: 'editor',
        label: 'Behavior',
        order: 30
    });

    // Register File Saving group
    app.api.invoke('settings:register-group', {
        id: 'editor-files',
        tabId: 'editor',
        label: 'Files & Saving',
        order: 40
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
            key: EDITOR_CONFIG_KEYS.FONT_FAMILY,
            type: 'select',
            label: 'Font Family',
            description: 'Choose your preferred programming font',
            groupId: 'editor-typography',
            order: 20,
            defaultValue: EDITOR_CONFIG_DEFAULTS.fontFamily,
            options: [
                { label: 'Default', value: '' },
                { label: 'JetBrains Mono', value: '"JetBrains Mono", monospace' },
                { label: 'Fira Code', value: '"Fira Code", monospace' },
                { label: 'Cascadia Code', value: '"Cascadia Code", "Cascadia Mono", monospace' },
                { label: 'Consolas', value: 'Consolas, monospace' },
                { label: 'Source Code Pro', value: '"Source Code Pro", monospace' },
                { label: 'Roboto Mono', value: '"Roboto Mono", monospace' },
                { label: 'SF Mono', value: '"SF Mono", "Apple Color Emoji", monospace' },
                { label: 'Courier New', value: '"Courier New", Courier, monospace' }
            ]
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
        },
        {
            key: EDITOR_CONFIG_KEYS.TAB_SIZE,
            type: 'number',
            label: 'Tab Size',
            description: 'Number of spaces per indentation level',
            groupId: 'editor-behavior',
            order: 10,
            min: 2,
            max: 8,
            step: 2,
            defaultValue: EDITOR_CONFIG_DEFAULTS.tabSize
        },
        {
            key: EDITOR_CONFIG_KEYS.AUTO_CLOSE_BRACKETS,
            type: 'toggle',
            label: 'Auto-Close Brackets',
            description: 'Automatically close brackets and quotes',
            groupId: 'editor-behavior',
            order: 20,
            defaultValue: EDITOR_CONFIG_DEFAULTS.autoCloseBrackets
        },
        {
            key: EDITOR_CONFIG_KEYS.FORMAT_ON_SAVE,
            type: 'toggle',
            label: 'Format on Save',
            description: 'Automatically format document when saving',
            groupId: 'editor-behavior',
            order: 30,
            defaultValue: EDITOR_CONFIG_DEFAULTS.formatOnSave
        },
        {
            key: EDITOR_CONFIG_KEYS.AUTOSAVE,
            type: 'toggle',
            label: 'Auto-Save',
            description: 'Automatically save files after changes',
            groupId: 'editor-files',
            order: 10,
            defaultValue: EDITOR_CONFIG_DEFAULTS.autosave
        },
        {
            key: EDITOR_CONFIG_KEYS.AUTOSAVE_DELAY,
            type: 'number',
            label: 'Auto-Save Delay (ms)',
            description: 'Delay before auto-saving after a change',
            groupId: 'editor-files',
            order: 20,
            min: 100,
            max: 10000,
            step: 100,
            defaultValue: EDITOR_CONFIG_DEFAULTS.autosaveDelay
        }
    ]);
}
