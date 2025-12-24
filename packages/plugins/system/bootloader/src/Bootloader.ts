import type { NotehubCore } from '@notehub/core';
import {
    validateManifestOrThrow,
    type PluginManifest
} from './schema.js';
import {
    DependencyGraph,
    topologicalSort,
    CyclicDependencyError,
    type PluginStatus,
    type TopologicalSortResult
} from './graph/index.js';

/**
 * Plugin instance that can be loaded
 */
export interface LoadablePlugin {
    /** Plugin manifest */
    manifest: PluginManifest;
    /** Initialization function */
    init: (app: NotehubCore) => Promise<void> | void;
}

/**
 * Result of loading a single plugin
 */
export interface PluginLoadResult {
    /** Plugin ID */
    pluginId: string;
    /** Final status */
    status: PluginStatus;
    /** Error if failed */
    error?: Error;
    /** ID of failed dependency if skipped */
    failedDependency?: string;
}

/**
 * Result of the bootloader load operation
 */
export interface BootloaderResult {
    /** Whether all plugins loaded successfully */
    success: boolean;
    /** Results for each plugin */
    pluginResults: Map<string, PluginLoadResult>;
    /** Plugins that loaded successfully */
    loaded: string[];
    /** Plugins that failed */
    failed: string[];
    /** Plugins skipped due to dependency failures */
    skipped: string[];
    /** Load order waves for debugging */
    waves: string[][];
}

/**
 * Bootloader - Plugin Orchestrator
 * 
 * Manages the discovery, resolution, and initialization of plugins.
 * Implements wavefront parallel loading with cascading failure handling.
 * 
 * Lifecycle (RFC Sections 4-7):
 * 1. **Discovery**: Accept raw manifests and validate them
 * 2. **Resolution**: Build dependency graph and verify all required deps exist
 * 3. **Sort**: Use Kahn's algorithm to determine load order waves
 * 4. **Initialization**: Load plugins in waves, handling failures gracefully
 * 
 * Cascading Failure (RFC Section 7):
 * - If plugin A fails, all plugins depending on A are marked SKIPPED_DEPENDENCY
 * - Skipped plugins do not block their own dependents (cascading effect)
 * 
 * @example
 * ```ts
 * const bootloader = new Bootloader(app);
 * 
 * const result = await bootloader.load([
 *   { manifest: loggerManifest, init: (app) => logger.init(app) },
 *   { manifest: storageManifest, init: (app) => storage.init(app) },
 * ]);
 * 
 * console.log(`Loaded: ${result.loaded.length}, Failed: ${result.failed.length}`);
 * ```
 */
export class Bootloader {
    private app: NotehubCore;
    private graph: DependencyGraph;
    private plugins: Map<string, LoadablePlugin>;
    private results: Map<string, PluginLoadResult>;
    private failedPlugins: Set<string>;

    private static readonly SOURCE = 'Bootloader';

    constructor(app: NotehubCore) {
        this.app = app;
        this.graph = new DependencyGraph();
        this.plugins = new Map();
        this.results = new Map();
        this.failedPlugins = new Set();
    }

    /**
     * Log a message via the Logger plugin
     */
    private log(level: 'info' | 'warn' | 'error', message: string): void {
        this.app.api.invoke(`logger:${level}`, Bootloader.SOURCE, message);
    }

