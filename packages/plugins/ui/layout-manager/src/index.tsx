import { SystemPlugin } from '@notehub/core';
import type { PluginManifest, NotehubCore, ZoneItem, WorkspaceViewConfig, StatusBarItemConfig } from '@notehub/core';
import { useSyncExternalStore, type FC } from 'react';
import { WelcomeLayout } from './components/WelcomeLayout.js';
import { EditorLayout } from './components/EditorLayout.js';
import { WindowController } from './logic/WindowController.js';

/**
 * Layout component type definition
 */
export type LayoutComponent = FC<Record<string, unknown>>;

/**
 * Active layout state
 */
interface ActiveLayout {
    name: string;
    props: Record<string, unknown>;
}

// Re-export ZoneItem type for convenience
export type { ZoneItem } from '@notehub/core';

// =============== Layout Store (Module-level State) ===============

/** Registry of available layouts */
const layoutRegistry = new Map<string, LayoutComponent>();

/** Currently active layout */
let activeLayout: ActiveLayout | null = null;

/** Subscribers for layout state changes */
const layoutSubscribers = new Set<() => void>();

// =============== Zone Store (Module-level State) ===============

/** Zone registry: zoneId -> array of items */
const zoneRegistry = new Map<string, ZoneItem[]>();

/** Subscribers for zone state changes */
const zoneSubscribers = new Set<() => void>();

/** Zone version for tracking changes (used by useSyncExternalStore) */
let zoneVersion = 0;

// =============== Workspace View Store ===============

/** Registry of workspace views */
const viewRegistry = new Map<string, WorkspaceViewConfig>();

/** Set of currently visible view IDs */
const visibleViews = new Set<string>();

// =============== Status Bar Store ===============

/** Registry of status bar items */
const statusBarRegistry = new Map<string, StatusBarItemConfig>();

/**
 * Notify all layout subscribers of state change
 */
function notifyLayoutSubscribers(): void {
    for (const callback of layoutSubscribers) {
        callback();
    }
}

/**
 * Notify all zone subscribers of state change
 */
function notifyZoneSubscribers(): void {
    zoneVersion++;
    for (const callback of zoneSubscribers) {
        callback();
    }
}

/**
 * Subscribe to layout state changes
 */
function subscribeLayout(callback: () => void): () => void {
    layoutSubscribers.add(callback);
    return () => {
        layoutSubscribers.delete(callback);
    };
}

/**
 * Subscribe to zone state changes
 */
function subscribeZone(callback: () => void): () => void {
    zoneSubscribers.add(callback);
    return () => {
        zoneSubscribers.delete(callback);
    };
}

/**
 * Get current layout state snapshot
 */
function getLayoutSnapshot(): ActiveLayout | null {
    return activeLayout;
}

/**
 * Get zone version snapshot (for triggering re-renders)
 */
function getZoneSnapshot(): number {
    return zoneVersion;
}

/** Reference to kernel (module-level for component access) */
let appInstance: NotehubCore | null = null;

// =============== LayoutRenderer Component ===============

/**
 * LayoutRenderer - React component that renders the active layout
 *
 * This component should be placed in the host application's root.
 * It automatically updates when the active layout changes.
 *
 * @example
 * ```tsx
 * import { LayoutRenderer } from '@notehub/layout-manager';
 *
 * function App() {
 *   return <LayoutRenderer />;
 * }
 * ```
 */
export const LayoutRenderer: FC = () => {
    const currentLayout = useSyncExternalStore(
        subscribeLayout,
        getLayoutSnapshot,
        getLayoutSnapshot
    );

    if (!currentLayout) {
        return null;
    }

    const Component = layoutRegistry.get(currentLayout.name);

    if (!Component) {
        console.warn(`[LayoutManager] Layout "${currentLayout.name}" not found in registry`);
        return null;
    }

    // Inject app instance into layout component
    return <Component {...currentLayout.props} app={appInstance} />;
};

// =============== ZoneRenderer Component ===============

/**
 * Props for ZoneRenderer component
 */
export interface ZoneRendererProps {
    /** Zone ID to render */
    name: string;
    /** Optional CSS class for the container */
    className?: string;
    /** Optional inline styles for the container */
    style?: React.CSSProperties;
}

/**
 * ZoneRenderer - React component that renders all items in a zone
 *
 * Fetches items from the zone registry, sorts by priority (descending),
 * and renders each using the Controller component from controllers-manager.
 *
 * @example
 * ```tsx
 * // In EditorLayout
 * <div className="sidebar">
 *   <ZoneRenderer name="sidebar-left" />
 * </div>
 * ```
 */
