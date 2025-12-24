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
export class EventBus {
    listeners = new Map();
    /**
     * Subscribe to an event
     * @param event - Event name
     * @param callback - Callback function to invoke when event is emitted
     */
    on(event, callback) {
        let callbacks = this.listeners.get(event);
        if (!callbacks) {
            callbacks = new Set();
            this.listeners.set(event, callbacks);
        }
        callbacks.add(callback);
    }
    /**
     * Unsubscribe from an event
     * @param event - Event name
     * @param callback - The callback function to remove
     */
    off(event, callback) {
        const callbacks = this.listeners.get(event);
        if (callbacks) {
            callbacks.delete(callback);
            if (callbacks.size === 0) {
                this.listeners.delete(event);
            }
        }
    }
    /**
     * Emit an event to all subscribers
     * @param event - Event name
     * @param payload - Event payload data
     */
    emit(event, payload) {
        const callbacks = this.listeners.get(event);
        if (callbacks) {
            for (const callback of callbacks) {
                try {
                    callback(payload);
                }
                catch (error) {
                    console.error(`[EventBus] Error in handler for event "${String(event)}":`, error);
                }
            }
        }
    }
    /**
     * Subscribe to an event for a single emission only
     * @param event - Event name
     * @param callback - Callback function invoked once
     */
    once(event, callback) {
        const onceWrapper = (payload) => {
            this.off(event, onceWrapper);
            callback(payload);
        };
        this.on(event, onceWrapper);
    }
    /**
     * Remove all listeners for a specific event or all events
     * @param event - Optional event name. If omitted, clears all listeners.
     */
    clear(event) {
        if (event !== undefined) {
            this.listeners.delete(event);
        }
        else {
            this.listeners.clear();
        }
    }
}
//# sourceMappingURL=EventBus.js.map