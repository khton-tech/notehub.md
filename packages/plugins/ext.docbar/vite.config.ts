/**
 * Vite Configuration for Notehub Plugin
 * 
 * Wave 1: SystemJS Shared Runtime
 * - Outputs SystemJS module format
 * - Marks React, CodeMirror, and API as external (provided by host)
 */
import { defineConfig } from 'vite';

export default defineConfig({
    build: {
        lib: {
            entry: 'src/main.tsx',
            formats: ['system'],
            fileName: () => 'main.js',
        },
        outDir: 'dist',
        emptyOutDir: true,
        minify: false,
        rollupOptions: {
            external: [
                // React Runtime (provided by Notehub)
                'react',
                'react-dom',
                'react-dom/client',
                'react/jsx-runtime',
                // Notehub API
                '@notehub.md/api',
                // UI Components
                'lucide-react',
                // Wave 1: CodeMirror Shared Runtime
                // CRITICAL: Must be external to prevent Dual Package Hazard
                /^@codemirror\/.*/,
            ],
            output: {
                format: 'system',
                entryFileNames: 'main.js',
                exports: 'auto',
            },
        },
    },
});
