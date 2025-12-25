import type { MouseEvent } from 'react';
import type { FileNode } from '../types';
import { Icon } from '@notehub/icon-manager';

interface FileTreeItemProps {
    node: FileNode;
    depth: number;
    onToggle: (path: string) => void;
    onSelect: (path: string) => void;
    selectedPath?: string | null | undefined;
}

export const FileTreeItem: React.FC<FileTreeItemProps> = ({
    node,
    depth,
    onToggle,
    onSelect,
    selectedPath
}) => {
    const isSelected = selectedPath === node.path;
    const isDirectory = node.kind === 'directory';

    // Indentation style
    const style = {
        paddingLeft: `${depth * 12 + 4}px`, // +4 for some base padding
    };

    const handleClick = (e: MouseEvent) => {
        e.stopPropagation();
        if (isDirectory) {
            onToggle(node.path);
        } else {
            onSelect(node.path);
        }
    };

    // const getIconName = () => { ... } // Unused
    // if (!isDirectory) return 'file'; // Default file icon
    // return node.isExpanded ? 'chevron-down' : 'chevron-right';

    return (
        <div className="select-none">
            <div
                className={`
                    flex items-center py-0.5 cursor-pointer text-[13px] h-[22px]
                    hover:bg-[var(--nh-bg-secondary)]
                    ${isSelected ? 'bg-[var(--nh-accent-secondary)] text-white' : 'text-[var(--nh-text-muted)]'}
                `}
                style={style}
                onClick={handleClick}
            >
                {/* Icon/Expander area */}
                <div className="w-[16px] flex items-center justify-center shrink-0 mr-1">
                    {isDirectory ? (
                        <Icon
                            name={node.isExpanded ? 'chevron-down' : 'chevron-right'}
                            size={14}
                            className={isSelected ? 'text-white' : 'text-[var(--nh-text-secondary)]'}
                        />
                    ) : (
                        <Icon
                            name="file"
                            size={14}
                            className={isSelected ? 'text-white' : 'text-[var(--nh-text-secondary)]'}
                        />
                    )}
                </div>

                {/* Name */}
                <span className="truncate leading-none opacity-90">{node.name}</span>
            </div>

            {/* Children */}
            {isDirectory && node.isExpanded && node.children && (
                <div>
                    {node.children.map(child => (
                        <FileTreeItem
                            key={child.path}
                            node={child}
                            depth={depth + 1}
                            onToggle={onToggle}
                            onSelect={onSelect}
                            selectedPath={selectedPath}
                        />
                    ))}
                    {/* Empty State */}
                    {node.isLoaded && node.children.length === 0 && (
                        <div
                            style={{ paddingLeft: `${(depth + 1) * 12 + 20}px` }}
                            className="text-[11px] text-[var(--nh-text-disabled)] py-1 italic"
                        >
                            Empty
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