export const ZoneRenderer: FC<ZoneRendererProps> = ({ name, className, style }) => {
    // Subscribe to zone changes to trigger re-render
    useSyncExternalStore(
        subscribeZone,
        getZoneSnapshot,
        getZoneSnapshot
    );

    // Get items for this zone
    const items = zoneRegistry.get(name) ?? [];

    // Sort by priority (higher priority = rendered first/top)
    const sortedItems = [...items].sort((a, b) => b.priority - a.priority);

    if (sortedItems.length === 0) {
        return null;
    }

    // Get the Controller component from the registry
    const Controller = appInstance?.api.invoke('controller:get', 'Controller') as FC<{ type: string }> | undefined;

    if (!Controller) {
        // Fallback: render items directly by invoking controller:get for each
        return (
            <div className={className} style={style} data-nh-zone={name}>
                {sortedItems.map((item, index) => {
                    const Component = appInstance?.api.invoke('controller:get', item.component) as FC | undefined;
                    if (!Component) {
                        console.warn(`[ZoneRenderer] Component "${item.component}" not found in controller registry`);
                        return null;
                    }
                    return <Component key={`${item.component}-${index}`} />;
                })}
            </div>
        );
    }

    return (
        <div className={className} style={style} data-nh-zone={name}>
            {sortedItems.map((item, index) => (
                <Controller key={`${item.component}-${index}`} type={item.component} />
            ))}
        </div>
    );
};

// =============== Plugin Implementation ===============

/**
 * LayoutManagerPlugin - Layout and screen management with Zone system
 *
 * Manages application layouts as React components and provides a zone-based
 * architecture for flexible UI composition.
 *
 * API Methods:
 * - `layout:register-component` - Register a React component as a layout
 * - `layout:set` - Set the active layout
 * - `layout:get-active` - Get current layout info
 * - `layout:list` - List all registered layouts
 * - `zone:register` - Register a component in a zone
 * - `zone:get` - Get all items in a zone
 * - `zone:clear` - Clear all items in a zone
 *
 * Events:
 * - `layout:changed` - Emitted when active layout changes
 * - `zone:updated` - Emitted when a zone is updated
 */
export class LayoutManagerPlugin extends SystemPlugin {
    readonly manifest: PluginManifest = {
        id: 'nh.ui.layout-manager',
        name: 'LayoutManager',
        version: '0.0.0',
        type: 'ui',
    };

    private windowController: WindowController | null = null;

    // =============== Layout API Method Handlers ===============

    /**
     * Register a layout component
     * @param name - Unique layout identifier
     * @param component - React component to render
     */
    private handleRegisterComponent = (name: string, component: LayoutComponent): void => {
        if (layoutRegistry.has(name)) {
            this.log('warn', `Layout "${name}" already registered, overwriting`);
        }

        layoutRegistry.set(name, component);
        this.log('info', `Layout "${name}" registered`);
    };

    /**
     * Set the active layout
     * @param name - Layout identifier to activate
     * @param props - Optional props to pass to the layout component
     */
    private handleSetLayout = (name: string, props: Record<string, unknown> = {}): boolean => {
        if (!layoutRegistry.has(name)) {
            this.log('error', `Layout "${name}" not found`);
            return false;
        }

        activeLayout = { name, props };
        notifyLayoutSubscribers();

        this.app.events.emit('layout:changed', { name, props });

        this.log('info', `Active layout set to "${name}"`);
        return true;
    };

    /**
     * Get current active layout info
     */
    private handleGetActiveLayout = (): ActiveLayout | null => {
        return activeLayout;
    };

    /**
     * List all registered layout names
     */
    private handleListLayouts = (): string[] => {
        return Array.from(layoutRegistry.keys());
    };

    // =============== Zone API Method Handlers ===============

    /**
     * Register a component in a zone
     * @param zoneId - Unique zone identifier (e.g., 'sidebar-left', 'status-bar')
     * @param item - Zone item with component name and priority
     */
    private handleZoneRegister = (zoneId: string, item: ZoneItem): void => {
        const items = zoneRegistry.get(zoneId) ?? [];

        // Check if component already exists in zone
        const existingIndex = items.findIndex(i => i.component === item.component);
        if (existingIndex >= 0) {
            // Update existing item
            items[existingIndex] = item;
            this.log('info', `Zone "${zoneId}": Updated "${item.component}" with priority ${item.priority}`);
        } else {
            // Add new item
            items.push(item);
            this.log('info', `Zone "${zoneId}": Registered "${item.component}" with priority ${item.priority}`);
        }

        zoneRegistry.set(zoneId, items);
        notifyZoneSubscribers();

        this.app.events.emit('zone:updated', { zoneId, items });
    };

