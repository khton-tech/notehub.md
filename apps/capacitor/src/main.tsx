import React from 'react';
import ReactDOM from 'react-dom/client';
import { NotehubApp, type BootstrapConfig } from '@notehub/app-bootstrap';
import { LayoutRenderer } from '@notehub/layout-manager';
import { AppLogo } from '@notehub/icon-manager';
import { importPlugin } from './generated/plugin-imports.js';
import './index.css';

/**
 * Capacitor-specific bootstrap configuration
 */
const capacitorConfig: BootstrapConfig = {
    platform: 'Capacitor',

    importPlugin,

    registerHostCapabilities(core) {
        core.api.register('shell:open', async (url: string) => {
            try {
                console.log('[Capacitor] Opening URL:', url);
                window.open(url, '_blank');
            } catch (error) {
                console.error('[Capacitor] Failed to open URL:', url, error);
            }
        });
    },

    // Skip the Tauri FS driver if it appears in the shared registry
    skipPluginIds: ['nh.system.fs-driver-tauri'],

    async loadRegistry() {
        const module = await import('./generated/plugin-registry.json');
        return module.default as any[];
    },
};

/**
 * Loading screen with Notehub branding
 */
function LoadingScreen({ status }: { status: string }): React.ReactElement {
    return (
        <div className="flex flex-col items-center justify-center h-screen bg-[#1a1a1a] text-[#e0e0e0] font-sans selection:bg-purple-500/30">
            <div className="relative flex items-center justify-center w-24 h-24">
                <div className="absolute inset-0 bg-purple-500/20 blur-xl rounded-full animate-pulse"></div>
                <div className="absolute inset-0 border-2 border-purple-500/30 rounded-full"></div>
                <div className="absolute inset-0 border-2 border-t-purple-500 border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin"></div>
                <div className="relative z-10 flex items-center justify-center">
                    <div className="text-purple-400 drop-shadow-[0_0_10px_rgba(168,85,247,0.5)]">
                        <AppLogo size={48} className="animate-pulse" />
                    </div>
                </div>
            </div>
            <div className="mt-8 text-center space-y-2">
                <h1 className="text-xl font-medium tracking-wide text-white/90">Notehub.md</h1>
                <p className="text-xs text-white/50 uppercase tracking-widest font-medium">{status}</p>
            </div>
        </div>
    );
}

/**
 * Error screen
 */
function ErrorScreen({ error }: { error: string }): React.ReactElement {
    return (
        <div className="flex flex-col items-center justify-center h-screen bg-[#1a1a1a] text-red-500 font-sans p-6">
            <h1 className="text-2xl mb-4 font-bold">Startup Error</h1>
            <p className="text-sm opacity-80 max-w-md text-center">{error}</p>
        </div>
    );
}

// Mount React app
ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <NotehubApp config={capacitorConfig} LoadingScreen={LoadingScreen} ErrorScreen={ErrorScreen}>
            <LayoutRenderer />
        </NotehubApp>
    </React.StrictMode>
);
