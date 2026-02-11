import type { FC } from 'react';
import { SystemPlugin } from '@notehub/core';
import type { PluginManifest } from '@notehub/core';

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
 * - `controller:unregister` - Unregister a controller component
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
export class ControllersManagerPlugin extends SystemPlugin {
    readonly manifest: PluginManifest = {
        id: 'nh.ui.controllers-manager',
        name: 'ControllersManager',
        version: '1.0.0',
        type: 'ui',
    };

    /** Controller registry: name -> React component */
    private controllers: Map<string, React.FC<any>> = new Map();

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

    /**
     * Unregister a controller component
     * @param name - Controller identifier to remove
     * @returns true if controller was removed, false if not found
     */
    private handleUnregister = (name: string): boolean => {
        if (!this.controllers.has(name)) {
            this.log('warn', `Controller "${name}" not found for unregister`);
            return false;
        }
        this.controllers.delete(name);
        this.log('info', `Controller "${name}" unregistered`);
        return true;
    };

    // =============== Plugin Lifecycle ===============

    /**
     * Load the plugin and initialize registry
     */
    protected async onLoad(): Promise<void> {
        this.log('info', 'Loading...');

        // Set singleton reference for Controller component access
        controllerRegistryInstance = this.controllers;

        // Register API methods
        this.registerApi('controller:register', this.handleRegister);
        this.registerApi('controller:unregister', this.handleUnregister);
        this.registerApi('controller:get', this.handleGet);

        this.log('info', 'Loaded successfully');
    }

    /**
     * Unload the plugin
     */
    protected async onUnload(): Promise<void> {
        this.log('info', 'Unloading...');

        // Clear singleton reference
        controllerRegistryInstance = null;

        // Clear state
        this.controllers.clear();

        this.log('info', 'Unloaded');
    }
}

// Default export for dynamic loading
export default ControllersManagerPlugin;
