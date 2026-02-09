import type { IPlugin, PluginManifest, NotehubCore } from '@notehub/core';

/**
 * ContextManagerPlugin - Context-aware state for conditional UI/commands
 *
 * Provides a global context system similar to VSCode's `when` clauses.
 * Plugins can set context values that other plugins can use to conditionally
 * enable/disable UI elements, commands, and keybindings.
 *
 * Use cases:
 * - `editorFocus` - Whether editor has focus
 * - `activeEditor.languageId` - Current file type
 * - `sidebarVisible` - Sidebar visibility state
 * - `youtubeActive` - Custom context from YouTube plugin
 *
 * API Methods:
 * - `context:set` - Set a context value
 * - `context:get` - Get a context value
 * - `context:delete` - Remove a context value
 * - `context:evaluate` - Evaluate a when clause expression
 * - `context:keys` - Get all context keys
 *
 * Events:
 * - `context:changed` - Emitted when any context value changes
 */
export class ContextManagerPlugin implements IPlugin {
    readonly manifest: PluginManifest = {
        id: 'nh.system.context-manager',
        name: 'ContextManager',
        version: '0.0.0',
        type: 'system',
    };

    /** Context storage */
    private context: Map<string, unknown> = new Map();

    /** Reference to kernel for event emission */
    private app: NotehubCore | null = null;

    /** Subscribers for context changes (key -> callbacks) */
    private subscribers: Map<string, Set<(value: unknown) => void>> = new Map();

    /**
     * Log a message via the Logger plugin
     */
    private log(level: 'info' | 'warn' | 'error', message: string): void {
        if (this.app) {
            this.app.api.invoke(`logger:${level}`, this.manifest.id, message);
        }
    }

    // =============== API Method Handlers ===============

    /**
     * Set a context value
     * Emits context:changed event after setting
     */
    private handleSet = (key: string, value: unknown): void => {
        if (typeof key !== 'string' || key.trim() === '') {
            this.log('error', 'Invalid key: must be a non-empty string');
            return;
        }

        const previousValue = this.context.get(key);
        this.context.set(key, value);

        // Emit change event
        if (this.app) {
            this.app.events.emit('context:changed', {
                key,
                value,
                previousValue,
            });
        }

        // Notify key-specific subscribers
        const subs = this.subscribers.get(key);
        if (subs) {
            for (const cb of subs) {
                try {
                    cb(value);
                } catch (e) {
                    this.log('error', `Subscriber error for key "${key}": ${e}`);
                }
            }
        }
    };

    /**
     * Get a context value
     */
    private handleGet = <T = unknown>(key: string): T | undefined => {
        return this.context.get(key) as T | undefined;
    };

    /**
     * Delete a context value
     */
    private handleDelete = (key: string): boolean => {
        const existed = this.context.has(key);
        if (existed) {
            const previousValue = this.context.get(key);
            this.context.delete(key);

            if (this.app) {
                this.app.events.emit('context:changed', {
                    key,
                    value: undefined,
                    previousValue,
                    deleted: true,
                });
            }
        }
        return existed;
    };

    /**
     * Evaluate a when clause expression
     * 
     * Supports:
     * - Simple key lookup: "editorFocus" -> truthy check
     * - Equality: "languageId == markdown"
     * - Inequality: "languageId != json"
     * - Negation: "!sidebarVisible"
     * - AND: "editorFocus && isMarkdown"
     * - OR: "editorFocus || previewFocus"
     * - Parentheses: "(a && b) || c"
     * 
     * @example
     * context:set('editorFocus', true);
     * context:set('languageId', 'markdown');
     * context:evaluate('editorFocus && languageId == markdown'); // true
     */
    private handleEvaluate = (expression: string): boolean => {
        try {
            return this.evaluateExpression(expression.trim());
        } catch (e) {
            this.log('error', `Failed to evaluate expression "${expression}": ${e}`);
            return false;
        }
    };

    /**
     * Get all context keys
     */
    private handleKeys = (): string[] => {
        return Array.from(this.context.keys());
    };

    /**
     * Subscribe to changes for a specific context key
     * @returns Unsubscribe function
     */
    private handleSubscribe = (key: string, callback: (value: unknown) => void): (() => void) => {
        let subs = this.subscribers.get(key);
        if (!subs) {
            subs = new Set();
            this.subscribers.set(key, subs);
        }
        subs.add(callback);

        // Return unsubscribe function
        return () => {
            const s = this.subscribers.get(key);
            if (s) {
                s.delete(callback);
                if (s.size === 0) {
                    this.subscribers.delete(key);
                }
            }
        };
    };

