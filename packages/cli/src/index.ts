#!/usr/bin/env node
/**
 * @fileoverview Notehub CLI Entry Point
 * 
 * Command-line tool for building and packaging Notehub plugins
 * into the .nhp (Notehub Plugin) format.
 * 
 * Usage:
 *   nhp create <id>  Create a new plugin from template
 *   nhp build        Build and package the plugin in the current directory
 *   nhp --help       Show help
 *   nhp --version    Show version
 * 
 * @module @notehub/cli
 */

import { Command } from 'commander';
import { buildCommand } from './commands/build.js';
import { createCommand } from './commands/create.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Read package.json for version
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJsonPath = join(__dirname, '..', 'package.json');

let version = '0.0.0';
try {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    version = packageJson.version;
} catch {
    // Use default version if package.json can't be read
}

// Create CLI program
const program = new Command();

program
    .name('nhp')
    .description('Notehub Plugin CLI - Build and package plugins for Notehub.md')
    .version(version);

// Register create command
program
    .command('create <id>')
    .description('Create a new plugin from template (e.g., nhp create ext.my-plugin)')
    .option('-n, --name <name>', 'Human-readable plugin name')
    .option('-s, --with-styles', 'Include styles.css template')
    .action(async (id: string, options) => {
        await createCommand({
            id,
            name: options.name,
            withStyles: options.withStyles,
        });
    });

// Register build command
program
    .command('build')
    .description('Build and package the plugin in the current directory')
    .option('-o, --output <dir>', 'Output directory for the .nhp file', '.')
    .option('--no-minify', 'Disable minification')
    .option('--sourcemap', 'Generate inline source maps for debugging')
    .option('-w, --watch', 'Watch mode - rebuild on file changes')
    .action(async (options) => {
        await buildCommand({
            outputDir: options.output,
            minify: options.minify !== false,
            sourcemap: options.sourcemap || false,
            watch: options.watch || false,
        });
    });

// Parse arguments
program.parse();

