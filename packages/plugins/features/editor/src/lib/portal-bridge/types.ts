import type React from 'react';

/**
 * Represents a portal item that bridges a React component into a DOM element.
 *
 * @template P - The props type for the React component
 */
export interface PortalItem<P = unknown> {
    /** Unique identifier for this portal */
    id: string;

    /** React component to render */
    component: React.FC<P>;

    /** Props to pass to the component */
    props: P;

    /** DOM element to render the component into */
    domElement: HTMLElement;
}