    /**
     * Get all items in a zone (sorted by priority, descending)
     * @param zoneId - Zone identifier
     */
    private handleZoneGet = (zoneId: string): ZoneItem[] => {
        const items = zoneRegistry.get(zoneId) ?? [];
        return [...items].sort((a, b) => b.priority - a.priority);
    };

    /**
     * Clear all items in a zone
     * @param zoneId - Zone identifier
     */
    private handleZoneClear = (zoneId: string): void => {
        if (zoneRegistry.has(zoneId)) {
            zoneRegistry.delete(zoneId);
            notifyZoneSubscribers();
            this.log('info', `Zone "${zoneId}" cleared`);

            this.app.events.emit('zone:updated', { zoneId, items: [] });
        }
    };

    // =============== DOM Utility API Method Handlers ===============

    /**
     * Wait for a zone element to appear in the DOM
     * @param zoneId - Zone ID to wait for (matches data-nh-zone attribute)
     * @param timeout - Optional timeout in milliseconds (default: 5000)
     * @returns The HTMLElement when found, or null on timeout
     */
    private handleWaitForZone = (zoneId: string, timeout: number = 5000): Promise<HTMLElement | null> => {
        return new Promise((resolve) => {
            // Check if element already exists
            const existing = document.querySelector(`[data-nh-zone="${zoneId}"]`) as HTMLElement | null;
            if (existing) {
                this.log('info', `Zone "${zoneId}" already exists in DOM`);
                resolve(existing);
                return;
            }

            // Set up timeout
            const timeoutId = setTimeout(() => {
                observer.disconnect();
                this.log('warn', `Timeout waiting for zone "${zoneId}"`);
                resolve(null);
            }, timeout);

            // Use MutationObserver to wait for element
            const observer = new MutationObserver((mutations) => {
                for (const mutation of mutations) {
                    if (mutation.type === 'childList') {
                        for (const node of mutation.addedNodes) {
                            if (node instanceof HTMLElement) {
                                // Check the node itself
                                if (node.getAttribute('data-nh-zone') === zoneId) {
                                    clearTimeout(timeoutId);
                                    observer.disconnect();
                                    this.log('info', `Zone "${zoneId}" found in DOM`);
                                    resolve(node);
                                    return;
                                }
                                // Check children of the added node
                                const child = node.querySelector(`[data-nh-zone="${zoneId}"]`) as HTMLElement | null;
                                if (child) {
                                    clearTimeout(timeoutId);
                                    observer.disconnect();
                                    this.log('info', `Zone "${zoneId}" found in DOM`);
                                    resolve(child);
                                    return;
                                }
                            }
                        }
                    }
                }
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        });
    };

    // =============== Plugin Lifecycle ===============

    /**
     * Load the plugin
     */
    protected async onLoad(): Promise<void> {
        appInstance = this.app;
        this.log('info', 'Loading...');

        // Register Layout API methods
        this.registerApi('layout:register-component', this.handleRegisterComponent);
        this.registerApi('layout:set', this.handleSetLayout);
        this.registerApi('layout:get-active', this.handleGetActiveLayout);
        this.registerApi('layout:list', this.handleListLayouts);

        // Register Zone API methods
        this.registerApi('zone:register', this.handleZoneRegister);
        this.registerApi('zone:get', this.handleZoneGet);
        this.registerApi('zone:clear', this.handleZoneClear);

        // Register DOM utility API methods
        this.registerApi('dom:wait-for-zone', this.handleWaitForZone);

        // Register Workspace View API methods
        this.registerApi('workspace:register-view', (config: WorkspaceViewConfig) => {
            if (!config?.id || !config.component) {
                this.log('warn', 'Invalid workspace view config');
                return;
            }
            viewRegistry.set(config.id, config);
            this.log('info', `Registered workspace view: ${config.id}`);
        });

        this.registerApi('workspace:unregister-view', (viewId: string) => {
            if (viewRegistry.delete(viewId)) {
                // Also hide it if visible
                if (visibleViews.has(viewId)) {
                    visibleViews.delete(viewId);
                    // Remove from zone
                    const items = zoneRegistry.get(viewRegistry.get(viewId)?.defaultLocation ?? '') ?? [];
                    const filtered = items.filter(i => i.component !== viewId);
                    if (filtered.length > 0) {
                        zoneRegistry.set(viewRegistry.get(viewId)?.defaultLocation ?? '', filtered);
                    }
                }
                this.log('info', `Unregistered workspace view: ${viewId}`);
            }
        });

        this.registerApi('workspace:show-view', (viewId: string) => {
            const config = viewRegistry.get(viewId);
            if (!config) {
                this.log('warn', `Workspace view not found: ${viewId}`);
                return;
            }
            if (visibleViews.has(viewId)) return;
            visibleViews.add(viewId);
            this.handleZoneRegister(config.defaultLocation, {
                component: config.component,
                priority: config.priority ?? 0,
            });
        });

        this.registerApi('workspace:hide-view', (viewId: string) => {
            const config = viewRegistry.get(viewId);
            if (!config || !visibleViews.has(viewId)) return;
            visibleViews.delete(viewId);
            const zoneId = config.defaultLocation;
            const items = zoneRegistry.get(zoneId) ?? [];
            const filtered = items.filter(i => i.component !== config.component);
            zoneRegistry.set(zoneId, filtered);
            zoneVersion++;
            notifyZoneSubscribers();
        });

        this.registerApi('workspace:list-views', () => {
            return Array.from(viewRegistry.values());
        });

        // Register Status Bar API methods
        this.registerApi('statusbar:add-item', (config: StatusBarItemConfig) => {
            if (!config?.id || !config.component) {
                this.log('warn', 'Invalid status bar item config');
                return;
            }
            statusBarRegistry.set(config.id, config);
            // Register in the status-bar zone
            this.handleZoneRegister('status-bar', {
                component: config.component,
                priority: config.priority ?? 0,
            });
            this.log('info', `Added status bar item: ${config.id}`);
        });

        this.registerApi('statusbar:remove-item', (itemId: string) => {
            const config = statusBarRegistry.get(itemId);
            if (!config) return;
            statusBarRegistry.delete(itemId);
            const items = zoneRegistry.get('status-bar') ?? [];
            const filtered = items.filter(i => i.component !== config.component);
            zoneRegistry.set('status-bar', filtered);
            zoneVersion++;
            notifyZoneSubscribers();
            this.log('info', `Removed status bar item: ${itemId}`);
        });

        this.registerApi('statusbar:list-items', () => {
            return Array.from(statusBarRegistry.values());
        });

        // Register built-in layouts
        this.handleRegisterComponent('welcome', WelcomeLayout);


        this.handleRegisterComponent('editor', EditorLayout);

        // Initialize Window Controller (restore state) - ONLY on Tauri Desktop
        // @ts-ignore
        if (typeof window !== 'undefined' && window.__TAURI_INTERNALS__) {
            try {
                this.windowController = new WindowController(this.app);
                await this.windowController.init();
            } catch (error) {
                this.log('warn', `Failed to initialize WindowController: ${error}`);
            }
        } else {
            this.log('info', 'Not in Tauri environment, skipping WindowController');
        }

        this.log('info', 'Loaded successfully');
    }

    /**
     * Unload the plugin
     */
    protected async onUnload(): Promise<void> {
        this.log('info', 'Unloading...');

        if (this.windowController) {
            await this.windowController.destroy();
            this.windowController = null;
        }

        // ========== BULLETPROOF STATE CLEANUP ==========
        // Clear all module-level state to prevent zombie listeners on HMR

        // 1. Clear registries
        layoutRegistry.clear();
        zoneRegistry.clear();
        viewRegistry.clear();
        visibleViews.clear();
        statusBarRegistry.clear();

        // 2. Reset active layout
        activeLayout = null;

        // 3. Reset zone version counter
        zoneVersion = 0;

        // 4. Notify subscribers before clearing to trigger React updates
        notifyLayoutSubscribers();
        notifyZoneSubscribers();

        // 5. Clear all subscriber sets (remove zombie listeners)
        layoutSubscribers.clear();
        zoneSubscribers.clear();

        // 6. Clear module-level app instance reference
        appInstance = null;

        this.log('info', 'Unloaded - all state cleared');
    }

}

// Re-export components and layouts
export { WelcomeLayout } from './components/WelcomeLayout.js';
export { EditorLayout } from './components/EditorLayout.js';

// Default export for dynamic loading
export default LayoutManagerPlugin;
