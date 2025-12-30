/**
 * CheckboxWidget - Styled checkbox widget following official CodeMirror 6 pattern
 * 
 * This widget only handles visual rendering. Event handling is done
 * in the ViewPlugin's eventHandlers, following the official CodeMirror example.
 * 
 * Styling uses the app's CSS variables from theme-manager.
 */

import { WidgetType } from '@codemirror/view';

export class CheckboxWidget extends WidgetType {
    constructor(readonly checked: boolean) {
        super();
    }

    eq(other: CheckboxWidget): boolean {
        return other.checked === this.checked;
    }

    toDOM(): HTMLElement {
        const wrap = document.createElement('span');
        wrap.setAttribute('aria-hidden', 'true');
        wrap.className = 'nh-checkbox-widget';

        // Wrapper styling
        wrap.style.cssText = `
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 18px;
            height: 18px;
            margin-right: 8px;
            cursor: pointer;
            vertical-align: middle;
        `;

        // Create custom checkbox visual (not native input for better styling)
        const box = document.createElement('span');
        box.className = 'nh-checkbox-box';

        if (this.checked) {
            box.style.cssText = `
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 16px;
                height: 16px;
                border-radius: 4px;
                background: var(--nh-accent-primary, #6b5ce7);
                border: 2px solid var(--nh-accent-primary, #6b5ce7);
                transition: all 0.15s ease;
            `;

            // Checkmark SVG
            box.innerHTML = `
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" 
                     stroke="var(--nh-button-text, #ffffff)" stroke-width="3" 
                     stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
            `;
        } else {
            box.style.cssText = `
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 16px;
                height: 16px;
                border-radius: 4px;
                background: transparent;
                border: 2px solid var(--nh-border-secondary, #3a3a3a);
                transition: all 0.15s ease;
            `;
        }

        wrap.appendChild(box);

        // Hidden native checkbox for accessibility
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = this.checked;
        input.style.cssText = `
            position: absolute;
            opacity: 0;
            width: 0;
            height: 0;
            pointer-events: none;
        `;
        wrap.appendChild(input);

        return wrap;
    }

    // CRITICAL: Return false to allow events to propagate to ViewPlugin's eventHandlers
    ignoreEvent(): boolean {
        return false;
    }
}
