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
export async function registerEditorSettings(app: NotehubCore): Promise<void> {
    const t = (key: string) => app.api.invoke<string>('i18n:t', key);

    const tabLabel = await t('editor.settings.tab') || 'Editor';
    const groupTypography = await t('editor.settings.groups.typography') || 'Typography';
    const groupDisplay = await t('editor.settings.groups.display') || 'Display';
    const groupBehavior = await t('editor.settings.groups.behavior') || 'Behavior';

    // Register Editor tab
    app.api.invoke('settings:register-tab', {
        id: 'editor',
        label: tabLabel,
        icon: 'edit',
        order: 10,
        category: 'core'
    });

    // Register Typography group
    app.api.invoke('settings:register-group', {
        id: 'editor-typography',
        tabId: 'editor',
        label: groupTypography,
        order: 10
    });

    // Register Display group
    app.api.invoke('settings:register-group', {
        id: 'editor-display',
        tabId: 'editor',
        label: groupDisplay,
        order: 20
    });

    // Register Behavior group
    app.api.invoke('settings:register-group', {
        id: 'editor-behavior',
        tabId: 'editor',
        label: groupBehavior,
        order: 30
    });

    // Fetch localized items
    const fsLabel = await t('editor.settings.items.fontSize.label') || 'Font Size';
    const fsDesc = await t('editor.settings.items.fontSize.description') || 'Editor font size in pixels';

    const fFamLabel = await t('editor.settings.items.fontFamily.label') || 'Font Family';
    const fFamDesc = await t('editor.settings.items.fontFamily.description') || 'Choose your preferred programming font';
    const fFamDefOpt = await t('editor.settings.items.fontFamily.options.default') || 'Default';

    const slnLabel = await t('editor.settings.items.showLineNumbers.label') || 'Show Line Numbers';
    const slnDesc = await t('editor.settings.items.showLineNumbers.description') || 'Display line numbers in the gutter';

    const wwLabel = await t('editor.settings.items.wordWrap.label') || 'Word Wrap';
    const wwDesc = await t('editor.settings.items.wordWrap.description') || 'Wrap long lines to fit the editor width';

    const tsLabel = await t('editor.settings.items.tabSize.label') || 'Tab Size';
    const tsDesc = await t('editor.settings.items.tabSize.description') || 'Number of spaces per indentation level';

    const acbLabel = await t('editor.settings.items.autoCloseBrackets.label') || 'Auto-Close Brackets';
    const acbDesc = await t('editor.settings.items.autoCloseBrackets.description') || 'Automatically close brackets and quotes';

    const fosLabel = await t('editor.settings.items.formatOnSave.label') || 'Format on Save';
    const fosDesc = await t('editor.settings.items.formatOnSave.description') || 'Automatically format document when saving';

    // Register setting items
    app.api.invoke('settings:register-items', [
        {
            key: EDITOR_CONFIG_KEYS.FONT_SIZE,
            type: 'number',
            label: fsLabel,
            description: fsDesc,
            groupId: 'editor-typography',
            order: 10,
            min: 8,
            max: 32,
            defaultValue: EDITOR_CONFIG_DEFAULTS.fontSize
        },
        {
            key: EDITOR_CONFIG_KEYS.FONT_FAMILY,
            type: 'select',
            label: fFamLabel,
            description: fFamDesc,
            groupId: 'editor-typography',
            order: 20,
            defaultValue: EDITOR_CONFIG_DEFAULTS.fontFamily,
            options: [
                { label: fFamDefOpt, value: '' },
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
            label: slnLabel,
            description: slnDesc,
            groupId: 'editor-display',
            order: 10,
            defaultValue: EDITOR_CONFIG_DEFAULTS.showLineNumbers
        },
        {
            key: EDITOR_CONFIG_KEYS.WORD_WRAP,
            type: 'toggle',
            label: wwLabel,
            description: wwDesc,
            groupId: 'editor-display',
            order: 20,
            defaultValue: EDITOR_CONFIG_DEFAULTS.wordWrap
        },
        {
            key: EDITOR_CONFIG_KEYS.TAB_SIZE,
            type: 'number',
            label: tsLabel,
            description: tsDesc,
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
            label: acbLabel,
            description: acbDesc,
            groupId: 'editor-behavior',
            order: 20,
            defaultValue: EDITOR_CONFIG_DEFAULTS.autoCloseBrackets
        },
        {
            key: EDITOR_CONFIG_KEYS.FORMAT_ON_SAVE,
            type: 'toggle',
            label: fosLabel,
            description: fosDesc,
            groupId: 'editor-behavior',
            order: 30,
            defaultValue: EDITOR_CONFIG_DEFAULTS.formatOnSave
        }
    ]);
}
