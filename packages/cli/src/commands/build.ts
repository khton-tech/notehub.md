/**
 * @fileoverview Build Command Implementation
 * 
 * Builds a Notehub plugin using Vite in library mode and packages
 * it into a .nhp (ZIP) archive.
 * 
 * Build Process:
 * 1. Read manifest.json from current directory
 * 2. Run Vite build with SystemJS output format
 * 3. Create ZIP archive with manifest.json, dist/main.js, styles.css (if exists)
 * 4. Rename to [plugin-id].nhp
 */

import { build as viteBuild, type LibraryFormats } from 'vite';
import archiver from 'archiver';
import chalk from 'chalk';
import { existsSync, readFileSync, createWriteStream, unlinkSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';

/**
 * Build command options
 */
export interface BuildOptions {
    /** Output directory for the .nhp file */
    outputDir: string;
    /** Whether to minify the output */
    minify: boolean;
    /** Whether to generate source maps */
    sourcemap: boolean;
    /** Whether to watch for changes */
    watch: boolean;
}

/**
 * Plugin manifest structure
 */
interface PluginManifest {
    id: string;
    name: string;
    version: string;
    main?: string;
    [key: string]: unknown;
}

/**
 * Execute the build command
 */
export async function buildCommand(options: BuildOptions): Promise<void> {
    const cwd = process.cwd();
    const startTime = Date.now();

    console.log(chalk.cyan('\n📦 Notehub Plugin Builder\n'));
    console.log(chalk.gray(`Working directory: ${cwd}\n`));

    // Step 1: Read and validate manifest
    const manifestPath = join(cwd, 'manifest.json');
    if (!existsSync(manifestPath)) {
        console.error(chalk.red('✖ Error: manifest.json not found in current directory'));
        console.error(chalk.gray('  Make sure you are in a plugin directory'));
        process.exit(1);
    }

    let manifest: PluginManifest;
    try {
        manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
    } catch (error) {
        console.error(chalk.red('✖ Error: Invalid manifest.json'));
        console.error(chalk.gray(`  ${error instanceof Error ? error.message : error}`));
        process.exit(1);
    }

    if (!manifest.id || !manifest.name || !manifest.version) {
        console.error(chalk.red('✖ Error: manifest.json must have id, name, and version fields'));
        process.exit(1);
    }

    // Validate plugin ID format
    const validIdPattern = /^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)+$/;
    if (!validIdPattern.test(manifest.id)) {
        console.error(chalk.red('✖ Error: Invalid plugin ID format'));
        console.error(chalk.gray('  Use format: ext.my-plugin or my-org.plugin-name'));
        console.error(chalk.gray('  Only lowercase letters, numbers, dots, and hyphens allowed'));
        process.exit(1);
    }

    console.log(chalk.white(`Plugin: ${chalk.bold(manifest.name)} (${manifest.id})`));
    console.log(chalk.white(`Version: ${manifest.version}\n`));

    // Step 2: Determine entry point
    const entryPoint = manifest.main || 'src/index.ts';
    const entryPath = join(cwd, entryPoint);

    // Try common entry points if the default doesn't exist
    const possibleEntries = [entryPoint, 'src/index.ts', 'src/index.tsx', 'src/main.ts', 'src/main.tsx', 'index.ts'];
    let actualEntry: string | null = null;

    for (const entry of possibleEntries) {
        const fullPath = join(cwd, entry);
        if (existsSync(fullPath)) {
            actualEntry = fullPath;
            break;
        }
    }

    if (!actualEntry) {
        console.error(chalk.red('✖ Error: No entry point found'));
        console.error(chalk.gray(`  Tried: ${possibleEntries.join(', ')}`));
        process.exit(1);
    }

    console.log(chalk.gray(`Entry: ${actualEntry}\n`));

    // Step 3: Run Vite build
    console.log(chalk.yellow('⚙ Building with Vite...'));

    const viteConfig = {
        root: cwd,
        build: {
            lib: {
                entry: actualEntry,
                // NOTE: Do NOT set 'name' here - it would create a named System.register()
                // which fails when loaded dynamically via Blob URL
                formats: ['system'] as LibraryFormats[],
                fileName: () => 'main.js',
            },
            outDir: 'dist',
            emptyOutDir: true,
            minify: options.minify ? 'esbuild' as const : false as const,
            sourcemap: options.sourcemap ? 'inline' as const : false as const,
            rollupOptions: {
                external: [
                    'react',
                    'react-dom',
                    'react-dom/client',
                    'react/jsx-runtime',
                    '@notehub.md/api',
                    // 'lucide-react',
                ],
                output: {
                    format: 'system' as const,
                    entryFileNames: 'main.js',
                    // Don't use named exports - we need anonymous module
                    exports: 'auto' as const,
                },
            },
            // Watch mode configuration
            watch: options.watch ? {} : null,
            // Suppress console output from Vite
            reportCompressedSize: false,
        },
        logLevel: 'warn' as const,
    };

    try {
        if (options.watch) {
            console.log(chalk.cyan('👁 Watch mode enabled - press Ctrl+C to stop\n'));
        }
        await viteBuild(viteConfig);
    } catch (error) {
        console.error(chalk.red('\n✖ Build failed'));
        console.error(chalk.gray(`  ${error instanceof Error ? error.message : error}`));
        process.exit(1);
    }

    // In watch mode, don't continue to packaging
    if (options.watch) {
        return;
    }

    console.log(chalk.green('✓ Build complete\n'));

    // Step 4: Verify dist/main.js exists
    const distMainPath = join(cwd, 'dist', 'main.js');
    if (!existsSync(distMainPath)) {
        console.error(chalk.red('✖ Error: dist/main.js not found after build'));
        process.exit(1);
    }

    // Step 5: Create ZIP archive
    console.log(chalk.yellow('📦 Packaging...'));

    const outputFileName = `${manifest.id}.nhp`;
    const outputPath = resolve(options.outputDir, outputFileName);

    // Remove existing .nhp if present
    if (existsSync(outputPath)) {
        unlinkSync(outputPath);
    }

    await createNhpArchive(cwd, outputPath, manifest);

    // Step 6: Print summary
    const fileSize = statSync(outputPath).size;
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(chalk.green('\n✓ Plugin packaged successfully!\n'));
    console.log(chalk.white('  Output:  ') + chalk.cyan(outputPath));
    console.log(chalk.white('  Size:    ') + chalk.cyan(formatFileSize(fileSize)));
    console.log(chalk.white('  Time:    ') + chalk.cyan(`${duration}s`));
    console.log();

    // Print contents
    console.log(chalk.gray('  Contents:'));
    console.log(chalk.gray('    • manifest.json'));
    console.log(chalk.gray('    • main.js'));

    const stylesPath = join(cwd, 'styles.css');
    if (existsSync(stylesPath)) {
        console.log(chalk.gray('    • styles.css'));
    }

    console.log();
}

/**
 * Create the .nhp ZIP archive
 */
async function createNhpArchive(
    sourceDir: string,
    outputPath: string,
    manifest: PluginManifest
): Promise<void> {
    return new Promise((resolve, reject) => {
        const output = createWriteStream(outputPath);
        const archive = archiver('zip', { zlib: { level: 9 } });

        output.on('close', () => resolve());
        archive.on('error', (err) => reject(err));

        archive.pipe(output);

        // Add manifest.json
        archive.file(join(sourceDir, 'manifest.json'), { name: 'manifest.json' });

        // Add dist/main.js as main.js (flatten structure)
        archive.file(join(sourceDir, 'dist', 'main.js'), { name: 'main.js' });

        // Add styles.css if exists
        const stylesPath = join(sourceDir, 'styles.css');
        if (existsSync(stylesPath)) {
            archive.file(stylesPath, { name: 'styles.css' });
        }

        // Also check for dist/style.css (Vite's default CSS output)
        const distStylesPath = join(sourceDir, 'dist', 'style.css');
        if (existsSync(distStylesPath) && !existsSync(stylesPath)) {
            archive.file(distStylesPath, { name: 'styles.css' });
        }

        archive.finalize();
    });
}

/**
 * Format file size in human-readable format
 */
function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
