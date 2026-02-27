import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],

    // Tauri expects a fixed port
    server: {
        port: 1420,
        strictPort: true,
        host: process.env.TAURI_DEV_HOST || false,
        hmr: process.env.TAURI_DEV_HOST
            ? {
                protocol: 'ws',
                host: process.env.TAURI_DEV_HOST,
                port: 1421,
            }
            : undefined,
        watch: {
            ignored: ['**/src-tauri/**'],
        },
        cors: {
            origin: true,
            credentials: true
        },
        headers: {
            // Need allows all origins to fix "missing Origin header"
            'Access-Control-Allow-Origin': '*',
        }
    },

    // Env prefix for Tauri
    envPrefix: ['VITE_', 'TAURI_'],

    build: {
        // Tauri uses Chromium on Windows and WebKit on macOS/Linux
        target: process.env.TAURI_PLATFORM === 'windows' ? 'chrome105' : 'safari14',
        // Don't minify for debug builds
        minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
        // Produce sourcemaps for debug builds
        sourcemap: !!process.env.TAURI_DEBUG,
    },
});
