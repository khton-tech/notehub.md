/**
 * Context Menu Registry
 * 
 * Central registry that allows plugins to register menu providers for specific contexts.
 * When a context menu is triggered, all registered providers for that context are
 * invoked to collect menu items.
 */

import type { MenuItem, MenuProvider } from '../types';

/**
 * ContextMenuRegistry - Provider management for context menus
 * 
 * Plugins register providers with a contextId (e.g., 'explorer-item', 'editor-selection').
 * When a menu is triggered for that context, all providers are called to generate items.
 */
export class ContextMenuRegistry {
    /**
     * Map of contextId -> Set of providers
     * Using Set ensures each provider is registered only once per context
     */
    private providers: Map<string, Set<MenuProvider>> = new Map();

    /**
     * Register a menu provider for a specific context
     * 
     * @param contextId - Context identifier (e.g., 'explorer-item', 'tab-header')
     * @param provider - Function that generates menu items for this context
     * @returns Unsubscribe function to remove the provider
     * 
     * @example
     * ```ts
     * const unsubscribe = registry.register('explorer-item', (payload) => [
     *     { type: 'action', id: 'open', label: 'Open', onClick: () => open(payload.path) }
     * ]);
     * // Later...
     * unsubscribe();
     * ```
     */
    register(contextId: string, provider: MenuProvider): () => void {
        let providers = this.providers.get(contextId);

        if (!providers) {
            providers = new Set();
            this.providers.set(contextId, providers);
        }

        providers.add(provider);

        // Debug: log provider count after registration
        console.log(`[ContextMenuRegistry] Registered provider for "${contextId}", total: ${providers.size}`);

        // Return unsubscribe function
        return () => {
            const set = this.providers.get(contextId);
            if (set) {
                set.delete(provider);
                console.log(`[ContextMenuRegistry] Unregistered provider for "${contextId}", remaining: ${set.size}`);
                // Clean up empty sets
                if (set.size === 0) {
                    this.providers.delete(contextId);
                }
            }
        };
    }


    /**
     * Get all menu items for a context
     * 
     * Calls all registered providers for the given contextId, waits for
     * any async providers, and concatenates all items with separators
     * between different providers' items.
     * 
     * @param contextId - Context identifier
     * @param payload - Contextual data to pass to providers
     * @returns Promise resolving to array of menu items
     */
    async getItems(contextId: string, payload: any): Promise<MenuItem[]> {
        const providers = this.providers.get(contextId);

        if (!providers || providers.size === 0) {
            return [];
        }

        // Debug: log provider count
        if (providers.size > 1) {
            console.warn(`[ContextMenuRegistry] Multiple providers (${providers.size}) for context "${contextId}"`);
        }

        const allItems: MenuItem[] = [];
        const providerResults: MenuItem[][] = [];

        // Collect items from all providers (may be async)
        for (const provider of providers) {
            try {
                const items = await Promise.resolve(provider(payload));
                if (items && items.length > 0) {
                    providerResults.push(items);
                }
            } catch (error) {
                // Log error but continue with other providers
                console.error(`[ContextMenuRegistry] Provider error for context "${contextId}":`, error);
            }
        }

        // Concatenate with separators between providers
        providerResults.forEach((items, index) => {
            if (index > 0 && allItems.length > 0) {
                // Add separator between different providers' items
                allItems.push({ type: 'separator' });
            }
            allItems.push(...items);
        });

        return allItems;
    }


    /**
     * Check if any providers are registered for a context
     * 
     * @param contextId - Context identifier
     * @returns True if at least one provider is registered
     */
    hasProviders(contextId: string): boolean {
        const providers = this.providers.get(contextId);
        return providers !== undefined && providers.size > 0;
    }

    /**
     * Clear all registered providers
     * Used during plugin unload
     */
    clear(): void {
        this.providers.clear();
    }
}

/**
 * Singleton instance for use across the plugin
 */
export const contextMenuRegistry = new ContextMenuRegistry();
