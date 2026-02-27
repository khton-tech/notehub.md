import React from 'react';
import { NotehubPlugin, PluginContext } from '@notehub.md/api';
import { P2PManager, FileUpdate } from './P2PManager';
import { SyncSettings } from './SyncSettings';

const TAB_ID = 'p2p-sync';

export default class P2PSyncPlugin implements NotehubPlugin {
    private ctx: PluginContext | null = null;
    private manager: P2PManager;
    private hookRemovers: Array<() => void> = [];

    // Loop prevention: Track files currently being written by the sync engine
    private incomingUpdates = new Set<string>();

    constructor() {
        this.manager = new P2PManager();
    }

    async onload(ctx: PluginContext): Promise<void> {
        this.ctx = ctx;
        console.log('[P2P Sync] Loading...');

        // 1. Initialize P2P Manager
        // Load config from storage if available
        const host = await ctx.storage.get<string>('host');
        const port = await ctx.storage.get<number>('port');
        const path = await ctx.storage.get<string>('path');
        const secure = await ctx.storage.get<boolean>('secure');

        const config = (host && port) ? { host, port, path, secure } : undefined;

        this.manager.initialize(config).catch(err => {
            console.warn('[P2P Sync] Auto-init failed, waiting for user:', err);
        });

        // 2. Register Settings UI
        await ctx.invokeApi('settings:register-tab', {
            id: TAB_ID,
            label: 'P2P Sync',
            icon: 'refresh-cw',
            order: 60
        });

        await ctx.invokeApi('settings:register-custom-view', {
            tabId: TAB_ID,
            view: () => <SyncSettings ctx={ctx} manager={this.manager} />
        });

        // 3. Setup Sync Logic hooks
        this.setupHooks(ctx);

        // 4. Handle Incoming Updates
        this.manager.on('file-received', this.handleFileReceived.bind(this));

        console.log('[P2P Sync] Loaded');
    }

    private setupHooks(ctx: PluginContext) {
        // Intercept local writes to broadcast changes
        const removeWriteHook = ctx.unsafe.hook(
            'fs:write-text-file',
            'after',
            async (args: unknown[], next: unknown) => {
                if (!args || !Array.isArray(args) || args.length < 2) return;
                const path = args[0] as string;
                const content = args[1] as string;

                // Check if this write was initiated by US (incoming sync)
                if (this.incomingUpdates.has(path)) {
                    console.log(`[P2P Sync] Ignoring loop for ${path}`);
                    this.incomingUpdates.delete(path);
                    return;
                }

                // Only sync .md files
                if (!path.endsWith('.md')) return;

                // Broadcast to peers
                this.manager.broadcastFile(path, content);
            }
        );

        this.hookRemovers.push(removeWriteHook);
    }

    private async handleFileReceived(update: FileUpdate) {
        if (!this.ctx) return;

        console.log(`[P2P Sync] Writing received update for ${update.path}`);

        // Mark as incoming to prevent loop
        this.incomingUpdates.add(update.path);

        try {
            await this.ctx.invokeApi('fs:write-text-file', update.path, update.content);
            console.log(`[P2P Sync] Update written for ${update.path}`);
        } catch (err) {
            console.error(`[P2P Sync] Failed to write ${update.path}:`, err);
            // Cleanup flag if write failed
            this.incomingUpdates.delete(update.path);
        }
    }

    async onunload(): Promise<void> {
        console.log('[P2P Sync] Unloading...');

        // Remove hooks
        this.hookRemovers.forEach(remove => remove());
        this.hookRemovers = [];

        // Disconnect P2P
        this.manager.disconnectAll();

        // Unregister settings
        if (this.ctx) {
            try {
                await this.ctx.invokeApi('settings:unregister-tab', TAB_ID);
            } catch { /* ignore */ }
            this.ctx = null;
        }
    }
}