    /**
     * Main entry point: Load all plugins
     * 
     * @param rawPlugins - Array of loadable plugins (manifest + init function)
     * @returns Bootloader result with status of all plugins
     */
    async load(rawPlugins: LoadablePlugin[]): Promise<BootloaderResult> {
        this.log('info', `Starting load of ${rawPlugins.length} plugin(s)`);

        // Phase 1: Discovery - Validate manifests and collect plugins
        const validatedPlugins = this.discover(rawPlugins);

        // Phase 2: Resolution - Build dependency graph
        this.resolve(validatedPlugins);

        // Phase 3: Sort - Get load order waves
        let sortResult: TopologicalSortResult;
        try {
            sortResult = topologicalSort(this.graph);
        } catch (error) {
            if (error instanceof CyclicDependencyError) {
                this.log('error', `Cyclic dependency detected: ${error.involvedPlugins.join(', ')}`);
                // Mark all cycle participants as failed
                for (const pluginId of error.involvedPlugins) {
                    this.markFailed(pluginId, error);
                }
                return this.buildResult([]);
            }
            throw error;
        }

        this.log('info', `Load order: ${sortResult.waves.length} wave(s)`);
        for (let i = 0; i < sortResult.waves.length; i++) {
            this.log('info', `  Wave ${i}: ${sortResult.waves[i]!.join(', ')}`);
        }

        // Phase 4: Initialization - Wavefront parallel loading
        await this.initializeWavefront(sortResult.waves);

        return this.buildResult(sortResult.waves);
    }

    /**
     * Phase 1: Discovery
     * Validate raw manifests and filter out invalid ones
     */
    private discover(rawPlugins: LoadablePlugin[]): LoadablePlugin[] {
        this.log('info', 'Phase 1: Discovery');
        const valid: LoadablePlugin[] = [];

        for (const plugin of rawPlugins) {
            try {
                // Re-validate manifest to ensure it's correct
                const validatedManifest = validateManifestOrThrow(plugin.manifest);
                valid.push({
                    manifest: validatedManifest,
                    init: plugin.init,
                });
                this.log('info', `  ✓ Validated: ${validatedManifest.id}`);
            } catch (error) {
                const pluginId = (plugin.manifest as any)?.id ?? 'unknown';
                this.log('error', `  ✗ Invalid manifest for "${pluginId}": ${error instanceof Error ? error.message : String(error)}`);
                // Skip invalid plugins
            }
        }

        return valid;
    }

    /**
     * Phase 2: Resolution
     * Build the dependency graph
     */
    private resolve(plugins: LoadablePlugin[]): void {
        this.log('info', 'Phase 2: Resolution');

        // Reset state
        this.graph = new DependencyGraph();
        this.plugins.clear();
        this.results.clear();
        this.failedPlugins.clear();

        // Add all plugins to graph
        for (const plugin of plugins) {
            this.graph.addNode(plugin.manifest);
            this.plugins.set(plugin.manifest.id, plugin);
        }

        // Build edges (handles missing required dependencies by throwing)
        try {
            this.graph.buildEdges();
        } catch (error) {
            // If a required dependency is missing, we need to handle it gracefully
            this.log('error', `Resolution failed: ${error instanceof Error ? error.message : String(error)}`);
            throw error;
        }

        this.log('info', '  Graph built successfully');
    }

    /**
     * Phase 4: Initialization
     * Process waves sequentially, plugins within wave in parallel
     */
    private async initializeWavefront(waves: string[][]): Promise<void> {
        this.log('info', 'Phase 4: Initialization (Wavefront)');

        for (let waveIndex = 0; waveIndex < waves.length; waveIndex++) {
            const wave = waves[waveIndex]!;
            this.log('info', `  Processing Wave ${waveIndex}...`);

            // Filter out plugins that should be skipped due to failed dependencies
            const toLoad: string[] = [];
            for (const pluginId of wave) {
                if (this.shouldSkip(pluginId)) {
                    // Already marked as skipped by cascading failure
                    continue;
                }
                toLoad.push(pluginId);
            }

            if (toLoad.length === 0) {
                this.log('info', `  Wave ${waveIndex}: all plugins skipped`);
                continue;
            }

            // Load plugins in parallel using Promise.allSettled
            const loadPromises = toLoad.map(pluginId => this.loadPlugin(pluginId));
            const settledResults = await Promise.allSettled(loadPromises);

            // Process results
            for (let i = 0; i < toLoad.length; i++) {
                const pluginId = toLoad[i]!;
                const result = settledResults[i]!;

                if (result.status === 'fulfilled') {
                    this.markLoaded(pluginId);
                    this.log('info', `    ✓ Loaded: ${pluginId}`);
                } else {
                    const reason = result.reason instanceof Error
                        ? result.reason
                        : new Error(String(result.reason));
                    this.markFailed(pluginId, reason);
                    this.log('error', `    ✗ Failed: ${pluginId} - ${reason.message}`);

                    // Cascade failure to dependents
                    this.cascadeFailure(pluginId);
                }
            }
        }
    }

