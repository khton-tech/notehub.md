import type { IPlugin, PluginManifest, NotehubCore } from '@notehub/core';

/**
 * Theme palette definition
 * Maps semantic color names to CSS values
 */
export interface ThemePalette {
    /** Main background color (darkest) */
    'bg-main': string;
    /** Sidebar background color (slightly lighter) */
    'bg-sidebar': string;
    /** Surface/card background color */
    'bg-surface': string;
    /** Primary accent color (purple for main actions) */
    'accent-primary': string;
    /** Secondary accent color (gray for secondary actions) */
    'accent-secondary': string;
    /** Primary border/accent color */
    'border-accent': string;
    /** Secondary border color */
    'border-secondary': string;
    /** Subtle border for dividers */
    'border-subtle': string;
    /** Primary text color */
    'text-primary': string;
    /** Secondary text color */
    'text-secondary'?: string;
    /** Muted text color for paths and descriptions */
    'text-muted': string;
    /** Error text color */
    'text-error'?: string;
    /** Button text color (contrast for accent buttons) */
    'button-text'?: string;
    /** Danger/destructive action color */
    'danger'?: string;
    /** Additional custom properties */
    [key: string]: string | undefined;
}

/**
 * Deep Space theme - VS Code-like dark theme with purple accents
 */
const DEEP_SPACE_THEME: ThemePalette = {
    // Backgrounds - Deep dark palette
    'bg-main': '#1a1a1a',
    'bg-sidebar': '#232323',
    'bg-surface': '#2a2a2a',
    // Accents - Purple primary, gray secondary
    'accent-primary': '#6b5ce7',
    'accent-secondary': '#3a3a3a',
    // Borders
    'border-accent': '#6b5ce7',
    'border-secondary': '#3a3a3a',
    'border-subtle': '#333333',
    // Text
    'text-primary': '#e0e0e0',
    'text-secondary': '#a0a0a0',
    'text-muted': '#888888',
    'text-error': '#ff6b6b',
    // Button
    'button-text': '#ffffff',
    // Danger
    'danger': '#dc2626',
};

/**
 * CSS variable prefix for all theme variables
 */
const CSS_VAR_PREFIX = '--nh-';

/**
 * Config key for storing current theme preference
 */
const CONFIG_KEY_CURRENT_THEME = 'theme.current';

/**
 * ThemeManagerPlugin - CSS variable theming system
 *
 * Manages application themes through CSS custom properties.
 * Persists user preference via config-manager.
 *
 * API Methods:
 * - `theme:register` - Register a new theme
 * - `theme:set` - Switch to a theme
 * - `theme:get-current` - Get current theme name
 * - `theme:list` - List all registered themes
 *
 * Events:
 * - `theme:changed` - Emitted when theme changes
 */
export class ThemeManagerPlugin implements IPlugin {
    readonly manifest: PluginManifest = {
        id: 'nh.ui.theme-manager',
        name: 'ThemeManager',
        version: '0.0.0',
        type: 'ui',
    };

    /** Registry of available themes */
    private themes: Map<string, ThemePalette> = new Map();

    /** Currently active theme name */
    private currentTheme: string = 'deep-space';

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

    /** Style element for global CSS */
    private styleElement: HTMLStyleElement | null = null;

    /**
     * Inject global styles for html and body to prevent resize flash
     */
    private injectGlobalStyles(): void {
        // Remove existing style element if present
        if (this.styleElement) {
            this.styleElement.remove();
        }

        // Create and inject global styles
        this.styleElement = document.createElement('style');
        this.styleElement.id = 'nh-theme-global-styles';
        this.styleElement.textContent = `
            html, body {
                background-color: var(--nh-bg-main, #1a1a1a);
                height: 100%;
                margin: 0;
                padding: 0;
                overflow: hidden;
            }
            #root {
                height: 100%;
                overflow: hidden;
            }
        `;
        document.head.appendChild(this.styleElement);
    }

