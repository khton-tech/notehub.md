import { NotehubCore, type IPlugin } from '@notehub/core';
import { Bootloader, type LoadablePlugin, type PluginManifest } from '@notehub/bootloader';
import type { BootstrapConfig } from './types.js';
import { pluginIdToPackageName, extractPluginClass } from './utils.js';

/**
 * Initialize the Notehub.md application using the provided platform config.
 *
 * Phases:
 *   1. Create core, register host capabilities
 *   2. Load plugin registry JSON
 *   3. Dynamically import and instantiate all plugins
 *   4. Run Bootloader for dependency-ordered loading
 *   5. Call onReady on all plugins
 *
 * @param config - Platform-specific bootstrap configuration
 * @param onStatusUpdate - Callback for status updates (shown in loading UI)
 * @returns The initialized NotehubCore instance
 */
export async function initNotehubApp(
    config: BootstrapConfig,
    onStatusUpdate: (status: string) => void
): Promise<NotehubCore> {
    const tag = `[${config.platform}]`;

    onStatusUpdate('Initializing Core...');
    console.log(`${tag} Starting Notehub.md (Dynamic Bootstrap)...`);

    // Create core kernel
    const core = new NotehubCore();

    // Register platform-specific host capabilities (e.g., shell:open)
    config.registerHostCapabilities(core);

    // ===== PHASE 1: Load Plugin Registry =====
    onStatusUpdate('Loading Plugin Registry...');
    console.log(`${tag} Phase 1: Loading plugin registry...`);

    let registry;
    try {
        registry = await config.loadRegistry();
        console.log(`${tag} Found ${registry.length} plugins in registry`);
    } catch (error) {
        console.error(`${tag} Failed to load plugin registry:`, error);
        throw new Error('Plugin registry not found. Run "pnpm run link-plugins" first.');
    }

    // Build skip set
    const skipIds = new Set(config.skipPluginIds ?? []);

    // ===== PHASE 2: Dynamic Plugin Import =====
    onStatusUpdate('Loading Plugins...');
    console.log(`${tag} Phase 2: Dynamic plugin import...`);

    const loadablePlugins: LoadablePlugin[] = [];
    const pluginInstances: IPlugin[] = [];

    for (const entry of registry) {
        // Skip bootloader — it's the orchestrator, not a regular plugin
        if (entry.id === 'nh.system.bootloader') {
            continue;
        }

        // Skip platform-incompatible plugins
        if (skipIds.has(entry.id)) {
            console.log(`${tag}   Skipping ${entry.id}`);
            continue;
        }

        const packageName = pluginIdToPackageName(entry.id);

        try {
            console.log(`${tag}   Importing ${entry.id} from ${packageName}...`);
            const module = await config.importPlugin(packageName);
            const PluginClass = extractPluginClass(module, entry);

            if (!PluginClass) {
                console.error(`${tag}   No plugin class found in ${packageName}`);
                continue;
            }

            const plugin = new PluginClass();

            if (!plugin || typeof plugin.load !== 'function' || !plugin.manifest?.id) {
                console.error(`${tag}   Invalid plugin instance from ${packageName}`);
                continue;
            }

            pluginInstances.push(plugin);

            // Register with core
            core.registerPlugin(plugin);

            // Convert manifest to bootloader format
            const coreManifest = plugin.manifest;
            const bootloaderManifest: PluginManifest = {
                id: coreManifest.id,
                name: coreManifest.name,
                version: coreManifest.version,
                type: coreManifest.type as 'system' | 'ui' | 'feature',
                dependencies: (entry.dependencies ?? []).reduce((acc, dep) => {
                    acc[dep] = '*';
                    return acc;
                }, {} as Record<string, string>),
                optionalDependencies: {},
            };

            loadablePlugins.push({
                manifest: bootloaderManifest,
                init: (app) => plugin.load(app),
            });

            console.log(`${tag}   ${entry.id} imported successfully`);
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            if (msg.includes('Unknown plugin package')) {
                console.warn(`${tag}   Skipping incompatible/unknown plugin: ${packageName}`);
            } else {
                console.error(`${tag}   Failed to import ${entry.id}:`, error);
            }
        }
    }

    console.log(`${tag} Successfully imported ${pluginInstances.length} plugins`);

    // ===== PHASE 3: Bootloader Initialization =====
    onStatusUpdate('Starting Bootloader...');
    console.log(`${tag} Phase 3: Bootloader initialization...`);

    const bootloader = new Bootloader(core);
    const result = await bootloader.load(loadablePlugins);

    console.log(`${tag} Bootloader result:`);
    console.log(`${tag}   Loaded: ${result.loaded.length}`);
    console.log(`${tag}   Failed: ${result.failed.length}`);
    console.log(`${tag}   Skipped: ${result.skipped.length}`);
    console.log(`${tag}   Waves: ${result.waves.length}`);

    if (result.failed.length > 0) {
        console.warn(`${tag} Failed plugins:`, result.failed);
    }
    if (result.skipped.length > 0) {
        console.warn(`${tag} Skipped plugins:`, result.skipped);
    }

    // Mark core as initialized
    core.setInitialized(true);

    // ===== PHASE 4: onReady Lifecycle =====
    onStatusUpdate('Finalizing...');
    console.log(`${tag} Phase 4: Calling onReady on all plugins...`);

    await core.callOnReady();

    onStatusUpdate('Ready');
    console.log(`${tag} Notehub.md started successfully`);

    return core;
}
