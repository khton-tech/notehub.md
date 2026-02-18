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
import { parseManifestOrThrow } from './ManifestParser.js';

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

        // Step 2: Validate all files against whitelist
        const filesInArchive: string[] = [];
        zip.forEach((relativePath) => {
            filesInArchive.push(relativePath);
        });

        for (const file of filesInArchive) {
            // Skip directories (they end with /)
            if (file.endsWith('/')) continue;

            if (!this.isAllowedFile(file)) {
                console.warn(`[ZipLoader] Unexpected file in NHP archive ${filename}: ${file}`);
                // For now we warn but don't reject - future versions may throw
            }
        }

        // Step 3: Validate required files exist
        const manifestFile = zip.file('manifest.json');
        if (!manifestFile) {
            throw new Error(`Invalid NHP: missing manifest.json in ${filename}`);
        }

        const mainJsFile = zip.file('main.js');
        if (!mainJsFile) {
            throw new Error(`Invalid NHP: missing main.js in ${filename}`);
        }

        // Step 4: Extract and parse manifest
        const manifestContent = await manifestFile.async('string');
        const manifest = parseManifestOrThrow(manifestContent, filename);

        // Step 5: Extract main.js, rewrite bare specifiers, and create Blob URL
        // SystemJS import maps don't reliably resolve bare specifiers from blob URL contexts
        // (especially in Tauri production builds). Rewrite them to the notehub://shared/ URLs
        // that are already registered via System.set() in ScopeInitializer.
        let mainJsText = await mainJsFile.async('string');
        mainJsText = this.rewriteSpecifiers(mainJsText);
        const blobUrl = URL.createObjectURL(
            new Blob([mainJsText], { type: 'application/javascript' })
        );

        // Step 6: Extract styles.css if present
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
     * Rewrite bare module specifiers to notehub://shared/ URLs.
     * This ensures SystemJS can resolve dependencies from blob URL contexts
     * where import maps may not apply (e.g. Tauri production builds).
     *
     * Order matters: longer specifiers (react/jsx-runtime) must be replaced
     * before shorter ones (react) to avoid partial matches.
     */
    private rewriteSpecifiers(js: string): string {
        const SHARED = 'notehub://shared/';
        const map: [string, string][] = [
            ['react/jsx-dev-runtime', `${SHARED}react-jsx-dev-runtime`],
            ['react/jsx-runtime', `${SHARED}react-jsx-runtime`],
            ['react-dom/client', `${SHARED}react-dom-client`],
            ['react-dom', `${SHARED}react-dom`],
            ['react', `${SHARED}react`],
            ['@notehub.md/api', `${SHARED}notehub-api`],
            ['@notehub/api', `${SHARED}notehub-api`],
            ['@notehub/core', `${SHARED}notehub-core`],
            ['@notehub/ui', `${SHARED}notehub-ui`],
            ['lucide-react', `${SHARED}lucide-react`],
        ];

        for (const [bare, url] of map) {
            js = js.replaceAll(`"${bare}"`, `"${url}"`);
            js = js.replaceAll(`'${bare}'`, `'${url}'`);
        }

        return js;
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
