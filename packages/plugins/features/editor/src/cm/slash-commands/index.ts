import { autocompletion, startCompletion } from "@codemirror/autocomplete";
import type { Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { slashCommandSource } from "./source";
import { slashPlaceholder } from "./placeholder";

/**
 * Listener that detects backspace/delete operations.
 * If the user backspaces into a potential slash command (e.g. "/c" after deleting "a"),
 * we forcefully re-trigger the completion menu.
 * 
 * This fixes the issue where filtering out all options closes the menu, and backspacing
 * back to a valid state doesn't reopen it automatically.
 */
const slashCommandUpdater = EditorView.updateListener.of((update) => {
    // Only verify if the doc changed via a user deletion (backspace/delete)
    if (!update.docChanged) return;

    // Check for deletion transaction
    const isDeletion = update.transactions.some(tr => tr.isUserEvent("delete"));
    if (!isDeletion) return;

    // Check cursor position
    const state = update.state;
    const { from, to } = state.selection.main;
    if (from !== to) return; // Ignore ranges

    // Check if the text before cursor matches our slash command pattern
    const line = state.doc.lineAt(from);
    const textBefore = line.text.slice(0, from - line.from);

    // Regex same as in source.ts: start of line or space, followed by slash, then non-slashes
    const SLASH_TRIGGER = /(?:^|\s)\/[^/\n]*$/;

    if (SLASH_TRIGGER.test(textBefore)) {
        // Force start completion
        startCompletion(update.view);
    }
});

/**
 * Creates the Slash Menu extension.
 * 
 * Configures the autocompletion extension to use our slashCommandSource
 * as an override, meaning it has high priority but can coexist (or replace normal completion when triggered).
 */
export function slashMenu(): Extension {
    return [
        slashPlaceholder(),
        autocompletion({
            override: [slashCommandSource],
            // defaultKeymap is usually included by 'autocompletion()', 
            // but can be explicitly added via 'completionKeymap' from @codemirror/autocomplete if needed separately.
            // The 'autocompletion' extension includes the keymap interaction.
            icons: false, // We might want to turn off default icons if we want custom ones, but let's keep simple for now.
            defaultKeymap: true // Ensure standard keys (Down, Up, Enter) work.
        }),
        slashCommandUpdater
    ];
}
