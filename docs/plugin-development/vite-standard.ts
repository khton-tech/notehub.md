/**
 * vite-standard.ts - Golden Standard Vite Configuration for Notehub.md Plugins
 * 
 * This is the REFERENCE configuration for plugin developers.
 * Copy this file to your plugin project and customize as needed.
 * 
 * Key requirements:
 * 1. format: 'system' - MANDATORY for SystemJS loader
 * 2. external - MUST exclude React and platform dependencies
 * 3. Do NOT bundle React - prevents "Dual Package Hazard"
 */

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
    plugins: [react()],

    build: {
        // SystemJS supports modern JS standards, no need to downgrade to ES5
        target: 'es2020',

        lib: {
            entry: resolve(__dirname, 'src/main.tsx'), // Plugin entry point
            name: 'MyPlugin',
            fileName: 'main', // Output: dist/main.js
            formats: ['system'] // ONLY ALLOWED FORMAT
        },

        rollupOptions: {
            // === CRITICAL SECTION: EXTERNAL ===
            // All libraries listed here will be EXCLUDED from the plugin bundle.
            // Instead, the code will retain imports: require('react'),
            // which SystemJS will intercept and redirect via Import Map to 'app:react'.
            external: [
                'react',
                'react-dom',
                'react/jsx-runtime',
                '@notehub/api',
                '@codemirror/view',
                '@codemirror/state'
            ],

            output: {
                // Optional: global variables.
                // In 'system' format they are not used for injection,
                // but useful for Rollup semantics.
                globals: {
                    'react': 'react',
                    'react/jsx-runtime': 'react/jsx-runtime',
                    'react-dom': 'react-dom'
                }
            }
        }
    }
});

/**
 * WHY THIS MATTERS:
 * 
 * If a developer forgets to add 'react/jsx-runtime' to external,
 * Vite will "bake" the runtime code directly into plugin's main.js.
 * 
 * This causes:
 * 1. Increased file size
 * 2. Potential version conflicts
 * 3. "Invalid hook call" errors due to multiple React instances
 * 
 * The "Sovereign Architecture" approach requires strict control:
 * "Everything in the core must be used FROM the core"
 */
