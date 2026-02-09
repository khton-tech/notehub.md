import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { NotehubCore, NotehubProvider, type IPlugin } from '@notehub/core';
import { Bootloader, type LoadablePlugin, type PluginManifest } from '@notehub/bootloader';
import { LayoutRenderer } from '@notehub/layout-manager';
import { AppLogo } from '@notehub/icon-manager';
import { open } from '@tauri-apps/plugin-shell';
import './index.css';

/**
 * Plugin registry entry from generated JSON
 */
interface PluginRegistryEntry {
    id: string;
    name: string;
    version: string;
    type: string;
    dependencies?: string[];
}

/**
 * Plugin module that exports a plugin class
 */
interface PluginModule {
    default?: new () => IPlugin;
    [key: string]: unknown;
}

/**
 * Global core instance for the application
 */
let coreInstance: NotehubCore | null = null;

// Expose for DevTools debugging
declare global {
    interface Window {
        __NOTEHUB__: NotehubCore | null;
    }
}

/**
 * Get the core instance (for use in components if needed)
 */
export function getCore(): NotehubCore | null {
    return coreInstance;
}

/**
 * Convert plugin ID to package name
 * Examples:
 *   "nh.system.logger" -> "@notehub/logger"
 *   "nh.ui.theme-manager" -> "@notehub/theme-manager"
 *   "nh.features.vault-picker" -> "@notehub/vault-picker"
 */
function pluginIdToPackageName(id: string): string {
    const parts = id.split('.');
    const name = parts[parts.length - 1];
    return `@notehub/${name}`;
}

/**
 * Dynamically import a plugin by its package name
 */
async function importPlugin(packageName: string): Promise<PluginModule> {
    // Use dynamic import with the package name
    // Vite will handle the resolution at build time
    switch (packageName) {
        // System plugins
        case '@notehub/logger':
            return import('@notehub/logger');
        case '@notehub/fs-manager':
            return import('@notehub/fs-manager');
        case '@notehub/state-manager':
            return import('@notehub/state-manager');
        case '@notehub/context-manager':
            return import('@notehub/context-manager');
        case '@notehub/fs-driver-tauri':
            return import('@notehub/fs-driver-tauri');
        case '@notehub/config-manager':
            return import('@notehub/config-manager');
        case '@notehub/synapse':
            return import('@notehub/synapse');
        case '@notehub/drag-drop':
            return import('@notehub/drag-drop');
        case '@notehub/titlebar':
            return import('@notehub/titlebar');
        case '@notehub/bootloader':
            return import('@notehub/bootloader');
        case '@notehub/command-manager':
            return import('@notehub/command-manager');
        case '@notehub/keymap':
            return import('@notehub/keymap');

        // UI plugins
        case '@notehub/theme-manager':
            return import('@notehub/theme-manager');
        case '@notehub/icon-manager':
            return import('@notehub/icon-manager');
        case '@notehub/controllers-manager':
            return import('@notehub/controllers-manager');
        case '@notehub/ck-standard':
            return import('@notehub/ck-standard');
        case '@notehub/dialog-manager':
            return import('@notehub/dialog-manager');
        case '@notehub/context-menu':
            return import('@notehub/context-menu');
        case '@notehub/layout-manager':
            return import('@notehub/layout-manager');
        case '@notehub/settings-manager':
            return import('@notehub/settings-manager');


        // Feature plugins
        case '@notehub/vault-picker':
            return import('@notehub/vault-picker');
        case '@notehub/workbench':
            return import('@notehub/workbench');
        case '@notehub/explorer':
            return import('@notehub/explorer');
        case '@notehub/editor':
            return import('@notehub/editor');
        case '@notehub/keybindings':
            return import('@notehub/keybindings');
        case '@notehub/about':
            return import('@notehub/about');
        case '@notehub/backlinks':
            return import('@notehub/backlinks');
        case '@notehub/command-palette':
            return import('@notehub/command-palette');

        default:
            throw new Error(`Unknown plugin package: ${packageName}`);
    }
}

/**
 * Extract plugin class from module
 */
