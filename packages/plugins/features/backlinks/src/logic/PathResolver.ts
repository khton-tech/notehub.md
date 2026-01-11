/**
 * @fileoverview Path Resolver for WikiLinks
 * 
 * Resolves link targets in WikiLink syntax to file paths.
 * MVP: Treats paths as relative to vault root.
 * Future: Will add fuzzy search support.
 */

/**
 * Resolves a WikiLink target to a file path.
 * 
 * @param currentFile - The current file's path (for relative resolution)
 * @param linkText - The raw link text from [[linkText]]
 * @returns The resolved file path
 * 
 * @example
 * resolvePath('/vault/notes/index.md', 'MyNote')     // -> 'MyNote.md'
 * resolvePath('/vault/notes/index.md', 'sub/Note.md') // -> 'sub/Note.md'
 */
export function resolvePath(_currentFile: string, linkText: string): string {
    // Trim whitespace from the link text
    const trimmed = linkText.trim();

    // If already has .md extension, return as-is
    if (trimmed.endsWith('.md')) {
        return trimmed;
    }

    // Append .md extension
    return `${trimmed}.md`;
}
