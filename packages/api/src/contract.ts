/**
 * @fileoverview Central API Registry for Notehub.md
 * @module @notehub/api
 *
 * This file defines the complete API surface that plugins can expose
 * and consume. All API methods must be registered here to enable
 * strict typing and IntelliSense support.
 *
 * ## Architecture
 *
 * The `NotehubApiMap` is the "constitution" of the plugin ecosystem.
 * External plugins consume this for type-safe API invocations.
 *
 * @packageDocumentation
 */

import type { FC } from 'react';

// ============================================================================
// FS Types
// ============================================================================

/**
 * Directory entry from readDir
 */
export interface DirEntry {
    name: string;
    isDirectory: boolean;
    isFile: boolean;
}

/**
 * Options for directory creation
 */
export interface CreateDirOptions {
    recursive?: boolean;
}

/**
 * File system event for watchers
 */
export interface FsEvent {
    path: string;
    type: 'create' | 'modify' | 'remove' | 'any';
}

/**
 * File system driver interface
 */
export interface IFileSystem {
    readFile(path: string): Promise<Uint8Array>;
    readTextFile(path: string): Promise<string>;
    writeFile(path: string, data: Uint8Array): Promise<void>;
    writeTextFile(path: string, content: string): Promise<void>;
    createDir(path: string, options?: CreateDirOptions): Promise<void>;
    readDir(path: string): Promise<DirEntry[]>;
    exists(path: string): Promise<boolean>;
    pickDirectory(): Promise<string | null>;
    watch(path: string, onChange: (event: FsEvent) => void): Promise<() => void>;
    removeFile(path: string): Promise<void>;
    removeDir(path: string, options?: { recursive?: boolean }): Promise<void>;
    rename(oldPath: string, newPath: string): Promise<void>;
}

// ============================================================================
// Layout Types
// ============================================================================

/**
 * Active layout state
 */
export interface ActiveLayout {
    name: string;
    props: Record<string, unknown>;
}

/**
 * Zone item for the zone registry
 */
export interface ZoneItem {
    /** Controller component name to render */
    component: string;
    /** Priority for ordering (higher = rendered first) */
    priority: number;
}

/**
 * Available zone identifiers in the application layout.
 * Use these constants when registering components to zones.
 */
export enum ZoneId {
    /** Ribbon on the left side */
    RIBBON = 'ribbon',
    /** Left sidebar */
    SIDEBAR_LEFT = 'sidebar-left',
    /** Right panel */
    PANEL_RIGHT = 'panel-right',
    /** Tab bar in editor area */
    TABBAR = 'tabbar',
    /** Editor header area */
    EDITOR_HEADER = 'editor-header',
    /** Editor footer/status area */
    EDITOR_FOOTER = 'editor-footer',
    /** Status bar at the bottom */
    STATUS_BAR = 'status-bar',
    /** Title bar */
    TITLEBAR = 'titlebar',
}

// ============================================================================
// Editor Types
// ============================================================================

/**
 * Cursor position in the editor.
 * Uses 0-indexed line and column numbers.
 */
export interface EditorCursor {
    /** Line number (0-indexed) */
    line: number;
    /** Column/character offset within the line (0-indexed) */
    ch: number;
}

/**
 * Selection range in the editor.
 * Defines start and end positions of a text selection.
 */
export interface EditorSelectionRange {
    /** Selection start position */
    from: EditorCursor;
    /** Selection end position (exclusive) */
    to: EditorCursor;
}

// ============================================================================
// Theme Types
// ============================================================================

/**
 * Theme palette definition
 */
export interface ThemePalette {
    'bg-main': string;
    'bg-sidebar': string;
    'bg-surface': string;
    'bg-secondary': string;
    'bg-hover': string;
    'accent-primary': string;
    'accent-secondary': string;
    'border-accent': string;
    'border-secondary': string;
    'border-subtle': string;
    'text-primary': string;
    'text-secondary'?: string;
    'text-muted': string;
    'text-error'?: string;
    'button-text'?: string;
    'danger'?: string;
    'font-family': string;
    'font-family-mono'?: string;
    [key: string]: string | undefined;
}

