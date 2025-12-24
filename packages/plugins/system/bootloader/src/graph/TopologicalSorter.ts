import { DependencyGraph } from './DependencyGraph.js';

/**
 * Error thrown when a cyclic dependency is detected
 */
export class CyclicDependencyError extends Error {
    /** Plugin IDs involved in the cycle */
    readonly involvedPlugins: string[];

    constructor(involvedPlugins: string[]) {
        const pluginList = involvedPlugins.join(', ');
        super(`Cyclic dependency detected involving plugins: ${pluginList}`);
        this.name = 'CyclicDependencyError';
        this.involvedPlugins = involvedPlugins;
    }
}

/**
 * Result of topological sorting
 */
export interface TopologicalSortResult {
    /** 
     * Waves/layers of plugins for parallel execution
     * - Wave 0: plugins with no dependencies
     * - Wave 1: plugins depending only on wave 0
     * - Wave N: plugins depending on waves 0..N-1
     */
    waves: string[][];

    /** Flat list of all plugins in load order */
    flatOrder: string[];
}

/**
 * Topological Sorter using Kahn's Algorithm
 * 
 * Produces a layered output (waves) suitable for parallel plugin loading.
 * Each wave can be loaded in parallel since all dependencies are satisfied
 * by previous waves.
 * 
 * Algorithm (RFC Section 6.1):
 * 1. Start with all nodes that have in-degree 0 (no dependencies)
 * 2. These form Wave 0
 * 3. Remove these nodes and decrement in-degrees of their dependents
 * 4. Nodes that now have in-degree 0 form Wave 1
 * 5. Repeat until all nodes are processed
 * 6. If nodes remain with in-degree > 0, there's a cycle
 * 
 * @example
 * ```ts
 * const graph = new DependencyGraph();
 * // ... add nodes and build edges
 * 
 * const sorter = new TopologicalSorter(graph);
 * const result = sorter.sort();
 * 
 * // Load in waves
 * for (const wave of result.waves) {
 *   await Promise.allSettled(wave.map(id => loadPlugin(id)));
 * }
 * ```
 */
export class TopologicalSorter {
    private graph: DependencyGraph;

    constructor(graph: DependencyGraph) {
        this.graph = graph;
    }

    /**
     * Perform topological sort using Kahn's Algorithm
     * 
     * @returns Sorted waves and flat order
     * @throws CyclicDependencyError if a cycle is detected
     */
    sort(): TopologicalSortResult {
        // Clone in-degree map since we'll modify it
        const inDegree = this.graph.cloneInDegree();
        const waves: string[][] = [];
        const flatOrder: string[] = [];
        let processedCount = 0;
        const totalNodes = this.graph.size;

        // Find initial wave: nodes with in-degree 0
        let currentWave = this.getNodesWithInDegree(inDegree, 0);

        while (currentWave.length > 0) {
            // Add current wave to result
            waves.push([...currentWave]);
            flatOrder.push(...currentWave);
            processedCount += currentWave.length;

            // Prepare next wave
            const nextWave: string[] = [];

            for (const pluginId of currentWave) {
                // Get all plugins that depend on this one
                const dependents = this.graph.getDependents(pluginId);

                for (const dependentId of dependents) {
                    // Decrement in-degree
                    const newDegree = inDegree.get(dependentId)! - 1;
                    inDegree.set(dependentId, newDegree);

                    // If in-degree becomes 0, add to next wave
                    if (newDegree === 0) {
                        nextWave.push(dependentId);
                    }
                }
            }

            currentWave = nextWave;
        }

        // Cycle detection: if not all nodes processed, there's a cycle
        if (processedCount < totalNodes) {
            const cycleNodes = this.findCycleNodes(inDegree);
            throw new CyclicDependencyError(cycleNodes);
        }

        return { waves, flatOrder };
    }

    /**
     * Get nodes with the specified in-degree
     */
    private getNodesWithInDegree(inDegree: Map<string, number>, degree: number): string[] {
        const result: string[] = [];
        for (const [nodeId, deg] of inDegree) {
            if (deg === degree) {
                result.push(nodeId);
            }
        }
        return result;
    }

    /**
     * Find nodes involved in a cycle (nodes with remaining in-degree > 0)
     */
    private findCycleNodes(inDegree: Map<string, number>): string[] {
        const cycleNodes: string[] = [];
        for (const [nodeId, deg] of inDegree) {
            if (deg > 0) {
                cycleNodes.push(nodeId);
            }
        }
        return cycleNodes;
    }
}

/**
 * Convenience function to sort a dependency graph
 * 
 * @param graph - The dependency graph to sort
 * @returns Topological sort result with waves
 * @throws CyclicDependencyError if a cycle is detected
 */
export function topologicalSort(graph: DependencyGraph): TopologicalSortResult {
    const sorter = new TopologicalSorter(graph);
    return sorter.sort();
}