    /**
     * Get all context as object (for debugging)
     */
    private handleDump = (): Record<string, unknown> => {
        const result: Record<string, unknown> = {};
        for (const [key, value] of this.context.entries()) {
            result[key] = value;
        }
        return result;
    };

    // =============== Expression Evaluator ===============

    /**
     * Evaluate a when clause expression
     */
    private evaluateExpression(expr: string): boolean {
        // Handle empty expression
        if (!expr) return true;

        // Handle OR (lowest precedence)
        const orParts = this.splitByOperator(expr, '||');
        if (orParts.length > 1) {
            return orParts.some(part => this.evaluateExpression(part.trim()));
        }

        // Handle AND
        const andParts = this.splitByOperator(expr, '&&');
        if (andParts.length > 1) {
            return andParts.every(part => this.evaluateExpression(part.trim()));
        }

        // Handle parentheses
        if (expr.startsWith('(') && expr.endsWith(')')) {
            return this.evaluateExpression(expr.slice(1, -1).trim());
        }

        // Handle negation
        if (expr.startsWith('!')) {
            return !this.evaluateExpression(expr.slice(1).trim());
        }

        // Handle equality
        if (expr.includes('==')) {
            const parts = expr.split('==').map(s => s.trim());
            const left = parts[0] ?? '';
            const right = parts[1] ?? '';
            const leftValue = this.context.get(left);
            const rightValue = this.parseValue(right);
            return leftValue === rightValue;
        }

        // Handle inequality
        if (expr.includes('!=')) {
            const parts = expr.split('!=').map(s => s.trim());
            const left = parts[0] ?? '';
            const right = parts[1] ?? '';
            const leftValue = this.context.get(left);
            const rightValue = this.parseValue(right);
            return leftValue !== rightValue;
        }

        // Handle 'in' operator (value in array)
        if (expr.includes(' in ')) {
            const parts = expr.split(' in ').map(s => s.trim());
            const left = parts[0] ?? '';
            const right = parts[1] ?? '';
            const leftValue = this.context.get(left);
            const rightValue = this.context.get(right);
            if (Array.isArray(rightValue)) {
                return rightValue.includes(leftValue);
            }
            return false;
        }

        // Simple key lookup (truthy check)
        const value = this.context.get(expr);
        return Boolean(value);
    }

    /**
     * Split expression by operator, respecting parentheses
     */
    private splitByOperator(expr: string, operator: string): string[] {
        const parts: string[] = [];
        let current = '';
        let depth = 0;

        for (let i = 0; i < expr.length; i++) {
            const char = expr[i];
            if (char === '(') depth++;
            else if (char === ')') depth--;

            if (depth === 0 && expr.slice(i, i + operator.length) === operator) {
                parts.push(current);
                current = '';
                i += operator.length - 1; // Skip operator
            } else {
                current += char;
            }
        }
        parts.push(current);

        return parts.length > 1 ? parts : [expr];
    }

    /**
     * Parse a value string into its actual type
     */
    private parseValue(str: string): unknown {
        // Remove quotes for string literals
        if ((str.startsWith('"') && str.endsWith('"')) ||
            (str.startsWith("'") && str.endsWith("'"))) {
            return str.slice(1, -1);
        }
        // Boolean
        if (str === 'true') return true;
        if (str === 'false') return false;
        // Number
        if (!isNaN(Number(str))) return Number(str);
        // Otherwise treat as string literal
        return str;
    }

    // =============== Plugin Lifecycle ===============

    async load(app: NotehubCore): Promise<void> {
        this.app = app;
        this.log('info', 'Loading...');

        // Register API methods
        app.api.register('context:set', this.handleSet);
        app.api.register('context:get', this.handleGet);
        app.api.register('context:delete', this.handleDelete);
        app.api.register('context:evaluate', this.handleEvaluate);
        app.api.register('context:keys', this.handleKeys);
        app.api.register('context:subscribe', this.handleSubscribe);
        app.api.register('context:dump', this.handleDump);

        // Set some default contexts
        this.handleSet('platform', typeof window !== 'undefined' &&
            // @ts-expect-error Tauri internals check
            window.__TAURI_INTERNALS__ ? 'desktop' : 'web');

        this.log('info', 'Loaded successfully');
    }

    async unload(app: NotehubCore): Promise<void> {
        this.log('info', 'Unloading...');

        app.api.unregister('context:set');
        app.api.unregister('context:get');
        app.api.unregister('context:delete');
        app.api.unregister('context:evaluate');
        app.api.unregister('context:keys');
        app.api.unregister('context:subscribe');
        app.api.unregister('context:dump');

        this.context.clear();
        this.subscribers.clear();

        this.log('info', 'Unloaded');
        this.app = null;
    }
}

export default ContextManagerPlugin;
