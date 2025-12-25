import type { PluginManifest } from '../schema.js';

/**
 * Plugin status during the loading process
 */
export type PluginStatus =
    | 'PENDING'           // Waiting to be loaded
    | 'LOADING'           // Currently loading
    | 'LOADED'            // Successfully loaded
    | 'FAILED'            // Failed to load
    | 'SKIPPED_DEPENDENCY'; // Skipped due to failed dependency

/**
 * Node in the dependency graph representing a plugin
 */
export interface DependencyNode {
    /** Plugin manifest */
    manifest: PluginManifest;
    /** Current loading status */
    status: PluginStatus;
    /** Error message if status is FAILED */
    error?: string;
    /** ID of the failed dependency if status is SKIPPED_DEPENDENCY */
    failedDependency?: string;
}

/**
 * Dependency Graph for plugin resolution
 * 
 * Manages the dependency relationships between plugins and tracks
 * their loading status. Handles both required and optional dependencies.
 * 
 * Key behaviors (RFC Section 4.1):
 * - Required dependencies create hard edges; missing required deps = failure
 * - Optional dependencies create edges ONLY if the dependency exists in the system
 * - Self-dependencies are ignored
 * 
 * @example
 * ```ts
 * const graph = new DependencyGraph();
 * graph.addNode(loggerManifest);
 * graph.addNode(storageManifest);
 * graph.buildEdges();
 * 
 * console.log(graph.getDependents('nh.system.logger')); // Plugins that depend on logger
 * ```
 */
export class DependencyGraph {
    /** Map of plugin ID to node data */
    private nodes: Map<string, DependencyNode> = new Map();

    /** Adjacency list: nodeId -> array of plugin IDs it depends on */
    private adjacencyList: Map<string, string[]> = new Map();

    /** Reverse adjacency list: nodeId -> array of plugin IDs that depend on it */
    private dependents: Map<string, Set<string>> = new Map();

    /** In-degree count for each node (number of unresolved dependencies) */
    private inDegree: Map<string, number> = new Map();

    /**
     * Add a plugin node to the graph
     * 
     * @param manifest - Plugin manifest to add
     * @throws Error if plugin with same ID already exists
     */
    addNode(manifest: PluginManifest): void {
        if (this.nodes.has(manifest.id)) {
            throw new Error(`Plugin "${manifest.id}" is already in the graph`);
        }

        this.nodes.set(manifest.id, {
            manifest,
            status: 'PENDING',
        });

        this.adjacencyList.set(manifest.id, []);
        this.dependents.set(manifest.id, new Set());
        this.inDegree.set(manifest.id, 0);
    }

    /**
     * Add multiple plugin nodes to the graph
     * 
     * @param manifests - Array of plugin manifests to add
     */
    addNodes(manifests: PluginManifest[]): void {
        for (const manifest of manifests) {
            this.addNode(manifest);
        }
    }

    /**
     * Build edges based on plugin dependencies
     * 
     * Must be called after all nodes are added.
     * 
     * Rules (RFC Section 4.1):
     * - Required dependencies: edge created, missing = error thrown
     * - Optional dependencies: edge created ONLY if dependency exists
     * - Self-dependencies: silently ignored
     * 
     * @throws Error if a required dependency is not found in the graph
     */
    buildEdges(): void {
        for (const [pluginId, node] of this.nodes) {
            const deps: string[] = [];

            // Process required dependencies
            for (const depId of Object.keys(node.manifest.dependencies)) {
                // Ignore self-dependency
                if (depId === pluginId) {
                    console.warn(`[DependencyGraph] Plugin "${pluginId}" has self-dependency, ignoring`);
                    continue;
                }

                if (!this.nodes.has(depId)) {
                    throw new Error(
                        `Plugin "${pluginId}" requires missing dependency "${depId}"`
                    );
                }

                deps.push(depId);
            }

            // Process optional dependencies (RFC Section 4.1)
            // Edge is created ONLY if the optional dependency exists
            for (const depId of Object.keys(node.manifest.optionalDependencies)) {
                // Ignore self-dependency
                if (depId === pluginId) {
                    continue;
                }

                // Only create edge if optional dependency is present
                if (this.nodes.has(depId)) {
                    deps.push(depId);
                } else {
                    console.warn(
                        `[DependencyGraph] Optional dependency "${depId}" for "${pluginId}" not found, skipping edge`
                    );
                }
            }

            this.adjacencyList.set(pluginId, deps);
            this.inDegree.set(pluginId, deps.length);

            // Build reverse adjacency (dependents)
            for (const depId of deps) {
                this.dependents.get(depId)!.add(pluginId);
            }
        }
    }

