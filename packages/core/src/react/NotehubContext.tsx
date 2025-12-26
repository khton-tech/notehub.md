/**
 * @fileoverview React Context for Notehub Core injection
 * @module @notehub/core/react/NotehubContext
 */

import { createContext, useContext, type ReactNode, type FC } from 'react';
import type { NotehubCore } from '../index.js';
import type { ApiBus } from '../buses/ApiBus.js';

/**
 * React context for accessing the Notehub Core instance
 * 
 * This context provides a way to inject the core instance deep into
 * the component tree without prop drilling.
 */
export const NotehubContext = createContext<NotehubCore | null>(null);

/**
 * Props for NotehubProvider
 */
export interface NotehubProviderProps {
    /** The NotehubCore instance to provide */
    value: NotehubCore;
    /** Child components */
    children: ReactNode;
}

/**
 * Provider component for injecting NotehubCore into the React tree
 * 
 * Wrap your root component (or LayoutRenderer) with this provider
 * to enable the useNotehub() and useApi() hooks throughout your app.
 * 
 * @example
 * ```tsx
 * import { NotehubProvider } from '@notehub/core';
 * 
 * function App() {
 *     return (
 *         <NotehubProvider value={coreInstance}>
 *             <LayoutRenderer />
 *         </NotehubProvider>
 *     );
 * }
 * ```
 */
export const NotehubProvider: FC<NotehubProviderProps> = ({ value, children }) => {
    return (
        <NotehubContext.Provider value={value}>
            {children}
        </NotehubContext.Provider>
    );
};

/**
 * Hook to access the NotehubCore instance
 * 
 * Must be used within a NotehubProvider. Throws an error if used outside.
 * 
 * @returns The NotehubCore instance
 * @throws Error if used outside of NotehubProvider
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *     const core = useNotehub();
 *     
 *     const handleClick = () => {
 *         core.events.emit('my:event', { data: 'value' });
 *     };
 *     
 *     return <button onClick={handleClick}>Emit Event</button>;
 * }
 * ```
 */
export function useNotehub(): NotehubCore {
    const context = useContext(NotehubContext);

    if (!context) {
        throw new Error(
            '[useNotehub] Must be used within a NotehubProvider. ' +
            'Wrap your component tree with <NotehubProvider value={core}>.'
        );
    }

    return context;
}

/**
 * Hook to access the ApiBus directly
 * 
 * Convenience hook that extracts the API bus from the core instance.
 * Must be used within a NotehubProvider.
 * 
 * @returns The ApiBus instance for invoking API methods
 * @throws Error if used outside of NotehubProvider
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *     const api = useApi();
 *     
 *     const handleClick = async () => {
 *         // Fully typed!
 *         await api.invoke('logger:info', 'MyComponent', 'Button clicked');
 *         const theme = api.invoke('theme:get-current');
 *     };
 *     
 *     return <button onClick={handleClick}>Log Message</button>;
 * }
 * ```
 */
export function useApi(): ApiBus {
    const core = useNotehub();
    return core.api;
}

/**
 * Hook to access the EventBus directly
 * 
 * Convenience hook that extracts the event bus from the core instance.
 * Must be used within a NotehubProvider.
 * 
 * @returns The EventBus instance for event pub/sub
 * @throws Error if used outside of NotehubProvider
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *     const events = useEvents();
 *     
 *     useEffect(() => {
 *         const unsubscribe = events.on('vault:opened', (payload) => {
 *             console.log('Vault opened:', payload);
 *         });
 *         return unsubscribe;
 *     }, [events]);
 *     
 *     return <div>Listening for events...</div>;
 * }
 * ```
 */
export function useEvents() {
    const core = useNotehub();
    return core.events;
}
