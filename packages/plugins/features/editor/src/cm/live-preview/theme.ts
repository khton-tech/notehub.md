/**
 * Live Preview Theme
 * 
 * All block element styling for Live Preview mode.
 * Uses CSS variables from theme-manager for dynamic theming.
 * 
 * This replaces the global <style> injection anti-pattern with
 * CodeMirror's proper theme extension system.
 * 
 * @module live-preview/theme
 */

import { EditorView } from '@codemirror/view';

export const livePreviewTheme = EditorView.theme({
    // ============================================================================
    // CODE BLOCKS
    // ============================================================================

    '.cm-code-block-bg': {
        fontFamily: 'var(--nh-font-family-mono, "JetBrains Mono", monospace)',
        backgroundColor: 'var(--nh-bg-surface)',
        borderLeft: '1px solid var(--nh-border-subtle)',
        borderRight: '1px solid var(--nh-border-subtle)',
        // NO PADDING/MARGIN/TEXT-INDENT - breaks click positioning
        lineHeight: '1.5'
    },

    '.cm-code-block-first': {
        borderTop: '1px solid var(--nh-border-subtle)',
        borderTopLeftRadius: '8px',
        borderTopRightRadius: '8px',
        paddingTop: '12px',
        marginTop: '8px',
        position: 'relative' // For badge absolute positioning
    },

    '.cm-code-block-last': {
        borderBottom: '1px solid var(--nh-border-subtle)',
        borderBottomLeftRadius: '8px',
        borderBottomRightRadius: '8px',
        paddingBottom: '12px',
        marginBottom: '8px'
    },

    '.cm-code-block-badge': {
        position: 'absolute',
        top: '8px',
        right: '16px',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        color: 'var(--nh-text-muted)',
        padding: '2px 8px',
        fontSize: '0.7em',
        borderRadius: '4px',
        fontFamily: 'var(--nh-font-family-sans)',
        fontWeight: '500',
        pointerEvents: 'none',
        userSelect: 'none',
        zIndex: '10',
        lineHeight: '1.4'
    },

    // ============================================================================
    // BLOCK WIDGETS (Plan B Architecture)
    // ============================================================================

    // Code Block Widget Container
    '.nh-code-block-widget': {
        margin: '12px 0',
        border: '1px solid var(--nh-border-subtle)',
        borderRadius: '8px',
        backgroundColor: 'var(--nh-bg-surface)',
        overflow: 'hidden',
        fontFamily: 'var(--nh-font-family-mono, "JetBrains Mono", monospace)'
    },

    // Code Block Header with Language Badge
    '.nh-code-block-header': {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        padding: '6px 12px',
        borderBottom: '1px solid var(--nh-border-subtle)',
        backgroundColor: 'rgba(0, 0, 0, 0.2)'
    },

    '.nh-code-block-lang-badge': {
        fontSize: '0.7em',
        fontFamily: 'var(--nh-font-family-sans)',
        fontWeight: '500',
        color: 'var(--nh-text-muted)',
        textTransform: 'uppercase',
        letterSpacing: '0.5px'
    },

    // Code Block Content
    '.nh-code-block-content': {
        margin: '0',
        padding: '16px',
        fontSize: '0.9em',
        lineHeight: '1.6',
        overflowX: 'auto',
        color: 'var(--nh-text-primary)'
    },

    '.nh-code-block-content code': {
        fontFamily: 'inherit',
        backgroundColor: 'transparent'
    },

    // ============================================================================
    // STANDARD BLOCKQUOTES
    // ============================================================================

    '.cm-blockquote': {
        borderLeft: '4px solid var(--nh-accent-secondary)',
        borderRight: '1px solid transparent',
        // NO PADDING/MARGIN/TEXT-INDENT - breaks click positioning
        backgroundColor: 'rgba(96, 165, 250, 0.05)',
        color: 'var(--nh-text-primary)',
        fontStyle: 'normal',
        display: 'block'
    },

    '.cm-blockquote-first': {
        borderTop: '1px solid var(--nh-accent-secondary)',
        borderTopLeftRadius: '6px',
        borderTopRightRadius: '6px',
        borderRight: '1px solid var(--nh-accent-secondary)',
        paddingTop: '8px',
        marginTop: '8px'
    },

    '.cm-blockquote-last': {
        borderBottom: '1px solid var(--nh-accent-secondary)',
        borderBottomLeftRadius: '6px',
        borderBottomRightRadius: '6px',
        borderRight: '1px solid var(--nh-accent-secondary)',
        paddingBottom: '8px',
        marginBottom: '8px'
    },

    // ============================================================================
    // CALLOUTS
    // ============================================================================

    // Callout Header Widget Container
    '.cm-callout-header': {
        display: 'flex',
        alignItems: 'center',
        padding: '10px 14px',
        backgroundColor: 'var(--nh-bg-surface)',
        border: '1px solid var(--nh-border-subtle)',
        borderLeft: '4px solid',
        borderTopLeftRadius: '6px',
        borderTopRightRadius: '6px',
        fontWeight: '600',
        userSelect: 'none',
        gap: '10px'
    },

    '.cm-callout-icon': {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
    },

    // Header Line Container (when not replaced by widget)
    '.cm-callout-header-line': {
        paddingLeft: '0'
    },

    // Body Lines
    '.cm-callout-body': {
        backgroundColor: 'var(--nh-bg-surface)',
        borderLeft: '1px solid var(--nh-border-subtle)',
        borderRight: '1px solid var(--nh-border-subtle)',
        // NO PADDING/MARGIN/TEXT-INDENT - breaks click positioning
        // Only vertical padding is safe
        paddingTop: '4px',
        paddingBottom: '4px'
    },

    '.cm-callout-last': {
        borderBottom: '1px solid var(--nh-border-subtle)',
        borderBottomLeftRadius: '6px',
        borderBottomRightRadius: '6px',
        paddingBottom: '12px',
        marginBottom: '8px'
    },

    // ============================================================================
    // CALLOUT TYPE COLORS
    // ============================================================================

    // Note / Info (Blue)
    '.cm-callout-note .cm-callout-header, .cm-callout-info .cm-callout-header': {
        borderLeftColor: '#60a5fa',
        color: '#60a5fa'
    },

    // Success / Check (Green)
    '.cm-callout-success .cm-callout-header, .cm-callout-check .cm-callout-header': {
        borderLeftColor: '#4ade80',
        color: '#4ade80'
    },

    // Warning / Caution (Orange)
    '.cm-callout-warning .cm-callout-header, .cm-callout-caution .cm-callout-header': {
        borderLeftColor: '#fb923c',
        color: '#fb923c'
    },

    // Danger / Error (Red)
    '.cm-callout-danger .cm-callout-header, .cm-callout-error .cm-callout-header': {
        borderLeftColor: '#f87171',
        color: '#f87171'
    },

    // Tip / Important (Purple)
    '.cm-callout-tip .cm-callout-header, .cm-callout-important .cm-callout-header': {
        borderLeftColor: '#c084fc',
        color: '#c084fc'
    },

    // Quote / Abstract (Gray)
    '.cm-callout-quote .cm-callout-header, .cm-callout-abstract .cm-callout-header': {
        borderLeftColor: '#cbd5e1',
        color: '#cbd5e1'
    },

    // ============================================================================
    // INLINE ELEMENTS
    // ============================================================================

    '.cm-nh-bold': {
        fontWeight: 'bold',
        color: 'var(--nh-text-primary)'
    },

    '.cm-nh-italic': {
        fontStyle: 'italic'
    },

    '.cm-nh-link': {
        color: 'var(--nh-accent-primary)',
        textDecoration: 'none',
        cursor: 'pointer',
        transition: 'all 0.2s ease',

        '&:hover': {
            textDecoration: 'underline',
            opacity: '0.8'
        }
    },

    '.cm-nh-inline-code': {
        fontFamily: 'var(--nh-font-family-mono)',
        backgroundColor: 'rgba(255, 255, 255, 0.12)',
        padding: '0.15em 0.4em',
        borderRadius: '4px',
        color: 'var(--nh-accent-primary)'
    },

    // ============================================================================
    // HEADINGS
    // ============================================================================

    '.cm-nh-h1': { fontSize: '2em', fontWeight: '600' },
    '.cm-nh-h2': { fontSize: '1.6em', fontWeight: '600' },
    '.cm-nh-h3': { fontSize: '1.3em', fontWeight: '600' },
    '.cm-nh-h4': { fontSize: '1.1em', fontWeight: '600' },
    '.cm-nh-h5': { fontSize: '1.05em', fontWeight: '600' },
    '.cm-nh-h6': { fontSize: '1em', fontWeight: '600' },

    '.cm-nh-h1-line': {
        paddingTop: '0.5em',
        paddingBottom: '0.25em',
        borderBottom: '2px solid var(--nh-border-subtle)'
    },

    '.cm-nh-h2-line': {
        paddingTop: '0.4em',
        paddingBottom: '0.2em',
        borderBottom: '1px solid var(--nh-border-subtle)'
    },

    '.cm-nh-h3-line': { paddingTop: '0.3em', paddingBottom: '0.15em' },
    '.cm-nh-h4-line': { paddingTop: '0.2em', paddingBottom: '0.1em' },
    '.cm-nh-h5-line': { paddingTop: '0.15em', paddingBottom: '0.075em' },
    '.cm-nh-h6-line': { paddingTop: '0.1em', paddingBottom: '0.05em' },

    // ============================================================================
    // LISTS
    // ============================================================================

    '.cm-nh-bullet': {
        color: 'var(--nh-text-muted)',
        display: 'inline-block',
        width: '1em',
        textAlign: 'center'
    }

}, { dark: true });
