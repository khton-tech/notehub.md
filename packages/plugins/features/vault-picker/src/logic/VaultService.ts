import type { NotehubCore } from '@notehub/core';

/**
 * Recent vault entry
 */
export interface VaultHistoryEntry {
    path: string;
    name: string;
    lastOpened: number; // timestamp
}

/**
 * VaultService - Business logic for vault operations
 *
 * Handles creating, opening, and managing vault history.
 * Uses fs-manager for file operations and state-manager for persistence.
 */
export class VaultService {
    private app: NotehubCore;

    constructor(app: NotehubCore) {
        this.app = app;
    }

    /**
     * Log a message via the Logger plugin
     */
    private log(level: 'info' | 'warn' | 'error', message: string): void {
        this.app.api.invoke(`logger:${level}`, 'nh.features.vault-picker', message);
    }

    /**
     * Show a user-friendly error alert
     * @param title - Alert title
     * @param message - Error message to display
     */
    private showErrorAlert(title: string, message: string): void {
        if (typeof window !== 'undefined') {
            // Use setTimeout to avoid blocking
            setTimeout(() => {
                alert(`${title}\n\n${message}`);
            }, 0);
        }
    }

    /**
     * Create a new vault at the specified path
     *
     * @param basePath - Parent directory where the vault will be created
     * @param name - Name of the vault folder
     */
    async createVault(basePath: string, name: string): Promise<void> {
        const sep = basePath.includes('/') ? '/' : '\\';
        const fullPath = `${basePath}${sep}${name}`;

        this.log('info', `Creating vault at: ${fullPath}`);

        try {
            // Create main vault directory
            await this.app.api.invoke('fs:create-dir', fullPath, { recursive: true });

            // Create .notehub structure
            await this.app.api.invoke('fs:create-dir', `${fullPath}${sep}.notehub${sep}plugins`, { recursive: true });
            await this.app.api.invoke('fs:create-dir', `${fullPath}${sep}.notehub${sep}configs`, { recursive: true });

            // Create README.md
            const readmeContent = `# Welcome to ${name}\n\nThis is your new Notehub vault.\n`;
            await this.app.api.invoke('fs:write-text-file', `${fullPath}${sep}README.md`, readmeContent);

            this.log('info', `Vault created successfully: ${name}`);

            // Open the newly created vault
            await this.openVault(fullPath);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.log('error', `Failed to create vault: ${errorMessage}`);
            this.showErrorAlert('Failed to Create Vault', `Could not create vault at "${fullPath}".\n\nReason: ${errorMessage}`);
            throw error;
        }
    }

    /**
     * Helper to extract a human-readable name from a path
     * Handles standard paths and Android SAF paths
     */
    private getNameFromPath(path: string): string {
        // Handle SAF paths
        if (path.startsWith('/saf-root/')) {
            try {
                // Remove prefix
                const withoutPrefix = path.substring('/saf-root/'.length);

                // The URI part is encoded, so it won't contain literal slashes
                const firstSlash = withoutPrefix.indexOf('/');

                if (firstSlash !== -1) {
                    // We have a relative path component (e.g. /saf-root/.../MyVault)
                    // Use the last part of the relative path
                    const relative = withoutPrefix.substring(firstSlash + 1);
                    const parts = relative.split(/[/\\]/);
                    return parts[parts.length - 1] || 'Unknown';
                }

                // No relative path, must extract from the JSON URI
                const decodedJson = decodeURIComponent(withoutPrefix);
                let uriStr = '';

                try {
                    const jsonObj = JSON.parse(decodedJson);
                    if (jsonObj && jsonObj.uri) {
                        uriStr = jsonObj.uri;
                    }
                } catch {
                    // Maybe it wasn't JSON but just a URI? (Backward compatibility)
                    uriStr = decodedJson;
                }

                if (uriStr) {
                    // Try to extract from content URI
                    // Examples: 
                    // content://.../tree/primary%3AVaultName
                    // content://.../document/primary%3AVaultName
                    const decodedUri = decodeURIComponent(uriStr);

                    // Remove trailing slashes
                    const cleanUri = decodedUri.replace(/\/+$/, '');

                    // Split by slash to get the last segment (usually the ID)
                    const parts = cleanUri.split('/');
                    const lastPart = parts[parts.length - 1]; // e.g. "primary:VaultName"

                    if (lastPart) {
                        // If it contains colon (common in Android docs IDs), take the part after colon
                        if (lastPart.includes(':')) {
                            const idParts = lastPart.split(':');
                            return idParts[idParts.length - 1] || lastPart;
                        }
                        return lastPart;
                    }

                    return 'Unknown';
                }
            } catch (e) {
                this.log('warn', `Failed to parse SAF path for name: ${e}`);
            }
        }

        // Standard path handling
        const sep = path.includes('/') ? '/' : '\\';
        const segments = path.split(sep);
        return segments[segments.length - 1] || 'Unknown';
    }

