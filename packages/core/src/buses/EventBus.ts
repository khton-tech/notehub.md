/**
 * Options for subscribing to events
 */
export interface SubscribeOptions {
    /** 
     * Priority of the listener (higher = runs earlier)
     * Default: 0 
     */
    priority?: number;
    /**
     * Optional condition to check before invoking handler
     */
    condition?: (payload: unknown) => boolean;
}

/**
 * Context passed to event handlers
 */
export interface EventContext {
    /** Prevent further propagation and default action */
    preventDefault(): void;
    /** Check if default was prevented */
    readonly defaultPrevented: boolean;
    /** Stop calling remaining listeners */
    stopPropagation(): void;
    /** Check if propagation was stopped */
    readonly propagationStopped: boolean;
}

/**
 * Result of an emit operation
 */
export interface EmitResult {
    defaultPrevented: boolean;
    propagationStopped: boolean;
}

/**
 * Generic event callback type
 * Supports both sync and async handlers
 */
export type EventCallback<T = unknown> = (payload: T, context: EventContext) => void | Promise<void>;

/**
 * Event map type for type-safe event definitions
 */
export type EventMap = Record<string, unknown>;

interface ListenerRecord {
    callback: EventCallback<unknown>;
    priority: number;
    condition: ((payload: unknown) => boolean) | undefined;
}

/**
 * Type-safe Event Bus for inter-plugin communication
 * Supports priorities and cancelable events.
 */
export class EventBus<TEvents extends EventMap = EventMap> {
    private listeners = new Map<keyof TEvents, ListenerRecord[]>();

    /**
     * Subscribe to an event
     * @param event - Event name
     * @param callback - Callback function to invoke when event is emitted
     * @param options - Subscription options (priority, condition)
     */
    on<K extends keyof TEvents>(
        event: K,
        callback: EventCallback<TEvents[K]>,
        options?: SubscribeOptions
    ): void {
        const record: ListenerRecord = {
            callback: callback as EventCallback<unknown>,
            priority: options?.priority ?? 0,
            condition: options?.condition as ((p: unknown) => boolean) | undefined
        };

        const existing = this.listeners.get(event) ?? [];
        existing.push(record);

        // Sort by priority desc
        existing.sort((a, b) => b.priority - a.priority);

        this.listeners.set(event, existing);
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
        const records = this.listeners.get(event);
        if (records) {
            const index = records.findIndex(r => r.callback === callback);
            if (index !== -1) {
                records.splice(index, 1);
                if (records.length === 0) {
                    this.listeners.delete(event);
                }
            }
        }
    }

    /**
     * Emit an event to all subscribers sequentially based on priority.
     * Use options to control behavior.
     * @param event - Event name
     * @param payload - Event payload data
     * @param options - Emit options
     */
    async emit<K extends keyof TEvents>(
        event: K,
        payload?: TEvents[K]
    ): Promise<EmitResult> {
        const records = this.listeners.get(event);

        let defaultPrevented = false;
        let propagationStopped = false;

        const context: EventContext = {
            preventDefault: () => { defaultPrevented = true; },
            get defaultPrevented() { return defaultPrevented; },
            stopPropagation: () => { propagationStopped = true; },
            get propagationStopped() { return propagationStopped; }
        };

        if (records) {
            // Create a copy to avoid issues if listeners unsubscribe during emit
            const listenersToRun = [...records];

            for (const record of listenersToRun) {
                if (propagationStopped) break;

                // Check condition
                if (record.condition && !record.condition(payload)) {
                    continue;
                }

                try {
                    await record.callback(payload as TEvents[K], context);
                } catch (error) {
                    console.error(`[EventBus] Error in handler for event "${String(event)}":`, error);
                }
            }
        }

        return { defaultPrevented, propagationStopped };
    }

    /**
     * Subscribe to an event for a single emission only
     */
    once<K extends keyof TEvents>(
        event: K,
        callback: EventCallback<TEvents[K]>,
        options?: SubscribeOptions
    ): void {
        const onceWrapper: EventCallback<TEvents[K]> = async (payload, context) => {
            this.off(event, onceWrapper);
            await callback(payload, context);
        };
        this.on(event, onceWrapper, options);
    }

    /**
     * Remove all listeners for a specific event or all events
     */
    clear<K extends keyof TEvents>(event?: K): void {
        if (event !== undefined) {
            this.listeners.delete(event);
        } else {
            this.listeners.clear();
        }
    }

    /**
     * Get listener count for an event
     */
    listenerCount<K extends keyof TEvents>(event: K): number {
        return this.listeners.get(event)?.length ?? 0;
    }
}