// ============================================================================
// Settings Manager Types
// ============================================================================

/**
 * Available setting input types
 */
export type SettingTypeDef = 'toggle' | 'text' | 'number' | 'select' | 'color';

/**
 * Settings tab definition for API contract
 */
export interface SettingsTabDef {
    /** Unique identifier for the tab */
    id: string;
    /** Display label shown in the sidebar */
    label: string;
    /** Lucide icon name */
    icon: string;
    /** Sort order (lower = first) */
    order: number;
}

/**
 * Settings group definition for API contract
 */
export interface SettingsGroupDef {
    /** Unique identifier for the group */
    id: string;
    /** ID of the parent tab */
    tabId: string;
    /** Display label/title */
    label: string;
    /** Sort order within the tab */
    order: number;
}

/**
 * Settings item definition for API contract
 */
export interface SettingsItemDef {
    /** Configuration key (e.g., 'editor.font-size') */
    key: string;
    /** Input type */
    type: SettingTypeDef;
    /** Display label */
    label: string;
    /** Optional description text */
    description?: string;
    /** ID of the parent group */
    groupId: string;
    /** Sort order within the group */
    order: number;
    /** Options for 'select' type */
    options?: Array<{ label: string; value: unknown }>;
    /** Minimum value for 'number' type */
    min?: number;
    /** Maximum value for 'number' type */
    max?: number;
    /** Step for 'number' type */
    step?: number;
    /** Placeholder for 'text' type */
    placeholder?: string;
    /** Default value */
    defaultValue?: unknown;
}

// ============================================================================
// Context Menu Types
// ============================================================================

/**
 * Type discriminator for menu items
 */
export type MenuItemType = 'action' | 'submenu' | 'separator';

/**
 * Clickable menu action item
 */
export interface MenuAction {
    type: 'action';
    /** Unique identifier for the action */
    id: string;
    /** Display label */
    label: string;
    /** Lucide icon name (kebab-case) */
    icon?: string;
    /** CSS color value for styling, e.g., 'var(--nh-danger)' */
    color?: string;
    /** Whether the action is disabled */
    disabled?: boolean;
    /** Click handler, receives contextual payload */
    onClick: (payload: unknown) => void;
}

/**
 * Visual separator between menu groups
 */
export interface MenuSeparator {
    type: 'separator';
}

/**
 * Nested submenu with recursive items
 */
export interface SubMenu {
    type: 'submenu';
    /** Display label */
    label: string;
    /** Lucide icon name (kebab-case) */
    icon?: string;
    /** Nested menu items */
    items: MenuItem[];
}

/**
 * Union type for all menu item types
 */
export type MenuItem = MenuAction | MenuSeparator | SubMenu;

/**
 * Dynamic menu provider function
 *
 * Called when a context menu is triggered to generate items dynamically.
 * The payload contains contextual information (e.g., file path, selection).
 *
 * @param payload - Context-specific data passed from the trigger
 * @returns Array of menu items or Promise resolving to items
 */
export type MenuProvider = (payload: unknown) => MenuItem[] | Promise<MenuItem[]>;

// ============================================================================
// Command System Types
// ============================================================================

/**
 * Areas where a command can be displayed/triggered
 * - 'palette': Shown in the command palette (Mod+P)
 * - 'slash-menu': Shown in slash-menu inside editor
 * - 'global': Only accessible via hotkey, not listed anywhere
 */
export type CommandArea = 'palette' | 'slash-menu' | 'global';

/**
 * Command definition for registration
 */
