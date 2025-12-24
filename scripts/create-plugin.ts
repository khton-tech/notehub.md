import prompts from 'prompts';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

// Plugin categories
type PluginCategory = 'system' | 'ui' | 'features';

interface PluginConfig {
    name: string;
    category: PluginCategory;
    pluginId: string;
    className: string;
    pluginPath: string;
}

/**
 * Convert kebab-case to PascalCase
 */
function toPascalCase(str: string): string {
    return str
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join('');
}

/**
 * Validate kebab-case format
 */
function isKebabCase(str: string): boolean {
    return /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(str);
}

/**
 * Generate package.json content
 */
function generatePackageJson(config: PluginConfig): string {
    const pkg = {
        name: `@notehub/${config.name}`,
        version: '0.0.0',
        type: 'module',
        main: './dist/index.js',
        types: './dist/index.d.ts',
        exports: {
            '.': {
                import: './dist/index.js',
                types: './dist/index.d.ts'
            }
        },
        files: ['dist'],
        scripts: {
            build: 'tsc',
            dev: 'tsc --watch',
            clean: 'rimraf dist'
        },
        dependencies: {
            '@notehub/core': 'workspace:*'
        },
        devDependencies: {
            typescript: '^5.3.0',
            rimraf: '^5.0.0'
        }
    };
    return JSON.stringify(pkg, null, 2);
}

/**
 * Generate tsconfig.json content
 */
function generateTsConfig(): string {
    const tsconfig = {
        extends: '../../../../tsconfig.base.json',
        compilerOptions: {
            outDir: './dist',
            rootDir: './src'
        },
        include: ['src/**/*'],
        exclude: ['node_modules', 'dist']
    };
    return JSON.stringify(tsconfig, null, 2);
}

/**
 * Generate manifest.json content
 */
function generateManifest(config: PluginConfig): string {
    const categoryType = config.category === 'features' ? 'feature' : config.category;
    const manifest = {
        id: config.pluginId,
        name: config.className.replace(/Plugin$/, ''),
        version: '0.0.0',
        type: categoryType,
        dependencies: []
    };
    return JSON.stringify(manifest, null, 2);
}

/**
 * Generate src/index.ts content
 */
function generateIndexTs(config: PluginConfig): string {
    const categoryType = config.category === 'features' ? 'feature' : config.category;
    return `import type { IPlugin, PluginManifest, NotehubCore } from '@notehub/core';

/**
 * ${config.className} - ${config.name} plugin
 */
export class ${config.className} implements IPlugin {
  readonly manifest: PluginManifest = {
    id: '${config.pluginId}',
    name: '${config.className.replace(/Plugin$/, '')}',
    version: '0.0.0',
    type: '${categoryType}',
  };

  load(app: NotehubCore): void {
    console.log(\`Plugin [${config.pluginId}] loaded\`);
    
    // TODO: Register your API methods, event handlers, etc.
    // app.api.register('${config.pluginId}.yourMethod', () => {});
    // app.events.on('someEvent', this.handleEvent);
  }

  unload(app: NotehubCore): void {
    console.log(\`Plugin [${config.pluginId}] unloaded\`);
    
    // TODO: Cleanup - unregister API methods, remove event listeners
    // app.api.unregister('${config.pluginId}.yourMethod');
  }
}

// Default export for dynamic loading
export default ${config.className};
`;
}

/**
 * Main CLI function
 */
async function main(): Promise<void> {
    console.log('\\n🔌 Notehub.md Plugin Generator\\n');

    // Prompt for plugin configuration
    const response = await prompts([
        {
            type: 'text',
            name: 'name',
            message: 'Plugin name (kebab-case):',
            validate: (value: string) => {
                if (!value) return 'Plugin name is required';
                if (!isKebabCase(value)) return 'Name must be in kebab-case (e.g., theme-manager)';
                return true;
            }
        },
        {
            type: 'select',
            name: 'category',
            message: 'Select plugin category:',
            choices: [
                { title: 'system  - Core infrastructure plugins', value: 'system' },
                { title: 'ui      - UI components and themes', value: 'ui' },
                { title: 'features - User-facing features', value: 'features' }
            ]
        }
    ]);

    // Check if user cancelled
    if (!response.name || !response.category) {
        console.log('\\n❌ Plugin creation cancelled.\\n');
        process.exit(1);
    }

    // Build configuration
    const config: PluginConfig = {
        name: response.name,
        category: response.category,
        pluginId: `nh.${response.category}.${response.name}`,
        className: `${toPascalCase(response.name)}Plugin`,
        pluginPath: path.join(ROOT_DIR, 'packages', 'plugins', response.category, response.name)
    };

    console.log(`\\n📦 Creating plugin: ${config.pluginId}`);
    console.log(`   Path: ${config.pluginPath}\\n`);

    // Check if directory already exists
    if (fs.existsSync(config.pluginPath)) {
        console.error(`❌ Error: Directory already exists: ${config.pluginPath}`);
        process.exit(1);
    }

    // Create directories
    const srcPath = path.join(config.pluginPath, 'src');
    fs.mkdirSync(srcPath, { recursive: true });

    // Generate files
    const files: Array<{ path: string; content: string }> = [
        { path: path.join(config.pluginPath, 'package.json'), content: generatePackageJson(config) },
        { path: path.join(config.pluginPath, 'tsconfig.json'), content: generateTsConfig() },
        { path: path.join(config.pluginPath, 'manifest.json'), content: generateManifest(config) },
        { path: path.join(srcPath, 'index.ts'), content: generateIndexTs(config) }
    ];

    for (const file of files) {
        fs.writeFileSync(file.path, file.content, 'utf-8');
        console.log(`   ✅ Created: ${path.relative(ROOT_DIR, file.path)}`);
    }

    console.log('\\n✨ Plugin created successfully!');
    console.log('\\nNext steps:');
    console.log(`   1. Run: pnpm install`);
    console.log(`   2. Build: pnpm --filter @notehub/${config.name} build`);
    console.log(`   3. Import in your app and register with NotehubCore\\n`);
}

main().catch((error) => {
    console.error('Error:', error);
    process.exit(1);
});
