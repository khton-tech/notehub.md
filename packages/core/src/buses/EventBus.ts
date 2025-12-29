/**
 * Generic event callback type
 * Supports both sync and async handlers
 */
export type EventCallback<T = unknown> = (payload: T) => void | Promise<void>;

/**
 * Event map type for type-safe event definitions
 */
export type EventMap = Record<string, unknown>;

/**
 * Type-safe Event Bus for inter-plugin communication
 *
 * @example
 * ```ts
 * interface AppEvents {
 *   'user:login': { userId: string };
 *   'note:created': { noteId: string; title: string };
 * }
 *
 * const bus = new EventBus<AppEvents>();
 * bus.on('user:login', (payload) => console.log(payload.userId));
 * bus.emit('user:login', { userId: '123' });
 * ```
 */
export class EventBus<TEvents extends EventMap = EventMap> {
    private listeners = new Map<keyof TEvents, Set<EventCallback<unknown>>>();

    /**
     * Subscribe to an event
     * @param event - Event name
     * @param callback - Callback function to invoke when event is emitted
     */
    on<K extends keyof TEvents>(
        event: K,
        callback: EventCallback<TEvents[K]>
    ): void {
        let callbacks = this.listeners.get(event);
        if (!callbacks) {
            callbacks = new Set();
            this.listeners.set(event, callbacks);
        }
        callbacks.add(callback as EventCallback<unknown>);
    }

    /**
     * Unsubscribe from an event
     * @param event - Event name
     * @param callback - The callback function to remove
     */
    off<K extends keyof TEvents>(
        event: K,
        callback: EventCallback<TEvents[K]>
    ): void {
        const callbacks = this.listeners.get(event);
        if (callbacks) {
            callbacks.delete(callback as EventCallback<unknown>);
            if (callbacks.size === 0) {
                this.listeners.delete(event);
            }
        }
    }

    /**
     * Emit an event to all subscribers asynchronously
     * Uses Promise.allSettled to ensure one failing listener doesn't block others
     * @param event - Event name
     * @param payload - Event payload data
     */
    async emit<K extends keyof TEvents>(event: K, payload?: TEvents[K]): Promise<void> {
        const callbacks = this.listeners.get(event);
        if (callbacks) {
            const results = await Promise.allSettled(
                Array.from(callbacks).map(cb => Promise.resolve(cb(payload)))
            );
            // Log any errors from failed handlers
            for (const result of results) {
                if (result.status === 'rejected') {
                    console.error(`[EventBus] Error in handler for event "${String(event)}":`, result.reason);
                }
            }
        }
    }

    /**
     * Subscribe to an event for a single emission only
     * @param event - Event name
     * @param callback - Callback function invoked once
     */
    once<K extends keyof TEvents>(
        event: K,
        callback: EventCallback<TEvents[K]>
    ): () => void {
        const onceWrapper: EventCallback<TEvents[K]> = (payload) => {
            this.off(event, onceWrapper);
            callback(payload);
        };
        this.on(event, onceWrapper);
        return () => this.off(event, onceWrapper);
    }

    /**
     * Remove all listeners for a specific event or all events
     * @param event - Optional event name. If omitted, clears all listeners.
     */
    clear<K extends keyof TEvents>(event?: K): void {
        if (event !== undefined) {
            this.listeners.delete(event);
        } else {
            this.listeners.clear();
        }
    }
}
