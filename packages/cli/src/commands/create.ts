/**
 * @fileoverview Create Command Implementation
 * 
 * Scaffolds a new Notehub plugin with the standard directory structure
 * and template files.
 * 
 * Generated Structure:
 * ├── manifest.json
 * ├── package.json
 * ├── tsconfig.json
 * ├── PLUGIN_GUIDE.md
 * ├── src/
 * │   └── index.ts
 * ├── docs/
 * │   └── index.html
 * └── styles.css (optional)
 */

import chalk from 'chalk';
import { existsSync, mkdirSync, writeFileSync, readFileSync, cpSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Get templates directory path
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TEMPLATES_DIR = resolve(__dirname, '..', '..', 'templates');

/**
 * Create command options
 */
export interface CreateOptions {
    /** Plugin ID (e.g., ext.my-plugin) */
    id: string;
    /** Human-readable plugin name */
    name?: string;
    /** Include styles.css template */
    withStyles?: boolean;
}

/**
 * Execute the create command
 */
export async function createCommand(options: CreateOptions): Promise<void> {
    const { id, name = toTitleCase(id), withStyles = false } = options;

    // Validate ID format
    if (!isValidPluginId(id)) {
        console.error(chalk.red('✖ Invalid plugin ID'));
        console.error(chalk.gray('  Use format: ext.my-plugin or my-org.plugin-name'));
        console.error(chalk.gray('  Only lowercase letters, numbers, dots, and hyphens allowed'));
        process.exit(1);
    }

    const targetDir = resolve(process.cwd(), id);

    console.log(chalk.cyan('\n🚀 Notehub Plugin Generator\n'));

    // Check if directory already exists
    if (existsSync(targetDir)) {
        console.error(chalk.red(`✖ Directory already exists: ${targetDir}`));
        process.exit(1);
    }

    console.log(chalk.white(`Creating plugin: ${chalk.bold(name)} (${id})`));
    console.log(chalk.gray(`Location: ${targetDir}\n`));

    // Create directory structure
    mkdirSync(targetDir, { recursive: true });
    mkdirSync(join(targetDir, 'src'), { recursive: true });
    mkdirSync(join(targetDir, 'docs'), { recursive: true });

    // Generate files
    writeFileSync(
        join(targetDir, 'manifest.json'),
        generateManifest(id, name)
    );
    console.log(chalk.green('  ✓ manifest.json'));

    writeFileSync(
        join(targetDir, 'package.json'),
        generatePackageJson(id, name)
    );
    console.log(chalk.green('  ✓ package.json'));

    writeFileSync(
        join(targetDir, 'tsconfig.json'),
        generateTsConfig()
    );
    console.log(chalk.green('  ✓ tsconfig.json'));

    writeFileSync(
        join(targetDir, 'vite.config.ts'),
        generateViteConfig()
    );
    console.log(chalk.green('  ✓ vite.config.ts'));

    writeFileSync(
        join(targetDir, 'src', 'main.tsx'),
        generateEntryPoint(id, name)
    );
    console.log(chalk.green('  ✓ src/main.tsx'));

    if (withStyles) {
        writeFileSync(
            join(targetDir, 'styles.css'),
            generateStyles(id)
        );
        console.log(chalk.green('  ✓ styles.css'));
    }

    // Copy template files
    try {
        const pluginGuide = readFileSync(join(TEMPLATES_DIR, 'PLUGIN_GUIDE.md'), 'utf-8');
        writeFileSync(join(targetDir, 'PLUGIN_GUIDE.md'), pluginGuide);
        console.log(chalk.green('  ✓ PLUGIN_GUIDE.md'));
    } catch {
        console.log(chalk.yellow('  ⚠ PLUGIN_GUIDE.md (template not found)'));
    }

    try {
        const docsHtml = readFileSync(join(TEMPLATES_DIR, 'docs.html'), 'utf-8');
        writeFileSync(join(targetDir, 'docs', 'index.html'), docsHtml);
        console.log(chalk.green('  ✓ docs/index.html'));
    } catch {
        console.log(chalk.yellow('  ⚠ docs/index.html (template not found)'));
    }

    // Copy full documentation from templates/docs
    try {
        const docsSrc = join(TEMPLATES_DIR, 'docs');
        const docsDest = join(targetDir, 'docs');
        if (existsSync(docsSrc)) {
            cpSync(docsSrc, docsDest, { recursive: true });
            console.log(chalk.green('  ✓ docs/ (bundled documentation)'));
        }
    } catch (e) {
        console.log(chalk.yellow('  ⚠ Failed to copy bundled docs'));
    }

    // Print next steps
    console.log(chalk.green('\n✓ Plugin created successfully!\n'));
    console.log(chalk.white('Next steps:'));
    console.log(chalk.gray(`  1. cd ${id}`));
    console.log(chalk.gray('  2. npm install'));
    console.log(chalk.gray('  3. npm run build'));
    console.log(chalk.gray('  4. nhp build'));
    console.log(chalk.gray('  5. Open docs/index.html for documentation'));
    console.log();
}

/**
 * Validate plugin ID format
 */
function isValidPluginId(id: string): boolean {
    // Must be: lowercase, can contain dots, hyphens, numbers
    // Must have at least one dot (namespace.name)
    return /^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)+$/.test(id);
}

