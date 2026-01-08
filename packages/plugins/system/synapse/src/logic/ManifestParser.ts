/**
 * @fileoverview Shared Manifest Parser
 * 
 * Common manifest parsing and validation logic used by both PluginLoader
 * and ZipLoader to ensure consistent validation rules.
 */

import type { ExternalPluginManifest } from '../types.js';

/**
 * Parse and validate manifest JSON string
 * 
 * @param json - Raw JSON string from manifest.json
 * @param sourcePath - Path to the manifest file (for error messages)
 * @returns Parsed and validated manifest, or null if invalid
 */
export function parseManifest(json: string, sourcePath: string): ExternalPluginManifest | null {
    let parsed: unknown;
    try {
        parsed = JSON.parse(json);
    } catch (error) {
        console.error(`[ManifestParser] Failed to parse manifest at ${sourcePath}: ${error}`);
        return null;
    }

    // Type validation
    if (!parsed || typeof parsed !== 'object') {
        console.error(`[ManifestParser] Invalid manifest at ${sourcePath}: not an object`);
        return null;
    }

    const obj = parsed as Record<string, unknown>;

    // Required fields validation
    if (!obj.id || typeof obj.id !== 'string') {
        console.error(`[ManifestParser] Invalid manifest at ${sourcePath}: missing or invalid 'id'`);
        return null;
    }
    if (!obj.name || typeof obj.name !== 'string') {
        console.error(`[ManifestParser] Invalid manifest at ${sourcePath}: missing or invalid 'name'`);
        return null;
    }
    if (!obj.version || typeof obj.version !== 'string') {
        console.error(`[ManifestParser] Invalid manifest at ${sourcePath}: missing or invalid 'version'`);
        return null;
    }

    // Build manifest with conditional optional fields
    const result: ExternalPluginManifest = {
        id: obj.id,
        name: obj.name,
        version: obj.version,
    };

    if (typeof obj.main === 'string') {
        result.main = obj.main;
    }
    if (Array.isArray(obj.dependencies)) {
        result.dependencies = obj.dependencies;
    }

    return result;
}

/**
 * Parse manifest JSON string (throwing version)
 * 
 * @param json - Raw JSON string from manifest.json
 * @param sourcePath - Path to the manifest file (for error messages)
 * @returns Parsed and validated manifest
 * @throws Error if manifest is invalid
 */
export function parseManifestOrThrow(json: string, sourcePath: string): ExternalPluginManifest {
    const result = parseManifest(json, sourcePath);
    if (!result) {
        throw new Error(`Invalid manifest.json at ${sourcePath}`);
    }
    return result;
}

/**
 * Timeout constant for plugin loading operations
 */
export const PLUGIN_LOAD_TIMEOUT_MS = 30000; // 30 seconds

/**
 * Execute a promise with a timeout
 * 
 * @param promise - Promise to execute
 * @param timeoutMs - Timeout in milliseconds
 * @param errorMessage - Error message to show on timeout
 * @returns Result of the promise
 * @throws Error if timeout occurs
 */
export function withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    errorMessage: string
): Promise<T> {
    return Promise.race([
        promise,
        new Promise<T>((_, reject) =>
            setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
        )
    ]);
}
