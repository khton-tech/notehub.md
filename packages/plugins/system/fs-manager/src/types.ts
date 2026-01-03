/**
 * Directory entry returned from readDir
 */
export interface DirEntry {
    /** Entry name (not full path) */
    name: string;
    /** Whether this entry is a directory */
    isDirectory: boolean;
    /** Whether this entry is a file */
    isFile: boolean;
}

/**
 * Options for createDir
 */
export interface CreateDirOptions {
    /** Create parent directories if they don't exist */
    recursive?: boolean;
}


/**
 * File System Event
 */
export interface FsEvent {
    /** Absolute path to the file/directory that changed */
    path: string;
    /** Type of change */
    type: 'create' | 'modify' | 'remove' | 'any';
}

/**
 * File System interface that all FS drivers must implement
 * 
 * This abstraction allows different implementations (Tauri, Web, Node.js)
 * to be plugged in without changing the consuming code.
 */
export interface IFileSystem {
    /**
     * Read a file as binary data
     * @param path - Absolute path to the file
     */
    readFile(path: string): Promise<Uint8Array>;

    /**
     * Read a file as UTF-8 text
     * @param path - Absolute path to the file
     */
    readTextFile(path: string): Promise<string>;

    /**
     * Write binary data to a file
     * @param path - Absolute path to the file
     * @param data - Binary data to write
     */
    writeFile(path: string, data: Uint8Array): Promise<void>;

    /**
     * Write text to a file
     * @param path - Absolute path to the file
     * @param content - Text content to write
     */
    writeTextFile(path: string, content: string): Promise<void>;

    /**
     * Create a directory
     * @param path - Absolute path to the directory
     * @param options - Creation options
     */
    createDir(path: string, options?: CreateDirOptions): Promise<void>;

    /**
     * Read directory contents
     * @param path - Absolute path to the directory
     */
    readDir(path: string): Promise<DirEntry[]>;

    /**
     * Check if a path exists
     * @param path - Absolute path to check
     */
    exists(path: string): Promise<boolean>;

    /**
     * Open a native directory picker dialog
     * @returns Selected directory path or null if cancelled
     */
    pickDirectory(): Promise<string | null>;

    /**
     * Watch a path for changes
     * @param path - Absolute path to watch (file or directory)
     * @param onChange - Callback for changes
     * @returns Function to stop watching
     */
    watch(path: string, onChange: (event: FsEvent) => void): Promise<() => void>;

    /**
     * Remove a file
     * @param path - Absolute path to the file
     */
    removeFile(path: string): Promise<void>;

    /**
     * Remove a directory
     * @param path - Absolute path to the directory
     * @param options - Removal options (recursive)
     */
    removeDir(path: string, options?: { recursive?: boolean }): Promise<void>;

    /**
     * Rename/move a file or directory
     * @param oldPath - Current path
     * @param newPath - New path
     */
    rename(oldPath: string, newPath: string): Promise<void>;
}