export interface CommandDefinition {
    /** Unique identifier (e.g., 'editor:save', 'palette:open') */
    id: string;
    /** Human-readable name shown in UI */
    name: string;
    /** Handler function to execute */
    handler: () => void | Promise<void>;
    /** Where this command should be listed visually */
    areas?: CommandArea[];
    /** Required context for execution (e.g., 'editor', 'explorer'). If null/undefined, always active. */
    context?: string;
    /** Default keybinding (e.g., 'Mod+B', 'Mod+Shift+P') */
    defaultHotkey?: string;
}

/**
 * Command info returned for palette display
 */
export interface VisibleCommand {
    /** Command ID */
    id: string;
    /** Display name */
    name: string;
    /** Current hotkey (may differ from default if user customized) */
    hotkey?: string;
}

// ============================================================================
// Synapse Types (External Plugin Loader)
// ============================================================================

/**
 * Result of loading an external plugin
 */
export interface SynapseLoadResult {
    success: boolean;
    pluginId?: string;
    error?: string;
}

/**
 * Portal (inline widget) specification for editor registration
 */
export interface PortalSpec {
    /** Unique identifier for the portal */
    id: string;
    /** Regex pattern to match (must have global flag 'g') */
    regex: RegExp | string;
    /** React component to render for each match */
    component: FC<{ match: RegExpExecArray }>;
    /** Optional display name for debugging */
    name?: string;
}

// ============================================================================
// NotehubApiMap - The Central API Registry
// ============================================================================

/**
 * NotehubApiMap defines the complete type signature for all registered API methods.
 *
 * This interface is the "constitution" of the plugin ecosystem - all plugins
 * must adhere to these contracts when registering or invoking API methods.
 *
 * @example
 * ```typescript
 * // Type-safe API invocation
 * const config = await api.invoke('config:get', 'theme.current', 'dark');
 * //    ^? string | undefined
 *
 * // Type-safe API registration
 * api.register('logger:info', (source, message) => {
 *     console.info(`[${source}] ${message}`);
 * });
 * ```
 */
export interface NotehubApiMap {
    // =========================================================================
    // Core API Discovery (built-in)
    // =========================================================================

    /** Get list of all registered API method names */
    'api:list': () => string[];

    /** Check if an API method is registered */
    'api:has': (name: string) => boolean;

    /** Get detailed info about a registered API method */
    'api:info': (name: string) => {
        exists: boolean;
        hookCount: { before: number; after: number; around: number };
    };

    /** Get all registered methods with metadata */
    'api:list-with-metadata': () => Array<{
        name: string;
        hookCount: { before: number; after: number; around: number };
    }>;

    // =========================================================================
    // Logger Plugin (nh.system.logger)
    // =========================================================================

    /** Log a message with specified level */
    'logger:log': (level: string, source: string, message: string) => void;

    /** Log an INFO level message */
    'logger:info': (source: string, message: string) => void;

    /** Log a WARN level message */
    'logger:warn': (source: string, message: string) => void;

    /** Log an ERROR level message */
    'logger:error': (source: string, message: string) => void;

    // =========================================================================
    // Config Manager Plugin (nh.system.config-manager)
    // =========================================================================

    /** Get a configuration value by key */
    'config:get': <T = unknown>(key: string, defaultValue?: T) => T | undefined;

    /** Set a configuration value and persist to disk */
    'config:set': (key: string, value: unknown) => Promise<void>;

    /** Reload configuration from disk */
    'config:reload': () => Promise<void>;

    /** Delete a configuration value (and persist change) */
    'config:delete': (key: string) => Promise<void>;

    // =========================================================================
    // State Manager Plugin (nh.system.state-manager)
    // =========================================================================

    /** Store a value in runtime state */
    'state:set': (key: string, value: unknown) => void;

    /** Retrieve a value from runtime state */
    'state:get': <T = unknown>(key: string) => T | undefined;

    /** Delete a value from runtime state */
    'state:delete': (key: string) => boolean;

    /** Check if a key exists in state */
    'state:has': (key: string) => boolean;

    /** Get all keys in state */
    'state:keys': () => string[];

