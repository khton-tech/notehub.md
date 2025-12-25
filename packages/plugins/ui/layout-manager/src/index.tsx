import type { IPlugin, PluginManifest, NotehubCore } from '@notehub/core';
import { useSyncExternalStore, type FC } from 'react';
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

// =============== Layout Store (Module-level State) ===============

/** Registry of available layouts */
const layoutRegistry = new Map<string, LayoutComponent>();

/** Currently active layout */
let activeLayout: ActiveLayout | null = null;

/** Subscribers for state changes */
const subscribers = new Set<() => void>();

/**
 * Notify all subscribers of state change
 */
function notifySubscribers(): void {
    for (const callback of subscribers) {
        callback();
    }
}

/**
 * Subscribe to layout state changes
 */
function subscribe(callback: () => void): () => void {
    subscribers.add(callback);
    return () => {
        subscribers.delete(callback);
    };
}

/**
 * Get current layout state snapshot
 */
function getSnapshot(): ActiveLayout | null {
    return activeLayout;
}

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
        subscribe,
        getSnapshot,
        getSnapshot
    );

    if (!currentLayout) {
        return null;
    }

    const Component = layoutRegistry.get(currentLayout.name);

    if (!Component) {
        console.warn(`[LayoutManager] Layout "${currentLayout.name}" not found in registry`);
        return null;
    }

    return <Component {...currentLayout.props} />;
};

// =============== Plugin Implementation ===============

/**
 * LayoutManagerPlugin - Layout and screen management
 *
 * Manages application layouts as React components.
 * Provides a registry for layouts and controls which one is active.
 *
 * API Methods:
 * - `layout:register-component` - Register a React component as a layout
 * - `layout:set-active` - Set the active layout
 * - `layout:get-active` - Get current layout info
 * - `layout:list` - List all registered layouts
 *
 * Events:
 * - `layout:changed` - Emitted when active layout changes
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

    // =============== API Method Handlers ===============

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
    private handleSet = (name: string, props: Record<string, unknown> = {}): boolean => {
        if (!layoutRegistry.has(name)) {
            this.log('error', `Layout "${name}" not found`);
            return false;
        }

        activeLayout = { name, props };
        notifySubscribers();

        if (this.app) {
            this.app.events.emit('layout:changed', { name, props });
        }

        this.log('info', `Active layout set to "${name}"`);
        return true;
    };

    /**
     * Get current active layout info
     */
    private handleGetActive = (): ActiveLayout | null => {
        return activeLayout;
    };

    /**
     * List all registered layout names
     */
    private handleList = (): string[] => {
        return Array.from(layoutRegistry.keys());
    };

    // =============== Plugin Lifecycle ===============

    /**
     * Load the plugin
     */
    async load(app: NotehubCore): Promise<void> {
        this.app = app;
        this.log('info', 'Loading...');

        // Register API methods
        app.api.register('layout:register-component', this.handleRegisterComponent);
        app.api.register('layout:set', this.handleSet);
        app.api.register('layout:get-active', this.handleGetActive);
        app.api.register('layout:list', this.handleList);

        // Register built-in layouts
        this.handleRegisterComponent('welcome', WelcomeLayout);
        this.handleRegisterComponent('editor', EditorLayout);

        this.log('info', 'Loaded successfully');
    }

    /**
     * Unload the plugin
     */
    async unload(app: NotehubCore): Promise<void> {
        this.log('info', 'Unloading...');

        // Unregister API methods
        app.api.unregister('layout:register-component');
        app.api.unregister('layout:set');
        app.api.unregister('layout:get-active');
        app.api.unregister('layout:list');

        // Clear state
        layoutRegistry.clear();
        activeLayout = null;
        notifySubscribers();

        this.app = null;

        this.log('info', 'Unloaded');
    }
}

// Re-export components
export { WelcomeLayout } from './components/WelcomeLayout.js';
export { EditorLayout } from './components/EditorLayout.js';

// Default export for dynamic loading
export default LayoutManagerPlugin;
