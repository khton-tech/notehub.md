import { describe, it, expect } from 'vitest';
import { PortalWidget } from '../PortalWidget';
import type { PortalSpec } from '../types';
import type { FC } from 'react';

// Mock component
const MockComponent: FC<{ match: RegExpExecArray }> = () => null;

describe('PortalWidget', () => {
    const mockSpec: PortalSpec = {
        id: 'test.portal',
        regex: /test/g,
        component: MockComponent
    };

    const mockMatch1 = ['test'] as RegExpExecArray;
    mockMatch1.input = 'test';
    mockMatch1.index = 0;

    const mockMatch2 = ['test'] as RegExpExecArray;
    mockMatch2.input = 'test';
    mockMatch2.index = 0;

    const mockMatchDiff = ['diff'] as RegExpExecArray;
    mockMatchDiff.input = 'diff';
    mockMatchDiff.index = 0;

    it('should be equal if spec and match are identical', () => {
        const widget1 = new PortalWidget(mockSpec, mockMatch1);
        const widget2 = new PortalWidget(mockSpec, mockMatch1);

        expect(widget1.eq(widget2)).toBe(true);
    });

    it('should be equal if match content is the same (deep comparison)', () => {
        const widget1 = new PortalWidget(mockSpec, mockMatch1);
        const widget2 = new PortalWidget(mockSpec, mockMatch2);

        expect(widget1.eq(widget2)).toBe(true);
    });

    it('should not be equal if spec IDs differ', () => {
        const otherSpec = { ...mockSpec, id: 'other.portal' };

        const widget1 = new PortalWidget(mockSpec, mockMatch1);
        const widget2 = new PortalWidget(otherSpec, mockMatch1);

        expect(widget1.eq(widget2)).toBe(false);
    });

    it('should not be equal if match content differs', () => {
        const widget1 = new PortalWidget(mockSpec, mockMatch1);
        const widget2 = new PortalWidget(mockSpec, mockMatchDiff);

        expect(widget1.eq(widget2)).toBe(false);
    });
});
