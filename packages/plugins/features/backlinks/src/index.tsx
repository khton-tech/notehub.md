/**
 * @fileoverview Backlinks Plugin Entry Point
 */

import type { IPlugin, NotehubCore, PluginManifest } from '@notehub/core';
import { WikiLink } from './components/WikiLink';
import { PathResolver } from './logic/PathResolver';

export class BacklinksPlugin implements IPlugin {
    readonly manifest: PluginManifest = {
        id: 'nh.features.backlinks',
        name: 'Backlinks',
        version: '0.1.5',
        type: 'feature',
        dependencies: [
            'nh.features.editor',
            'nh.system.fs-manager'
        ]
    };

    async load(app: NotehubCore): Promise<void> {
        // Register API for resolving paths (optional ecosystem hook)
        // Wrappers to satisfy strict ApiHandler type: (...args: unknown[]) => unknown
        app.api.register('backlinks:resolve', (async (path: unknown) => {
            if (typeof path === 'string') {
                const resolver = new PathResolver(app);
                return await resolver.resolveLink(path);
            }
            return '';
        }) as any); // Cast to any to bypass keyof NotehubApiMap check if strict

        // Register the WikiLink portal
        app.api.invoke('editor:register-portal', {
            id: 'wiki-link',
            // Regex: [[Target|Alias]] or [[Target]]
            // Capture group 1: Target
            // Capture group 2: Alias (optional)
            regex: /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,
            component: WikiLink,
            name: 'WikiLink'
        });

        console.log('[Backlinks] Loaded');
    }

    async unload(app: NotehubCore): Promise<void> {
        app.api.unregister('backlinks:resolve');
        // Portals generally persist or need unregistering logic if supported.
        // Assuming editor:unregister-portal isn't strictly required or implemented yet based on prompt.
    }
}

export default BacklinksPlugin;
