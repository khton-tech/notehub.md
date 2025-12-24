import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { NotehubCore } from '@notehub/core';

// System Plugins
import { LoggerPlugin } from '@notehub/logger';
import { FsManagerPlugin } from '@notehub/fs-manager';
import { FsDriverTauriPlugin } from '@notehub/fs-driver-tauri';
import { StateManagerPlugin } from '@notehub/state-manager';
import { ConfigManagerPlugin } from '@notehub/config-manager';

// UI Plugins
import { ThemeManagerPlugin } from '@notehub/theme-manager';
import { IconManagerPlugin } from '@notehub/icon-manager';
import { ControllersManagerPlugin } from '@notehub/controllers-manager';
import { CKStandardPlugin } from '@notehub/ck-standard';
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
async function initApp(): Promise<NotehubCore> {
    console.log('[Desktop] Starting Notehub.md...');

    // Create core kernel
    const core = new NotehubCore();
    coreInstance = core;

    // ===== PLUGIN REGISTRATION =====
    // Order matters: Dependencies must be registered before dependents
    // The architecture follows a layered approach:

    // Layer 0: Foundation - Logger (no dependencies)
    core.registerPlugin(new LoggerPlugin());

    // Layer 1: Core Infrastructure
    core.registerPlugin(new FsManagerPlugin());       // Depends on: Logger
    core.registerPlugin(new StateManagerPlugin());    // Depends on: Logger

    // Layer 2: Drivers & Services
    core.registerPlugin(new FsDriverTauriPlugin());   // Depends on: Logger, FsManager
    core.registerPlugin(new ConfigManagerPlugin());   // Depends on: Logger, FsManager

    // Layer 3: UI Foundation
    core.registerPlugin(new ThemeManagerPlugin());       // Depends on: Logger, ConfigManager
    core.registerPlugin(new IconManagerPlugin());        // Depends on: Logger
    core.registerPlugin(new ControllersManagerPlugin()); // Depends on: Logger
    core.registerPlugin(new CKStandardPlugin());         // Depends on: ControllersManager, IconManager
    core.registerPlugin(new LayoutManagerPlugin());      // Depends on: Logger, ControllersManager

    // Layer 4: Feature Plugins
    core.registerPlugin(new VaultPickerPlugin());        // Depends on: FsManager, StateManager, LayoutManager

    // ===== INITIALIZATION =====
    // This will load plugins in registration order
    await core.init();

    // Note: VaultPickerPlugin handles layout activation on load

    console.log('[Desktop] Notehub.md started successfully');

    return core;
}

/**
 * App component that manages initialization state
 */
function App(): React.ReactElement {
    const [isReady, setIsReady] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        initApp()
            .then(() => {
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
            <div style={styles.errorContainer}>
                <h1 style={styles.errorTitle}>⚠️ Startup Error</h1>
                <p style={styles.errorMessage}>{error}</p>
            </div>
        );
    }

    // Loading state
    if (!isReady) {
        return (
            <div style={styles.loadingContainer}>
                <div style={styles.spinner} />
                <p style={styles.loadingText}>Loading Notehub.md...</p>
            </div>
        );
    }

    // Ready - render the active layout
    return <LayoutRenderer />;
}

/**
 * Styles for loading and error states
 */
const styles: Record<string, React.CSSProperties> = {
    loadingContainer: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        backgroundColor: 'var(--nh-bg-main, #1a1a1a)',
        color: 'var(--nh-text-primary, #e0e0e0)',
        fontFamily: 'system-ui, -apple-system, sans-serif',
    },
    spinner: {
        width: '48px',
        height: '48px',
        border: '3px solid var(--nh-border-secondary, #3a3a3a)',
        borderTop: '3px solid var(--nh-accent-primary, #6b5ce7)',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
    },
    loadingText: {
        marginTop: '16px',
        fontSize: '16px',
        opacity: 0.8,
    },
    errorContainer: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        backgroundColor: 'var(--nh-bg-main, #1a1a1a)',
        color: 'var(--nh-text-error, #ff6b6b)',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        padding: '24px',
    },
    errorTitle: {
        fontSize: '24px',
        marginBottom: '16px',
    },
    errorMessage: {
        fontSize: '14px',
        opacity: 0.8,
        maxWidth: '400px',
        textAlign: 'center',
    },
};

// Add keyframe animation for spinner
const styleSheet = document.createElement('style');
styleSheet.textContent = `
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
`;
document.head.appendChild(styleSheet);

// Mount React app
ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);
