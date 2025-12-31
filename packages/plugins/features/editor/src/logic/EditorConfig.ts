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