function extractPluginClass(module: PluginModule, manifest: PluginRegistryEntry): (new () => IPlugin) | null {
    // Try default export first
    if (module.default && typeof module.default === 'function') {
        return module.default as new () => IPlugin;
    }

    // Try named export based on manifest name + "Plugin"
    const namedExport = `${manifest.name}Plugin`;
    if (module[namedExport] && typeof module[namedExport] === 'function') {
        return module[namedExport] as new () => IPlugin;
    }

    // Try any export that looks like a plugin class
    for (const key of Object.keys(module)) {
        if (key.endsWith('Plugin') && typeof module[key] === 'function') {
            return module[key] as new () => IPlugin;
        }
    }

    return null;
}

/**
 * Initialize the Notehub.md application with dynamic plugin loading
 */
async function initApp(onStatusUpdate: (status: string) => void): Promise<NotehubCore> {
    onStatusUpdate('Initializing Core...');
    console.log('[Desktop] Starting Notehub.md (Dynamic Bootstrap)...');

    // Create core kernel
    const core = new NotehubCore();
    coreInstance = core;
    window.__NOTEHUB__ = core; // Expose for DevTools debugging

    // Register host capabilities
    core.api.register('shell:open', async (url: string) => {
        try {
            await open(url);
        } catch (error) {
            console.error('[Desktop] Failed to open URL:', url, error);
        }
    });

    // ===== PHASE 1: Load Plugin Registry =====
    onStatusUpdate('Loading Plugin Registry...');
    console.log('[Desktop] Phase 1: Loading plugin registry...');

    let registry: PluginRegistryEntry[];
    try {
        const registryModule = await import('./generated/plugin-registry.json');
        registry = registryModule.default as PluginRegistryEntry[];
        console.log(`[Desktop] Found ${registry.length} plugins in registry`);
    } catch (error) {
        console.error('[Desktop] Failed to load plugin registry:', error);
        throw new Error('Plugin registry not found. Run "pnpm run link-plugins" first.');
    }

    // ===== PHASE 2: Dynamic Plugin Import =====
    onStatusUpdate('Loading Plugins...');
    console.log('[Desktop] Phase 2: Dynamic plugin import...');

    const loadablePlugins: LoadablePlugin[] = [];
    const pluginInstances: IPlugin[] = [];

    for (const entry of registry) {
        // Skip bootloader - it's the orchestrator, not a regular plugin
        if (entry.id === 'nh.system.bootloader') {
            continue;
        }

        const packageName = pluginIdToPackageName(entry.id);

        try {
            console.log(`[Desktop]   Importing ${entry.id} from ${packageName}...`);
            const module = await importPlugin(packageName);
            const PluginClass = extractPluginClass(module, entry);

            if (!PluginClass) {
                console.error(`[Desktop]   ✗ No plugin class found in ${packageName}`);
                continue;
            }

            const plugin = new PluginClass();
            pluginInstances.push(plugin);

            // Register with core
            core.registerPlugin(plugin);

            // Convert manifest to bootloader format
            // IMPORTANT: Use entry.dependencies from registry (has correct data from manifest.json)
            // NOT plugin.manifest.dependencies which may be undefined
            const coreManifest = plugin.manifest;
            const bootloaderManifest: PluginManifest = {
                id: coreManifest.id,
                name: coreManifest.name,
                version: coreManifest.version,
                type: coreManifest.type as 'system' | 'ui' | 'feature',
                // Use entry.dependencies from registry - these have the correct values
                dependencies: (entry.dependencies || []).reduce((acc, dep) => {
                    acc[dep] = '*';
                    return acc;
                }, {} as Record<string, string>),
                optionalDependencies: {},
            };

            // Prepare for bootloader
            loadablePlugins.push({
                manifest: bootloaderManifest,
                init: (app) => plugin.load(app),
            });

            console.log(`[Desktop]   ✓ ${entry.id} imported successfully`);
        } catch (error) {
            console.error(`[Desktop]   ✗ Failed to import ${entry.id}:`, error);
            if (error instanceof Error) {
                console.error(`[Desktop]   Details: ${error.message}`);
                console.error(`[Desktop]   Stack: ${error.stack}`);
            }
            // Continue with other plugins - one failure shouldn't crash the app
        }
    }

    console.log(`[Desktop] Successfully imported ${pluginInstances.length} plugins`);

    // ===== PHASE 3: Bootloader Initialization =====
    onStatusUpdate('Starting Bootloader...');
    console.log('[Desktop] Phase 3: Bootloader initialization...');

    const bootloader = new Bootloader(core);
    const result = await bootloader.load(loadablePlugins);

    console.log('[Desktop] Bootloader result:');
    console.log(`[Desktop]   Loaded: ${result.loaded.length}`);
    console.log(`[Desktop]   Failed: ${result.failed.length}`);
    console.log(`[Desktop]   Skipped: ${result.skipped.length}`);
    console.log(`[Desktop]   Waves: ${result.waves.length}`);

    if (result.failed.length > 0) {
        console.warn('[Desktop] Failed plugins:', result.failed);
    }
    if (result.skipped.length > 0) {
        console.warn('[Desktop] Skipped plugins:', result.skipped);
    }

    // Mark core as initialized
    core.setInitialized(true);

    // ===== PHASE 4: onReady Lifecycle =====
    onStatusUpdate('Finalizing...');
    console.log('[Desktop] Phase 4: Calling onReady on all plugins...');

    await core.callOnReady();

    onStatusUpdate('Ready');
    console.log('[Desktop] Notehub.md started successfully');

    return core;
}

