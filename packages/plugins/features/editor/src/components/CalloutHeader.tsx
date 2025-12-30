/**
 * @fileoverview CalloutHeader - React component for callout header visualization
 * 
 * Renders the visual representation of a callout header with:
 * - Dynamic icon based on callout type (from lucide-react)
 * - Type-specific color styling
 * - Title display
 * 
 * @module @notehub/editor/components/CalloutHeader
 * @author Notehub Team
 */

import React from 'react';
import {
    Info,
    AlertTriangle,
    AlertCircle,
    Lightbulb,
    CheckCircle2,
    HelpCircle,
    Quote,
    Bug,
    Flame,
    Zap,
    type LucideIcon
} from 'lucide-react';

/**
 * Props for the CalloutHeader component
 */
export interface CalloutHeaderProps {
    /** Callout type (e.g., "INFO", "WARNING", "TIP") */
    type: string;
    /** Optional title text */
    title?: string;
}

/**
 * Mapping of callout types to lucide icons
 */
const TYPE_ICONS: Record<string, LucideIcon> = {
    // Primary types
    INFO: Info,
    NOTE: Info,
    TIP: Lightbulb,
    HINT: Lightbulb,
    WARNING: AlertTriangle,
    WARN: AlertTriangle,
    CAUTION: AlertCircle,
    DANGER: AlertCircle,
    ERROR: AlertCircle,
    SUCCESS: CheckCircle2,
    CHECK: CheckCircle2,
    DONE: CheckCircle2,
    QUESTION: HelpCircle,
    FAQ: HelpCircle,
    QUOTE: Quote,
    CITE: Quote,
    BUG: Bug,
    IMPORTANT: Flame,
    ABSTRACT: Zap,
    SUMMARY: Zap,
    TLDR: Zap,
};

/**
 * Mapping of callout types to CSS color classes
 */
const TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
    // Info (Blue)
    INFO: { bg: 'rgba(74, 144, 226, 0.15)', text: '#4a90e2', border: '#4a90e2' },
    NOTE: { bg: 'rgba(74, 144, 226, 0.15)', text: '#4a90e2', border: '#4a90e2' },

    // Tips (Green)
    TIP: { bg: 'rgba(76, 175, 80, 0.15)', text: '#4caf50', border: '#4caf50' },
    HINT: { bg: 'rgba(76, 175, 80, 0.15)', text: '#4caf50', border: '#4caf50' },
    SUCCESS: { bg: 'rgba(76, 175, 80, 0.15)', text: '#4caf50', border: '#4caf50' },
    CHECK: { bg: 'rgba(76, 175, 80, 0.15)', text: '#4caf50', border: '#4caf50' },
    DONE: { bg: 'rgba(76, 175, 80, 0.15)', text: '#4caf50', border: '#4caf50' },

    // Warnings (Orange)
    WARNING: { bg: 'rgba(255, 152, 0, 0.15)', text: '#ff9800', border: '#ff9800' },
    WARN: { bg: 'rgba(255, 152, 0, 0.15)', text: '#ff9800', border: '#ff9800' },
    CAUTION: { bg: 'rgba(255, 152, 0, 0.15)', text: '#ff9800', border: '#ff9800' },

    // Danger (Red)
    DANGER: { bg: 'rgba(244, 67, 54, 0.15)', text: '#f44336', border: '#f44336' },
    ERROR: { bg: 'rgba(244, 67, 54, 0.15)', text: '#f44336', border: '#f44336' },
    BUG: { bg: 'rgba(244, 67, 54, 0.15)', text: '#f44336', border: '#f44336' },
    IMPORTANT: { bg: 'rgba(244, 67, 54, 0.15)', text: '#f44336', border: '#f44336' },

    // Questions (Purple)
    QUESTION: { bg: 'rgba(156, 39, 176, 0.15)', text: '#9c27b0', border: '#9c27b0' },
    FAQ: { bg: 'rgba(156, 39, 176, 0.15)', text: '#9c27b0', border: '#9c27b0' },

    // Quote (Gray)
    QUOTE: { bg: 'rgba(158, 158, 158, 0.15)', text: '#9e9e9e', border: '#9e9e9e' },
    CITE: { bg: 'rgba(158, 158, 158, 0.15)', text: '#9e9e9e', border: '#9e9e9e' },

    // Abstract (Cyan)
    ABSTRACT: { bg: 'rgba(0, 188, 212, 0.15)', text: '#00bcd4', border: '#00bcd4' },
    SUMMARY: { bg: 'rgba(0, 188, 212, 0.15)', text: '#00bcd4', border: '#00bcd4' },
    TLDR: { bg: 'rgba(0, 188, 212, 0.15)', text: '#00bcd4', border: '#00bcd4' },
};

/** Default colors for unknown types */
const DEFAULT_COLORS = { bg: 'rgba(158, 158, 158, 0.15)', text: '#9e9e9e', border: '#9e9e9e' };

/**
 * CalloutHeader - Visual representation of a callout header
 * 
 * Displays an icon and title for a callout block with type-specific styling.
 * 
 * @example
 * ```tsx
 * <CalloutHeader type="INFO" title="Important Information" />
 * ```
 */
export const CalloutHeader: React.FC<CalloutHeaderProps> = ({ type, title }) => {
    const normalizedType = type.toUpperCase();
    const Icon = TYPE_ICONS[normalizedType] || Info;
    const colors = TYPE_COLORS[normalizedType] || DEFAULT_COLORS;

    // Use type as display if no title provided
    const displayTitle = title?.trim() || type;

    return (
        <div
            className="cm-callout-header"
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 12px',
                backgroundColor: colors.bg,
                borderLeft: `3px solid ${colors.border}`,
                borderTopLeftRadius: '4px',
                borderTopRightRadius: '4px',
                fontFamily: 'var(--nh-font-family-mono, "JetBrains Mono", monospace)',
                fontSize: '14px',
                lineHeight: '1.4',
            }}
        >
            <Icon
                size={18}
                style={{
                    color: colors.text,
                    flexShrink: 0,
                }}
            />
            <span
                style={{
                    color: colors.text,
                    fontWeight: 600,
                }}
            >
                {displayTitle}
            </span>
        </div>
    );
};
