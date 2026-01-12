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
 * Mapping of callout types to CSS variable names
 * These map to --nh-callout-* variables defined in theme-manager
 */
const TYPE_COLOR_VARS: Record<string, string> = {
    // Info (Blue)
    INFO: 'var(--nh-callout-info, #60a5fa)',
    NOTE: 'var(--nh-callout-info, #60a5fa)',

    // Tips (Green)
    TIP: 'var(--nh-callout-tip, #4ade80)',
    HINT: 'var(--nh-callout-tip, #4ade80)',
    SUCCESS: 'var(--nh-callout-tip, #4ade80)',
    CHECK: 'var(--nh-callout-tip, #4ade80)',
    DONE: 'var(--nh-callout-tip, #4ade80)',

    // Warnings (Amber)
    WARNING: 'var(--nh-callout-warning, #fbbf24)',
    WARN: 'var(--nh-callout-warning, #fbbf24)',
    CAUTION: 'var(--nh-callout-warning, #fbbf24)',

    // Danger (Red)
    DANGER: 'var(--nh-callout-danger, #f87171)',
    ERROR: 'var(--nh-callout-danger, #f87171)',
    BUG: 'var(--nh-callout-danger, #f87171)',
    IMPORTANT: 'var(--nh-callout-danger, #f87171)',

    // Questions (Purple)
    QUESTION: 'var(--nh-callout-question, #c084fc)',
    FAQ: 'var(--nh-callout-question, #c084fc)',

    // Quote (Gray)
    QUOTE: 'var(--nh-callout-quote, #a1a1aa)',
    CITE: 'var(--nh-callout-quote, #a1a1aa)',

    // Abstract (Cyan)
    ABSTRACT: 'var(--nh-callout-abstract, #22d3ee)',
    SUMMARY: 'var(--nh-callout-abstract, #22d3ee)',
    TLDR: 'var(--nh-callout-abstract, #22d3ee)',
};

/** Default color for unknown types */
const DEFAULT_COLOR = 'var(--nh-callout-quote, #a1a1aa)';

/**
 * CalloutHeader - Visual representation of a callout header
 * 
 * Displays an icon and title for a callout block with type-specific styling.
 * Now uses CSS variables for theming support.
 * 
 * @example
 * ```tsx
 * <CalloutHeader type="INFO" title="Important Information" />
 * ```
 */
export const CalloutHeader: React.FC<CalloutHeaderProps> = ({ type, title }) => {
    const normalizedType = type.toUpperCase();
    const Icon = TYPE_ICONS[normalizedType] || Info;
    const colorVar = TYPE_COLOR_VARS[normalizedType] || DEFAULT_COLOR;

    // Use type as display if no title provided
    const displayTitle = title?.trim() || type;

    return (
        <div
            className="cm-callout-header flex items-center gap-2 w-full font-mono text-sm leading-relaxed"
            style={{ color: colorVar }}
        >
            <Icon
                size={18}
                className="shrink-0 drop-shadow-[0_0_4px_currentColor]"
                style={{ color: colorVar }}
            />
            <span className="font-semibold" style={{ color: colorVar }}>
                {displayTitle}
            </span>
        </div>
    );
};
