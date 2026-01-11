import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PortalRegistry } from '../PortalRegistry';
import type { PortalSpec } from '../types';

describe('PortalRegistry', () => {
    let registry: PortalRegistry;

    const mockSpec: PortalSpec = {
        id: 'test.portal',
        regex: /test/g,
        component: () => null,
        name: 'Test Portal'
    };

    beforeEach(() => {
        registry = PortalRegistry.getInstance();
        registry.clear();
    });

    it('should maintain a singleton instance', () => {
        const instance1 = PortalRegistry.getInstance();
        const instance2 = PortalRegistry.getInstance();
        expect(instance1).toBe(instance2);
    });

    it('should register and retrieve a portal', () => {
        registry.register(mockSpec);

        expect(registry.get(mockSpec.id)).toBe(mockSpec);
        expect(registry.getAll()).toContain(mockSpec);
        expect(registry.getAll()).toHaveLength(1);
    });

    it('should unregister a portal', () => {
        registry.register(mockSpec);
        expect(registry.get(mockSpec.id)).toBeDefined();

        registry.unregister(mockSpec.id);
        expect(registry.get(mockSpec.id)).toBeUndefined();
        expect(registry.getAll()).toHaveLength(0);
    });

    it('should notify listeners on register', () => {
        const listener = vi.fn();
        registry.onUpdate(listener);

        registry.register(mockSpec);
        expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should notify listeners on unregister', () => {
        registry.register(mockSpec);

        const listener = vi.fn();
        registry.onUpdate(listener);

        registry.unregister(mockSpec.id);
        expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should allow unsubscribing from updates', () => {
        const listener = vi.fn();
        const unsubscribe = registry.onUpdate(listener);

        unsubscribe();
        registry.register(mockSpec);

        expect(listener).not.toHaveBeenCalled();
    });
});
