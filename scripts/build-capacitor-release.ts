import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const capacitorDir = path.join(rootDir, 'apps', 'capacitor');
const androidDir = path.join(capacitorDir, 'android');
const releaseDir = path.join(rootDir, 'apps', 'releases');

// Main function
async function main() {
    console.log('🚀 Starting Capacitor Android Build...');

    try {
        // 1. Build frontend and dependencies
        console.log('\n📦 Building packages and frontend...');
        // Run build in root to ensure all dependencies are built
        execSync('pnpm build', { stdio: 'inherit', cwd: rootDir });

        // 2. Sync Capacitor
        console.log('\n🔗 Syncing Capacitor...');
        execSync('pnpm sync', { stdio: 'inherit', cwd: capacitorDir });

        // 3. Build APK (Release)
        console.log('\n📱 Building Android APK (Release)...');

        // Use gradlewWrapper
        const gradlew = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';

        // Check if android directory exists
        if (!fs.existsSync(androidDir)) {
            throw new Error(`Android platform not found at ${androidDir}. Did you run 'npx cap add android'?`);
        }

        execSync(`${gradlew} assembleRelease`, { stdio: 'inherit', cwd: androidDir });

        // 4. Locate APK
        // usually in app/build/outputs/apk/release/app-release-unsigned.apk
        const apkDir = path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'release');

        if (!fs.existsSync(apkDir)) {
            throw new Error(`Could not find APK output directory: ${apkDir}`);
        }

        const apkFiles = findApkFiles(apkDir);

        if (apkFiles.length === 0) {
            throw new Error(`No APK files found in ${apkDir}`);
        }

        const targetApk = apkFiles[0];
        console.log(`\n✅ Found APK: ${targetApk}`);

        // 5. Move to releases
        if (!fs.existsSync(releaseDir)) {
            fs.mkdirSync(releaseDir, { recursive: true });
        }

        const packageJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf-8'));
        const capPackageJson = JSON.parse(fs.readFileSync(path.join(capacitorDir, 'package.json'), 'utf-8'));
        const version = capPackageJson.version || packageJson.version || '0.0.0';

        // Use simpler timestamp format YYYYMMDD-HHmm
        const now = new Date();
        const timestamp = now.toISOString().replace(/[:T-]/g, '').slice(0, 12);

        const newName = `notehub-capacitor-v${version}-release-${timestamp}.apk`;
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
