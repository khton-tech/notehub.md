import { useState, useRef, useEffect, type MouseEvent, type KeyboardEvent, type ChangeEvent } from 'react';
import type { FileNode } from '../types';
import { Icon } from '@notehub/icon-manager';
import { useNotehub } from '@notehub/core';


interface FileTreeItemProps {
    node: FileNode;
    depth: number;
    onToggle: (path: string) => void;
    onSelect: (path: string) => void;
    selectedPath?: string | null | undefined;
    focusedPath?: string | null | undefined;
    activeFilePath?: string | null | undefined;
    renamingPath?: string | null | undefined;
    onRenameSubmit: (oldPath: string, newName: string) => void;
    onRenameCancel: () => void;
}

export const FileTreeItem: React.FC<FileTreeItemProps> = ({
    node,
    depth,
    onToggle,
    onSelect,
    selectedPath,
    focusedPath,
    activeFilePath,
    renamingPath,
    onRenameSubmit,
    onRenameCancel,
}) => {
    const app = useNotehub();
    const isSelected = selectedPath === node.path;
    const isFocused = focusedPath === node.path;
    const isActive = activeFilePath === node.path;
    const isRenaming = renamingPath === node.path;
    const isDirectory = node.kind === 'directory';

    // Rename input state
    const [renameValue, setRenameValue] = useState(node.name);
    const inputRef = useRef<HTMLInputElement>(null);

    // Focus input when entering rename mode
    useEffect(() => {
        if (isRenaming && inputRef.current) {
            inputRef.current.focus();
            // Select filename without extension
            const dotIndex = node.name.lastIndexOf('.');
            if (dotIndex > 0 && !isDirectory) {
                inputRef.current.setSelectionRange(0, dotIndex);
            } else {
                inputRef.current.select();
            }
        }
    }, [isRenaming, node.name, isDirectory]);

    // Reset rename value when path changes
    useEffect(() => {
        setRenameValue(node.name);
    }, [node.name]);

    // Indentation style - more breathing room
    const style = {
        paddingLeft: `${depth * 16 + 8}px`,
    };

    const handleClick = (e: MouseEvent) => {
        e.stopPropagation();
        if (isRenaming) return;

        if (isDirectory) {
            onToggle(node.path);
        } else {
            onSelect(node.path);
        }
    };

    const handleContextMenu = (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (isRenaming) return;

        app.api.invoke(
            'context-menu:trigger' as any,
            e.nativeEvent,
            'explorer-item',
            { path: node.path, kind: node.kind }
        );
    };

    // Rename handlers
    const handleRenameChange = (e: ChangeEvent<HTMLInputElement>) => {
        setRenameValue(e.target.value);
    };

    const handleRenameKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (renameValue.trim() && renameValue !== node.name) {
                onRenameSubmit(node.path, renameValue.trim());
            } else {
                onRenameCancel();
            }
        } else if (e.key === 'Escape') {
            e.preventDefault();
            setRenameValue(node.name);
            onRenameCancel();
        }
    };

    const handleRenameBlur = () => {
        if (renameValue.trim() && renameValue !== node.name) {
            onRenameSubmit(node.path, renameValue.trim());
        } else {
            onRenameCancel();
        }
    };

    // Determine icon
    const getIcon = (): { name: string; className: string } => {
        const baseClass = isSelected || isActive
            ? 'text-white'
            : 'text-[var(--nh-text-secondary)]';

        if (isDirectory) {
            return {
                name: node.isExpanded ? 'folder-open' : 'folder',
                className: `${baseClass} ${!isSelected && !isActive ? 'text-yellow-500/80' : ''}`,
            };
        }

        // File icon - could be extended for different file types
        return {
            name: 'file',
            className: baseClass,
        };
    };

    const icon = getIcon();

    // Build class names
    const itemClasses = [
        'flex items-center py-1 cursor-pointer text-[13px] min-h-[28px]',
        'hover:bg-[var(--nh-bg-hover)] transition-colors duration-100',
        'rounded-sm mx-1',
    ];

    if (isActive && !isSelected) {
        // Active file (open in editor) - subtle highlight with accent border
        itemClasses.push(
            'bg-[var(--nh-accent-primary)]/10',
            'border-l-2 border-[var(--nh-accent-primary)]',
            'text-[var(--nh-text-primary)]'
        );
    } else if (isSelected) {
        // Selected item - full accent background
        itemClasses.push(
            'bg-[var(--nh-accent-primary)]',
            'text-white'
        );
    } else {
        itemClasses.push('text-[var(--nh-text-secondary)]');
    }

    if (isFocused && !isSelected) {
        itemClasses.push('ring-1 ring-inset ring-[var(--nh-accent-primary)]/50');
    }

    return (
        <div className="select-none" role="treeitem" aria-selected={isSelected}>
            <div
                className={itemClasses.join(' ')}
                style={style}
                onClick={handleClick}
                onContextMenu={handleContextMenu}
            >
                {/* Chevron for directories */}
                {isDirectory && (
                    <div className="w-[16px] flex items-center justify-center shrink-0">
                        <Icon
                            name={node.isExpanded ? 'chevron-down' : 'chevron-right'}
                            size={14}
                            className={isSelected ? 'text-white/80' : 'text-[var(--nh-text-muted)]'}
                        />
                    </div>
                )}

                {/* Icon */}
                <div className={`w-[18px] flex items-center justify-center shrink-0 ${isDirectory ? '' : 'ml-[16px]'}`}>
                    <Icon
                        name={icon.name}
                        size={15}
                        className={icon.className}
                    />
                </div>

                {/* Name or Rename Input */}
                <div className="flex-1 min-w-0 ml-2">
                    {isRenaming ? (
                        <input
                            ref={inputRef}
                            type="text"
                            value={renameValue}
                            onChange={handleRenameChange}
                            onKeyDown={handleRenameKeyDown}
                            onBlur={handleRenameBlur}
                            className="
                                w-full px-1.5 py-0.5 text-[13px]
                                bg-[var(--nh-bg-main)] 
                                border border-[var(--nh-accent-primary)]
                                rounded outline-none
                                text-[var(--nh-text-primary)]
                            "
                            onClick={(e) => e.stopPropagation()}
                        />
                    ) : (
                        <span className="truncate leading-none block">
                            {node.name}
                        </span>
                    )}
                </div>
            </div>

            {/* Children */}
            {isDirectory && node.isExpanded && node.children && (
                <div role="group">
                    {node.children.map(child => (
                        <FileTreeItem
                            key={child.path}
                            node={child}
                            depth={depth + 1}
                            onToggle={onToggle}
                            onSelect={onSelect}
                            selectedPath={selectedPath}
                            focusedPath={focusedPath}
                            activeFilePath={activeFilePath}
                            renamingPath={renamingPath}
                            onRenameSubmit={onRenameSubmit}
                            onRenameCancel={onRenameCancel}
                        />
                    ))}
                    {/* Empty State */}
                    {node.isLoaded && node.children.length === 0 && (
                        <div
                            style={{ paddingLeft: `${(depth + 1) * 16 + 24}px` }}
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
