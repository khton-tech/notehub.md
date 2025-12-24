import React from 'react';
import ReactDOM from 'react-dom/client';
import { NotehubCore } from '@notehub/core';
import { FsManagerPlugin } from '@notehub/fs-manager';
import { FsDriverTauriPlugin } from '@notehub/fs-driver-tauri';

/**
 * Initialize the Notehub.md application
 */
async function initApp(): Promise<void> {
    console.log('[Desktop] Starting Notehub.md...');

    // Create core kernel
    const core = new NotehubCore();

    // Manual plugin registration
    // Order matters: fs-manager must be loaded before fs-driver-tauri
    core.registerPlugin(new FsManagerPlugin());
    core.registerPlugin(new FsDriverTauriPlugin());

    // Initialize core - this will load plugins in order
    await core.init();

    console.log('[Desktop] Notehub.md started successfully');
}

// Initialize the app
initApp().catch((error) => {
    console.error('[Desktop] Failed to start:', error);
});

// Minimal React mount point (no UI)
ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <div id="app" />
    </React.StrictMode>
);
