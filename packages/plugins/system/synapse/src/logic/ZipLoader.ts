/**
 * @fileoverview ZIP Loader for NHP Plugin Format
 * 
 * Handles in-memory extraction of .nhp (ZIP) files without writing to disk.
 * Creates Blob URLs for dynamic module loading via SystemJS.
 * 
 * Security:
 * - Only extracts whitelisted files (manifest.json, main.js, styles.css)
 * - Validates manifest structure before returning
 * - Returns parsed data for further validation by PluginLoader
 */

import JSZip from 'jszip';
import type { ExternalPluginManifest } from '../types.js';

/**
 * Result of loading an NHP file
 */
export interface NhpLoadResult {
    /** Parsed plugin manifest */
    manifest: ExternalPluginManifest;
    /** Blob URL for the main.js module (for SystemJS import) */
    blobUrl: string;
    /** CSS content if styles.css exists in the archive */
    css?: string;
}

/**
 * Allowed files in NHP archives (security whitelist)
 */
const ALLOWED_FILES = ['manifest.json', 'main.js', 'styles.css'];

/**
 * ZipLoader - In-memory NHP file extractor
 * 
 * Extracts .nhp files (ZIP archives) in memory and creates Blob URLs
 * for dynamic loading without writing files to disk.
 */
export class ZipLoader {
    /**
     * Load an NHP file from an ArrayBuffer
     * 
     * @param buffer - Raw bytes of the .nhp file
     * @param filename - Original filename for error messages
     * @returns Parsed manifest, Blob URL for main.js, and optional CSS content
     * @throws Error if ZIP is invalid or missing required files
     */
    async loadFromBuffer(buffer: ArrayBuffer, filename: string = 'plugin.nhp'): Promise<NhpLoadResult> {
        // Step 1: Parse ZIP
        const zip = await JSZip.loadAsync(buffer);

        // Step 2: Validate required files exist
        const manifestFile = zip.file('manifest.json');
        if (!manifestFile) {
            throw new Error(`Invalid NHP: missing manifest.json in ${filename}`);
        }

        const mainJsFile = zip.file('main.js');
        if (!mainJsFile) {
            throw new Error(`Invalid NHP: missing main.js in ${filename}`);
        }

        // Step 3: Extract and parse manifest
        const manifestContent = await manifestFile.async('string');
        const manifest = this.parseManifest(manifestContent, filename);

        // Step 4: Extract main.js and create Blob URL
        const mainJsContent = await mainJsFile.async('blob');
        const blobUrl = URL.createObjectURL(
            new Blob([mainJsContent], { type: 'application/javascript' })
        );

        // Step 5: Extract styles.css if present
        const stylesFile = zip.file('styles.css');
        const css = stylesFile ? await stylesFile.async('string') : undefined;

        // Build result with conditional css inclusion
        const result: NhpLoadResult = {
            manifest,
            blobUrl,
        };
        if (css !== undefined) {
            result.css = css;
        }

        return result;
    }

    /**
     * Parse and validate manifest JSON
     */
    private parseManifest(json: string, filename: string): ExternalPluginManifest {
        let parsed: unknown;
        try {
            parsed = JSON.parse(json);
        } catch (error) {
            throw new Error(`Invalid manifest.json in ${filename}: ${error}`);
        }

        // Type validation
        if (!parsed || typeof parsed !== 'object') {
            throw new Error(`Invalid manifest.json in ${filename}: not an object`);
        }

        const obj = parsed as Record<string, unknown>;

        // Required fields
        if (!obj.id || typeof obj.id !== 'string') {
            throw new Error(`Invalid manifest in ${filename}: missing or invalid 'id'`);
        }
        if (!obj.name || typeof obj.name !== 'string') {
            throw new Error(`Invalid manifest in ${filename}: missing or invalid 'name'`);
        }
        if (!obj.version || typeof obj.version !== 'string') {
            throw new Error(`Invalid manifest in ${filename}: missing or invalid 'version'`);
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
     * List files in a ZIP archive (for debugging)
     */
    async listFiles(buffer: ArrayBuffer): Promise<string[]> {
        const zip = await JSZip.loadAsync(buffer);
        const files: string[] = [];

        zip.forEach((relativePath) => {
            files.push(relativePath);
        });

        return files;
    }

    /**
     * Check if a file is in the allowed whitelist
     */
    isAllowedFile(filename: string): boolean {
        return ALLOWED_FILES.includes(filename);
    }
}

// Singleton instance for convenience
export const zipLoader = new ZipLoader();
