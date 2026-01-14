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
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
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
        join(targetDir, 'src', 'index.ts'),
        generateEntryPoint(id, name)
    );
    console.log(chalk.green('  ✓ src/index.ts'));

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
            dev: 'tsc --watch',
        },
        dependencies: {},
        devDependencies: {
            '@notehub.md/api': '^0.1.0',
            '@types/react': '^18.3.0',
            typescript: '^5.6.0',
        },
        peerDependencies: {
            react: '^18.3.0',
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
 * Generate src/index.ts entry point
 */
function generateEntryPoint(id: string, name: string): string {
    return `/**
 * ${name} Plugin
 * 
 * @module ${id}
 */

import { NotehubPlugin, PluginContext } from '@notehub.md/api';

class ${toPascalCase(id)}Plugin extends NotehubPlugin {
    async onload(ctx: PluginContext): Promise<void> {
        console.log('${name} plugin loaded!');
        
        // Register an API endpoint
        // ctx.registerApi('${id}:hello', (name: string) => \`Hello, \${name}!\`);
        
        // Subscribe to events
        // ctx.subscribe('note:saved', (payload) => {
        //     console.log('Note saved:', payload);
        // });
    }

    async onunload(): Promise<void> {
        console.log('${name} plugin unloaded!');
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
