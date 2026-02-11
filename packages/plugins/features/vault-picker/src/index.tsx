import { SystemPlugin } from '@notehub/core';
import type { PluginManifest } from '@notehub/core';
import { VaultService } from './logic/VaultService.js';
import { VaultList } from './components/VaultList.js';
import { VaultActions } from './components/VaultActions.js';

/**
 * VaultPickerPlugin - Vault selection and creation
 *
 * This is the "Magnum Opus" of Phase 1 - combines fs, config, state, and UI
 * systems into the core user flow: selecting or creating a vault.
 *
 * Lifecycle:
 * 1. On load, checks for `vault.last-opened` in state
 * 2. If valid vault exists → auto-opens it (Phase 2 transition)
 * 3. If no vault → registers UI components and shows welcome screen
 * 4. Listens for `app:vault-opened` event to transition to editor
 */
export class VaultPickerPlugin extends SystemPlugin {
    readonly manifest: PluginManifest = {
        id: 'nh.features.vault-picker',
        name: 'VaultPicker',
        version: '0.0.0',
        type: 'feature',
    };

    private service: VaultService | null = null;

    /**
     * Load the plugin
     */
    protected async onLoad(): Promise<void> {
        this.service = new VaultService(this.app);
        this.log('info', 'Loading...');

        // Register vault:close API
        this.registerApi('vault:close', () => this.service?.closeVault());

        // Set up Phase 2 transition listener
        // Handled by Workbench plugin now
        // this.vaultOpenedHandler = (payload: unknown) => { ... }
        // this.registerEvent('app:vault-opened', this.vaultOpenedHandler);

        // Listen for vault close to show welcome screen again
        this.registerEvent('app:vault-closed', () => {
            this.log('info', 'Vault closed, showing welcome screen');
            this.showWelcomeScreen();
        });

        // Check for last opened vault
        const lastOpened = await this.service.getLastOpenedVault();

        if (lastOpened) {
            this.log('info', `Found last opened vault: ${lastOpened}`);

            // Verify the vault still exists
            const isValid = await this.service.isValidVault(lastOpened);

            if (isValid) {
                this.log('info', 'Last vault is valid, auto-opening...');
                // Don't await - let it run asynchronously to not block plugin loading
                this.service.openVault(lastOpened).catch((err) => {
                    this.log('error', `Failed to auto-open vault: ${err}`);
                    this.showWelcomeScreen();
                });
                return;
            } else {
                this.log('warn', 'Last vault is invalid or missing, showing welcome screen');
            }
        }

        // No valid vault - show welcome screen
        this.showWelcomeScreen();
    }

    /**
     * Register UI components and show welcome layout
     */
    private showWelcomeScreen(): void {
        if (!this.service) return;

        const app = this.app;
        const service = this.service;

        this.log('info', 'Registering UI components for welcome screen');

        // Create wrapper components that have access to service
        const VaultListWrapper = () => {
            return <VaultList service={service} />;
        };

        const VaultActionsWrapper = () => {
            return <VaultActions app={app} service={service} />;
        };

        // Register controllers
        app.api.invoke('controller:register', 'vault-list', VaultListWrapper);
        app.api.invoke('controller:register', 'vault-actions', VaultActionsWrapper);

        // Set welcome layout as active
        app.api.invoke('layout:set', 'welcome');

        this.log('info', 'Welcome screen initialized');
    }

    /**
     * Unload the plugin
     */
    protected async onUnload(): Promise<void> {
        this.log('info', 'Unloading...');

        this.service = null;

        this.log('info', 'Unloaded');
    }
}

// Re-export types and components
export { VaultService, type VaultHistoryEntry } from './logic/VaultService.js';
export { VaultList } from './components/VaultList.js';
export { VaultActions } from './components/VaultActions.js';

// Default export for dynamic loading
export default VaultPickerPlugin;
