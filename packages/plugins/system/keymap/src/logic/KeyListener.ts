
import type { NotehubCore } from '@notehub/core';

export class KeyListener {
    /** Map of hotkey string -> commandId */
    private hotkeyMap: Map<string, string> = new Map();
    private boundKeydownHandler: ((e: KeyboardEvent) => void) | null = null;
    private app: NotehubCore;

    /**
     * List of hotkeys that should ALWAYS have their default browser behavior blocked,
     * regardless of whether a command is bound or not.
     */
    private static readonly BLOCKED_DEFAULTS_RAW = [
        'mod+p', 'ctrl+p', 'meta+p',          // Print
        'mod+s', 'ctrl+s', 'meta+s',          // Save
        'mod+o', 'ctrl+o', 'meta+o',          // Open
        'mod+f', 'ctrl+f', 'meta+f',          // Find
        'mod+g', 'ctrl+g', 'meta+g',          // Find next
        'mod+n', 'ctrl+n', 'meta+n',          // New window
        'mod+shift+n',                        // Incognito
        'f1',             // Help
        'f3',             // Find
        'f5',             // Refresh
        'mod+r', 'ctrl+r', 'meta+r',          // Refresh
        'mod+shift+r'     // Force Refresh
    ];

    private blockedDefaults: Set<string> = new Set();

    /**
     * Map physical keys (code) to standard ASCII characters for consistent hotkey handling
     * regardless of the current keyboard layout (e.g. Russian, Greek).
     * This is primarily used when Mod/Ctrl/Meta is held down.
     */
    private static readonly CODE_TO_KEY: Record<string, string> = {
        'KeyA': 'a', 'KeyB': 'b', 'KeyC': 'c', 'KeyD': 'd', 'KeyE': 'e',
        'KeyF': 'f', 'KeyG': 'g', 'KeyH': 'h', 'KeyI': 'i', 'KeyJ': 'j',
        'KeyK': 'k', 'KeyL': 'l', 'KeyM': 'm', 'KeyN': 'n', 'KeyO': 'o',
        'KeyP': 'p', 'KeyQ': 'q', 'KeyR': 'r', 'KeyS': 's', 'KeyT': 't',
        'KeyU': 'u', 'KeyV': 'v', 'KeyW': 'w', 'KeyX': 'x', 'KeyY': 'y',
        'KeyZ': 'z',
        'Digit0': '0', 'Digit1': '1', 'Digit2': '2', 'Digit3': '3',
        'Digit4': '4', 'Digit5': '5', 'Digit6': '6', 'Digit7': '7',
        'Digit8': '8', 'Digit9': '9',
        'Comma': ',', 'Period': '.', 'Slash': '/', 'Backslash': '\\',
        'BracketLeft': '[', 'BracketRight': ']', 'Quote': "'", 'Semicolon': ';',
        'Minus': '-', 'Equal': '='
    };

    constructor(app: NotehubCore) {
        this.app = app;
        // Normalize blocked defaults
        this.blockedDefaults = new Set(
            KeyListener.BLOCKED_DEFAULTS_RAW.map(k => this.normalizeHotkey(k))
        );
    }

    /**
     * Initialize listeners and load initial keybindings
     */
    init(): void {
        this.log('info', `Initializing KeyListener. Platform: ${navigator.platform}, UserAgent: ${navigator.userAgent}`);

        this.boundKeydownHandler = this.handleKeydown.bind(this);
        // USE CAPTURE PHASE to intercept events before they hit default handlers or other listeners
        window.addEventListener('keydown', this.boundKeydownHandler, true);
        this.log('info', 'Key listener initialized (capture phase)');

        // Load initial bindings from all registered commands
        this.syncInitialBindings();
    }

    /**
     * Clean up listeners
     */
    dispose(): void {
        if (this.boundKeydownHandler) {
            window.removeEventListener('keydown', this.boundKeydownHandler, true);
            this.boundKeydownHandler = null;
        }
        this.hotkeyMap.clear();
        this.log('info', 'Key listener disposed');
    }

    /**
     * Register a new keybinding
     */
    registerBinding(commandId: string, hotkey: string): void {
        const normalized = this.normalizeHotkey(hotkey);
        this.hotkeyMap.set(normalized, commandId);
        this.log('info', `Registered binding: ${hotkey} -> ${commandId}`);
    }

    /**
     * Sync all currently registered commands from command-manager
     */
    private async syncInitialBindings(): Promise<void> {
        try {
            const commands: any[] = await this.app.api.invoke('command:get-all');

            if (Array.isArray(commands)) {
                let count = 0;
                for (const cmd of commands) {
                    if (cmd.defaultHotkey) {
                        this.registerBinding(cmd.id, cmd.defaultHotkey);
                        count++;
                    }
                }
                this.log('info', `Synced ${count} initial keybindings. Map size: ${this.hotkeyMap.size}`);
            }
        } catch (err) {
            this.log('warn', `Failed to sync initial bindings: ${err}`);
        }
    }

    /**
     * Handle keydown events
     */
    private handleKeydown(e: KeyboardEvent): void {
        const hotkey = this.buildHotkeyFromEvent(e);
        const commandId = this.hotkeyMap.get(hotkey);

        // Debug logging enabled to help diagnosis
        // console.log(`[Keymap] Keydown: code=${e.code} key=${e.key} -> "${hotkey}"`);

        // 1. Preemptively block dangerous defaults
        if (this.blockedDefaults.has(hotkey)) {
            e.preventDefault();
            e.stopPropagation();
        }

        if (!commandId) {
            return;
        }

        console.log(`[Keymap] Match: "${hotkey}" -> ${commandId}`);

        // Found a command for this hotkey
        // If we haven't already blocked it, do so now
        if (!this.blockedDefaults.has(hotkey)) {
            e.preventDefault();
            e.stopPropagation();
        }

        this.app.api.invoke('command:execute', commandId);
    }

    /**
     * Normalize hotkey string to internal format
     */
    private normalizeHotkey(hotkey: string): string {
        return hotkey.toLowerCase().split('+').sort().join('+');
    }

    /**
     * Build normalized hotkey from event
     */
    private buildHotkeyFromEvent(e: KeyboardEvent): string {
        if (e.key === 'Control' || e.key === 'Shift' || e.key === 'Alt' || e.key === 'Meta') {
            return ''; // Ignore modifier-only events
        }

        const parts: string[] = [];

        // Mod key mapping
        const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform) || /Mac/.test(navigator.userAgent);

        // Detect Mod (Ctrl on Windows/Linux, Command on Mac)
        if ((isMac && e.metaKey) || (!isMac && e.ctrlKey)) {
            parts.push('mod');
        } else {
            if (e.ctrlKey) parts.push('ctrl');
            if (e.metaKey) parts.push('meta');
        }

        if (e.shiftKey) parts.push('shift');
        if (e.altKey) parts.push('alt');

        // Key determination
        let key = e.key.toLowerCase();

        // If a modifier is pressed (especially Mod/Ctrl), use the physical key code
        // to avoid layout issues (e.g. Russian "Mod+M" producing "Mod+ь")
        const hasModifier = e.ctrlKey || e.metaKey || e.altKey;
        const mappedKey = hasModifier ? KeyListener.CODE_TO_KEY[e.code] : undefined;
        if (mappedKey) {
            key = mappedKey;
        }

        if (key === ' ') key = 'space';
        if (key === 'escape') key = 'esc';

        parts.push(key);

        return parts.sort().join('+');
    }

    private log(level: 'info' | 'warn', message: string): void {
        this.app.api.invoke(`logger:${level}`, 'nh.system.keymap', message);
    }
}