// Mount React app
ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);

/**
 * App component that manages initialization state
 */
function App(): React.ReactElement {
    const [isReady, setIsReady] = useState(false);
    const [status, setStatus] = useState('Initializing...');
    const [error, setError] = useState<string | null>(null);
    const initStartedRef = React.useRef(false);

    useEffect(() => {
        // Guard against React StrictMode double-invocation
        if (initStartedRef.current) {
            console.log('[Desktop] Init already started, skipping duplicate call');
            return;
        }
        initStartedRef.current = true;

        // Minimum loading time to prevent flash
        const startTime = Date.now();

        initApp(setStatus)
            .then(async () => {
                const elapsed = Date.now() - startTime;
                if (elapsed < 1000) {
                    await new Promise(resolve => setTimeout(resolve, 1000 - elapsed));
                }
                setIsReady(true);
            })
            .catch((err) => {
                console.error('[Desktop] Failed to start:', err);
                setError(err instanceof Error ? err.message : String(err));
            });
    }, []);


    // Error state
    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-[#1a1a1a] text-red-500 font-sans p-6">
                <h1 className="text-2xl mb-4 font-bold">⚠️ Startup Error</h1>
                <p className="text-sm opacity-80 max-w-md text-center">{error}</p>
            </div>
        );
    }

    // Loading state
    if (!isReady) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-[#1a1a1a] text-[#e0e0e0] font-sans selection:bg-purple-500/30">
                <div className="relative flex items-center justify-center w-24 h-24">
                    {/* Pulsing background glow */}
                    <div className="absolute inset-0 bg-purple-500/20 blur-xl rounded-full animate-pulse"></div>

                    {/* Spinner */}
                    <div className="absolute inset-0 border-2 border-purple-500/30 rounded-full"></div>
                    <div className="absolute inset-0 border-2 border-t-purple-500 border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin"></div>

                    {/* Icon */}
                    <div className="relative z-10 flex items-center justify-center">
                        <div className="text-purple-400 drop-shadow-[0_0_10px_rgba(168,85,247,0.5)]">
                            <AppLogo size={48} className="animate-pulse" />
                        </div>
                    </div>
                </div>

                <div className="mt-8 text-center space-y-2">
                    <h1 className="text-xl font-medium tracking-wide text-white/90">
                        Notehub.md
                    </h1>
                    <p className="text-xs text-white/50 uppercase tracking-widest font-medium">
                        {status}
                    </p>
                </div>
            </div>
        );
    }

    // Ready - render the active layout
    return (
        <NotehubProvider value={coreInstance!}>
            <LayoutRenderer />
        </NotehubProvider>
    );
}
