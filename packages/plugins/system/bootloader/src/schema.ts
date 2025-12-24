import { z } from 'zod';

/**
 * Plugin type classification
 */
export const PluginTypeSchema = z.enum(['system', 'ui', 'feature']);
export type PluginType = z.infer<typeof PluginTypeSchema>;

/**
 * Semantic version string pattern
 * Matches: 0.0.0, 1.2.3, 10.20.30, etc.
 */
const SemVerPattern = /^\d+\.\d+\.\d+(?:-[\w.]+)?(?:\+[\w.]+)?$/;

/**
 * Plugin ID pattern (e.g., "nh.system.logger")
 */
const PluginIdPattern = /^[\w-]+(?:\.[\w-]+)*$/;

/**
 * Version constraint pattern for dependencies
 * Supports: exact version, ^version, ~version, >=version, *
 */
const VersionConstraintPattern = /^(?:\*|\^?\~?(?:>=?)?\d+(?:\.\d+)?(?:\.\d+)?(?:-[\w.]+)?(?:\+[\w.]+)?)$/;

/**
 * Schema for plugin manifest (RFC Section 3.2)
 * 
 * @property id - Unique plugin identifier (e.g., "nh.system.logger")
 * @property name - Human-readable plugin name
 * @property version - Semantic version string
 * @property type - Plugin classification
 * @property dependencies - Required dependencies (plugin must fail if missing)
 * @property optionalDependencies - Optional dependencies (plugin loads without them)
 */
export const PluginManifestSchema = z.object({
    /** Unique plugin identifier (e.g., "nh.system.logger") */
    id: z.string().regex(PluginIdPattern, {
        message: 'Plugin ID must be a valid identifier (e.g., "nh.system.logger")'
    }),

    /** Human-readable plugin name */
    name: z.string().min(1, 'Plugin name is required'),

    /** Semantic version string */
    version: z.string().regex(SemVerPattern, {
        message: 'Version must be a valid semver string (e.g., "1.0.0")'
    }),

    /** Plugin type classification */
    type: PluginTypeSchema,

    /** 
     * Required dependencies as Record<PluginID, VersionConstraint>
     * If a dependency is not available, the plugin MUST NOT load
     */
    dependencies: z.record(
        z.string().regex(PluginIdPattern),
        z.string().regex(VersionConstraintPattern)
    ).optional().default({}),

    /**
     * Optional dependencies as Record<PluginID, VersionConstraint>
     * Plugin loads even if optional dependencies are missing
     */
    optionalDependencies: z.record(
        z.string().regex(PluginIdPattern),
        z.string().regex(VersionConstraintPattern)
    ).optional().default({}),

    /** Optional description */
    description: z.string().optional(),

    /** Optional author information */
    author: z.string().optional(),

    /** Optional homepage URL */
    homepage: z.string().url().optional(),

    /** Optional repository URL */
    repository: z.string().optional(),

    /** Optional license identifier */
    license: z.string().optional(),

    /** Optional keywords/tags */
    keywords: z.array(z.string()).optional(),
});

/**
 * Type for validated plugin manifest
 */
export type PluginManifest = z.infer<typeof PluginManifestSchema>;

/**
 * Zod error issue type
 */
export type ValidationError = z.ZodIssue;

/**
 * Result of manifest validation
 */
export interface ValidationResult {
    success: boolean;
    manifest?: PluginManifest;
    errors?: ValidationError[];
}

/**
 * Validate a raw manifest JSON object
 * 
 * @param json - Raw JSON object to validate
 * @returns Validation result with parsed manifest or errors
 * 
 * @example
 * ```ts
 * const result = validateManifest({
 *   id: 'nh.system.logger',
 *   name: 'Logger',
 *   version: '1.0.0',
 *   type: 'system',
 *   dependencies: { 'nh.core.config': '^1.0.0' }
 * });
 * 
 * if (result.success) {
 *   console.log(result.manifest);
 * } else {
 *   console.error(result.errors);
 * }
 * ```
 */
export function validateManifest(json: unknown): ValidationResult {
    const result = PluginManifestSchema.safeParse(json);

    if (result.success) {
        return {
            success: true,
            manifest: result.data,
        };
    }

    return {
        success: false,
        errors: result.error.issues,
    };
}

/**
 * Validate a manifest and throw on error
 * 
 * @param json - Raw JSON object to validate
 * @returns Validated plugin manifest
 * @throws Error with validation details if invalid
 */
export function validateManifestOrThrow(json: unknown): PluginManifest {
    const result = validateManifest(json);

    if (!result.success) {
        const errorMessages = result.errors!
            .map((err: ValidationError) => `${err.path.join('.')}: ${err.message}`)
            .join('; ');
        throw new Error(`Invalid plugin manifest: ${errorMessages}`);
    }

    return result.manifest!;
}
