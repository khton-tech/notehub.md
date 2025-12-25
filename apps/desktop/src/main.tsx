import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { NotehubCore } from '@notehub/core';
import WorkbenchPlugin from '@notehub/workbench';
import { Hexagon } from 'lucide-react';
import './index.css';

// System Plugins
import { LoggerPlugin } from '@notehub/logger';
import { FsManagerPlugin } from '@notehub/fs-manager';
import { FsDriverTauriPlugin } from '@notehub/fs-driver-tauri';
import { StateManagerPlugin } from '@notehub/state-manager';
import { ConfigManagerPlugin } from '@notehub/config-manager';
import { Bootloader } from '@notehub/bootloader';

// UI Plugins
import { ThemeManagerPlugin } from '@notehub/theme-manager';
import { IconManagerPlugin } from '@notehub/icon-manager';
import { ControllersManagerPlugin } from '@notehub/controllers-manager';
import { CKStandardPlugin } from '@notehub/ck-standard';
import { DialogManagerPlugin } from '@notehub/dialog-manager';
import { LayoutManagerPlugin, LayoutRenderer } from '@notehub/layout-manager';

// Feature Plugins
import { VaultPickerPlugin } from '@notehub/vault-picker';

/**
 * Global core instance for the application
 */
let coreInstance: NotehubCore | null = null;

/**
 * Get the core instance (for use in components if needed)
 */
export function getCore(): NotehubCore | null {
    return coreInstance;
}

/**
 * Initialize the Notehub.md application
 */
async function initApp(onStatusUpdate: (status: string) => void): Promise<NotehubCore> {
    onStatusUpdate('Initializing Core...');
    console.log('[Desktop] Starting Notehub.md...');

    // Create core kernel
    const core = new NotehubCore();
    coreInstance = core;

    // ===== PLUGIN REGISTRATION =====
    onStatusUpdate('Registering Plugins...');

    // Layer 0: Foundation
    core.registerPlugin(new LoggerPlugin());

    // Layer 1: Core Infrastructure
    core.registerPlugin(new FsManagerPlugin());
    core.registerPlugin(new StateManagerPlugin());

    // Layer 2: Drivers & Services
    core.registerPlugin(new FsDriverTauriPlugin());
    core.registerPlugin(new ConfigManagerPlugin());

    // Layer 3: UI Foundation
    core.registerPlugin(new ThemeManagerPlugin());
    core.registerPlugin(new IconManagerPlugin());
    core.registerPlugin(new ControllersManagerPlugin());
    core.registerPlugin(new CKStandardPlugin());
    core.registerPlugin(new DialogManagerPlugin());
    core.registerPlugin(new LayoutManagerPlugin());

    // Layer 4: Feature Plugins
    core.registerPlugin(new VaultPickerPlugin());
    core.registerPlugin(new WorkbenchPlugin());

    // Initialize Bootloader (Orchestrator)
    new Bootloader(core);

    // ===== INITIALIZATION =====
    onStatusUpdate('Starting Plugins...');
    await core.init();

    onStatusUpdate('Ready');
    console.log('[Desktop] Notehub.md started successfully');

    return core;
}

// Mount React app
ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);

/**
 * App component that manages initialization state
 */
function App(): React.ReactElement {
    const [isReady, setIsReady] = useState(false);
    const [status, setStatus] = useState('Initializing...');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // Minimum loading time to prevent flash
        const startTime = Date.now();

        initApp(setStatus)
            .then(async () => {
                const elapsed = Date.now() - startTime;
                if (elapsed < 1000) {
                    await new Promise(resolve => setTimeout(resolve, 1000 - elapsed));
                }
                setIsReady(true);
            })
            .catch((err) => {
                console.error('[Desktop] Failed to start:', err);
                setError(err instanceof Error ? err.message : String(err));
            });
    }, []);

    // Error state
    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-[#1a1a1a] text-red-500 font-sans p-6">
                <h1 className="text-2xl mb-4 font-bold">⚠️ Startup Error</h1>
                <p className="text-sm opacity-80 max-w-md text-center">{error}</p>
            </div>
        );
    }

    // Loading state
    if (!isReady) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-[#1a1a1a] text-[#e0e0e0] font-sans selection:bg-purple-500/30">
                <div className="relative flex items-center justify-center w-24 h-24">
                    {/* Pulsing background glow */}
                    <div className="absolute inset-0 bg-purple-500/20 blur-xl rounded-full animate-pulse"></div>

                    {/* Spinner */}
                    <div className="absolute inset-0 border-2 border-purple-500/30 rounded-full"></div>
                    <div className="absolute inset-0 border-2 border-t-purple-500 border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin"></div>

                    {/* Icon */}
                    <div className="relative z-10 flex items-center justify-center">
                        <div className="text-purple-400 drop-shadow-[0_0_10px_rgba(168,85,247,0.5)]">
                            <Hexagon size={48} strokeWidth={1.5} className="animate-pulse" />
                        </div>
                    </div>
                </div>

                <div className="mt-8 text-center space-y-2">
                    <h1 className="text-xl font-medium tracking-wide text-white/90">
                        Notehub.md
                    </h1>
                    <p className="text-xs text-white/50 uppercase tracking-widest font-medium">
                        {status}
                    </p>
                </div>
            </div>
        );
    }

    // Ready - render the active layout
    return <LayoutRenderer />;
}
