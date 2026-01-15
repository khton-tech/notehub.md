import type { CommandDefinition, VisibleCommand } from '@notehub.md/api';
import type { NotehubCore } from '@notehub/core';

/**
 * CommandRegistry - Central registry for all commands
 * 
 * Features:
 * - Command registration
 * - Context-aware execution (commands only work in their context)
 * - Visible command filtering for palette
 */
export class CommandRegistry {
    /** Registered commands by ID */
    private commands: Map<string, CommandDefinition> = new Map();

    /** Current active context (e.g., 'editor', 'explorer', 'global') */
    private activeContext: string = 'global';

    /** App reference for API calls */
    private app: NotehubCore;

    constructor(app: NotehubCore) {
        this.app = app;
    }

    /**
     * Initialize 
     */
    init(): void {
        this.log('info', 'Command Registry initialized');
    }

    /**
     * Cleanup 
     */
    dispose(): void {
        this.commands.clear();
        this.log('info', 'Disposed');
    }

    /**
     * Register a command
     */
    register(def: CommandDefinition): void {
        // Validate
        if (!def.id || !def.name || !def.handler) {
            this.log('warn', `Invalid command definition: ${JSON.stringify(def)}`);
            return;
        }

        // Check for duplicate
        if (this.commands.has(def.id)) {
            this.log('warn', `Command '${def.id}' already registered, overwriting`);
        }

        // Store command
        this.commands.set(def.id, def);

        // Register hotkey if provided (delegated to keymap plugin)
        if (def.defaultHotkey) {
            // Check if keymap plugin is available
            // cast to any because has may not be strictly typed for all future methods
            if ((this.app.api as any).has && (this.app.api as any).has('keymap:register-binding')) {
                this.app.api.invoke('keymap:register-binding', def.id, def.defaultHotkey);
            }
            this.log('info', `Registered command '${def.id}' with hotkey '${def.defaultHotkey}'`);
        } else {
            this.log('info', `Registered command '${def.id}'`);
        }
    }

    /**
     * Unregister a command
     */
    unregister(id: string): boolean {
        const cmd = this.commands.get(id);
        if (!cmd) return false;

        this.commands.delete(id);
        this.log('info', `Unregistered command '${id}'`);
        return true;
    }

    /**
     * Set the active context
     */
    setContext(context: string): void {
        if (this.activeContext !== context) {
            this.log('info', `Context changed: '${this.activeContext}' -> '${context}'`);
            this.activeContext = context;
        }
    }

    /**
     * Get current context
     */
    getContext(): string {
        return this.activeContext;
    }

    /**
     * Get all registered commands
     */
    getAll(): CommandDefinition[] {
        return Array.from(this.commands.values());
    }

    /**
     * Execute a command by ID
     */
    async execute(id: string): Promise<void> {
        const cmd = this.commands.get(id);
        if (!cmd) {
            this.log('warn', `Command '${id}' not found`);
            return;
        }

        // Check context
        if (cmd.context && cmd.context !== this.activeContext) {
            this.log('info', `Command '${id}' skipped: context mismatch (requires '${cmd.context}', active is '${this.activeContext}')`);
            return;
        }

        try {
            this.log('info', `Executing command '${id}'`);
            await cmd.handler();
        } catch (error) {
            this.log('error', `Command '${id}' failed: ${error}`);
        }
    }

    /**
     * Get commands visible for the palette in the current context
     */
    getVisibleCommands(): VisibleCommand[] {
        const visible: VisibleCommand[] = [];

        for (const [id, cmd] of this.commands) {
            // Must include 'palette' in areas (or have no areas specified, default to palette)
            const areas = cmd.areas || ['palette'];
            if (!areas.includes('palette')) continue;

            // Check context: command is visible if it has no context requirement,
            // OR if its context matches the active context
            if (cmd.context && cmd.context !== this.activeContext) continue;

            const entry: VisibleCommand = {
                id,
                name: cmd.name,
            };
            if (cmd.defaultHotkey) {
                entry.hotkey = this.formatHotkeyForDisplay(cmd.defaultHotkey);
            }
            visible.push(entry);
        }

        // Sort alphabetically by name
        visible.sort((a, b) => a.name.localeCompare(b.name));

        return visible;
    }

    /**
     * Log helper
     */
    private log(level: 'info' | 'warn' | 'error', message: string): void {
        this.app.api.invoke(`logger:${level}`, 'nh.system.command-manager', message);
    }

    /**
     * Format a hotkey for display (platform-specific symbols)
     */
    private formatHotkeyForDisplay(hotkey: string): string {
        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

        return hotkey
            .replace(/Mod\+/gi, isMac ? '⌘' : 'Ctrl+')
            .replace(/Shift\+/gi, isMac ? '⇧' : 'Shift+')
            .replace(/Alt\+/gi, isMac ? '⌥' : 'Alt+');
    }
}