    /** Clear all state */
    'state:clear': () => void;

    /** Export entire state as object */
    'state:dump': () => Record<string, unknown>;

    /** Restore state from a dump object */
    'state:restore': (dump: Record<string, unknown>) => void;

    // =========================================================================
    // Context Manager Plugin (nh.system.context-manager)
    // =========================================================================

    /** Set a context value (for when clauses) */
    'context:set': (key: string, value: unknown) => void;

    /** Get a context value */
    'context:get': <T = unknown>(key: string) => T | undefined;

    /** Delete a context value */
    'context:delete': (key: string) => boolean;

    /** Evaluate a when clause expression (supports &&, ||, ==, !=, !) */
    'context:evaluate': (expression: string) => boolean;

    /** Get all context keys */
    'context:keys': () => string[];

    /** Subscribe to context changes for a key */
    'context:subscribe': (key: string, callback: (value: unknown) => void) => (() => void);

    /** Dump all context values */
    'context:dump': () => Record<string, unknown>;

    // =========================================================================
    // FS Manager Plugin (nh.system.fs-manager)
    // =========================================================================

    /** Register a file system driver */
    'fs:register-driver': (driver: IFileSystem, name?: string) => void;

    /** Read file as binary data */
    'fs:read-file': (path: string) => Promise<Uint8Array>;

    /** Read file as UTF-8 text */
    'fs:read-text-file': (path: string) => Promise<string>;

    /** Write binary data to file */
    'fs:write-file': (path: string, data: Uint8Array) => Promise<void>;

    /** Write text to file */
    'fs:write-text-file': (path: string, content: string) => Promise<void>;

    /** Create a directory */
    'fs:create-dir': (path: string, options?: CreateDirOptions) => Promise<void>;

    /** Read directory contents */
    'fs:read-dir': (path: string) => Promise<DirEntry[]>;

    /** Check if path exists */
    'fs:exists': (path: string) => Promise<boolean>;

    /** Open native directory picker */
    'fs:pick-directory': () => Promise<string | null>;

    /** Watch a path for changes */
    'fs:watch': (path: string, onChange: (event: FsEvent) => void) => Promise<() => void>;

    /** Remove a file */
    'fs:remove-file': (path: string) => Promise<void>;

    /** Remove a directory */
    'fs:remove-dir': (path: string, options?: { recursive?: boolean }) => Promise<void>;

    /** Rename/move a file or directory */
    'fs:rename': (oldPath: string, newPath: string) => Promise<void>;

    // =========================================================================
    // Layout Manager Plugin (nh.ui.layout-manager)
    // =========================================================================

    /** Register a layout component */
    'layout:register-component': (name: string, component: FC<Record<string, unknown>>) => void;

    /** Set the active layout */
    'layout:set': (name: string, props?: Record<string, unknown>) => boolean;

    /** Get current active layout info */
    'layout:get-active': () => ActiveLayout | null;

    /** List all registered layout names */
    'layout:list': () => string[];

    // =========================================================================
    // Zone System (part of Layout Manager)
    // =========================================================================

    /** Register a component in a zone */
    'zone:register': (zoneId: string, item: ZoneItem) => void;

    /** Get all items in a zone (sorted by priority) */
    'zone:get': (zoneId: string) => ZoneItem[];

    /** Clear all items in a zone */
    'zone:clear': (zoneId: string) => void;

    /**
     * Wait for a zone element to appear in the DOM.
     * Uses MutationObserver to efficiently wait for the element.
     * 
     * @param zoneId - Zone ID to wait for (matches data-nh-zone attribute)
     * @param timeout - Optional timeout in milliseconds (default: 5000)
     * @returns The HTMLElement when found, or null on timeout
     */
    'dom:wait-for-zone': (zoneId: string, timeout?: number) => Promise<HTMLElement | null>;

    // =========================================================================
    // Dialog Manager Plugin (nh.ui.dialog-manager)
    // =========================================================================

