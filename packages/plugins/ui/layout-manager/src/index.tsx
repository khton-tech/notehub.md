import type { IPlugin, PluginManifest, NotehubCore, ZoneItem } from '@notehub/core';
import { useSyncExternalStore, type FC } from 'react';
import { Controller } from '@notehub/controllers-manager';
import { WelcomeLayout } from './components/WelcomeLayout.js';
import { EditorLayout } from './components/EditorLayout.js';

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

    // Use Controller component from controllers-manager for dynamic rendering
    // This avoids async api.invoke calls during render which would return a Promise (object)
    return (
        <div className={className} style={style}>
            {sortedItems.map((item, index) => (
                <Controller
                    key={`${item.component}-${index}`}
                    type={item.component}
                />
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
export class LayoutManagerPlugin implements IPlugin {
    readonly manifest: PluginManifest = {
        id: 'nh.ui.layout-manager',
        name: 'LayoutManager',
        version: '0.0.0',
        type: 'ui',
    };

    /** Reference to kernel */
    private app: NotehubCore | null = null;

    /**
     * Log a message via the Logger plugin
     */
    private log(level: 'info' | 'warn' | 'error', message: string): void {
        if (this.app) {
            this.app.api.invoke(`logger:${level}`, this.manifest.id, message);
        }
    }

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

        if (this.app) {
            this.app.events.emit('layout:changed', { name, props });
        }

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

        if (this.app) {
            this.app.events.emit('zone:updated', { zoneId, items });
        }
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

            if (this.app) {
                this.app.events.emit('zone:updated', { zoneId, items: [] });
            }
        }
    };

    // =============== Plugin Lifecycle ===============

    /**
     * Load the plugin
     */
    async load(app: NotehubCore): Promise<void> {
        this.app = app;
        appInstance = app;
        this.log('info', 'Loading...');

        // Register Layout API methods
        app.api.register('layout:register-component', this.handleRegisterComponent);
        app.api.register('layout:set', this.handleSetLayout);
        app.api.register('layout:get-active', this.handleGetActiveLayout);
        app.api.register('layout:list', this.handleListLayouts);

        // Register Zone API methods
        app.api.register('zone:register', this.handleZoneRegister);
        app.api.register('zone:get', this.handleZoneGet);
        app.api.register('zone:clear', this.handleZoneClear);

        // Register built-in layouts
        this.handleRegisterComponent('welcome', WelcomeLayout);
        this.handleRegisterComponent('editor', EditorLayout);

        // Register MainZoneRenderer controller
        const MainZoneRendererComponent: FC = () => {
            return <ZoneRenderer name="main" style={{ width: '100%', height: '100%' }} />;
        };
        app.api.invoke('controller:register', 'main-zone-renderer', MainZoneRendererComponent);

        this.log('info', 'Loaded successfully');
    }

    /**
     * Unload the plugin
     */
    async unload(app: NotehubCore): Promise<void> {
        this.log('info', 'Unloading...');

        // Unregister Layout API methods
        app.api.unregister('layout:register-component');
        app.api.unregister('layout:set');
        app.api.unregister('layout:get-active');
        app.api.unregister('layout:list');

        // Unregister Zone API methods
        app.api.unregister('zone:register');
        app.api.unregister('zone:get');
        app.api.unregister('zone:clear');

        // ========== BULLETPROOF STATE CLEANUP ==========
        // Clear all module-level state to prevent zombie listeners on HMR

        // 1. Clear registries
        layoutRegistry.clear();
        zoneRegistry.clear();

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

        // 7. Clear instance reference
        this.app = null;

        this.log('info', 'Unloaded - all state cleared');
    }

}

// Re-export components and layouts
export { WelcomeLayout } from './components/WelcomeLayout.js';
export { EditorLayout } from './components/EditorLayout.js';

// Default export for dynamic loading
export default LayoutManagerPlugin;