    /**
     * Apply theme CSS variables to document root
     */
    private applyTheme(palette: ThemePalette): void {
        const root = document.documentElement;

        for (const [key, value] of Object.entries(palette)) {
            if (value !== undefined) {
                root.style.setProperty(`${CSS_VAR_PREFIX}${key}`, value);
            }
        }

        // Apply global styles to ensure background sync
        this.injectGlobalStyles();
    }

    /**
     * Remove all theme CSS variables from document root
     */
    private clearTheme(): void {
        const root = document.documentElement;
        const currentPalette = this.themes.get(this.currentTheme);

        if (currentPalette) {
            for (const key of Object.keys(currentPalette)) {
                root.style.removeProperty(`${CSS_VAR_PREFIX}${key}`);
            }
        }
    }

    // =============== API Method Handlers ===============

    /**
     * Register a new theme
     * @param name - Unique theme identifier
     * @param palette - Theme color palette
     */
    private handleRegister = (name: string, palette: ThemePalette): void => {
        if (this.themes.has(name)) {
            this.log('warn', `Theme "${name}" already registered, overwriting`);
        }

        this.themes.set(name, palette);
        this.log('info', `Theme "${name}" registered`);
    };

    /**
     * Switch to a registered theme
     * @param name - Theme identifier to activate
     */
    private handleSet = async (name: string): Promise<boolean> => {
        const palette = this.themes.get(name);

        if (!palette) {
            this.log('error', `Theme "${name}" not found`);
            return false;
        }

        // Clear previous theme variables
        this.clearTheme();

        // Apply new theme
        this.currentTheme = name;
        this.applyTheme(palette);

        // Persist preference
        if (this.app) {
            await this.app.api.invoke('config:set', CONFIG_KEY_CURRENT_THEME, name);
            this.app.events.emit('theme:changed', { name, palette });
        }

        this.log('info', `Theme changed to "${name}"`);
        return true;
    };

    /**
     * Get current theme name
     */
    private handleGetCurrent = (): string => {
        return this.currentTheme;
    };

    /**
     * List all registered theme names
     */
    private handleList = (): string[] => {
        return Array.from(this.themes.keys());
    };

    /**
     * Get a theme palette by name
     */
    private handleGet = (name: string): ThemePalette | undefined => {
        return this.themes.get(name);
    };

    // =============== Plugin Lifecycle ===============

    /**
     * Load the plugin
     */
    async load(app: NotehubCore): Promise<void> {
        this.app = app;
        this.log('info', 'Loading...');

        // Register default theme
        this.themes.set('deep-space', DEEP_SPACE_THEME);
        this.log('info', 'Default theme "deep-space" registered');

        // Register API methods
        app.api.register('theme:register', this.handleRegister);
        app.api.register('theme:set', this.handleSet);
        app.api.register('theme:get-current', this.handleGetCurrent);
        app.api.register('theme:list', this.handleList);
        app.api.register('theme:get', this.handleGet);

        // Load saved theme preference
        const savedTheme = await app.api.invoke<string | undefined>(
            'config:get',
            CONFIG_KEY_CURRENT_THEME,
            'deep-space'
        );

        this.currentTheme = savedTheme ?? 'deep-space';

        // Apply current theme
        const palette = this.themes.get(this.currentTheme);
        if (palette) {
            this.applyTheme(palette);
            this.log('info', `Applied theme "${this.currentTheme}"`);
        }

        this.log('info', 'Loaded successfully');
    }

    /**
     * Unload the plugin
     */
    async unload(app: NotehubCore): Promise<void> {
        this.log('info', 'Unloading...');

        // Clear theme from DOM
        this.clearTheme();

        // Unregister API methods
        app.api.unregister('theme:register');
        app.api.unregister('theme:set');
        app.api.unregister('theme:get-current');
        app.api.unregister('theme:list');
        app.api.unregister('theme:get');

        // Clear state
        this.themes.clear();
        this.app = null;

        this.log('info', 'Unloaded');
    }
}

// Default export for dynamic loading
export default ThemeManagerPlugin;
