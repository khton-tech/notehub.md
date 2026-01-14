import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const desktopDir = path.join(rootDir, 'apps', 'desktop');
const releaseDir = path.join(rootDir, 'apps', 'releases');

// Main function
async function main() {
    console.log('🚀 Starting Android Debug Build...');

    try {
        // 1. Build frontend (Note: tauri build triggers this usually, but good to be explicit or if we need specific flags)
        // Actually, 'tauri android build' runs the 'beforeBuildCommand' which is 'pnpm build'.
        // So we might skip explicit build step if tauri.conf.json is configured correctly.
        // But let's run predev to be sure plugins are linked.

        console.log('\n🔗 Linking plugins...');
        execSync('pnpm predev', { stdio: 'inherit', cwd: rootDir });

        // 2. Build APK (Debug for auto-signing)
        console.log('\n📱 Building Android APK (Debug - ARM only)...');
        // We use --debug flag to generate a signed debug APK that can be installed directly
        // We restrict to ARM targets to reduce size and build time
        execSync('pnpm --filter @notehub/desktop tauri android build --debug --apk true --target aarch64 --target armv7', { stdio: 'inherit', cwd: rootDir });

        // 3. Locate APK
        const apkDir = path.join(desktopDir, 'src-tauri', 'gen', 'android', 'app', 'build', 'outputs', 'apk');

        if (!fs.existsSync(apkDir)) {
            throw new Error(`Could not find APK output directory: ${apkDir}`);
        }

        // Find the APK file
        const apkFiles = findApkFiles(apkDir);

        if (apkFiles.length === 0) {
            throw new Error(`No APK files found in ${apkDir}`);
        }

        // Prioritize: universal-debug -> debug -> any debug -> any apk
        const targetApk =
            apkFiles.find(f => f.includes('universal') && f.includes('debug')) ||
            apkFiles.find(f => f.includes('debug')) ||
            apkFiles[0];

        console.log(`\n✅ Found APK: ${targetApk}`);

        // 4. Move to releases
        if (!fs.existsSync(releaseDir)) {
            fs.mkdirSync(releaseDir, { recursive: true });
        }

        // Get version from package.json
        const packageJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf-8'));
        const version = packageJson.version || '0.0.0';

        // Use simpler timestamp format YYYYMMDD-HHmm
        const now = new Date();
        const timestamp = now.toISOString().replace(/[:T-]/g, '').slice(0, 12);

        const newName = `notehub-android-v${version}-debug-${timestamp}.apk`;
        const destPath = path.join(releaseDir, newName);

        fs.copyFileSync(targetApk, destPath);

        console.log(`\n🎉 Release build completed!`);
        console.log(`📂 APK saved to: ${destPath}`);

    } catch (error) {
        console.error('\n❌ Build failed:');
        console.error(error);
        process.exit(1);
    }
}

function findApkFiles(dir: string): string[] {
    let results: string[] = [];
    if (!fs.existsSync(dir)) return [];

    const list = fs.readdirSync(dir);
    list.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat && stat.isDirectory()) {
            results = results.concat(findApkFiles(filePath));
        } else {
            if (file.endsWith('.apk') && !file.endsWith('-unaligned.apk')) {
                results.push(filePath);
            }
        }
    });
    return results;
}

main();
