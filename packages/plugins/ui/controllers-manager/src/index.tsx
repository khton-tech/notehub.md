import type { FC } from 'react';
import type { IPlugin, PluginManifest, NotehubCore } from '@notehub/core';

/**
 * Controller component props
 */
export interface ControllerProps {
    /** Controller type name from registry */
    type: string;
    /** Additional props passed to the controller component */
    [key: string]: any;
}

/**
 * Singleton reference to the controller registry for component access
 */
let controllerRegistryInstance: Map<string, React.FC<any>> | null = null;

/**
 * Controller Component
 *
 * Renders a registered controller component by type.
 * Falls back to null with console warning if controller is not found.
 *
 * @example
 * ```tsx
 * <Controller type="button" variant="primary" onClick={handleClick}>
 *   Click Me
 * </Controller>
 * ```
 */
export const Controller: FC<ControllerProps> = ({ type, ...props }) => {
    const ControllerComponent = controllerRegistryInstance?.get(type);

    if (!ControllerComponent) {
        console.warn(`[ControllersManager] Controller "${type}" not found in registry`);
        return null;
    }

    return <ControllerComponent {...props} />;
};

/**
 * ControllersManagerPlugin - UI Component Registry
 *
 * Provides a centralized registry for UI controllers (atomic components).
 * Other plugins can register custom controllers via the API.
 *
 * API Methods:
 * - `controller:register` - Register a controller component
 * - `controller:get` - Get a controller component by name
 *
 * @example
 * ```ts
 * // Register a controller
 * app.api.invoke('controller:register', 'button', ButtonComponent);
 *
 * // Get a controller component
 * const Button = app.api.invoke('controller:get', 'button');
 * ```
 */
export class ControllersManagerPlugin implements IPlugin {
    readonly manifest: PluginManifest = {
        id: 'nh.ui.controllers-manager',
        name: 'ControllersManager',
        version: '1.0.0',
        type: 'ui',
    };

    /** Controller registry: name -> React component */
    private controllers: Map<string, React.FC<any>> = new Map();

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
     * Register a controller component
     * @param name - Unique controller identifier (e.g., 'button', 'input')
     * @param component - React component to render the controller
     */
    private handleRegister = (name: string, component: React.FC<any>): void => {
        if (this.controllers.has(name)) {
            this.log('warn', `Controller "${name}" already registered, overwriting`);
        }
        this.controllers.set(name, component);
        this.log('info', `Controller "${name}" registered`);
    };

    /**
     * Get a controller component by name
     * @param name - Controller identifier
     * @returns Controller component or undefined
     */
    private handleGet = (name: string): React.FC<any> | undefined => {
        const controller = this.controllers.get(name);
        if (!controller) {
            this.log('warn', `Controller "${name}" not found`);
        }
        return controller;
    };

    // =============== Plugin Lifecycle ===============

    /**
     * Load the plugin and initialize registry
     */
    async load(app: NotehubCore): Promise<void> {
        this.app = app;
        this.log('info', 'Loading...');

        // Set singleton reference for Controller component access
        controllerRegistryInstance = this.controllers;

        // Register API methods
        app.api.register('controller:register', this.handleRegister);
        app.api.register('controller:get', this.handleGet);

        this.log('info', 'Loaded successfully');
    }

    /**
     * Unload the plugin
     */
    async unload(app: NotehubCore): Promise<void> {
        this.log('info', 'Unloading...');

        // Clear singleton reference
        controllerRegistryInstance = null;

        // Unregister API methods
        app.api.unregister('controller:register');
        app.api.unregister('controller:get');

        // Clear state
        this.controllers.clear();
        this.app = null;

        this.log('info', 'Unloaded');
    }
}

// Default export for dynamic loading
export default ControllersManagerPlugin;
