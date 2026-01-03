/**
 * FileNode interface for react-arborist
 * 
 * The library expects:
 * - `id`: unique identifier (we use full path)
 * - `name`: display name
 * - `children`: optional array for tree structure
 */
export interface FileNode {
    /** Full path - used as unique identifier by react-arborist */
    id: string;
    /** Filename for display */
    name: string;
    /** Is this a directory? */
    isDir: boolean;
    /** Child nodes for directories */
    children?: FileNode[];
    /** Flag: whether directory contents are loaded */
    isLoaded?: boolean;
}
