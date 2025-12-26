/**
 * Static decoration definitions for Live Preview
 * 
 * These are created once and reused for performance.
 * Classes map to styles defined in notehubTheme.
 */

import { Decoration, WidgetType } from '@codemirror/view';

// ============================================================================
// HIDDEN SYNTAX DECORATIONS
// ============================================================================

/**
 * Replace decoration that hides syntax markers (**, *, #, etc.)
 * Empty widget = text collapses to 0 width
 */
export const hiddenSyntax = Decoration.replace({});

// ============================================================================
// INLINE MARK DECORATIONS
// ============================================================================

/**
 * Bold text styling (applied to content between ** markers)
 */
export const boldMark = Decoration.mark({
    class: 'cm-nh-bold'
});

/**
 * Italic text styling (applied to content between * markers)
 */
export const italicMark = Decoration.mark({
    class: 'cm-nh-italic'
});

/**
 * Link text styling
 */
export const linkMark = Decoration.mark({
    class: 'cm-nh-link'
});

/**
 * Strikethrough text styling
 */
export const strikethroughMark = Decoration.mark({
    class: 'cm-nh-strikethrough'
});

/**
 * Inline code styling
 */
export const inlineCodeMark = Decoration.mark({
    class: 'cm-nh-inline-code'
});

/**
 * Bullet point replacement decoration
 * We use a WidgetDecoration to replace the dash with a bullet
 */
class BulletWidget extends WidgetType {
    toDOM() {
        const span = document.createElement('span');
        span.textContent = '•';
        span.className = 'cm-nh-bullet';
        return span;
    }
}

export const bulletPointWidget = Decoration.replace({
    widget: new BulletWidget()
});

// ============================================================================
// LINE DECORATIONS (for block elements)
// ============================================================================

/**
 * Heading line decorations by level (H1-H6)
 * Applied to the entire line container
 */
export const headingLines = {
    1: Decoration.line({ class: 'cm-nh-h1-line' }),
    2: Decoration.line({ class: 'cm-nh-h2-line' }),
    3: Decoration.line({ class: 'cm-nh-h3-line' }),
    4: Decoration.line({ class: 'cm-nh-h4-line' }),
    5: Decoration.line({ class: 'cm-nh-h5-line' }),
    6: Decoration.line({ class: 'cm-nh-h6-line' }),
} as const;

/**
 * Heading text mark decorations (for the actual heading text)
 */
export const headingMarks = {
    1: Decoration.mark({ class: 'cm-nh-h1' }),
    2: Decoration.mark({ class: 'cm-nh-h2' }),
    3: Decoration.mark({ class: 'cm-nh-h3' }),
    4: Decoration.mark({ class: 'cm-nh-h4' }),
    5: Decoration.mark({ class: 'cm-nh-h5' }),
    6: Decoration.mark({ class: 'cm-nh-h6' }),
} as const;

// ============================================================================
// UTILITY TYPES
// ============================================================================

export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

// ============================================================================
// CODE BLOCK DECORATIONS
// ============================================================================

/**
 * Hides the code block fences (```)
 */
export const codeBlockFenceHide = Decoration.replace({});

/**
 * Applies background color to code block lines
 */
export const codeBlockBackground = Decoration.line({
    class: 'cm-code-block-bg'
});

/**
 * Widget to display language badge
 */
class BadgeWidget extends WidgetType {
    constructor(readonly text: string) {
        super();
    }

    eq(other: BadgeWidget) {
        return other.text === this.text;
    }

    toDOM() {
        const span = document.createElement('span');
        span.className = 'cm-code-block-badge';
        span.textContent = this.text;
        return span;
    }
}

export const codeBlockLangBadge = (lang: string) => Decoration.widget({
    widget: new BadgeWidget(lang),
    side: 1
});
