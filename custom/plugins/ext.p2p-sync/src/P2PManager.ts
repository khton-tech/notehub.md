import { Peer, DataConnection, PeerOptions } from 'peerjs';

export interface FileUpdate {
    path: string;
    content: string;
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';

type EventHandler<T> = (data: T) => void;

export class P2PManager {
    private peer: Peer | null = null;
    private connections: Map<string, DataConnection> = new Map();
    private _peerId: string | null = null;
    private listeners: Map<string, EventHandler<any>[]> = new Map();

    constructor() { }

    public get peerId(): string | null {
        return this._peerId;
    }

    public async initialize(config?: PeerOptions): Promise<string> {
        return new Promise((resolve, reject) => {
            if (this.peer) {
                this.disconnectAll();
            }

            // CORS Fix: Generate ID client-side to avoid the /id HTTP call which gets blocked
            // by PeerJS public server on non-standard origins (like tauri://).
            // We use the browser's native crypto API, with a fallback.
            const generateId = () => {
                if (typeof crypto !== 'undefined' && crypto.randomUUID) {
                    return crypto.randomUUID();
                }
                return 'peer-' + Math.random().toString(36).substr(2, 9);
            };

            const id = config?.id || generateId();
            const peerConfig = config || {};

            console.warn('[P2P] Initializing Peer with ID:', id, 'Config:', peerConfig);

            // Pass the ID as the first argument to bypass server generation
            this.peer = new Peer(id, peerConfig);

            this.peer.on('open', (id) => {
                console.log('[P2P] Peer initialized with ID:', id);
                this._peerId = id;
                this.emit('ready', id);
                resolve(id);
            });

            this.peer.on('connection', (conn) => {
                console.log('[P2P] Incoming connection from:', conn.peer);
                this.setupConnection(conn);
            });

            this.peer.on('error', (err) => {
                console.error('[P2P] Peer error:', err);
                this.emit('error', err);
                if (!this._peerId) reject(err);
            });

            this.peer.on('disconnected', () => {
                console.log('[P2P] Peer disconnected from server');
                this.emit('disconnected', undefined);
            });
        });
    }

    public connect(remotePeerId: string): void {
        if (!this.peer || this.connections.has(remotePeerId)) return;

        console.log('[P2P] Connecting to:', remotePeerId);
        const conn = this.peer.connect(remotePeerId);
        this.setupConnection(conn);
    }

    public broadcastFile(path: string, content: string): void {
        const payload: FileUpdate = { path, content };
        console.log(`[P2P] Broadcasting ${path} to ${this.connections.size} peers`);

        for (const [peerId, conn] of this.connections) {
            if (conn.open) {
                conn.send(payload);
            } else {
                console.warn(`[P2P] Connection to ${peerId} is not open, skipping`);
            }
        }
    }

    public disconnectAll(): void {
        for (const conn of this.connections.values()) {
            conn.close();
        }
        this.connections.clear();
        this.peer?.destroy();
        this.peer = null;
        this._peerId = null;
        this.emit('disconnected', undefined);
    }

    public getConnectedPeers(): string[] {
        return Array.from(this.connections.keys());
    }

    // --- Private ---

    private setupConnection(conn: DataConnection): void {
        conn.on('open', () => {
            console.log('[P2P] Connection established with:', conn.peer);
            this.connections.set(conn.peer, conn);
            this.emit('peer-connected', conn.peer);
        });

        conn.on('data', (data) => {
            // Assume it matches FileUpdate interface
            if (this.isFileUpdate(data)) {
                console.log('[P2P] Received file update:', data.path);
                this.emit('file-received', data);
            }
        });

        conn.on('close', () => {
            console.log('[P2P] Connection closed:', conn.peer);
            this.connections.delete(conn.peer);
            this.emit('peer-disconnected', conn.peer);
        });

        conn.on('error', (err) => {
            console.error('[P2P] Connection error:', err);
            this.connections.delete(conn.peer);
            this.emit('peer-disconnected', conn.peer);
        });
    }

    private isFileUpdate(data: any): data is FileUpdate {
        return data && typeof data.path === 'string' && typeof data.content === 'string';
    }

    // --- Event Emitter ---

    public on(event: 'ready', handler: (id: string) => void): void;
    public on(event: 'error', handler: (err: any) => void): void;
    public on(event: 'disconnected', handler: () => void): void;
    public on(event: 'peer-connected', handler: (peerId: string) => void): void;
    public on(event: 'peer-disconnected', handler: (peerId: string) => void): void;
    public on(event: 'file-received', handler: (update: FileUpdate) => void): void;
    public on(event: string, handler: EventHandler<any>): void {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event)?.push(handler);
    }

    public off(event: string, handler: EventHandler<any>): void {
        const handlers = this.listeners.get(event);
        if (handlers) {
            this.listeners.set(event, handlers.filter(h => h !== handler));
        }
    }

    private emit(event: string, data: any): void {
        const handlers = this.listeners.get(event);
        if (handlers) {
            handlers.forEach(h => h(data));
        }
    }
}