/**
 * Convert plugin ID to title case name
 */
function toTitleCase(id: string): string {
    // ext.my-cool-plugin -> My Cool Plugin
    const parts = id.split('.');
    const lastPart = parts[parts.length - 1];
    return lastPart
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

/**
 * Generate manifest.json content
 */
function generateManifest(id: string, name: string): string {
    const manifest = {
        id,
        name,
        version: '0.1.0',
        description: `${name} plugin for Notehub.md`,
        author: '',
        main: 'main.js',
    };
    return JSON.stringify(manifest, null, 4) + '\n';
}

/**
 * Generate package.json content
 */
function generatePackageJson(id: string, name: string): string {
    const packageName = id.replace(/\./g, '-');
    const pkg = {
        name: packageName,
        version: '0.1.0',
        description: `${name} plugin for Notehub.md`,
        type: 'module',
        main: './dist/main.js',
        scripts: {
            build: 'nhp build',
            dev: 'vite build --watch',
        },
        dependencies: {},
        devDependencies: {
            '@notehub.md/api': '^0.1.0',
            '@types/react': '^18.3.0',
            'vite': '^5.4.0',
            'typescript': '^5.6.0',
        },
        peerDependencies: {
            'react': '^18.3.0',
            'react-dom': '^18.3.0',
            '@codemirror/state': '*',
            '@codemirror/view': '*',
        },
    };
    return JSON.stringify(pkg, null, 4) + '\n';
}

/**
 * Generate tsconfig.json content
 */
function generateTsConfig(): string {
    const config = {
        compilerOptions: {
            target: 'ES2022',
            module: 'ESNext',
            moduleResolution: 'bundler',
            lib: ['ES2022', 'DOM'],
            jsx: 'react-jsx',
            strict: true,
            esModuleInterop: true,
            skipLibCheck: true,
            forceConsistentCasingInFileNames: true,
            declaration: false,
            outDir: './dist',
            rootDir: './src',
        },
        include: ['src/**/*'],
        exclude: ['node_modules', 'dist'],
    };
    return JSON.stringify(config, null, 4) + '\n';
}

/**
 * Generate vite.config.ts for plugin builds
 */
function generateViteConfig(): string {
    return `/**
 * Vite Configuration for Notehub Plugin
 * 
 * Wave 1: SystemJS Shared Runtime
 * - Outputs SystemJS module format
 * - Marks React, CodeMirror, and API as external (provided by host)
 */
import { defineConfig } from 'vite';

export default defineConfig({
    build: {
        lib: {
            entry: 'src/main.tsx',
            formats: ['system'],
            fileName: () => 'main.js',
        },
        outDir: 'dist',
        emptyOutDir: true,
        minify: false,
        rollupOptions: {
            external: [
                // React Runtime (provided by Notehub)
                'react',
                'react-dom',
                'react-dom/client',
                'react/jsx-runtime',
                // Notehub API
                '@notehub.md/api',
                // UI Components
                'lucide-react',
                // Wave 1: CodeMirror Shared Runtime
                // CRITICAL: Must be external to prevent Dual Package Hazard
                /^@codemirror\\/.*/,
            ],
            output: {
                format: 'system',
                entryFileNames: 'main.js',
                exports: 'auto',
            },
        },
    },
});
`;
}

/**
 * Generate src/main.tsx entry point with Wave 2/3 examples
 */
function generateEntryPoint(id: string, name: string): string {
    return `/**
 * ${name} Plugin
 * 
 * @module ${id}
 * 
 * Template demonstrating:
 * - Basic API registration and invocation
 * - Wave 2: Middleware Engine (hooks.before/after)
 * - Wave 3: Unsafe Context (God Mode) - COMMENTED BY DEFAULT
 */

import { NotehubPlugin, PluginContext } from '@notehub.md/api';
// Uncomment for Wave 3: Unsafe Context usage
// import type { EditorView } from '@codemirror/view';

class ${toPascalCase(id)}Plugin extends NotehubPlugin {
    async onload(ctx: PluginContext): Promise<void> {
        console.log('[${name}] Plugin loaded!');
        
        // ═══════════════════════════════════════════════════════════
        // BASIC USAGE: Register API endpoint
        // ═══════════════════════════════════════════════════════════
        ctx.registerApi('${id}:greet', (name: string) => {
            return \`Hello, \${name}! Greetings from ${name} plugin.\`;
        });
        
        // Subscribe to application events
        ctx.subscribe<{ path: string }>('note:opened', (payload) => {
            console.log('[${name}] Note opened:', payload.path);
        });
        
        // ═══════════════════════════════════════════════════════════
        // WAVE 2: Middleware Engine (Interceptors)
        // Uncomment to intercept and modify API calls
        // ═══════════════════════════════════════════════════════════
        
        // Example: Log all file writes
        // ctx.subscribe('middleware:register', () => {
        //     // Register a "before" hook on fs:write-text-file
        //     // This runs BEFORE the actual write happens
        //     ctx.invokeApi('hooks:before', 'fs:write-text-file', (callCtx: any) => {
        //         const [path, content] = callCtx.args;
        //         console.log(\`[${name}] Intercepted write to: \${path}\`);
        //         console.log(\`[${name}] Content length: \${content?.length || 0} chars\`);
        //     });
        // });
        
        // ═══════════════════════════════════════════════════════════
        // WAVE 3: Unsafe Context (God Mode)
        // ⚠️ WARNING: These APIs may change without notice!
        // Use only when Safe API doesn't provide required functionality
        // ═══════════════════════════════════════════════════════════
        
        // Example: Direct EditorView access for CodeMirror 6 manipulation
        // const view = ctx.unsafe.getActiveEditorView() as EditorView | null;
        // if (view) {
        //     // Insert text at cursor position
        //     const pos = view.state.selection.main.head;
        //     view.dispatch({
        //         changes: { from: pos, insert: 'Hello from ${name}!' }
        //     });
        // }
        
        // Example: Access global window object
        // const win = ctx.unsafe.window;
        // console.log('User agent:', win.navigator.userAgent);
        
        // Example: Access root app instance (internal APIs)
        // const app = ctx.unsafe.app;
        // console.log('App instance:', app);
        
        // ═══════════════════════════════════════════════════════════
        // WAVE 4: Portal API (Dynamic UI Injection)
        // Inject UI anywhere without modifying core layouts
        // ═══════════════════════════════════════════════════════════
        
        // Example: Add a toolbar above the editor
        // setTimeout(() => {
        //     const container = ctx.unsafe.createPortal('[data-nh-portal="editor"]', 'prepend');
        //     if (container) {
        //         container.innerHTML = '<div style="padding:8px;background:#333;">My Toolbar</div>';
        //     }
        // }, 100);
    }

    async onunload(): Promise<void> {
        console.log('[${name}] Plugin unloaded!');
        // Cleanup is automatic for APIs and subscriptions
    }
}

export default new ${toPascalCase(id)}Plugin();
`;
}

/**
 * Generate styles.css template
 */
function generateStyles(id: string): string {
    return `/**
 * Styles for ${id}
 * 
 * These styles are automatically injected when the plugin loads.
 * Use plugin-specific class names to avoid conflicts.
 */

.${id.replace(/\./g, '-')} {
    /* Your styles here */
}
`;
}

/**
 * Convert plugin ID to PascalCase class name
 */
function toPascalCase(id: string): string {
    // ext.my-cool-plugin -> MyCoolPlugin
    return id
        .split(/[.-]/)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join('');
}
