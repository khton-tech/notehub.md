/**
 * @fileoverview Settings Registry - Central store for settings definitions
 * 
 * This singleton class stores all registered settings tabs, groups, and items.
 * Plugins register their settings here, and the SettingsModal reads from it.
 * 
 * @module @notehub/settings-manager/logic/SettingsRegistry
 */

import type { SettingsTab, SettingsGroup, SettingsItem, SettingsStructure } from '../types';

/**
 * SettingsRegistry - Singleton registry for settings metadata
 * 
 * Stores tabs, groups, and items separately and provides a method
 * to retrieve them as a nested structure for rendering.
 */
export class SettingsRegistry {
    // ========================================================================
    // Singleton Pattern
    // ========================================================================

    private static instance: SettingsRegistry | null = null;

    /**
     * Get the singleton instance of SettingsRegistry
     */
    static getInstance(): SettingsRegistry {
        if (!SettingsRegistry.instance) {
            SettingsRegistry.instance = new SettingsRegistry();
        }
        return SettingsRegistry.instance;
    }

    /**
     * Reset the singleton instance (for testing)
     */
    static resetInstance(): void {
        SettingsRegistry.instance = null;
    }

    // ========================================================================
    // Internal Storage
    // ========================================================================

    private tabs: Map<string, SettingsTab> = new Map();
    private groups: Map<string, SettingsGroup> = new Map();
    private items: Map<string, SettingsItem> = new Map();
    private customViews: Map<string, React.FC<any>> = new Map();

    /** Listeners for structure changes */
    private listeners: Set<() => void> = new Set();

    private constructor() {
        // Private constructor enforces singleton pattern
    }

    // ========================================================================
    // Registration Methods
    // ========================================================================

    /**
     * Register a settings tab
     * 
     * @param tab - Tab definition to register
     * @throws If a tab with the same ID already exists
     */
    registerTab(tab: SettingsTab): void {
        if (this.tabs.has(tab.id)) {
            console.warn(`[SettingsRegistry] Tab "${tab.id}" already registered, overwriting`);
        }
        this.tabs.set(tab.id, tab);
        this.notifyListeners();
    }

    /**
     * Register a settings group
     * 
     * @param group - Group definition to register
     * @throws If the parent tab doesn't exist
     */
    registerGroup(group: SettingsGroup): void {
        if (this.groups.has(group.id)) {
            console.warn(`[SettingsRegistry] Group "${group.id}" already registered, overwriting`);
        }
        this.groups.set(group.id, group);
        this.notifyListeners();
    }

    /**
     * Register a settings item
     * 
     * @param item - Item definition to register
     */
    registerItem(item: SettingsItem): void {
        if (this.items.has(item.key)) {
            console.warn(`[SettingsRegistry] Item "${item.key}" already registered, overwriting`);
        }
        this.items.set(item.key, item);
        this.notifyListeners();
    }

    /**
     * Register a custom view for a tab
     * 
     * @param tabId - ID of the tab to replace with custom view
     * @param view - React component definition
     */
    registerCustomView(tabId: string, view: React.FC<any>): void {
        if (this.customViews.has(tabId)) {
            console.warn(`[SettingsRegistry] Custom view for tab "${tabId}" already registered, overwriting`);
        }
        this.customViews.set(tabId, view);
        this.notifyListeners();
    }

    // ========================================================================
    // Bulk Registration
    // ========================================================================

    /**
     * Register multiple tabs at once
     */
    registerTabs(tabs: SettingsTab[]): void {
        for (const tab of tabs) {
            this.registerTab(tab);
        }
    }

    /**
     * Register multiple groups at once
     */
    registerGroups(groups: SettingsGroup[]): void {
        for (const group of groups) {
            this.registerGroup(group);
        }
    }

    /**
     * Register multiple items at once
     */
    registerItems(items: SettingsItem[]): void {
        for (const item of items) {
            this.registerItem(item);
        }
    }

    // ========================================================================
    // Structure Retrieval
    // ========================================================================

    /**
     * Get the nested structure for rendering
     * 
     * Returns tabs sorted by order, each containing groups sorted by order,
     * each containing items sorted by order.
     */
    getStructure(): SettingsStructure {
        // Sort tabs by order
        const sortedTabs = Array.from(this.tabs.values())
            .sort((a, b) => a.order - b.order);

        // Build nested structure
        const structure: SettingsStructure = {
            tabs: sortedTabs.map(tab => {
                // Get groups for this tab, sorted by order
                const tabGroups = Array.from(this.groups.values())
                    .filter(group => group.tabId === tab.id)
                    .sort((a, b) => a.order - b.order);

                return {
                    ...tab,
                    groups: tabGroups.map(group => {
                        // Get items for this group, sorted by order
                        const groupItems = Array.from(this.items.values())
                            .filter(item => item.groupId === group.id)
                            .sort((a, b) => a.order - b.order);

                        return {
                            ...group,
                            items: groupItems
                        };
                    })
                };
            })
        };

        return structure;
    }

    // ========================================================================
    // Accessors
    // ========================================================================

    /**
     * Get a tab by ID
     */
    getTab(id: string): SettingsTab | undefined {
        return this.tabs.get(id);
    }

    /**
     * Get a group by ID
     */
    getGroup(id: string): SettingsGroup | undefined {
        return this.groups.get(id);
    }

    /**
     * Get an item by key
     */
    getItem(key: string): SettingsItem | undefined {
        return this.items.get(key);
    }

    /**
     * Get all registered tabs
     */
    getAllTabs(): SettingsTab[] {
        return Array.from(this.tabs.values());
    }

    /**
     * Get all registered groups
     */
    getAllGroups(): SettingsGroup[] {
        return Array.from(this.groups.values());
    }

    /**
     * Get all registered items
     */
    getAllItems(): SettingsItem[] {
        return Array.from(this.items.values());
    }

    /**
     * Get custom view for a tab
     */
    getCustomView(tabId: string): React.FC<any> | undefined {
        return this.customViews.get(tabId);
    }

    // ========================================================================
    // Unregistration
    // ========================================================================

    /**
     * Unregister a tab and all its groups/items
     */
    unregisterTab(tabId: string): void {
        // Remove associated groups and their items
        for (const [groupId, group] of this.groups) {
            if (group.tabId === tabId) {
                this.unregisterGroup(groupId);
            }
        }
        this.tabs.delete(tabId);
        this.notifyListeners();
    }

    /**
     * Unregister a group and all its items
     */
    unregisterGroup(groupId: string): void {
        // Remove associated items
        for (const [key, item] of this.items) {
            if (item.groupId === groupId) {
                this.items.delete(key);
            }
        }
        this.groups.delete(groupId);
        this.notifyListeners();
    }

    /**
     * Unregister a setting item by key
     */
    unregisterItem(key: string): void {
        this.items.delete(key);
        this.notifyListeners();
    }

    /**
     * Clear all registered settings
     */
    clear(): void {
        this.tabs.clear();
        this.groups.clear();
        this.items.clear();
        this.customViews.clear();
        this.notifyListeners();
    }

    // ========================================================================
    // Change Notification
    // ========================================================================

    /**
     * Subscribe to structure changes
     */
    subscribe(listener: () => void): () => void {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }

    private notifyListeners(): void {
        for (const listener of this.listeners) {
            listener();
        }
    }
}

// Export singleton accessor for convenience
export const getSettingsRegistry = (): SettingsRegistry => SettingsRegistry.getInstance();
