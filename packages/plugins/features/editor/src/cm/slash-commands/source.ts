import { CompletionContext, type CompletionResult, snippet } from "@codemirror/autocomplete";

/**
 * Trigger regex: matches a slash at the start of a line or after a space, 
 * optionally followed by command text.
 */
const SLASH_TRIGGER = /(?:^|\s)\/[^/\n]*$/;

/**
 * Slash command completion source.
 * Triggers on '/' and offers options to insert markdown blocks.
 */
export function slashCommandSource(context: CompletionContext): CompletionResult | null {
    // 1. Check if the trigger matches
    // 1. Check if the trigger matches
    // matchBefore checks the text before the cursor
    const match = context.matchBefore(SLASH_TRIGGER);

    // If no match, or if explicitly disabled (though usually we just rely on match)
    if (!match) return null;

    // 2. Define the options
    // We set 'from' to slashPos + 1 (exclude the slash) so that standard filtering works 
    // (e.g. "Heading" matches "" or "h").
    // We then wrap the 'apply' logic to ensure the slash is deleted when an option is picked.

    // Find the actual position of the slash in the match
    // match.text contains the full matched string (e.g. " /cmd") or ("/cmd")
    const slashOffset = match.text.lastIndexOf('/');
    const slashPos = match.from + slashOffset;

    // Ensure we are really looking at a slash just to be safe, 
    // though the regex check should guarantee it ends in /
    if (context.state.sliceDoc(slashPos, slashPos + 1) !== "/") {
        return null;
    }

    /**

    /**
     * Helper to wrap an apply string/function to also delete the slash trigger.
     */
    const cleanSlash = (baseApply: string | ((view: any, completion: any, from: number, to: number) => void)) => {
        return (view: any, completion: any, from: number, to: number) => {
            // 'from' is slashPos + 1. We want to replace from slashPos (from - 1).
            const realFrom = from - 1;

            if (typeof baseApply === "string") {
                view.dispatch({
                    changes: { from: realFrom, to: to, insert: baseApply },
                    selection: { anchor: realFrom + baseApply.length }
                });
            } else {
                // For function/snippets, we pass the 'realFrom' so it overwrites the slash too
                baseApply(view, completion, realFrom, to);
            }
        };
    };

    const result = {
        from: slashPos + 1,
        options: [
            // --- Headings ---
            { label: "Heading 1", type: "H1", apply: cleanSlash("# "), detail: "Big Header" },
            { label: "Heading 2", type: "H2", apply: cleanSlash("## "), detail: "Medium Header" },
            { label: "Heading 3", type: "H3", apply: cleanSlash("### "), detail: "Small Header" },

            // --- Lists ---
            { label: "Bullet List", type: "text", apply: cleanSlash("- "), detail: "Unordered List" },
            { label: "Numbered List", type: "text", apply: cleanSlash("1. "), detail: "Ordered List" },
            { label: "Task List", type: "text", apply: cleanSlash("- [ ] "), detail: "Checkbox" },

            // --- Complex Blocks ---
            {
                label: "Callout",
                type: "function",
                apply: cleanSlash(snippet("> [!INFO] ${}\n> ")),
                detail: "Info Block"
            },
            {
                label: "Code Block",
                type: "function",
                apply: cleanSlash(snippet("```${language}\n${}\n```")),
                detail: "Code Snippet"
            }
        ],
        // Enable filtering so typing "/h" narrows down to Headings
        filter: true,

        // validFor must match the text AFTER the slash (result.from)
        // matches any sequence of characters that are not slashes or newlines
        validFor: /^[^/\n]*$/
    };

    return result;
}