    /**
     * Open an existing vault
     *
     * @param fullPath - Full path to the vault directory
     */
    async openVault(fullPath: string): Promise<void> {
        this.log('info', `Opening vault: ${fullPath}`);

        try {
            // Check if .notehub directory exists, create if missing
            const sep = fullPath.includes('/') ? '/' : '\\';
            const notehubPath = `${fullPath}${sep}.notehub`;
            const hasNotehub = await this.app.api.invoke<boolean>('fs:exists', notehubPath);

            if (!hasNotehub) {
                this.log('info', `Vault at ${fullPath} is missing .notehub directory. Initializing...`);
                // Create .notehub structure
                await this.app.api.invoke('fs:create-dir', `${notehubPath}${sep}plugins`, { recursive: true });
                await this.app.api.invoke('fs:create-dir', `${notehubPath}${sep}configs`, { recursive: true });
                this.log('info', `.notehub directory created`);
            }

            // Extract vault name from path
            const name = this.getNameFromPath(fullPath);

            // Update history (deduplicate, unshift to top, limit to 10)
            const currentHistory = await this.getRecentVaults();
            const filteredHistory = currentHistory.filter((v) => v.path !== fullPath);
            const newEntry: VaultHistoryEntry = {
                path: fullPath,
                name,
                lastOpened: Date.now(),
            };
            const newHistory = [newEntry, ...filteredHistory].slice(0, 10);
            await this.app.api.invoke('config:set', 'vault.history', newHistory);

            // Save last opened vault
            await this.app.api.invoke('config:set', 'vault.last-opened', fullPath);

            // Emit vault opened event
            this.app.events.emit('app:vault-opened', { path: fullPath, name });

            this.log('info', `Vault opened: ${name}`);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.log('error', `Failed to open vault: ${errorMessage}`);
            this.showErrorAlert('Failed to Open Vault', `Could not open vault at "${fullPath}".\n\nReason: ${errorMessage}`);
            throw error;
        }
    }

    /**
     * Get list of recently opened vaults
     */
    async getRecentVaults(): Promise<VaultHistoryEntry[]> {
        const history = await this.app.api.invoke<VaultHistoryEntry[] | undefined>('config:get', 'vault.history');
        return Array.isArray(history) ? history : [];
    }

    /**
     * Get the last opened vault path
     */
    async getLastOpenedVault(): Promise<string | null> {
        const result = await this.app.api.invoke<string | undefined>('config:get', 'vault.last-opened');
        return result ?? null;
    }

    /**
     * Check if a path is a valid vault
     */
    async isValidVault(path: string): Promise<boolean> {
        try {
            const sep = path.includes('/') ? '/' : '\\';
            const result = await this.app.api.invoke<boolean>('fs:exists', `${path}${sep}.notehub`);
            return Boolean(result);
        } catch {
            return false;
        }
    }

    /**
     * Close the current vault
     *
     * Clears the last-opened state and emits vault-closed event
     */
    async closeVault(): Promise<void> {
        this.log('info', 'Closing vault...');

        try {
            // Clear last-opened to prevent auto-login on next reload
            // Uses config:delete since openVault saves via config:set
            await this.app.api.invoke('config:delete', 'vault.last-opened');

            // Emit vault closed event
            this.app.events.emit('app:vault-closed', {});

            this.log('info', 'Vault closed');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.log('error', `Failed to close vault: ${errorMessage}`);
            throw error;
        }
    }
}
