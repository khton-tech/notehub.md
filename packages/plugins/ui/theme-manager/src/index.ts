import { SystemPlugin } from '@notehub/core';
import type { PluginManifest } from '@notehub/core';
import { colord } from 'colord';
import { registerThemeSettings } from './logic/ThemeConfig';
import en from './locales/en';
import ru from './locales/ru';

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
    /** Button text color (contrast for accent buttons) — computed dynamically */
    'button-text'?: string;
    /** Alias for button-text: readable text ON any accent-colored surface */
    'on-accent'?: string;
    /** Hover variant of accent-primary (lightened or darkened) */
    'accent-hover'?: string;
    /** RGB triplet of accent-primary for use in rgba() — e.g. "124, 58, 237" */
    'accent-rgb'?: string;
    /** Danger/destructive action color */
    'danger'?: string;
    /** Readable text ON danger-colored surfaces (always white — danger red is always dark) */
    'on-danger'?: string;
    /** Default font family */
    'font-family': string;
    /** Monospace font family */
    'font-family-mono'?: string;
    /** Small shadow for elevation 1 */
    'shadow-sm'?: string;
    /** Medium shadow for elevation 2 */
    'shadow-md'?: string;
    /** Additional custom properties */
    [key: string]: string | undefined;
}

/**
 * Deep Space theme - Rich Black with floating glassmorphism
 * Redesigned for modern "floating" aesthetic with layered depth
 */
const DEEP_SPACE_THEME: ThemePalette = {
    // Backgrounds - Deep space slate palette engineered for long work sessions (Linear / Raycast aesthetic)
    'bg-main': '#0B0C10',      // Canvas background (soft deep obsidian, non-glare)
    'bg-sidebar': '#101218',   // Elevated Sidebar Layer
    'bg-surface': '#161922',   // Floating Cards & Main Editor Panels
    'bg-secondary': '#1E2230', // Inputs, Popovers, Sub-panels
    'bg-hover': 'rgba(255, 255, 255, 0.045)', // Soft translucent micro-hover

    // Glassmorphism tokens
    'glass-bg': 'rgba(22, 25, 34, 0.82)',
    'glass-border': 'rgba(255, 255, 255, 0.06)',

    // Accents - Ergonomic Violet / Indigo (balanced saturation)
    'accent-primary': '#8b5cf6', // Violet-500
    'accent-secondary': 'rgba(139, 92, 246, 0.14)', // Transparent soft violet
    'accent-hover': '#7c3aed', // Violet-600

    // Borders - Hairline non-distracting borders
    'border-accent': '#8b5cf6',
    'border-secondary': 'rgba(255, 255, 255, 0.06)', // Soft panel border
    'border-subtle': 'rgba(255, 255, 255, 0.035)', // Subdued divider

    // Shadows for depth and subtle elevation
    'shadow-sm': '0 2px 8px rgba(0, 0, 0, 0.25)',
    'shadow-md': '0 8px 24px rgba(0, 0, 0, 0.35)',
    'shadow-lg': '0 16px 48px rgba(0, 0, 0, 0.45)',

    // Text - Carefully tuned ergonomics (Slate hierarchy)
    'text-primary': '#E2E8F0', // Slate-200 (reduces stark contrast glare)
    'text-secondary': '#94A3B8', // Slate-400
    'text-muted': '#64748B', // Slate-500
    'text-error': '#f87171', // Red-400

    // Button
    'button-text': '#ffffff',

    // Danger
    'danger': '#ef4444', // Red-500
    'on-danger': '#ffffff',

    // Callout semantic colors
    'callout-info': '#60a5fa',       // Blue-400
    'callout-tip': '#4ade80',        // Green-400
    'callout-warning': '#fbbf24',    // Amber-400
    'callout-danger': '#f87171',     // Red-400
    'callout-question': '#c084fc',   // Purple-400
    'callout-quote': '#a1a1aa',      // Zinc-400
    'callout-abstract': '#22d3ee',   // Cyan-400

    // Panel effects
    'panel-glow': 'inset 0 0 0 1px rgba(255,255,255,0.05)',

    // Typography
    'font-family': '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    'font-family-mono': '"JetBrains Mono", "Fira Code", Consolas, monospace',
};

