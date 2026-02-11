/**
 * @fileoverview Plugin Development Server
 *
 * Watches a plugin directory for source changes and rebuilds automatically.
 * When connected to a running Notehub instance, it can signal hot-reload
 * via the synapse:reload-plugin API.
 *
 * Usage:
 *   nhp dev                # Watch current directory and rebuild on changes
 *   nhp dev --port 3100    # Use custom WebSocket port for reload signaling
 */

import { watch } from 'node:fs';
import { resolve, join, relative } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import chalk from 'chalk';
import { buildCommand } from './build.js';

export interface DevOptions {
    /** Port for reload signaling (future WebSocket integration) */
    port: number;
}

interface PluginManifest {
    id: string;
    name: string;
    version: string;
}

/**
 * Run the plugin development server.
 *
 * Watches the `src/` directory for changes and triggers rebuilds.
 * Future: connect to running Notehub app via WebSocket to signal reload.
 */
export async function devCommand(options: DevOptions): Promise<void> {
    const cwd = process.cwd();
    const manifestPath = join(cwd, 'manifest.json');

    // Validate plugin directory
    if (!existsSync(manifestPath)) {
        console.error(chalk.red('Error: No manifest.json found in current directory.'));
        console.error(chalk.dim('Run this command from a plugin directory.'));
        process.exit(1);
    }

    let manifest: PluginManifest;
    try {
        manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as PluginManifest;
    } catch {
        console.error(chalk.red('Error: Failed to parse manifest.json'));
        process.exit(1);
    }

    const srcDir = resolve(cwd, 'src');
    if (!existsSync(srcDir)) {
        console.error(chalk.red('Error: No src/ directory found.'));
        process.exit(1);
    }

    console.log(chalk.bold.cyan('\n🔧 Notehub Plugin Dev Server\n'));
    console.log(chalk.dim(`  Plugin:  ${manifest.name} (${manifest.id})`));
    console.log(chalk.dim(`  Version: ${manifest.version}`));
    console.log(chalk.dim(`  Watch:   ${relative(cwd, srcDir)}/`));
    console.log('');

    // Initial build
    console.log(chalk.yellow('⚡ Initial build...'));
    try {
        await buildCommand({
            outputDir: '.',
            minify: false,
            sourcemap: true,
            watch: false,
        });
        console.log(chalk.green('✓ Build complete\n'));
    } catch (error) {
        console.error(chalk.red('✗ Initial build failed:'), error);
        console.log(chalk.dim('Watching for changes to retry...\n'));
    }

    // Watch for changes
    let buildTimeout: ReturnType<typeof setTimeout> | null = null;
    let buildInProgress = false;

    const rebuild = async () => {
        if (buildInProgress) return;
        buildInProgress = true;

        const start = Date.now();
        console.log(chalk.yellow(`\n⚡ Rebuilding ${manifest.id}...`));

        try {
            await buildCommand({
                outputDir: '.',
                minify: false,
                sourcemap: true,
                watch: false,
            });
            const elapsed = Date.now() - start;
            console.log(chalk.green(`✓ Rebuilt in ${elapsed}ms`));
            console.log(chalk.dim('  Reload the plugin in Notehub to see changes.'));
        } catch (error) {
            console.error(chalk.red('✗ Build failed:'), error);
        }

        buildInProgress = false;
    };

    // Use Node.js fs.watch with debouncing
    const watcher = watch(srcDir, { recursive: true }, (_eventType, filename) => {
        if (!filename) return;

        // Ignore non-source files
        if (!filename.endsWith('.ts') && !filename.endsWith('.tsx') &&
            !filename.endsWith('.css') && !filename.endsWith('.json')) {
            return;
        }

        console.log(chalk.dim(`  Changed: ${filename}`));

        // Debounce — wait 200ms for additional changes
        if (buildTimeout) clearTimeout(buildTimeout);
        buildTimeout = setTimeout(rebuild, 200);
    });

    console.log(chalk.cyan('👀 Watching for changes... (Ctrl+C to stop)\n'));

    // Handle graceful shutdown
    const cleanup = () => {
        console.log(chalk.dim('\n\nStopping dev server...'));
        watcher.close();
        if (buildTimeout) clearTimeout(buildTimeout);
        process.exit(0);
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);

    // Keep the process alive
    await new Promise(() => {});
}