    /** Show an alert dialog */
    'dialog:alert': (title: string, message: string) => Promise<void>;

    /** Show a confirmation dialog */
    'dialog:confirm': (title: string, message: string) => Promise<boolean>;

    /** Show a prompt dialog */
    'dialog:prompt': (title: string, message: string, defaultValue?: string) => Promise<string | null>;

    // =========================================================================
    // Theme Manager Plugin (nh.ui.theme-manager)
    // =========================================================================

    /** Register a new theme */
    'theme:register': (name: string, palette: ThemePalette) => void;

    /** Set the active theme */
    'theme:set': (name: string) => Promise<boolean>;

    /** Get current theme name */
    'theme:get-current': () => string;

    /** List all registered theme names */
    'theme:list': () => string[];

    /** Get a theme palette by name */
    'theme:get': (name: string) => ThemePalette | undefined;

    // =========================================================================
    // Controllers Manager Plugin (nh.ui.controllers-manager)
    // =========================================================================

    /** Register a controller component */
    'controller:register': (name: string, component: FC<unknown>) => void;

    /** Unregister a controller component */
    'controller:unregister': (name: string) => boolean;

    /** Get a controller component by name */
    'controller:get': (name: string) => FC<unknown> | undefined;

    // =========================================================================
    // Icon Manager Plugin (nh.ui.icon-manager)
    // =========================================================================

    /** Register a custom icon */
    'icon:register': (name: string, component: React.ElementType) => void;

    /** Get an icon component by name */
    'icon:get': (name: string) => React.ElementType;

    // =========================================================================
    // Context Menu Plugin (nh.ui.context-menu)
    // =========================================================================

    /**
     * Register a context menu provider for a specific context
     * @param contextId - Context identifier (e.g., 'explorer-item')
     * @param provider - Menu provider function
     * @returns Unsubscribe function to remove the provider
     */
    'context-menu:register': (contextId: string, provider: MenuProvider) => () => void;

    /**
     * Trigger a context menu at the event's position
     * @param event - The original mouse event (for position)
     * @param contextId - Context identifier to get providers for
     * @param payload - Data to pass to providers
     */
    'context-menu:trigger': (event: MouseEvent, contextId: string, payload: unknown) => Promise<void>;

    // =========================================================================
    // Explorer Plugin (nh.features.explorer)
    // =========================================================================

    /** Open a folder in the explorer */
    'explorer:open': (path: string) => Promise<void>;

    /** Set the root path for the explorer */
    'explorer:set-root': (path: string) => Promise<void>;

    // =========================================================================
    // Shell Plugin (Host Capabilities)
    // =========================================================================

    /** Open a URL in the default browser */
    'shell:open': (url: string) => Promise<void>;

    // =========================================================================
    // Bootloader Plugin (nh.system.bootloader)
    // Note: Uses dot notation for legacy compatibility
    // =========================================================================

    /** Load a set of plugins with dependency resolution */
    'bootloader.load': (plugins: unknown[]) => Promise<unknown>;

    /** Get the result of the last load operation */
    'bootloader.getResult': () => unknown | null;

    /** Get the bootloader instance for advanced usage */
    'bootloader.getInstance': () => unknown | null;

    // =========================================================================
    // Vault Picker Plugin (nh.features.vault-picker)
    // =========================================================================

    /** Close the current vault and return to welcome screen */
    'vault:close': () => Promise<void>;

    // =========================================================================
    // Settings Manager Plugin (nh.ui.settings-manager)
    // =========================================================================

    /** Register a settings tab */
    'settings:register-tab': (tab: SettingsTabDef) => void;

    /** Register a settings group */
    'settings:register-group': (group: SettingsGroupDef) => void;

    /** Register a settings item */
    'settings:register-item': (item: SettingsItemDef) => void;

    /** Register multiple tabs at once */
    'settings:register-tabs': (tabs: SettingsTabDef[]) => void;

