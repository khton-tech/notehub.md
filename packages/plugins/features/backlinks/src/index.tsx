/**
 * @fileoverview Backlinks Plugin Entry Point
 * 
 * This plugin provides WikiLink (`[[...]]`) support for the Notehub editor.
 * It registers a widget that renders wikilinks as interactive elements.
 * 
 * ## Features
 * - Renders `[[Path]]` and `[[Path|Alias]]` as clickable links
 * - Theme-aware styling using CSS variables
 * - Zero configuration required
 * 
 * ## Dependencies
 * - `nh.features.editor` - Widget registration API
 * - `nh.system.fs-manager` - File operations (future)
 * 
 * @module @notehub/backlinks
 * @version 0.1.3-a
 */

import type { IPlugin, PluginManifest, NotehubCore } from '@notehub/core';
import { WikiLink, setWikiLinkCore, setVaultRoot } from './components/WikiLink';

/**
 * Regex pattern for WikiLinks
 * 
 * Matches:
 * - `[[Path]]` - captures Path in group 1
 * - `[[Path|Alias]]` - captures Path in group 1, Alias in group 2
 * 
 * Pattern breakdown:
 * - `\[\[` - Opening brackets
 * - `([^\]|]+)` - Group 1: Path (any chars except ] or |)
 * - `(?:\|([^\]]+))?` - Optional: | followed by Group 2: Alias
 * - `\]\]` - Closing brackets
 */
const WIKILINK_PATTERN = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

/**
 * Unique widget ID for registration
 */
const WIDGET_ID = 'wiki-link';

/**
 * BacklinksPlugin - Provides WikiLink rendering in the editor
 * 
 * @implements {IPlugin}
 */
export class BacklinksPlugin implements IPlugin {
    readonly manifest: PluginManifest = {
        id: 'nh.features.backlinks',
        name: 'Backlinks',
        version: '0.1.3-a',
        type: 'feature',
        dependencies: [
            'nh.features.editor',
            'nh.system.fs-manager'
        ]
    };

    private app: NotehubCore | null = null;
    private eventCleanups: Array<() => void> = [];

    /**
     * Log a message via the Logger plugin
     */
    private log(level: 'info' | 'warn' | 'error', message: string): void {
        if (this.app) {
            this.app.api.invoke(`logger:${level}`, this.manifest.id, message);
        }
    }

    /**
     * Handle vault opened event - set vault root for WikiLinks
     */
    private handleVaultOpened = (payload: unknown): void => {
        const { path } = payload as { path: string };
        setVaultRoot(path);
        this.log('info', `Vault root set: ${path}`);
    };

    /**
     * Initialize the plugin
     * 
     * Registers the WikiLink widget with the editor's widget system.
     */
    async load(app: NotehubCore): Promise<void> {
        this.app = app;
        this.log('info', 'Loading...');

        // Set Core reference for WikiLink components (includes events)
        setWikiLinkCore({
            api: app.api,
            events: app.events
        });

        // Subscribe to vault opened events to get vault root
        app.events.on('app:vault-opened', this.handleVaultOpened);
        this.eventCleanups.push(() => app.events.off('app:vault-opened', this.handleVaultOpened));

        // Try to get current vault root from state
        try {
            const currentVault = await app.api.invoke('state:get', 'app.currentVault') as string | null;
            if (currentVault) {
                setVaultRoot(currentVault);
                this.log('info', `Initial vault root: ${currentVault}`);
            }
        } catch (e) {
            // State may not be available yet
        }

        // Register the WikiLink widget with the editor
        app.api.invoke(
            'editor:register-widget',
            WIDGET_ID,
            WIKILINK_PATTERN,
            WikiLink
        );

        this.log('info', 'Loaded - WikiLink widget registered');
    }

    /**
     * Cleanup the plugin
     * 
     * Unregisters the widget to prevent memory leaks.
     */
    async unload(app: NotehubCore): Promise<void> {
        this.log('info', 'Unloading...');

        // Unsubscribe from events
        for (const cleanup of this.eventCleanups) {
            cleanup();
        }
        this.eventCleanups = [];

        // Unregister the widget
        app.api.invoke('editor:unregister-widget', WIDGET_ID);

        // Clear references
        setWikiLinkCore(null);
        setVaultRoot(null);

        this.app = null;
        this.log('info', 'Unloaded');
    }
}

export default BacklinksPlugin;
