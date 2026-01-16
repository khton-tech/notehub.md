import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

/**
 * Vite configuration for ext.docbar plugin.
 * 
 * Key requirements:
 * 1. Output format: SystemJS (for dynamic loading via Synapse)
 * 2. External: React, CodeMirror (use shared runtime from core)
 */
export default defineConfig({
    plugins: [react()],
    build: {
        target: 'es2020',
        lib: {
            entry: resolve(__dirname, 'src/main.tsx'),
            formats: ['system'],
            fileName: () => 'main.js',
        },
        outDir: 'dist',
        emptyOutDir: true,
        minify: false,
        rollupOptions: {
            // CRITICAL: These must be external to avoid Dual Package Hazard
            external: [
                'react',
                'react-dom',
                'react-dom/client',
                'react/jsx-runtime',
                '@notehub.md/api',
                // CodeMirror packages - use regex to catch all
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
