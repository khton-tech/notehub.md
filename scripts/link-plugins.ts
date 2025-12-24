import fg from 'fast-glob';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

// Directory paths
const PLUGINS_DIR = path.join(ROOT_DIR, 'packages', 'plugins');
const GENERATED_DIR = path.join(ROOT_DIR, 'apps', 'desktop', 'src', 'generated');
const ARTIFACTS_DIR = path.join(ROOT_DIR, 'artifacts');

// Output files
const REGISTRY_FILE = path.join(GENERATED_DIR, 'plugin-registry.json');
const GRAPH_MMD_FILE = path.join(ARTIFACTS_DIR, 'graph.mmd');
const GRAPH_HTML_FILE = path.join(ARTIFACTS_DIR, 'graph.html');

// Color mapping for categories
const CATEGORY_COLORS: Record<string, string> = {
    system: '#ff6b6b',
    ui: '#4dabf7',
    feature: '#51cf66',
    features: '#51cf66',
};

interface PluginManifest {
    id: string;
    name: string;
    version: string;
    type: string;
    dependencies?: string[];
}

/**
 * Safely parse JSON with error handling
 */
function safeParseJson(filePath: string): PluginManifest | null {
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(content) as PluginManifest;
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`  ⚠️  Warning: Failed to parse ${path.relative(ROOT_DIR, filePath)}: ${message}`);
        return null;
    }
}

/**
 * Scan plugins directory and collect all manifests
 */
async function scanManifests(): Promise<PluginManifest[]> {
    const pattern = path.join(PLUGINS_DIR, '**', 'manifest.json').replace(/\\/g, '/');
    const files = await fg(pattern, {
        absolute: true,
        ignore: ['**/node_modules/**', '**/dist/**']
    });

    const manifestMap = new Map<string, PluginManifest>();

    for (const file of files) {
        const manifest = safeParseJson(file);
        if (manifest && manifest.id) {
            // Deduplicate by ID - first one wins
            if (!manifestMap.has(manifest.id)) {
                manifestMap.set(manifest.id, manifest);
            }
        }
    }

    return Array.from(manifestMap.values());
}

/**
 * Generate plugin registry JSON
 */
function generateRegistry(manifests: PluginManifest[]): void {
    // Ensure directory exists
    fs.mkdirSync(GENERATED_DIR, { recursive: true });

    // Write registry file
    fs.writeFileSync(REGISTRY_FILE, JSON.stringify(manifests, null, 2), 'utf-8');
}

/**
 * Generate Mermaid dependency graph
 */