/**
 * Light theme - Modern light mode with floating aesthetic
 */
const LIGHT_THEME: ThemePalette = {
    // Backgrounds - Light palette with subtle layers
    'bg-main': '#FAFAFA',
    'bg-sidebar': '#F5F5F5',
    'bg-surface': '#FFFFFF',
    'bg-secondary': '#F0F0F0',
    'bg-hover': '#EBEBEB',

    // Glassmorphism tokens
    'glass-bg': 'rgba(255, 255, 255, 0.8)',
    'glass-border': 'rgba(0, 0, 0, 0.06)',

    // Accents
    'accent-primary': '#7c3aed',
    'accent-secondary': 'rgba(124, 58, 237, 0.08)',

    // Borders
    'border-accent': '#7c3aed',
    'border-secondary': 'rgba(0, 0, 0, 0.14)',
    'border-subtle': 'rgba(0, 0, 0, 0.10)',

    // Shadows - enhanced for depth
    'shadow-sm': '0 2px 8px rgba(0, 0, 0, 0.08)',
    'shadow-md': '0 8px 24px rgba(0, 0, 0, 0.12)',
    'shadow-lg': '0 16px 48px rgba(0, 0, 0, 0.16)',

    // Text
    'text-primary': '#1A1A1A',
    'text-secondary': '#4A4A4A',
    'text-muted': 'rgba(0, 0, 0, 0.60)',
    'text-error': '#dc2626',

    // Button — will be overridden dynamically by applyTheme normalization
    'button-text': '#ffffff',

    // Danger
    'danger': '#dc2626',
    'on-danger': '#ffffff',

    // Callout semantic colors (darker shades for light theme)
    'callout-info': '#3b82f6',       // Blue-500
    'callout-tip': '#22c55e',        // Green-500
    'callout-warning': '#f59e0b',    // Amber-500
    'callout-danger': '#ef4444',     // Red-500
    'callout-question': '#a855f7',   // Purple-500
    'callout-quote': '#71717a',      // Zinc-500
    'callout-abstract': '#06b6d4',   // Cyan-500

    // Panel effects
    'panel-glow': 'inset 0 0 0 1px rgba(0,0,0,0.08)',

    // Typography
    'font-family': '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    'font-family-mono': '"JetBrains Mono", "Fira Code", Consolas, monospace',
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
export class ThemeManagerPlugin extends SystemPlugin {
    readonly manifest: PluginManifest = {
        id: 'nh.ui.theme-manager',
        name: 'ThemeManager',
        version: '0.0.0',
        type: 'ui',
        dependencies: ['nh.system.i18n'],
    };

    /** Registry of available themes */
    private themes: Map<string, ThemePalette> = new Map();

    /** Currently active theme name (preference) */
    private currentTheme: string = 'deep-space';

    /** System theme media query listener */
    private systemMediaQuery: MediaQueryList | null = null;

    /** Style element for global CSS */
    private styleElement: HTMLStyleElement | null = null;

    /**
     * Inject global styles for html and body to prevent resize flash
     */
    /**
     * Inject global styles for html and body to prevent resize flash
     */
    /**
     * Inject global styles for html and body to prevent resize flash
     */
    private injectGlobalStyles(): void {
        // Reuse existing style element or create new one
        if (!this.styleElement) {
            this.styleElement = document.createElement('style');
            this.styleElement.id = 'nh-theme-global-styles';

            // CSP Nonce Support: Find nonce by iterating scripts (attribute selector often fails)
            let nonce: string | undefined;
            const scripts = document.scripts;
            for (let i = 0; i < scripts.length; i++) {
                const script = scripts.item(i);
                if (script && script.nonce) {
                    nonce = script.nonce;
                    break;
                }
            }

            if (nonce) {
                this.styleElement.setAttribute('nonce', nonce);
                this.log('info', 'Applied CSP nonce to global styles');
            } else {
                this.log('warn', 'No CSP nonce found for global styles');
            }

            document.head.appendChild(this.styleElement);
        }

        const cssContent = `
            /* Base styles */
            html, body {
                background-color: var(--nh-bg-main, #08080A);
                height: 100%;
                margin: 0;
                padding: 0;
                overflow: hidden;
                font-family: var(--nh-font-family, "Inter", system-ui, sans-serif);
                color: var(--nh-text-primary, #E2E8F0);
                line-height: 1.5;
                letter-spacing: -0.011em;
                font-feature-settings: 'cv02', 'cv03', 'cv04', 'cv11';
                -webkit-font-smoothing: antialiased;
                -moz-osx-font-smoothing: grayscale;
            }

            #root {
                height: 100%;
                overflow: hidden;
            }

            /* Glassmorphism utility classes */
            .nh-glass {
                background: var(--nh-glass-bg, rgba(20, 20, 20, 0.7));
                backdrop-filter: blur(12px);
                -webkit-backdrop-filter: blur(12px);
                border: 1px solid var(--nh-glass-border, rgba(255, 255, 255, 0.08));
            }

            .nh-glass-strong {
                background: var(--nh-glass-bg, rgba(20, 20, 20, 0.85));
                backdrop-filter: blur(20px);
                -webkit-backdrop-filter: blur(20px);
                border: 1px solid var(--nh-glass-border, rgba(255, 255, 255, 0.08));
            }

            /* Enhanced scrollbar styling */
            ::-webkit-scrollbar {
                width: 8px;
                height: 8px;
            }

            ::-webkit-scrollbar-track {
                background: transparent;
            }

            ::-webkit-scrollbar-thumb {
                background: var(--nh-border-secondary, rgba(255, 255, 255, 0.08));
                border-radius: 4px;
                transition: background 0.2s ease;
            }

            ::-webkit-scrollbar-thumb:hover {
                background: var(--nh-text-muted, rgba(255, 255, 255, 0.2));
            }

            ::-webkit-scrollbar-corner {
                background: transparent;
            }

            /* Smooth transitions for interactive elements */
            button, a, input, select, textarea {
                transition: all 0.2s ease;
            }

            /* Focus ring utility */
            .nh-focus-ring:focus-visible {
                outline: none;
                box-shadow: 0 0 0 2px var(--nh-bg-main), 0 0 0 4px var(--nh-accent-primary);
            }

            /* Animations toggle */
            body.nh-disable-animations *,
            body.nh-disable-animations *::before,
            body.nh-disable-animations *::after {
                animation: none !important;
                transition: none !important;
            }

            /* Reduced motion preference - DISABLED as it causes "on speed" effect */
            /*
            @media (prefers-reduced-motion: reduce) {
                *, *::before, *::after {
                    animation-duration: 0.01ms !important;
                    transition-duration: 0.01ms !important;
                }
            }
            */
        `;

        // Only update if content changed to prevent layout thrashing
        if (this.styleElement.textContent !== cssContent) {
            this.styleElement.textContent = cssContent;
        }
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
        // Debug log to detect rapid theme application
        // this.log('debug', `Applying theme with accent: ${palette['accent-primary']}`);

        const root = document.documentElement;

        // Get saved accent color
        let accentPrimary = palette['accent-primary'];
        const savedAccent = await this.app.api.invoke<string | undefined>('config:get', 'theme.accent-primary');
        if (savedAccent) {
            accentPrimary = savedAccent;
        }

        // ── Accent normalization ──────────────────────────────────────────────
        // Determine readable text color ON the accent surface.
        // WCAG contrast: white needs accent luminance < ~0.18, black needs > 0.18.
        // colord.isDark() uses perceived brightness (r*0.299 + g*0.587 + b*0.114)
        // which is a good proxy. We add a small bias toward white for mid-range colors.
        const accentColord = colord(accentPrimary);
        const onAccent = accentColord.isDark() ? '#ffffff' : '#111111';

        // Accent hover variant: lighten dark accents, darken light ones
        const accentHover = accentColord.isDark()
            ? accentColord.lighten(0.07).toHex()
            : accentColord.darken(0.07).toHex();

        // RGB triplet for use in rgba() expressions in CSS
        const { r, g, b } = accentColord.toRgb();
        const accentRgb = `${r}, ${g}, ${b}`;

        // Generate dynamic palette from accent
        const dynamicPalette: Partial<ThemePalette> = {
            ...palette,
            'accent-primary': accentPrimary,
            // Hover variant of accent (for button hover states)
            'accent-hover': accentHover,
            // Text ON accent surfaces (buttons, badges, highlights)
            'button-text': onAccent,
            'on-accent': onAccent,
            // RGB triplet — enables rgba(var(--nh-accent-rgb), 0.15) in CSS
            'accent-rgb': accentRgb,
            // Generate secondary accent (12% opacity)
            'accent-secondary': colord(accentPrimary).alpha(0.12).toRgbString(),
            // Generate border accent
            'border-accent': accentPrimary,
            // Generate focus ring (transparent accent)
            'ring-focus': colord(accentPrimary).alpha(0.4).toHex(),
            // Generate glow accent variants
            'glow-accent-sm': `0 0 8px ${colord(accentPrimary).alpha(0.25).toRgbString()}`,
            'glow-accent-md': `0 0 14px ${colord(accentPrimary).alpha(0.35).toRgbString()}`,
            'glow-accent-lg': `0 0 22px ${colord(accentPrimary).alpha(0.45).toRgbString()}`,
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
        await this.app.api.invoke('config:set', CONFIG_KEY_CURRENT_THEME, name);
        this.app.events.emit('theme:changed', { name, palette });

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
    protected async onLoad(): Promise<void> {
        this.log('info', 'Loading...');

        // Register default themes
        this.themes.set('deep-space', DEEP_SPACE_THEME);
        this.themes.set('light', LIGHT_THEME);
        this.log('info', 'Default themes registered');

        // Register API methods
        this.registerApi('theme:register', this.handleRegister);
        this.registerApi('theme:set', this.handleSet);
        this.registerApi('theme:get-current', this.handleGetCurrent);
        this.registerApi('theme:list', this.handleList);
        this.registerApi('theme:get', this.handleGet);

        // Load saved theme preference
        const savedTheme = await this.app.api.invoke<string | undefined>(
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

        // Apply UI Settings (Animations)
        const uiAnimations = await this.app.api.invoke<boolean>('config:get', 'ui.animations');
        if (uiAnimations === false) {
            document.body.classList.add('nh-disable-animations');
        }

        // Subscribe to accent color changes for live preview
        this.registerEvent('config:updated', async (payload: any) => {
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
                await this.app.api.invoke('config:set', 'theme.accent-primary', newColor);
            } else if (payload.key === CONFIG_KEY_CURRENT_THEME) {
                // Handle external theme changes (e.g. from settings sync)
                if (payload.value !== this.currentTheme) {
                    await this.handleSet(payload.value as string);
                }
            } else if (payload.key === 'ui.animations') {
                if (payload.value) {
                    document.body.classList.remove('nh-disable-animations');
                } else {
                    document.body.classList.add('nh-disable-animations');
                }
            }
        });

        this.log('info', 'Loaded successfully');
    }

    /**
     * Called when all plugins are loaded
     */
    protected async onPluginReady(): Promise<void> {
        // Register translations
        this.app.api.invoke('i18n:register-namespace', 'theme', { en: en.theme, ru: ru.theme });

        // Register Settings (safe to do here as settings-manager is guaranteed to be loaded)
        await registerThemeSettings(this.app);

        // Listen for language changes to update translation in settings
        this.registerEvent('i18n:language-changed', async () => {
            await registerThemeSettings(this.app);
        });

        // Listen for bulk config reloads (e.g. vault switch)
        this.registerEvent('config:reloaded', async () => {
            this.log('info', 'Config reloaded, refreshing theme...');

            // Re-fetch current theme preference
            const savedTheme = await this.app.api.invoke<string | undefined>('config:get', CONFIG_KEY_CURRENT_THEME);

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
    protected async onUnload(): Promise<void> {
        this.log('info', 'Unloading...');

        // Stop listener
        if (this.systemMediaQuery) {
            this.systemMediaQuery.removeEventListener('change', this.handleSystemThemeChange);
            this.systemMediaQuery = null;
        }

        // Clear theme from DOM
        this.clearTheme();

        // Clear state
        this.themes.clear();

        this.log('info', 'Unloaded');
    }
}

// Default export for dynamic loading
export default ThemeManagerPlugin;
