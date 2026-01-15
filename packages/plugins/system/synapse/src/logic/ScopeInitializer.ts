/**
 * @fileoverview Shared Scope Initializer for SystemJS
 * 
 * This module sets up the "shared scope" by registering the host application's
 * React, ReactDOM, @notehub/core, @notehub/api, and @notehub/ui instances with SystemJS.
 * This enables external plugins to import these dependencies and receive the
 * same instances used by the host application.
 * 
 * @example
 * External plugins can now do:
 * ```ts
 * import React from 'react';
 * import { NotehubCore } from '@notehub/core';
 * import { NotehubPlugin, PluginContext } from '@notehub.md/api';
 * import { Button, Card, Input } from '@notehub/ui';
 * ```
 * And receive the host's instances instead of bundling their own.
 */

import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as ReactDOMClient from 'react-dom/client';
import * as NotehubCore from '@notehub/core';
import * as NotehubApi from '@notehub.md/api';
import * as NotehubUI from '@notehub/ck-standard';

// SystemJS global type declaration (SystemJS 6.x)
// Includes addImportMap for programmatic import map registration
declare const System: {
    set(id: string, module: object): void;
    import(id: string): Promise<unknown>;
    delete(id: string): boolean;
    resolve(id: string): string;
    addImportMap?(map: { imports: Record<string, string> }): void;
    prepareImport?(doProcessScripts?: boolean): Promise<void>;
};

/**
 * Synthetic URL prefix for shared scope modules
 * Using a custom protocol-like prefix to avoid conflicts
 */
const SHARED_SCOPE_PREFIX = 'notehub://shared/';

/**
 * Check if shared scope has been initialized
 */
let scopeInitialized = false;

/**
 * Initialize the SystemJS shared scope with host dependencies.
 * 
 * This function registers the following modules:
 * - `react` - React library (with default and named exports)
 * - `react-dom` - ReactDOM library
 * - `react-dom/client` - ReactDOM client API (createRoot, hydrateRoot)
 * - `@notehub/core` - Notehub core library
 * - `@notehub/api` - Notehub public API SDK for plugin development
 * - `@notehub/ui` - Notehub UI component kit (ck-standard)
 * 
 * After calling this, external plugins loaded via SystemJS can import
 * these modules and receive the host's instances.
 * 
 * @throws Error if SystemJS global is not available
 */
export function initSharedScope(): void {
    if (scopeInitialized) {
        console.warn('[ScopeInitializer] Shared scope already initialized, skipping');
        return;
    }

    if (typeof System === 'undefined') {
        throw new Error('[ScopeInitializer] SystemJS global not found. Ensure systemjs is loaded.');
    }

    // Define synthetic URLs for our shared modules
    const moduleUrls = {
        'react': `${SHARED_SCOPE_PREFIX}react`,
        'react-dom': `${SHARED_SCOPE_PREFIX}react-dom`,
        'react-dom/client': `${SHARED_SCOPE_PREFIX}react-dom-client`,
        '@notehub/core': `${SHARED_SCOPE_PREFIX}notehub-core`,
        '@notehub/api': `${SHARED_SCOPE_PREFIX}notehub-api`,
        '@notehub.md/api': `${SHARED_SCOPE_PREFIX}notehub-api`,
        '@notehub/ui': `${SHARED_SCOPE_PREFIX}notehub-ui`,
    };

    // Step 1: Add import map to map bare specifiers to our synthetic URLs
    // This allows plugins to use `import React from 'react'` 
    if (System.addImportMap) {
        System.addImportMap({
            imports: moduleUrls
        });
        console.log('[ScopeInitializer] Import map registered');
    } else {
        // Fallback: manually inject import map script tag
        const importMap = {
            imports: moduleUrls
        };
        const script = document.createElement('script');
        script.type = 'systemjs-importmap';
        script.textContent = JSON.stringify(importMap);
        document.head.appendChild(script);
        console.log('[ScopeInitializer] Import map injected via script tag');
    }

    // Step 2: Register modules at the synthetic URLs
    // SystemJS will resolve 'react' -> 'notehub://shared/react' via import map
    // Then find our pre-registered module

    // Register React with both default and named exports
    System.set(moduleUrls['react'], {
        ...React,
        default: React,
        __esModule: true,
    });

    // Register ReactDOM
    System.set(moduleUrls['react-dom'], {
        ...ReactDOM,
        default: ReactDOM,
        __esModule: true,
    });

    // Register ReactDOM/client for React 18+ createRoot API
    System.set(moduleUrls['react-dom/client'], {
        ...ReactDOMClient,
        default: ReactDOMClient,
        __esModule: true,
    });

    // Register @notehub/core
    System.set(moduleUrls['@notehub/core'], {
        ...NotehubCore,
        default: NotehubCore,
        __esModule: true,
    });

    // Register @notehub/api - Public SDK for plugin development
    System.set(moduleUrls['@notehub/api'], {
        ...NotehubApi,
        default: NotehubApi,
        __esModule: true,
    });

    // Register @notehub/ui - UI Component Kit (ck-standard)
    System.set(moduleUrls['@notehub/ui'], {
        ...NotehubUI,
        default: NotehubUI,
        __esModule: true,
    });

    scopeInitialized = true;
    console.log('[ScopeInitializer] Shared scope initialized with React, ReactDOM, @notehub/core, @notehub/api, and @notehub/ui');
}

/**
 * Check if the shared scope has been initialized
 */
export function isScopeInitialized(): boolean {
    return scopeInitialized;
}

/**
 * Reset the scope initialization flag (for testing purposes)
 * @internal
 */
export function resetScope(): void {
    scopeInitialized = false;
}