    /**
     * Load a single plugin
     */
    private async loadPlugin(pluginId: string): Promise<void> {
        const plugin = this.plugins.get(pluginId);
        if (!plugin) {
            throw new Error(`Plugin "${pluginId}" not found`);
        }

        this.graph.setStatus(pluginId, 'LOADING');

        // Call the plugin's init function
        await plugin.init(this.app);
    }

    /**
     * Check if a plugin should be skipped due to failed dependencies
     */
    private shouldSkip(pluginId: string): boolean {
        // Check if already marked
        const existingResult = this.results.get(pluginId);
        if (existingResult && existingResult.status === 'SKIPPED_DEPENDENCY') {
            return true;
        }

        // Check if any dependency has failed
        const dependencies = this.graph.getDependencies(pluginId);
        for (const depId of dependencies) {
            if (this.failedPlugins.has(depId)) {
                // Mark as skipped
                this.markSkipped(pluginId, depId);
                return true;
            }
        }

        return false;
    }

    /**
     * Cascade failure to all dependents of a failed plugin
     */
    private cascadeFailure(failedPluginId: string): void {
        const dependents = this.graph.getDependents(failedPluginId);

        for (const dependentId of dependents) {
            if (!this.results.has(dependentId)) {
                this.markSkipped(dependentId, failedPluginId);
                this.log('warn', `    ⊘ Skipped: ${dependentId} (depends on failed ${failedPluginId})`);

                // Recursively cascade to dependents of the skipped plugin
                this.cascadeFailure(dependentId);
            }
        }
    }

    /**
     * Mark a plugin as loaded
     */
    private markLoaded(pluginId: string): void {
        this.graph.setStatus(pluginId, 'LOADED');
        this.results.set(pluginId, {
            pluginId,
            status: 'LOADED',
        });
    }

    /**
     * Mark a plugin as failed
     */
    private markFailed(pluginId: string, error: Error): void {
        this.graph.setStatus(pluginId, 'FAILED', error.message);
        this.results.set(pluginId, {
            pluginId,
            status: 'FAILED',
            error,
        });
        this.failedPlugins.add(pluginId);
    }

    /**
     * Mark a plugin as skipped due to dependency failure
     */
    private markSkipped(pluginId: string, failedDependency: string): void {
        this.graph.setStatus(pluginId, 'SKIPPED_DEPENDENCY', undefined, failedDependency);
        this.results.set(pluginId, {
            pluginId,
            status: 'SKIPPED_DEPENDENCY',
            failedDependency,
        });
        this.failedPlugins.add(pluginId); // Also track as "failed" for cascading
    }

    /**
     * Build the final result object
     */
    private buildResult(waves: string[][]): BootloaderResult {
        const loaded: string[] = [];
        const failed: string[] = [];
        const skipped: string[] = [];

        for (const [pluginId, result] of this.results) {
            switch (result.status) {
                case 'LOADED':
                    loaded.push(pluginId);
                    break;
                case 'FAILED':
                    failed.push(pluginId);
                    break;
                case 'SKIPPED_DEPENDENCY':
                    skipped.push(pluginId);
                    break;
            }
        }

        const success = failed.length === 0 && skipped.length === 0;

        this.log('info', 'Load complete:');
        this.log('info', `  Loaded: ${loaded.length}`);
        if (failed.length > 0) {
            this.log('warn', `  Failed: ${failed.length}`);
        }
        if (skipped.length > 0) {
            this.log('warn', `  Skipped: ${skipped.length}`);
        }

        return {
            success,
            pluginResults: new Map(this.results),
            loaded,
            failed,
            skipped,
            waves,
        };
    }
}
