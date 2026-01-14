/**
 * @fileoverview Keyboard Layout Engine for Cross-Layout Search
 *
 * Enables search to work across different keyboard layouts.
 * When a user types characters in one layout but meant another,
 * this engine generates candidate strings for all possible interpretations.
 *
 * Supported layouts: EN (QWERTY), RU (Russian), FR (AZERTY)
 *
 * @example
 * // User types "ghbdtn" (on EN layout, meaning "привет" in RU)
 * getSearchCandidates("ghbdtn") // => ["ghbdtn", "привет", ...]
 */

// ============================================================================
// Layout Definitions
// ============================================================================

/**
 * Character position strings for each keyboard layout (lowercase only).
 * These represent the same physical key positions across layouts.
 */
const LAYOUTS = {
    en: "qwertyuiop[]asdfghjkl;'zxcvbnm,.",
    ru: 'йцукенгшщзхъфывапролджэячсмитьбю',
    fr: 'azertyuiop^$qsdfghjklmùwxcvbn,;:!',
} as const;

type LayoutKey = keyof typeof LAYOUTS;

// ============================================================================
// Mapper Generation
// ============================================================================

/**
 * Creates a character mapping from one layout to another.
 * Maps each character at position N in the source layout
 * to the character at position N in the target layout.
 */
function createMapper(from: LayoutKey, to: LayoutKey): Map<string, string> {
    const fromLayout = LAYOUTS[from];
    const toLayout = LAYOUTS[to];
    const map = new Map<string, string>();

    const minLength = Math.min(fromLayout.length, toLayout.length);
    for (let i = 0; i < minLength; i++) {
        const fromChar = fromLayout.charAt(i);
        const toChar = toLayout.charAt(i);
        map.set(fromChar, toChar);
    }

    return map;
}

// Pre-computed mappers for supported layout conversions
const MAPPERS: ReadonlyArray<{ name: string; map: Map<string, string> }> = [
    { name: 'en→ru', map: createMapper('en', 'ru') },
    { name: 'ru→en', map: createMapper('ru', 'en') },
    { name: 'fr→en', map: createMapper('fr', 'en') },
    { name: 'fr→ru', map: createMapper('fr', 'ru') },
];

// ============================================================================
// Public API
// ============================================================================

/**
 * Translates a string from one layout to another using the given mapper.
 * Characters not in the map are preserved as-is.
 */
function translateWithMapper(
    input: string,
    mapper: Map<string, string>
): string {
    let result = '';
    for (const char of input) {
        const lowerChar = char.toLowerCase();
        const mappedChar = mapper.get(lowerChar);

        if (mappedChar !== undefined) {
            // Preserve original case by checking if input was uppercase
            result +=
                char === char.toUpperCase() && char !== char.toLowerCase()
                    ? mappedChar.toUpperCase()
                    : mappedChar;
        } else {
            result += char;
        }
    }
    return result;
}

/**
 * Generates search candidates for a given input string.
 * Returns the original input plus all possible layout translations.
 *
 * @param input - The user's search query
 * @returns Array of unique, non-empty candidate strings to match against
 *
 * @example
 * getSearchCandidates("ghbdtn")
 * // Returns: ["ghbdtn", "привет", "thzfyu", "е|зае,"]
 */
export function getSearchCandidates(input: string): string[] {
    // Start with original input
    const candidates = new Set<string>();

    if (input.trim()) {
        candidates.add(input);
    }

    // Generate translations for each mapper
    for (const { map } of MAPPERS) {
        const translated = translateWithMapper(input, map);
        if (translated.trim() && translated !== input) {
            candidates.add(translated);
        }
    }

    return Array.from(candidates);
}

/**
 * LayoutEngine namespace for convenient importing
 */
export const LayoutEngine = {
    getSearchCandidates,
} as const;

export default LayoutEngine;