function generateMermaidGraph(manifests: PluginManifest[]): string {
    const lines: string[] = ['flowchart LR'];

    // Build a map of id -> manifest for quick lookup
    const manifestMap = new Map<string, PluginManifest>();
    for (const m of manifests) {
        manifestMap.set(m.id, m);
    }

    // Group plugins by category for styling
    const byCategory: Record<string, string[]> = {};

    // Add nodes
    for (const manifest of manifests) {
        const escapedName = manifest.name.replace(/"/g, '\\"');
        lines.push(`    ${manifest.id.replace(/\./g, '_')}["${escapedName}"]`);

        const category = manifest.type || 'feature';
        if (!byCategory[category]) {
            byCategory[category] = [];
        }
        byCategory[category].push(manifest.id.replace(/\./g, '_'));
    }

    // Add edges (dependencies)
    for (const manifest of manifests) {
        if (manifest.dependencies && manifest.dependencies.length > 0) {
            const sourceId = manifest.id.replace(/\./g, '_');
            for (const dep of manifest.dependencies) {
                const targetId = dep.replace(/\./g, '_');
                // Only add edge if target exists
                if (manifestMap.has(dep)) {
                    lines.push(`    ${sourceId} --> ${targetId}`);
                }
            }
        }
    }

    // Add class definitions
    lines.push('');
    lines.push('    %% Styles');
    lines.push('    classDef system fill:#ff6b6b,stroke:#c92a2a,color:#fff');
    lines.push('    classDef ui fill:#4dabf7,stroke:#1971c2,color:#fff');
    lines.push('    classDef feature fill:#51cf66,stroke:#2f9e44,color:#fff');

    // Apply classes to nodes
    for (const [category, nodeIds] of Object.entries(byCategory)) {
        if (nodeIds.length > 0) {
            const normalizedCategory = category === 'features' ? 'feature' : category;
            lines.push(`    class ${nodeIds.join(',')} ${normalizedCategory}`);
        }
    }

    return lines.join('\n');
}

/**
 * Generate HTML viewer for Mermaid graph
 */
function generateHtmlViewer(mermaidContent: string): string {
    const escapedContent = mermaidContent.replace(/`/g, '\\`');

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Plugin Dependency Graph - Notehub.md</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            min-height: 100vh;
            padding: 2rem;
            color: #e0e0e0;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
        }
        h1 {
            text-align: center;
            margin-bottom: 0.5rem;
            font-size: 2rem;
            background: linear-gradient(90deg, #ff6b6b, #4dabf7, #51cf66);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }
        .subtitle {
            text-align: center;
            color: #888;
            margin-bottom: 2rem;
        }
        .legend {
            display: flex;
            justify-content: center;
            gap: 2rem;
            margin-bottom: 2rem;
        }
        .legend-item {
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }
        .legend-color {
            width: 20px;
            height: 20px;
            border-radius: 4px;
        }
        .legend-color.system { background: #ff6b6b; }
        .legend-color.ui { background: #4dabf7; }
        .legend-color.feature { background: #51cf66; }
        .graph-container {
            background: rgba(255, 255, 255, 0.05);
            border-radius: 12px;
            padding: 2rem;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        }
        #graph {
            display: flex;
            justify-content: center;
        }
        .mermaid {
            background: transparent !important;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔌 Plugin Dependency Graph</h1>
        <p class="subtitle">Notehub.md Plugin Architecture</p>
        
        <div class="legend">
            <div class="legend-item">
                <div class="legend-color system"></div>
                <span>System</span>
            </div>
            <div class="legend-item">
                <div class="legend-color ui"></div>
                <span>UI</span>
            </div>
            <div class="legend-item">
                <div class="legend-color feature"></div>
                <span>Feature</span>
            </div>
        </div>
        
        <div class="graph-container">
            <div id="graph">
                <pre class="mermaid">
${mermaidContent}
                </pre>
            </div>
        </div>
    </div>
    
    <script type="module">
        import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs';
        mermaid.initialize({
            startOnLoad: true,
            theme: 'dark',
            flowchart: {
                useMaxWidth: true,
                htmlLabels: true,
                curve: 'basis'
            }
        });
    </script>
</body>
</html>`;
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
    console.log('\n🔗 Notehub.md Plugin Linker\n');

    // Step 1: Scan for manifests
    console.log('📦 Scanning for plugin manifests...');
    const manifests = await scanManifests();

    if (manifests.length === 0) {
        console.log('\n⚠️  No plugins found in packages/plugins/');
        console.log('   Create a plugin with: pnpm gen:plugin\n');
        return;
    }

    // Step 2: Generate registry
    console.log('\n📋 Generating plugin registry...');
    generateRegistry(manifests);
    console.log(`   ✅ ${path.relative(ROOT_DIR, REGISTRY_FILE)}`);

    // Step 3: Generate Mermaid graph
    console.log('\n🎨 Generating dependency graph...');
    fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });

    const mermaidContent = generateMermaidGraph(manifests);
    fs.writeFileSync(GRAPH_MMD_FILE, mermaidContent, 'utf-8');
    console.log(`   ✅ ${path.relative(ROOT_DIR, GRAPH_MMD_FILE)}`);

    // Step 4: Generate HTML viewer
    const htmlContent = generateHtmlViewer(mermaidContent);
    fs.writeFileSync(GRAPH_HTML_FILE, htmlContent, 'utf-8');
    console.log(`   ✅ ${path.relative(ROOT_DIR, GRAPH_HTML_FILE)}`);

    // Summary
    console.log('\n' + '─'.repeat(50));
    console.log(`✨ Found ${manifests.length} plugin${manifests.length > 1 ? 's' : ''}. Registry generated. Graph updated.`);
    console.log('─'.repeat(50) + '\n');

    // List found plugins
    for (const manifest of manifests) {
        const color = CATEGORY_COLORS[manifest.type] || '#888';
        console.log(`   • ${manifest.id} (${manifest.type})`);
    }
    console.log('');
}

main().catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
});