    /**
     * Get a node by plugin ID
     */
    getNode(pluginId: string): DependencyNode | undefined {
        return this.nodes.get(pluginId);
    }

    /**
     * Get all nodes in the graph
     */
    getAllNodes(): Map<string, DependencyNode> {
        return new Map(this.nodes);
    }

    /**
     * Get node count
     */
    get size(): number {
        return this.nodes.size;
    }

    /**
     * Get the dependencies of a plugin
     * 
     * @param pluginId - Plugin ID
     * @returns Array of plugin IDs this plugin depends on
     */
    getDependencies(pluginId: string): string[] {
        return this.adjacencyList.get(pluginId) ?? [];
    }

    /**
     * Get all plugins that depend on the given plugin
     * 
     * @param pluginId - Plugin ID
     * @returns Set of plugin IDs that depend on this plugin
     */
    getDependents(pluginId: string): Set<string> {
        return this.dependents.get(pluginId) ?? new Set();
    }

    /**
     * Get the in-degree (number of dependencies) for a plugin
     */
    getInDegree(pluginId: string): number {
        return this.inDegree.get(pluginId) ?? 0;
    }

    /**
     * Get all plugin IDs with the specified in-degree
     * 
     * @param degree - In-degree to match
     * @returns Array of plugin IDs with that in-degree
     */
    getNodesWithInDegree(degree: number): string[] {
        const result: string[] = [];
        for (const [pluginId, inDeg] of this.inDegree) {
            if (inDeg === degree) {
                result.push(pluginId);
            }
        }
        return result;
    }

    /**
     * Update the status of a plugin node
     * 
     * @param pluginId - Plugin ID
     * @param status - New status
     * @param error - Optional error message (for FAILED status)
     * @param failedDependency - Optional failed dependency ID (for SKIPPED_DEPENDENCY)
     */
    setStatus(
        pluginId: string,
        status: PluginStatus,
        error?: string,
        failedDependency?: string
    ): void {
        const node = this.nodes.get(pluginId);
        if (!node) {
            throw new Error(`Plugin "${pluginId}" not found in graph`);
        }

        node.status = status;
        if (error !== undefined) {
            node.error = error;
        }
        if (failedDependency !== undefined) {
            node.failedDependency = failedDependency;
        }
    }

    /**
     * Get all nodes with a specific status
     */
    getNodesByStatus(status: PluginStatus): DependencyNode[] {
        const result: DependencyNode[] = [];
        for (const node of this.nodes.values()) {
            if (node.status === status) {
                result.push(node);
            }
        }
        return result;
    }

    /**
     * Clone the in-degree map (used for topological sorting)
     */
    cloneInDegree(): Map<string, number> {
        return new Map(this.inDegree);
    }

    /**
     * Check if all nodes have been processed (no PENDING status)
     */
    isFullyProcessed(): boolean {
        for (const node of this.nodes.values()) {
            if (node.status === 'PENDING') {
                return false;
            }
        }
        return true;
    }

    /**
     * Get a summary of the graph for debugging
     */
    toDebugString(): string {
        const lines: string[] = ['DependencyGraph:'];

        for (const [id, node] of this.nodes) {
            const deps = this.adjacencyList.get(id) ?? [];
            const dependents = this.dependents.get(id) ?? new Set();
            lines.push(
                `  ${id} [${node.status}]: deps=[${deps.join(', ')}], dependents=[${[...dependents].join(', ')}]`
            );
        }

        return lines.join('\n');
    }
}
