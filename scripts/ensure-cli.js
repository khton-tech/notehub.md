import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const binDir = path.join(ROOT_DIR, 'node_modules', '.bin');
const cliDistPath = path.join(ROOT_DIR, 'packages', 'cli', 'dist', 'index.js');

if (!fs.existsSync(binDir)) {
    fs.mkdirSync(binDir, { recursive: true });
}

// Bash wrapper script
const bashScript = `#!/bin/sh
basedir=$(dirname "$(echo "$0" | sed -e 's,\\\\,/,g')")
exec node "$basedir/../packages/cli/dist/index.js" "$@"
`;

// Windows CMD wrapper script
const cmdScript = `@IF EXIST "%~dp0\\node.exe" (
  "%~dp0\\node.exe"  "%~dp0\\..\\packages\\cli\\dist\\index.js" %*
) ELSE (
  @SETLOCAL
  @SET PATHEXT=%PATHEXT:;.JS;=;%
  node  "%~dp0\\..\\packages\\cli\\dist\\index.js" %*
)
`;

// PowerShell wrapper script
const ps1Script = `#!/usr/bin/env pwsh
$basedir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$exe = ""
if ($PSVersionTable.PSVersion -lt [Version]'6.0' -or $IsWindows) {
  $exe = "$basedir/../packages/cli/dist/index.js"
} else {
  $exe = "$basedir/../packages/cli/dist/index.js"
}
& node $exe $args
exit $LASTEXITCODE
`;

fs.writeFileSync(path.join(binDir, 'nhp'), bashScript, { mode: 0o755 });
fs.writeFileSync(path.join(binDir, 'nhp.cmd'), cmdScript, { mode: 0o755 });
fs.writeFileSync(path.join(binDir, 'nhp.ps1'), ps1Script, { mode: 0o755 });

console.log('✅ Created nhp CLI wrappers in node_modules/.bin');
