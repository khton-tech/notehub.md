import { NotehubCore } from '@notehub/core';
import type { DirEntry } from '@notehub/fs-manager';

// Helper Utils
function normalizePath(path: string): string {
    return path.replace(/\\/g, '/').replace(/\/+/g, '/');
}

function joinPath(...segments: string[]): string {
    return normalizePath(segments.join('/'));
}

export class PathResolver {
    private app: NotehubCore;

    // Folders to skip during deep search
    private static readonly IGNORED_FOLDERS = new Set([
        'node_modules',
        '.git',
        '.obsidian',
        '.notehub',
        '.idea',
        '.vscode',
        'dist',
        'build',
        'coverage'
    ]);

    constructor(app: NotehubCore) {
        this.app = app;
    }

    /**
     * Resolve a WikiLink to a file path
     * @param linkText The text inside the WikiLink (e.g. "My Note" or "Folder/My Note")
     * @returns The resolved absolute path (existing file) or the default path for creation
     */
    async resolveLink(linkText: string): Promise<string> {
        // 1. Sanitize
        // Remove [[ and ]] just in case, though regex usually handles it.
        // Also handle alias: [[Target|Alias]] -> Target
        let target = linkText.replace(/^\[\[/, '').replace(/\]\]$/, '');
        const pipeIndex = target.indexOf('|');
        if (pipeIndex !== -1) {
            target = target.substring(0, pipeIndex);
        }
        target = target.trim();

        // Ensure extension
        // Note: If user links [[Image.png]], we should probably respect that.
        // But prompt says "Ensure it ends in .md (unless it has another extension)."
        // Simple check: does it have an extension?
        // "My Note" -> "My Note.md"
        // "My Note.canvas" -> "My Note.canvas"
        if (!/\.[a-zA-Z0-9]+$/.test(target)) {
            target += '.md';
        }

        // Get Root
        const rootPath = await this.app.api.invoke<string | null>('explorer:get-root');
        if (!rootPath) {
            console.warn('[PathResolver] No vault open, cannot resolve path correctly.');
            return target; // Fallback
        }

        // Strategy 1: Exact/Relative Path Check
        // If the user typed a full path "Folder/Note.md", check it relative to root.
        const exactPath = joinPath(rootPath, target);
        if (await this.exists(exactPath)) {
            return exactPath;
        }

        // Strategy 3: Deep Search (The "Magic")
        // Crawl vault looking for file matching the filename.
        // If target was "Folder/Note.md", we extract "Note.md" and search for it?
        // Obsidian behavior: If path is provided, it tries to respect it. If not found, it *might* fuzzy search?
        // Prompt says: 
        // "Strategy 2: Root Path ... Check if /${linkText} exists." (Matches ExactPath if linkText is simple)
        // "Strategy 3: Deep Search ... Look for any file where filename === targetFilename."

        // We will search for the filename part.
        const targetFilename = target.split('/').pop()!;

        // Only do deep search if it's potentially ambiguous (or always?).
        // Prompt implies always for "Magic".
        const foundPath = await this.findFile(rootPath, targetFilename, target);
        if (foundPath) {
            return foundPath;
        }

        // Result: Not found. Return logical path for creation.
        // We return the exact path we checked first (Root + LinkText), so the file is created there by default.
        return exactPath;
    }

    private async exists(path: string): Promise<boolean> {
        try {
            return await this.app.api.invoke<boolean>('fs:exists', path);
        } catch {
            return false;
        }
    }

    /**
     * Recursively find a file matching the filename, optionally checking if it ends with a suffix.
     * @param dirPath Current directory to search
     * @param targetFilename The strictly matching filename (e.g. "note.md")
     * @param searchSuffix Optional suffix to match against the full path (e.g. "1.1/note.md")
     */
    private async findFile(dirPath: string, targetFilename: string, searchSuffix?: string): Promise<string | null> {
        try {
            const entries = await this.app.api.invoke<DirEntry[]>('fs:read-dir', dirPath);

            // 1. Check files in current dir
            for (const entry of entries) {
                if (!entry.isDirectory && entry.name === targetFilename) {
                    const fullPath = joinPath(dirPath, entry.name);

                    // If we have a suffix (e.g. "1.1/note.md"), verify matches
                    if (searchSuffix) {
                        // Normalize both to be safe
                        const normalizedSuffix = normalizePath(searchSuffix);
                        // Check if path ends with suffix. 
                        // Note: normalizePath uses '/' separators.
                        if (fullPath.endsWith('/' + normalizedSuffix) || fullPath === normalizedSuffix || fullPath.endsWith(normalizedSuffix)) {
                            return fullPath;
                        }
                        // If strict suffix provided but didn't match, we behave like it wasn't found 
                        // in this specific folder, so we continue searching.
                    } else {
                        return fullPath;
                    }
                }
            }

            // 2. Recurse into subdirectories
            for (const entry of entries) {
                if (entry.isDirectory) {
                    if (PathResolver.IGNORED_FOLDERS.has(entry.name) || entry.name.startsWith('.')) {
                        continue;
                    }
                    const found = await this.findFile(joinPath(dirPath, entry.name), targetFilename, searchSuffix);
                    if (found) return found;
                }
            }
        } catch (error) {
            // Permission error or other fs error
            console.debug(`[PathResolver] Skipped dir ${dirPath}:`, error);
        }
        return null;
    }
}
