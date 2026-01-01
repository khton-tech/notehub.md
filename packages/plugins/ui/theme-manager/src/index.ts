import type { IPlugin, PluginManifest, NotehubCore } from '@notehub/core';
import { colord } from 'colord';
import { registerThemeSettings } from './logic/ThemeConfig';

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
    /** Secondary background (inputs, dropdowns) */
    'bg-secondary': string;
    /** Hover background state */
    'bg-hover': string;
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
    /** Default font family */
    'font-family': string;
    /** Monospace font family */
    'font-family-mono'?: string;
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
    'bg-secondary': '#2a2a2a',
    'bg-hover': '#3a3a3a',
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
    // Typography
    'font-family': 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    'font-family-mono': 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
};

/**
 * Light theme - Standard light mode
 */
const LIGHT_THEME: ThemePalette = {
    // Backgrounds - Light palette
    'bg-main': '#ffffff',
    'bg-sidebar': '#f3f4f6', // gray-100
    'bg-surface': '#ffffff',
    'bg-secondary': '#f9fafb', // gray-50
    'bg-hover': '#f3f4f6', // gray-100
    // Accents
    'accent-primary': '#6b5ce7',
    'accent-secondary': '#e2e8f0', // gray-200
    // Borders
    'border-accent': '#6b5ce7',
    'border-secondary': '#e5e7eb', // gray-200
    'border-subtle': '#f3f4f6', // gray-100
    // Text
    'text-primary': '#111827', // gray-900
    'text-secondary': '#4b5563', // gray-600
    'text-muted': '#9ca3af', // gray-400
    'text-error': '#ef4444',
    // Button
    'button-text': '#ffffff',
    // Danger
    'danger': '#dc2626',
    // Typography
    'font-family': 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    'font-family-mono': 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
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

    /** Currently active theme name (preference) */
    private currentTheme: string = 'deep-space';

    /** Reference to kernel */
    private app: NotehubCore | null = null;

    /** System theme media query listener */
    private systemMediaQuery: MediaQueryList | null = null;

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
                font-family: var(--nh-font-family, system-ui, sans-serif);
                color: var(--nh-text-primary, #e0e0e0);
            }
            #root {
                height: 100%;
                overflow: hidden;
            }
        `;
        document.head.appendChild(this.styleElement);
    }

    /**
     * Resolve 'system' theme to 'light' or 'deep-space'
     */
    private resolveSystemTheme(): string {
        if (typeof window !== 'undefined' && window.matchMedia) {
            if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
                return 'deep-space';
            }
            return 'light';
        }
        return 'deep-space'; // Default fallback
    }

    /**
     * Handle system theme changes
     */
    private handleSystemThemeChange = (e: MediaQueryListEvent) => {
        if (this.currentTheme === 'system') {
            const resolvedTheme = e.matches ? 'deep-space' : 'light';
            this.log('info', `System theme changed to ${e.matches ? 'dark' : 'light'}, applying ${resolvedTheme}`);

            const palette = this.themes.get(resolvedTheme);
            if (palette) {
                this.applyTheme(palette);
            }
        }
    };

    /**
     * Apply theme CSS variables to document root
     * Merges base palette with dynamic accent color preference
     */
    private async applyTheme(palette: ThemePalette): Promise<void> {
        const root = document.documentElement;

        // Get saved accent color
        let accentPrimary = palette['accent-primary'];
        if (this.app) {
            const savedAccent = await this.app.api.invoke<string | undefined>('config:get', 'theme.accent-primary');
            if (savedAccent) {
                accentPrimary = savedAccent;
            }
        }

        // Generate dynamic palette from accent
        const dynamicPalette: Partial<ThemePalette> = {
            ...palette,
            'accent-primary': accentPrimary,
            // Generate secondary accent (darker/desaturated)
            'accent-secondary': colord(accentPrimary).alpha(0.1).toHex(),
            // Generate border accent
            'border-accent': accentPrimary,
            // Generate focus ring (transparent accent)
            'ring-focus': colord(accentPrimary).alpha(0.4).toHex(),
        };

        for (const [key, value] of Object.entries(dynamicPalette)) {
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
        // We don't track which specific keys are set, so we can't easily remove distinct ones.
        // But since we overwrite them, clearing might not be strictly necessary if we always set properties.
        // However, for cleanliness, we can iterate all known theme keys if needed.
        // For now, removing property by property is tricky without knowing exact keys active.
        // We will skip explicit removal as overwritting handles it, and 'style' cleanup handles global styles.
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
        let targetTheme = name;

        // Handle System Theme
        if (name === 'system') {
            targetTheme = this.resolveSystemTheme();

            // Setup listener if not already listening
            if (!this.systemMediaQuery && typeof window !== 'undefined' && window.matchMedia) {
                this.systemMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
                this.systemMediaQuery.addEventListener('change', this.handleSystemThemeChange);
                this.log('info', 'Started watching system theme preferences');
            }
        } else {
            // Stop listening if we switched to manual theme
            if (this.systemMediaQuery) {
                this.systemMediaQuery.removeEventListener('change', this.handleSystemThemeChange);
                this.systemMediaQuery = null;
            }
        }

        const palette = this.themes.get(targetTheme);

        if (!palette) {
            this.log('error', `Theme "${targetTheme}" not found (requested "${name}")`);
            return false;
        }

        // Apply new theme
        this.currentTheme = name; // persist "system" if selected
        await this.applyTheme(palette);

        // Persist preference
        if (this.app) {
            await this.app.api.invoke('config:set', CONFIG_KEY_CURRENT_THEME, name);
            this.app.events.emit('theme:changed', { name, palette });
        }

        this.log('info', `Theme changed to "${name}" (effective: "${targetTheme}")`);
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

        // Register default themes
        this.themes.set('deep-space', DEEP_SPACE_THEME);
        this.themes.set('light', LIGHT_THEME);
        this.log('info', 'Default themes registered');

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

        // Apply current theme (using handleSet logic to handle 'system' correctly)
        // We use internal logic to avoid config write-back loop on startup
        let effectiveTheme = this.currentTheme;

        if (this.currentTheme === 'system') {
            effectiveTheme = this.resolveSystemTheme();
            if (typeof window !== 'undefined' && window.matchMedia) {
                this.systemMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
                this.systemMediaQuery.addEventListener('change', this.handleSystemThemeChange);
            }
        }

        const palette = this.themes.get(effectiveTheme);
        if (palette) {
            await this.applyTheme(palette);
            this.log('info', `Applied theme "${this.currentTheme}" (effective: ${effectiveTheme})`);
        } else {
            // Fallback if saved theme not found
            const fallbackPalette = this.themes.get('deep-space');
            if (fallbackPalette) await this.applyTheme(fallbackPalette);
        }

        // Subscribe to accent color changes for live preview
        app.events.on('config:updated', async (payload: any) => {
            if (payload.key === 'theme.accent-primary') {
                // Re-resolve effective theme
                let themeName = this.currentTheme;
                if (themeName === 'system') themeName = this.resolveSystemTheme();

                const currentPalette = this.themes.get(themeName);
                if (currentPalette) {
                    await this.applyTheme(currentPalette);
                }
            } else if (payload.key === 'theme.accent-preset') {
                // If preset changes, update the custom accent color to match
                const newColor = payload.value as string;
                await app.api.invoke('config:set', 'theme.accent-primary', newColor);
            } else if (payload.key === CONFIG_KEY_CURRENT_THEME) {
                // Handle external theme changes (e.g. from settings sync)
                if (payload.value !== this.currentTheme) {
                    await this.handleSet(payload.value as string);
                }
            }
        });

        this.log('info', 'Loaded successfully');
    }

    /**
     * Called when all plugins are loaded
     */
    async onReady(app: NotehubCore): Promise<void> {
        // Register Settings (safe to do here as settings-manager is guaranteed to be loaded)
        registerThemeSettings(app);

        // Listen for bulk config reloads (e.g. vault switch)
        app.events.on('config:reloaded', async () => {
            this.log('info', 'Config reloaded, refreshing theme...');

            // Re-fetch current theme preference
            const savedTheme = await app.api.invoke<string | undefined>('config:get', CONFIG_KEY_CURRENT_THEME);

            // If explicit theme set in this vault, use it. Otherwise default to current (or deep-space)
            // Actually, if we switched vaults, we usually want to respect the new vault's theme or default.
            // If 'savedTheme' is undefined, it means this vault has no preference. 
            // We should probably stick to what we have OR reset to default. 
            // Let's reset to what 'savedTheme' says or 'deep-space' if missing.
            const newTheme = savedTheme ?? 'deep-space';

            if (newTheme !== this.currentTheme) {
                await this.handleSet(newTheme);
            } else {
                // Even if theme name is same, accent color might have changed
                let themeName = this.currentTheme;
                if (themeName === 'system') themeName = this.resolveSystemTheme();
                const currentPalette = this.themes.get(themeName);
                if (currentPalette) {
                    await this.applyTheme(currentPalette);
                }
            }
        });
    }

    /**
     * Unload the plugin
     */
    async unload(app: NotehubCore): Promise<void> {
        this.log('info', 'Unloading...');

        // Stop listener
        if (this.systemMediaQuery) {
            this.systemMediaQuery.removeEventListener('change', this.handleSystemThemeChange);
            this.systemMediaQuery = null;
        }

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
