import React, { useState, useEffect } from 'react';
import { PluginContext } from '@notehub.md/api';
import { P2PManager } from './P2PManager';

interface Props {
    ctx: PluginContext;
    manager: P2PManager;
}

export const SyncSettings: React.FC<Props> = ({ ctx, manager }) => {
    const [myId, setMyId] = useState<string | null>(manager.peerId);
    const [remoteId, setRemoteId] = useState('');
    const [peers, setPeers] = useState<string[]>(manager.getConnectedPeers());
    const [status, setStatus] = useState<string>('Idle');

    // Server Config
    const [host, setHost] = useState('');
    const [port, setPort] = useState(443);
    const [path, setPath] = useState('/');
    const [secure, setSecure] = useState(true);
    const [showConfig, setShowConfig] = useState(false);

    useEffect(() => {
        const loadConfig = async () => {
            const h = await ctx.storage.get<string>('host');
            const p = await ctx.storage.get<number>('port');
            const pt = await ctx.storage.get<string>('path');
            const s = await ctx.storage.get<boolean>('secure');

            if (h) setHost(h);
            if (p) setPort(p);
            if (pt) setPath(pt);
            if (s !== undefined) setSecure(s);
        };
        loadConfig();

        const updatePeers = () => setPeers(manager.getConnectedPeers());
        const updateId = (id: string) => setMyId(id);

        manager.on('ready', updateId);
        manager.on('peer-connected', updatePeers);
        manager.on('peer-disconnected', updatePeers);

        if (!myId && !manager.peerId) {
            // Initial load handled by index.tsx, but if that failed or we are here,
            // we can trigger a re-init if needed, but better wait for user action if it failed.
        }

        return () => {
            manager.off('ready', updateId);
            manager.off('peer-connected', updatePeers);
            manager.off('peer-disconnected', updatePeers);
        };
    }, [manager, myId, ctx]);

    const handleConnect = () => {
        if (!remoteId) return;
        setStatus(`Connecting to ${remoteId}...`);
        manager.connect(remoteId);
        setRemoteId('');
    };

    const copyId = () => {
        if (myId) {
            navigator.clipboard.writeText(myId);
            setStatus('ID Copied!');
            setTimeout(() => setStatus('Ready'), 2000);
        }
    };

    const saveAndRestart = async () => {
        setStatus('Saving & Restarting Peer...');
        await ctx.storage.set('host', host);
        await ctx.storage.set('port', port);
        await ctx.storage.set('path', path);
        await ctx.storage.set('secure', secure);

        const config = host ? { host, port, path, secure } : undefined;

        try {
            const id = await manager.initialize(config);
            setStatus(`Ready. ID: ${id}`);
        } catch (err: any) {
            setStatus(`Error: ${err.message || err}`);
        }
    };

    return (
        <div style={{ padding: '20px', maxWidth: '600px' }}>
            <h2>P2P Sync Settings</h2>

            <div style={{ marginBottom: '20px', padding: '15px', border: '1px solid #ddd', borderRadius: '8px' }}>
                <h3>My Device ID</h3>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <code style={{ background: '#f5f5f5', padding: '8px', borderRadius: '4px', flex: 1 }}>
                        {myId || 'Not Connected'}
                    </code>
                    <button onClick={copyId} disabled={!myId}>Copy</button>
                </div>
            </div>

            <div style={{ marginBottom: '20px', padding: '15px', border: '1px solid #ddd', borderRadius: '8px' }}>
                <h3 onClick={() => setShowConfig(!showConfig)} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    {showConfig ? '▼' : '▶'} Peer Server Configuration
                </h3>
                {showConfig && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
                        <label>
                            Host (e.g., 0.peerjs.com):
                            <input type="text" value={host} onChange={e => setHost(e.target.value)} style={{ width: '100%', padding: '5px' }} />
                        </label>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <label style={{ flex: 1 }}>
                                Port:
                                <input type="number" value={port} onChange={e => setPort(Number(e.target.value))} style={{ width: '100%', padding: '5px' }} />
                            </label>
                            <label style={{ flex: 1 }}>
                                Path:
                                <input type="text" value={path} onChange={e => setPath(e.target.value)} style={{ width: '100%', padding: '5px' }} />
                            </label>
                        </div>
                        <label>
                            <input type="checkbox" checked={secure} onChange={e => setSecure(e.target.checked)} /> Secure (HTTPS)
                        </label>
                        <button onClick={saveAndRestart} style={{ marginTop: '10px' }}>Save & Restart Connection</button>
                        <p style={{ fontSize: '0.8em', color: '#666' }}>
                            Leave Host empty to use default PeerJS cloud (might fail with CORS on some platforms).
                        </p>
                    </div>
                )}
            </div>

            <div style={{ marginBottom: '20px', padding: '15px', border: '1px solid #ddd', borderRadius: '8px' }}>
                <h3>Connect to Peer</h3>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <input
                        type="text"
                        value={remoteId}
                        onChange={(e) => setRemoteId(e.target.value)}
                        placeholder="Enter Remote Device ID"
                        style={{ flex: 1, padding: '8px' }}
                    />
                    <button onClick={handleConnect} disabled={!myId || !remoteId}>Connect</button>
                </div>
                <p style={{ marginTop: '10px', color: '#666' }}>Status: {status}</p>
            </div>

            <div style={{ padding: '15px', border: '1px solid #ddd', borderRadius: '8px' }}>
                <h3>Connected Devices ({peers.length})</h3>
                {peers.length === 0 ? (
                    <p style={{ color: '#999' }}>No connected devices.</p>
                ) : (
                    <ul style={{ listStyle: 'none', padding: 0 }}>
                        {peers.map(peer => (
                            <li key={peer} style={{ padding: '8px 0', borderBottom: '1px solid #eee' }}>
                                🟢 {peer}
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
};