    /** Register multiple groups at once */
    'settings:register-groups': (groups: SettingsGroupDef[]) => void;

    /** Register multiple items at once */
    'settings:register-items': (items: SettingsItemDef[]) => void;

    /** Get the nested settings structure for rendering */
    'settings:get-structure': () => unknown;

    /** Open the settings modal */
    'settings:open': () => void;

    /** Close the settings modal */
    'settings:close': () => void;

    /** Toggle the settings modal */
    'settings:toggle': () => void;

    /** Unregister a settings tab */
    'settings:unregister-tab': (id: string) => void;

    /** Unregister a settings group */
    'settings:unregister-group': (id: string) => void;

    /** Unregister a settings item */
    'settings:unregister-item': (key: string) => void;

    /** Register a custom view for a tab */
    'settings:register-custom-view': (args: { tabId: string; view: FC<any> }) => void;

    // =========================================================================
    // Editor Plugin (nh.features.editor)
    // =========================================================================

    /** Register a portal (inline widget) */
    'editor:register-portal': (spec: PortalSpec) => void;

    /** Unregister a portal by ID */
    'editor:unregister-portal': (id: string) => void;

    /** Check if editor has unsaved changes */
    'editor:is-dirty': () => boolean;

    /** Open a file in the editor */
    'editor:open': (path: string) => Promise<void>;

    /** Get the path of the currently open file */
    'editor:get-active-path': () => string | null;

    // -------------------------------------------------------------------------
    // Text Manipulation API
    // -------------------------------------------------------------------------

    /** Get the full document content */
    'editor:get-content': () => string;

    /** Replace the entire document content */
    'editor:set-content': (content: string) => void;

    /** Get the current text selection (empty string if no selection) */
    'editor:get-selection': () => string;

    /** Replace the current selection with new text */
    'editor:replace-selection': (text: string) => void;

    /** Insert text at the current cursor position */
    'editor:insert-text': (text: string) => void;

    /** Get content of a specific line (0-indexed) */
    'editor:get-line': (lineNumber: number) => string;

    /** Get the total number of lines in the document */
    'editor:get-line-count': () => number;

    // -------------------------------------------------------------------------
    // Cursor API
    // -------------------------------------------------------------------------

    /** Get the current cursor position */
    'editor:get-cursor': () => EditorCursor;

    /** Set the cursor position */
    'editor:set-cursor': (pos: EditorCursor) => void;

    /** Get the current selection range */
    'editor:get-selection-range': () => EditorSelectionRange;

    /** Set the selection range */
    'editor:set-selection-range': (range: EditorSelectionRange) => void;

    // -------------------------------------------------------------------------
    // Unsafe / Advanced API
    // -------------------------------------------------------------------------

    /**
     * UNSAFE: Get direct access to CodeMirror EditorView.
     * @warning This API may break in future versions. Use at your own risk.
     * @returns The EditorView instance or null if no editor is mounted
     */
    'editor:unsafe_get-view': () => unknown | null;

    // =========================================================================
    // Synapse Plugin (nh.system.synapse) - External Plugin Loader
    // =========================================================================

    /**
     * Load an external plugin from a path
     * @param pluginPath - Absolute path to the plugin directory
     * @returns Result object with success status and plugin ID or error
     */
    'synapse:load-plugin': (pluginPath: string) => Promise<SynapseLoadResult>;

    /**
     * Unload an external plugin by ID
     * @param pluginId - ID of the plugin to unload
     * @returns true if successfully unloaded
     */
    'synapse:unload-plugin': (pluginId: string) => Promise<boolean>;

    /**
     * List all currently loaded external plugin IDs
     * @returns Array of plugin IDs
     */
    /**
     * List all currently loaded external plugin IDs
     * @returns Array of plugin IDs
     */
    'synapse:list-plugins': () => string[];

    /**
     * Get detailed metadata for all loaded plugins
     * @returns Array of plugin metadata objects
     */
    'synapse:get-details': () => unknown[];

