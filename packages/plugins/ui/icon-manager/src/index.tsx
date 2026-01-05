import type { FC } from 'react';
import type { IPlugin, PluginManifest, NotehubCore } from '@notehub/core';
import {
    FolderOpen,
    Info,
    Zap,
    Plus,
    PlusCircle,
    Box,
    Disc,
    Trash2,
    Settings,
    X,
    FileText,
    HelpCircle,
    File,
    Folder,
    ChevronRight,
    ChevronDown,
    // New icons for StatusBar and extended functionality
    CheckCircle2,
    RefreshCw,
    AlertCircle,
    Search,
    Edit,
    Save,
    Undo,
    Redo,
    Menu,
    MoreVertical,
    Check,
    AlertTriangle,
    Loader,
    Palette,
    FlaskConical,
    Package,
    type LucideIcon,
} from 'lucide-react';

/**
 * Icon component props
 */
export interface IconProps {
    /** Icon name from registry */
    name: string;
    /** Icon size in pixels (default: 24) */
    size?: number;
    /** Additional CSS class names */
    className?: string;
}

/**
 * Singleton reference to the icon registry for component access
 */
let iconRegistryInstance: Map<string, React.ElementType> | null = null;

/**
 * Icon Component
 * 
 * Renders an icon from the registry by name.
 * Falls back to HelpCircle if icon is not found.
 * 
 * @example
 * ```tsx
 * <Icon name="folder-open" size={24} className="text-yellow-400" />
 * ```
 */
export const Icon: FC<IconProps> = ({ name, size = 24, className }) => {
    const IconComponent = iconRegistryInstance?.get(name) ?? HelpCircle;
    return <IconComponent size={size} className={className} />;
};

/**
 * Core icon set mapping (kebab-case names to Lucide components)
 */
const CORE_ICONS: Record<string, LucideIcon> = {
    'folder-open': FolderOpen,
    'info': Info,
    'zap': Zap,
    'plus': Plus,
    'plus-circle': PlusCircle,
    'box': Box,
    'disc': Disc,
    'trash-2': Trash2,
    'settings': Settings,
    'x': X,
    'file-text': FileText,
    'help-circle': HelpCircle,
    'file': File,
    'folder': Folder,
    'chevron-right': ChevronRight,
    'chevron-down': ChevronDown,
    // New icons for StatusBar and extended functionality
    'check-circle': CheckCircle2,
    'refresh-cw': RefreshCw,
    'alert-circle': AlertCircle,
    'search': Search,
    'edit': Edit,
    'save': Save,
    'undo': Undo,
    'redo': Redo,
    'menu': Menu,
    'more-vertical': MoreVertical,
    'check': Check,
    'alert-triangle': AlertTriangle,
    'loader': Loader,
    'palette': Palette,
    'flask-conical': FlaskConical,
    'package': Package,
};

/**
 * IconManagerPlugin - Icon registry and component provider
 * 
 * Provides a centralized registry for icons with Lucide React as the default set.
 * Other plugins can register custom icons via the API.
 * 
 * API Methods:
 * - `icon:register` - Register a custom icon
 * - `icon:get` - Get an icon component by name
 * 
 * @example
 * ```ts
 * // Register a custom icon
 * app.api.invoke('icon:register', 'my-icon', MyIconComponent);
 * 
 * // Get an icon component
 * const IconComponent = app.api.invoke('icon:get', 'folder-open');
 * ```
 */
export class IconManagerPlugin implements IPlugin {
    readonly manifest: PluginManifest = {
        id: 'nh.ui.icon-manager',
        name: 'IconManager',
        version: '1.0.0',
        type: 'ui',
    };

    /** Icon registry: name -> React component */
    private icons: Map<string, React.ElementType> = new Map();

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
     * Register a custom icon
     * @param name - Unique icon identifier (kebab-case recommended)
     * @param component - React component to render the icon
     */
    private handleRegister = (name: string, component: React.ElementType): void => {
        if (this.icons.has(name)) {
            this.log('warn', `Icon "${name}" already registered, overwriting`);
        }
        this.icons.set(name, component);
        this.log('info', `Icon "${name}" registered`);
    };

    /**
     * Get an icon component by name
     * @param name - Icon identifier
     * @returns Icon component or HelpCircle fallback
     */
    private handleGet = (name: string): React.ElementType => {
        const icon = this.icons.get(name);
        if (!icon) {
            this.log('warn', `Icon "${name}" not found, using fallback`);
            return HelpCircle;
        }
        return icon;
    };

    // =============== Plugin Lifecycle ===============

    /**
     * Load the plugin and register core icons
     */
    async load(app: NotehubCore): Promise<void> {
        this.app = app;
        this.log('info', 'Loading...');

        // Register core icon set from Lucide
        for (const [name, component] of Object.entries(CORE_ICONS)) {
            this.icons.set(name, component);
        }
        this.log('info', `Registered ${Object.keys(CORE_ICONS).length} core icons`);

        // Set singleton reference for Icon component access
        iconRegistryInstance = this.icons;

        // Register API methods
        app.api.register('icon:register', this.handleRegister);
        app.api.register('icon:get', this.handleGet);

        this.log('info', 'Loaded successfully');
    }

    /**
     * Unload the plugin
     */
    async unload(app: NotehubCore): Promise<void> {
        this.log('info', 'Unloading...');

        // Clear singleton reference
        iconRegistryInstance = null;

        // Unregister API methods
        app.api.unregister('icon:register');
        app.api.unregister('icon:get');

        // Clear state
        this.icons.clear();
        this.app = null;

        this.log('info', 'Unloaded');
    }
}

// Default export for dynamic loading
export default IconManagerPlugin;
