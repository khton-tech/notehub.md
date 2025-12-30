/**
 * @fileoverview CalloutHeader - React component for callout header rendering
 * 
 * Renders the visual representation of a callout header with icon and title.
 * Used by CalloutWidget via the Portal Bridge.
 * 
 * @module @notehub/editor/components/widgets/CalloutHeader
 */

import React from 'react';
import {
    Info,
    AlertTriangle,
    Zap,
    CheckCircle,
    Pencil,
    HelpCircle,
    Quote,
    Bug,
    Flame,
    ListTodo,
    type LucideIcon,
} from 'lucide-react';

/**
 * Props for the CalloutHeader component
 */
export interface CalloutHeaderProps {
    /** Callout type (info, warning, danger, etc.) */
    type: string;
    /** Callout title text */
    title: string;
}

/**
 * Callout type configuration
 */
interface CalloutConfig {
    icon: LucideIcon;
    colorVar: string;
    bgVar: string;
}

/**
 * Map of callout types to their visual configuration
 */
const CALLOUT_CONFIG: Record<string, CalloutConfig> = {
    // Information types
    info: {
        icon: Info,
        colorVar: 'var(--nh-callout-info, #58a6ff)',
        bgVar: 'var(--nh-callout-info-bg, rgba(88, 166, 255, 0.1))',
    },
    note: {
        icon: Pencil,
        colorVar: 'var(--nh-callout-note, #8b949e)',
        bgVar: 'var(--nh-callout-note-bg, rgba(139, 148, 158, 0.1))',
    },
    tip: {
        icon: Zap,
        colorVar: 'var(--nh-callout-tip, #3fb950)',
        bgVar: 'var(--nh-callout-tip-bg, rgba(63, 185, 80, 0.1))',
    },

    // Success types
    success: {
        icon: CheckCircle,
        colorVar: 'var(--nh-callout-success, #3fb950)',
        bgVar: 'var(--nh-callout-success-bg, rgba(63, 185, 80, 0.1))',
    },
    check: {
        icon: CheckCircle,
        colorVar: 'var(--nh-callout-check, #3fb950)',
        bgVar: 'var(--nh-callout-check-bg, rgba(63, 185, 80, 0.1))',
    },
    done: {
        icon: CheckCircle,
        colorVar: 'var(--nh-callout-done, #3fb950)',
        bgVar: 'var(--nh-callout-done-bg, rgba(63, 185, 80, 0.1))',
    },

    // Warning types
    warning: {
        icon: AlertTriangle,
        colorVar: 'var(--nh-callout-warning, #d29922)',
        bgVar: 'var(--nh-callout-warning-bg, rgba(210, 153, 34, 0.1))',
    },
    caution: {
        icon: AlertTriangle,
        colorVar: 'var(--nh-callout-caution, #d29922)',
        bgVar: 'var(--nh-callout-caution-bg, rgba(210, 153, 34, 0.1))',
    },
    attention: {
        icon: AlertTriangle,
        colorVar: 'var(--nh-callout-attention, #d29922)',
        bgVar: 'var(--nh-callout-attention-bg, rgba(210, 153, 34, 0.1))',
    },

    // Danger types
    danger: {
        icon: Flame,
        colorVar: 'var(--nh-callout-danger, #f85149)',
        bgVar: 'var(--nh-callout-danger-bg, rgba(248, 81, 73, 0.1))',
    },
    fail: {
        icon: Bug,
        colorVar: 'var(--nh-callout-fail, #f85149)',
        bgVar: 'var(--nh-callout-fail-bg, rgba(248, 81, 73, 0.1))',
    },
    error: {
        icon: Bug,
        colorVar: 'var(--nh-callout-error, #f85149)',
        bgVar: 'var(--nh-callout-error-bg, rgba(248, 81, 73, 0.1))',
    },

    // Other types
    question: {
        icon: HelpCircle,
        colorVar: 'var(--nh-callout-question, #a371f7)',
        bgVar: 'var(--nh-callout-question-bg, rgba(163, 113, 247, 0.1))',
    },
    quote: {
        icon: Quote,
        colorVar: 'var(--nh-callout-quote, #8b949e)',
        bgVar: 'var(--nh-callout-quote-bg, rgba(139, 148, 158, 0.1))',
    },
    todo: {
        icon: ListTodo,
        colorVar: 'var(--nh-callout-todo, #58a6ff)',
        bgVar: 'var(--nh-callout-todo-bg, rgba(88, 166, 255, 0.1))',
    },
};

/**
 * Default configuration for unknown callout types
 */
const DEFAULT_CONFIG: CalloutConfig = {
    icon: Info,
    colorVar: 'var(--nh-callout-default, #8b949e)',
    bgVar: 'var(--nh-callout-default-bg, rgba(139, 148, 158, 0.1))',
};

/**
 * Get callout configuration for a given type
 */
function getCalloutConfig(type: string): CalloutConfig {
    const normalizedType = type.toLowerCase().trim();
    return CALLOUT_CONFIG[normalizedType] || DEFAULT_CONFIG;
}

/**
 * CalloutHeader - Visual representation of a callout header
 * 
 * Renders as a flex container with:
 * - Icon (from lucide-react, colored by type)
 * - Title text
 * 
 * Styled with Tailwind classes (works via Portal in main app context).
 */
export const CalloutHeader: React.FC<CalloutHeaderProps> = ({ type, title }) => {
    const config = getCalloutConfig(type);
    const Icon = config.icon;

    // Use title or fallback to capitalized type
    const displayTitle = title || type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();

    return (
        <div
            className="flex items-center gap-2 px-3 py-2 rounded-t-md border-b font-medium select-none"
            style={{
                backgroundColor: config.bgVar,
                borderColor: config.colorVar,
                borderWidth: '1px 1px 1px 3px',
                borderStyle: 'solid',
            }}
        >
            <Icon
                size={18}
                style={{ color: config.colorVar }}
                className="flex-shrink-0"
            />
            <span
                style={{ color: config.colorVar }}
                className="text-sm font-semibold"
            >
                {displayTitle}
            </span>
        </div>
    );
};

CalloutHeader.displayName = 'CalloutHeader';
