/**
 * @fileoverview Central API registry for Notehub.md
 * 
 * This file defines the complete API surface that plugins can expose
 * and consume. All API methods must be registered here to enable
 * strict typing and IntelliSense support.
 * 
 * @module @notehub/core/api/contract
 */

import type { FC } from 'react';

// ============================================================================
// FS Types (re-declared for contract independence)
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
    // Explorer Plugin (nh.features.explorer)
    // =========================================================================

    /** Open a folder in the explorer */
    'explorer:open': (path: string) => Promise<void>;

    /** Set the root path for the explorer */
    'explorer:set-root': (path: string) => Promise<void>;

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
