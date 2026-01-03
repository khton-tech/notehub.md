/**
 * Path Utilities for Explorer
 *
 * Centralized path manipulation functions to ensure consistent
 * handling of forward/backward slashes across Windows and Unix.
 */

/**
 * Normalize path separators to forward slashes and remove duplicates
 */
export function normalizePath(path: string): string {
    return path.replace(/\\/g, '/').replace(/\/+/g, '/');
}

/**
 * Get parent directory path
 */
export function getParentPath(path: string): string {
    const normalized = normalizePath(path);
    const lastSlash = normalized.lastIndexOf('/');
    return lastSlash > 0 ? normalized.substring(0, lastSlash) : '';
}

/**
 * Get file or folder name from path
 */
export function getFileName(path: string): string {
    const normalized = normalizePath(path);
    const lastSlash = normalized.lastIndexOf('/');
    return lastSlash >= 0 ? normalized.substring(lastSlash + 1) : normalized;
}

/**
 * Join path segments with forward slashes
 */
export function joinPath(...segments: string[]): string {
    return normalizePath(segments.join('/'));
}
