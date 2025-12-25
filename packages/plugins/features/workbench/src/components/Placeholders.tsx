import { Files, Search, Settings, Box, FileText } from 'lucide-react';


// Ribbon Placeholder
export const RibbonPlaceholder: React.FC = () => {
    return (
        <div className="flex flex-col items-center gap-4 w-full pt-2">
            <div className="p-2 text-[var(--nh-text-muted)] hover:text-[var(--nh-text-primary)] hover:bg-white/5 rounded cursor-pointer transition-colors">
                <Files size={20} />
            </div>
            <div className="p-2 text-[var(--nh-text-muted)] hover:text-[var(--nh-text-primary)] hover:bg-white/5 rounded cursor-pointer transition-colors">
                <Search size={20} />
            </div>
            <div className="p-2 text-[var(--nh-text-muted)] hover:text-[var(--nh-text-primary)] hover:bg-white/5 rounded cursor-pointer transition-colors mt-auto mb-2">
                <Settings size={20} />
            </div>
        </div>
    );
};

// Explorer Placeholder
export const ExplorerPlaceholder: React.FC = () => {
    return (
        <div className="p-4 text-sm text-[var(--nh-text-muted)] select-none">
            <div className="font-bold mb-2 uppercase text-[10px] tracking-wider text-[var(--nh-text-muted)]">Explorer</div>
            <div className="flex items-center gap-2 py-1 hover:text-[var(--nh-text-primary)] cursor-pointer">
                <Box size={14} />
                <span>Phase 2 (Editor) coming soon!</span>
            </div>
        </div>
    );
};

// Editor Placeholder
export const EditorPlaceholder: React.FC = () => {
    return (
        <div className="flex flex-col items-center justify-center h-full text-[var(--nh-text-muted)] select-none">
            <FileText size={64} className="mb-4 opacity-20" />
            <div className="text-lg font-medium">Notehub.md</div>
            <div className="text-sm opacity-60">No file is open</div>
            <div className="text-xs opacity-40 mt-8">Phase 2: Editor Interface</div>
        </div>
    );
};
