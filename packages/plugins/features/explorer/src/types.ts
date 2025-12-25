export interface FileNode {
    path: string;
    name: string;
    kind: 'file' | 'directory';
    children?: FileNode[]; // For loaded folders
    isLoaded?: boolean;    // Flag, whether contents are loaded
    isExpanded?: boolean;  // UI state for expansion
}
