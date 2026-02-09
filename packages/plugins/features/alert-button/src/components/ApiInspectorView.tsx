
import React, { useState, useEffect } from 'react';
import { PluginContext } from '@notehub/api';

interface ApiInspectorViewProps {
    ctx: PluginContext;
}

const ApiInspectorView: React.FC<ApiInspectorViewProps> = ({ ctx }) => {
    const [methods, setMethods] = useState<string[]>([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchMethods = () => {
            try {
                // Attempt to access internal API bus to get registered methods
                // This is a hack for debugging/inspection as it's not part of the public API contract
                // We assume ctx has access to app or api bus in some way, or we use a known global if available.
                // Based on standard Notehub architecture, we might find it on ctx.app.api

                const api = (ctx as any).app?.api;
                if (api && typeof api.getRegisteredMethods === 'function') {
                    const registered = api.getRegisteredMethods() as string[];
                    setMethods(registered.sort());
                } else {
                    console.warn('ApiInspector: Could not access getRegisteredMethods via ctx.app.api');
                    // Fallback or error state?
                    // Maybe try to list keys if we can access the map directly (highly unlikely)
                }
            } catch (e) {
                console.error('ApiInspector: Error fetching methods', e);
            } finally {
                setLoading(false);
            }
        };

        fetchMethods();

        // Optional: poll for changes?
        const interval = setInterval(fetchMethods, 2000);
        return () => clearInterval(interval);
    }, [ctx]);

    const filteredMethods = methods.filter(m =>
        m.toLowerCase().includes(search.toLowerCase())
    );

    const containerStyle: React.CSSProperties = {
        padding: '20px',
        color: 'var(--nh-text-normal)',
        height: '100%',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
    };

    const headerStyle: React.CSSProperties = {
        marginBottom: '20px'
    };

    const inputStyle: React.CSSProperties = {
        width: '100%',
        padding: '8px 12px',
        borderRadius: '4px',
        border: '1px solid var(--nh-background-modifier-border)',
        backgroundColor: 'var(--nh-background-primary)',
        color: 'var(--nh-text-normal)',
        marginBottom: '10px'
    };

    const listContainerStyle: React.CSSProperties = {
        flex: 1,
        overflowY: 'auto',
        border: '1px solid var(--nh-background-modifier-border)',
        borderRadius: '4px',
        backgroundColor: 'var(--nh-background-primary)'
    };

    const itemStyle: React.CSSProperties = {
        padding: '8px 12px',
        borderBottom: '1px solid var(--nh-background-modifier-border)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        cursor: 'pointer' // Could make them clickable to copy?
    };

    return (
        <div style={containerStyle}>
            <div style={headerStyle}>
                <h2>API Inspector</h2>
                <p style={{ opacity: 0.7, marginBottom: '10px' }}>
                    Listing {methods.length} registered API methods.
                </p>
                <input
                    type="text"
                    placeholder="Search APIs..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    style={inputStyle}
                />
            </div>

            {loading ? (
                <div>Loading...</div>
            ) : (
                <div style={listContainerStyle}>
                    {filteredMethods.length === 0 ? (
                        <div style={{ padding: '20px', textAlign: 'center', opacity: 0.6 }}>
                            No methods found matching "{search}"
                        </div>
                    ) : (
                        filteredMethods.map(method => (
                            <div
                                key={method}
                                style={itemStyle}
                                title="Click to copy"
                                onClick={() => {
                                    navigator.clipboard.writeText(method);
                                    // Could show toast here if available via ctx
                                }}
                            >
                                <span style={{ fontFamily: 'monospace' }}>{method}</span>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};

export default ApiInspectorView;
