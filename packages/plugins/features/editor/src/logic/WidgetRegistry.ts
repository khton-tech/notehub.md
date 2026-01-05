/**
 * @fileoverview Widget Registry - Manages dynamic regex-based widgets
 * 
 * This registry stores definitions for widgets that should be rendered
 * in the editor based on regex matches.
 */

import type { FC } from 'react';

export interface WidgetDefinition {
    id: string;
    regex: RegExp;
    component: FC<any>;
}

export class WidgetRegistry {
    private widgets: Map<string, WidgetDefinition> = new Map();
    private listeners: Set<() => void> = new Set();

    /**
     * Register a new widget
     * 
     * @param id - Unique identifier for the widget
     * @param regex - Regex pattern to match
     * @param component - React component to render
     */
    register(id: string, regex: RegExp, component: FC<any>): void {
        this.widgets.set(id, { id, regex, component });
        this.notifyListeners();
    }

    /**
     * Unregister a widget
     */
    unregister(id: string): void {
        if (this.widgets.delete(id)) {
            this.notifyListeners();
        }
    }

    /**
     * Get all registered widgets
     */
    getAll(): WidgetDefinition[] {
        return Array.from(this.widgets.values());
    }

    /**
     * Subscribe to registry changes
     */
    subscribe(listener: () => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    private notifyListeners(): void {
        this.listeners.forEach(listener => listener());
    }
}