    // =========================================================================
    // Command Manager Plugin (nh.system.command-manager)
    // =========================================================================

    /**
     * Register a command
     * @param def - Command definition object
     */
    'command:register': (def: CommandDefinition) => void;

    /**
     * Get all registered commands
     * @returns Array of all command definitions
     */
    'command:get-all': () => CommandDefinition[];

    /**
     * Execute a command by ID
     * @param id - Command ID to execute
     * @returns Promise that resolves when command completes
     */
    'command:execute': (id: string) => Promise<void>;

    /**
     * Set the active command context
     * @param context - Context identifier (e.g., 'editor', 'explorer', 'global')
     */
    'command:set-context': (context: string) => void;

    /**
     * Get commands visible for the current context
     * @returns Array of visible commands for the palette
     */
    'command:get-visible': () => VisibleCommand[];

    /**
     * Register a keybinding for a command
     * @param commandId - ID of the command
     * @param hotkey - Hotkey string (e.g. "Mod+S")
     */
    'keymap:register-binding': (commandId: string, hotkey: string) => void;

    /**
     * Bind a hotkey to a command (overwrites existing bindings)
     * @param commandId - ID of the command
     * @param hotkey - Hotkey string
     */
    'keymap:bind': (commandId: string, hotkey: string) => Promise<void>;

    /**
     * Add an additional binding for a command
     * @param commandId - ID of the command
     * @param hotkey - Hotkey string to add
     */
    'keymap:add-binding': (commandId: string, hotkey: string) => Promise<void>;

    /**
     * Remove a specific binding from a command
     * @param commandId - ID of the command
     * @param hotkey - Hotkey string to remove
     */
    'keymap:remove-binding': (commandId: string, hotkey: string) => Promise<void>;

    /**
     * Reset a command's bindings to defaults
     * @param commandId - ID of the command
     */
    'keymap:reset': (commandId: string) => Promise<void>;

    /**
     * Get the primary binding for a command
     * @param commandId - ID of the command
     * @returns First hotkey or undefined
     */
    'keymap:get-binding': (commandId: string) => string | undefined;

    /**
     * Get all bindings for a command
     * @param commandId - ID of the command
     * @returns Array of hotkey strings
     */
    'keymap:get-bindings': (commandId: string) => string[];

    // =========================================================================
    // TitleBar Plugin (nh.system.titlebar)
    // =========================================================================

    /** Set the title bar title */
    'titlebar:set-title': (title: string) => void;

    /** Set the title bar icon (Lucide icon name or null to clear) */
    'titlebar:set-icon': (icon: string | null) => void;

    /** Get the current title bar title */
    'titlebar:get-title': () => string;
}

// ============================================================================
// Helper Types for Plugin Development
// ============================================================================

/**
 * All registered API method names
 */
export type ApiMethodName = keyof NotehubApiMap;

/**
 * Get the parameter types for an API method
 *
 * @example
 * ```typescript
 * type LoggerArgs = ApiMethodArgs<'logger:info'>;
 * //   ^? [source: string, message: string]
 * ```
 */
export type ApiMethodArgs<K extends ApiMethodName> = Parameters<NotehubApiMap[K]>;

/**
 * Get the return type for an API method
 *
 * @example
 * ```typescript
 * type ConfigResult = ApiMethodResult<'config:get'>;
 * //   ^? unknown | undefined
 * ```
 */
export type ApiMethodResult<K extends ApiMethodName> = ReturnType<NotehubApiMap[K]>;

/**
 * Get the awaited return type for an API method (unwraps Promise)
 *
 * @example
 * ```typescript
 * type FileContent = ApiMethodAwaitedResult<'fs:read-text-file'>;
 * //   ^? string
 * ```
 */
export type ApiMethodAwaitedResult<K extends ApiMethodName> = Awaited<ReturnType<NotehubApiMap[K]>>;
