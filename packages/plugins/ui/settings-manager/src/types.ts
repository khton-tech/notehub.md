/**
 * @fileoverview Settings Manager Type Definitions
 * 
 * This file defines the contract for the metadata-driven settings UI.
 * Plugins register their settings definitions using these types, and
 * the settings engine renders the appropriate UI components.
 * 
 * @module @notehub/settings-manager/types
 */

// ============================================================================
// Setting Type Discriminator
// ============================================================================

/**
 * Available setting input types.
 * 
 * - `toggle`: Boolean switch (on/off)
 * - `text`: Single-line text input
 * - `number`: Numeric input with optional min/max
 * - `select`: Dropdown selection from options
 * - `color`: Color picker input
 */
export type SettingType = 'toggle' | 'text' | 'number' | 'select' | 'color';

// ============================================================================
// Tab Definition
// ============================================================================

/**
 * Represents a top-level tab in the settings modal sidebar.
 * 
 * Tabs group related settings together (e.g., "Editor", "Files", "Appearance").
 * 
 * @example
 * ```typescript
 * const editorTab: SettingsTab = {
 *     id: 'editor',
 *     label: 'Editor',
 *     icon: 'edit-3',
 *     order: 10
 * };
 * ```
 */
export interface SettingsTab {
    /** Unique identifier for the tab (e.g., 'editor', 'files', 'appearance') */
    id: string;
    /** Display label shown in the sidebar (e.g., 'Editor') */
    label: string;
    /** Lucide icon name for the tab icon */
    icon: string;
    /** Sort order for tabs (lower = first) */
    order: number;
    /** Category for grouping in UI */
    category?: 'core' | 'custom';
}

// ============================================================================
// Group Definition
// ============================================================================

/**
 * Represents a collapsible section within a tab.
 * 
 * Groups organize settings within a tab into logical sections
 * (e.g., "Typography", "Behavior", "Save Options").
 * 
 * @example
 * ```typescript
 * const typographyGroup: SettingsGroup = {
 *     id: 'typography',
 *     tabId: 'editor',
 *     label: 'Typography',
 *     order: 10
 * };
 * ```
 */
export interface SettingsGroup {
    /** Unique identifier for the group (e.g., 'typography') */
    id: string;
    /** ID of the parent tab this group belongs to */
    tabId: string;
    /** Display label/title for the section header */
    label: string;
    /** Sort order within the tab (lower = first) */
    order: number;
}

// ============================================================================
// Setting Item Definition
// ============================================================================

/**
 * Represents an individual setting item that renders as a form field.
 * 
 * The `type` field determines which input component is rendered.
 * Additional fields provide type-specific configuration.
 * 
 * @example
 * ```typescript
 * const fontSizeSetting: SettingsItem = {
 *     key: 'editor.font-size',
 *     type: 'number',
 *     label: 'Font Size',
 *     description: 'Base font size for the editor (in pixels)',
 *     groupId: 'typography',
 *     order: 10,
 *     min: 8,
 *     max: 32
 * };
 * ```
 */
export interface SettingsItem {
    /** 
     * Configuration key in `config-manager` format.
     * Uses dot notation for namespacing (e.g., 'editor.font-size').
     */
    key: string;

    /** Input type that determines which component is rendered */
    type: SettingType;

    /** Display label for the setting */
    label: string;

    /** Optional description text shown below the label */
    description?: string;

    /** ID of the parent group this setting belongs to */
    groupId: string;

    /** Sort order within the group (lower = first) */
    order: number;

    // ========================================================================
    // Type-specific options
    // ========================================================================

    /** Options for 'select' type - array of label/value pairs */
    options?: Array<{ label: string; value: unknown }>;

    /** Minimum value for 'number' type */
    min?: number;

    /** Maximum value for 'number' type */
    max?: number;

    /** Step increment for 'number' type */
    step?: number;

    /** Placeholder text for 'text' type */
    placeholder?: string;

    /** Default value when config key is not set */
    defaultValue?: unknown;
}

// ============================================================================
// Nested Structure for Rendering
// ============================================================================

/**
 * Nested structure returned by `getStructure()` for rendering.
 * 
 * This structure is optimized for UI rendering with items
 * already sorted by their `order` field.
 */
export interface SettingsStructure {
    tabs: Array<SettingsTab & {
        customView?: React.FC<any>;
        groups: Array<SettingsGroup & {
            items: SettingsItem[];
        }>;
    }>;
}
