import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const cliDistPath = path.join(ROOT_DIR, 'packages', 'cli', 'dist', 'index.js');

function createWrapperIn(targetBinDir) {
    if (!fs.existsSync(targetBinDir)) {
        fs.mkdirSync(targetBinDir, { recursive: true });
    }

    const relCliPath = path.relative(targetBinDir, cliDistPath).replace(/\\/g, '/');

    // Bash wrapper script
    const bashScript = `#!/bin/sh
basedir=$(dirname "$(echo "$0" | sed -e 's,\\\\,/,g')")
exec node "$basedir/${relCliPath}" "$@"
`;

    // Windows CMD wrapper script
    const cmdScript = `@IF EXIST "%~dp0\\node.exe" (
  "%~dp0\\node.exe"  "%~dp0\\${relCliPath.replace(/\//g, '\\')}" %*
) ELSE (
  @SETLOCAL
  @SET PATHEXT=%PATHEXT:;.JS;=;%
  node  "%~dp0\\${relCliPath.replace(/\//g, '\\')}" %*
)
`;

    // PowerShell wrapper script
    const ps1Script = `#!/usr/bin/env pwsh
$basedir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$exe = "$basedir/${relCliPath}"
& node $exe $args
exit $LASTEXITCODE
`;

    fs.writeFileSync(path.join(targetBinDir, 'nhp'), bashScript, { mode: 0o755 });
    fs.writeFileSync(path.join(targetBinDir, 'nhp.cmd'), cmdScript, { mode: 0o755 });
    fs.writeFileSync(path.join(targetBinDir, 'nhp.ps1'), ps1Script, { mode: 0o755 });
}

// 1. Root node_modules/.bin
createWrapperIn(path.join(ROOT_DIR, 'node_modules', '.bin'));

// 2. Scan custom/plugins/* and packages/plugins/*/*
const searchDirs = [
    path.join(ROOT_DIR, 'custom', 'plugins'),
    path.join(ROOT_DIR, 'packages', 'plugins', 'features'),
    path.join(ROOT_DIR, 'packages', 'plugins', 'system'),
    path.join(ROOT_DIR, 'packages', 'plugins', 'ui')
];

for (const parentDir of searchDirs) {
    if (fs.existsSync(parentDir)) {
        const subdirs = fs.readdirSync(parentDir);
        for (const sub of subdirs) {
            const pluginDir = path.join(parentDir, sub);
            if (fs.statSync(pluginDir).isDirectory()) {
                const pluginPkg = path.join(pluginDir, 'package.json');
                if (fs.existsSync(pluginPkg)) {
                    createWrapperIn(path.join(pluginDir, 'node_modules', '.bin'));
                }
            }
        }
    }
}

console.log('✅ Created nhp CLI wrappers across root and all plugin workspaces');
