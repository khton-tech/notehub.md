import { cpSync, rmSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageRoot = resolve(__dirname, '..');
const repoRoot = resolve(packageRoot, '..', '..');

const srcDocs = join(repoRoot, 'docs', 'forPluginMakers');
const destDocs = join(packageRoot, 'templates', 'docs');

console.log(`Copying docs from ${srcDocs} to ${destDocs}...`);

if (existsSync(destDocs)) {
    rmSync(destDocs, { recursive: true, force: true });
}

mkdirSync(destDocs, { recursive: true });

cpSync(srcDocs, destDocs, { recursive: true });

console.log('Docs copied successfully.');
