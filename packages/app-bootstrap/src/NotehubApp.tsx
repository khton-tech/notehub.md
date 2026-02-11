import React, { useState, useEffect } from 'react';
import { NotehubCore, NotehubProvider } from '@notehub/core';
import type { BootstrapConfig } from './types.js';
import { initNotehubApp } from './bootstrap.js';

// Expose for DevTools debugging
declare global {
    interface Window {
        __NOTEHUB__: NotehubCore | null;
    }
}

interface NotehubAppProps {
    /** Platform-specific bootstrap configuration */
    config: BootstrapConfig;
    /** Component to render when the app is ready */
    children: React.ReactNode;
    /** Optional loading screen component. Receives status string. */
    LoadingScreen?: React.FC<{ status: string }>;
    /** Optional error screen component. Receives error message. */
    ErrorScreen?: React.FC<{ error: string }>;
}

/**
 * Top-level Notehub application component.
 * Handles initialization, loading state, and error state.
 * Wraps children in `NotehubProvider` once ready.
 */
export function NotehubApp({ config, children, LoadingScreen, ErrorScreen }: NotehubAppProps): React.ReactElement {
    const [core, setCore] = useState<NotehubCore | null>(null);
    const [status, setStatus] = useState('Initializing...');
    const [error, setError] = useState<string | null>(null);
    const initStartedRef = React.useRef(false);

    useEffect(() => {
        // Guard against React StrictMode double-invocation
        if (initStartedRef.current) return;
        initStartedRef.current = true;

        const startTime = Date.now();

        initNotehubApp(config, setStatus)
            .then(async (coreInstance) => {
                window.__NOTEHUB__ = coreInstance;

                // Minimum loading time to prevent flash
                const elapsed = Date.now() - startTime;
                if (elapsed < 1000) {
                    await new Promise(resolve => setTimeout(resolve, 1000 - elapsed));
                }
                setCore(coreInstance);
            })
            .catch((err) => {
                console.error(`[${config.platform}] Failed to start:`, err);
                setError(err instanceof Error ? err.message : String(err));
            });
    }, [config]);

    if (error) {
        if (ErrorScreen) return <ErrorScreen error={error} />;
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#1a1a1a', color: '#ef4444', fontFamily: 'sans-serif', padding: '1.5rem' }}>
                <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem', fontWeight: 'bold' }}>Startup Error</h1>
                <p style={{ fontSize: '0.875rem', opacity: 0.8, maxWidth: '28rem', textAlign: 'center' }}>{error}</p>
            </div>
        );
    }

    if (!core) {
        if (LoadingScreen) return <LoadingScreen status={status} />;
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#1a1a1a', color: '#e0e0e0', fontFamily: 'sans-serif' }}>
                <p style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.5 }}>{status}</p>
            </div>
        );
    }

    return (
        <NotehubProvider value={core}>
            {children}
        </NotehubProvider>
    );
}
