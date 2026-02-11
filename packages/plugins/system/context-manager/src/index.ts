import { SystemPlugin } from '@notehub/core';
import type { PluginManifest } from '@notehub/core';

/**
 * ContextManagerPlugin - Context-aware state for conditional UI/commands
 */
export class ContextManagerPlugin extends SystemPlugin {
    readonly manifest: PluginManifest = {
        id: 'nh.system.context-manager',
        name: 'ContextManager',
        version: '0.0.0',
        type: 'system',
    };

    /** Context storage */
    private context: Map<string, unknown> = new Map();

    /** Subscribers for context changes (key -> callbacks) */
    private subscribers: Map<string, Set<(value: unknown) => void>> = new Map();

    // =============== API Method Handlers ===============

    private handleSet = (key: string, value: unknown): void => {
        if (typeof key !== 'string' || key.trim() === '') {
            this.log('error', 'Invalid key: must be a non-empty string');
            return;
        }

        const previousValue = this.context.get(key);
        this.context.set(key, value);

        this.app.events.emit('context:changed', {
            key,
            value,
            previousValue,
        });

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

    private handleGet = <T = unknown>(key: string): T | undefined => {
        return this.context.get(key) as T | undefined;
    };

    private handleDelete = (key: string): boolean => {
        const existed = this.context.has(key);
        if (existed) {
            const previousValue = this.context.get(key);
            this.context.delete(key);

            this.app.events.emit('context:changed', {
                key,
                value: undefined,
                previousValue,
                deleted: true,
            });
        }
        return existed;
    };

    private handleEvaluate = (expression: string): boolean => {
        try {
            return this.evaluateExpression(expression.trim());
        } catch (e) {
            this.log('error', `Failed to evaluate expression "${expression}": ${e}`);
            return false;
        }
    };

    private handleKeys = (): string[] => {
        return Array.from(this.context.keys());
    };

    private handleSubscribe = (key: string, callback: (value: unknown) => void): (() => void) => {
        let subs = this.subscribers.get(key);
        if (!subs) {
            subs = new Set();
            this.subscribers.set(key, subs);
        }
        subs.add(callback);

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

    private handleDump = (): Record<string, unknown> => {
        const result: Record<string, unknown> = {};
        for (const [key, value] of this.context.entries()) {
            result[key] = value;
        }
        return result;
    };

    // =============== Expression Evaluator ===============

    private evaluateExpression(expr: string): boolean {
        if (!expr) return true;

        const orParts = this.splitByOperator(expr, '||');
        if (orParts.length > 1) {
            return orParts.some(part => this.evaluateExpression(part.trim()));
        }

        const andParts = this.splitByOperator(expr, '&&');
        if (andParts.length > 1) {
            return andParts.every(part => this.evaluateExpression(part.trim()));
        }

        if (expr.startsWith('(') && expr.endsWith(')')) {
            return this.evaluateExpression(expr.slice(1, -1).trim());
        }

        if (expr.startsWith('!')) {
            return !this.evaluateExpression(expr.slice(1).trim());
        }

        if (expr.includes('==')) {
            const parts = expr.split('==').map(s => s.trim());
            const left = parts[0] ?? '';
            const right = parts[1] ?? '';
            const leftValue = this.context.get(left);
            const rightValue = this.parseValue(right);
            return leftValue === rightValue;
        }

        if (expr.includes('!=')) {
            const parts = expr.split('!=').map(s => s.trim());
            const left = parts[0] ?? '';
            const right = parts[1] ?? '';
            const leftValue = this.context.get(left);
            const rightValue = this.parseValue(right);
            return leftValue !== rightValue;
        }

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

        const value = this.context.get(expr);
        return Boolean(value);
    }

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
                i += operator.length - 1;
            } else {
                current += char;
            }
        }
        parts.push(current);

        return parts.length > 1 ? parts : [expr];
    }

    private parseValue(str: string): unknown {
        if ((str.startsWith('"') && str.endsWith('"')) ||
            (str.startsWith("'") && str.endsWith("'"))) {
            return str.slice(1, -1);
        }
        if (str === 'true') return true;
        if (str === 'false') return false;
        if (!isNaN(Number(str))) return Number(str);
        return str;
    }

    // =============== Plugin Lifecycle ===============

    protected async onLoad(): Promise<void> {
        this.log('info', 'Loading...');

        this.registerApi('context:set', this.handleSet);
        this.registerApi('context:get', this.handleGet);
        this.registerApi('context:delete', this.handleDelete);
        this.registerApi('context:evaluate', this.handleEvaluate);
        this.registerApi('context:keys', this.handleKeys);
        this.registerApi('context:subscribe', this.handleSubscribe);
        this.registerApi('context:dump', this.handleDump);

        // Set some default contexts
        this.handleSet('platform', typeof window !== 'undefined' &&
            // @ts-expect-error Tauri internals check
            window.__TAURI_INTERNALS__ ? 'desktop' : 'web');

        this.log('info', 'Loaded successfully');
    }

    protected async onUnload(): Promise<void> {
        this.log('info', 'Unloading...');
        this.context.clear();
        this.subscribers.clear();
        this.log('info', 'Unloaded');
    }
}

export default ContextManagerPlugin;
