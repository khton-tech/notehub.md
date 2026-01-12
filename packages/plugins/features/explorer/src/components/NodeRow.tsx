/**
 * NodeRow - Custom node renderer for react-arborist
 * 
 * Renders a single row in the file tree with:
 * - File/folder icons from icon-manager
 * - Context menu integration
 * - Deep Space theme styling
 * - Inline rename support
 */

import React, { useRef, useEffect } from 'react';
import type { NodeRendererProps } from 'react-arborist';
import { Icon } from '@notehub/icon-manager';
import { useNotehub } from '@notehub/core';
import type { FileNode } from '../types';

export const NodeRow: React.FC<NodeRendererProps<FileNode>> = ({
    node,
    style,
    dragHandle,
}) => {
    const app = useNotehub();
    const data = node.data;
    const inputRef = useRef<HTMLInputElement>(null);

    // Focus input when entering edit mode
    useEffect(() => {
        if (node.isEditing && inputRef.current) {
            inputRef.current.focus();
            // Select filename without extension
            const dotIndex = data.name.lastIndexOf('.');
            if (dotIndex > 0 && !data.isDir) {
                inputRef.current.setSelectionRange(0, dotIndex);
            } else {
                inputRef.current.select();
            }
        }
    }, [node.isEditing, data.name, data.isDir, data.id]);

    // Track previous editing state to prevent stale opens
    const wasEditing = useRef(false);
    useEffect(() => {
        if (node.isEditing) wasEditing.current = true;
    }, [node.isEditing]);

    // Auto-open files when focused via keyboard navigation
    useEffect(() => {
        if (node.isFocused && !data.isDir && !node.isEditing) {
            // If we just finished editing, skip this trigger
            if (wasEditing.current) {
                wasEditing.current = false;
                return;
            }
            app.events.emit('explorer:file-selected', { path: data.id });
        }
    }, [node.isFocused, data.isDir, data.id, node.isEditing, app.events]);

    // Context menu handler
    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        app.api.invoke(
            'context-menu:trigger' as any,
            e.nativeEvent,
            'explorer-item',
            { path: data.id, isDir: data.isDir }
        );
    };

    // Click handler
    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (node.isEditing) return;
        // Toggle folders when clicking on the row
        if (data.isDir) {
            node.toggle();
        }
        // Always select the node
        node.select();
    };

    // Chevron click - only toggle, don't select
    const handleChevronClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        node.toggle();
    };

    // Icon logic
    const iconName = data.isDir
        ? (node.isOpen ? 'folder-open' : 'folder')
        : 'file';

    // Build class names for styling
    const baseClasses = [
        'group relative flex items-center h-full cursor-pointer text-[13px] pr-2',
        'transition-colors duration-100',
    ];

    // Highlight based on selection (active file)
    const isHighlighted = node.isSelected;

    if (isHighlighted) {
        baseClasses.push(
            'text-white',
            'mx-1.5 rounded-lg',
            'bg-[var(--nh-accent-secondary)]'
        );
    } else {
        baseClasses.push(
            'text-[var(--nh-text-secondary)]',
            'hover:bg-[var(--nh-bg-hover)]'
        );
    }

    // Focused state (keyboard navigation) - removed thick ring in favor of subtle left border

    // Icon color classes - monochrome for consistency
    const iconColorClass = isHighlighted
        ? 'text-white'
        : 'text-[var(--nh-text-muted)]';

    return (
        <div
            ref={dragHandle}
            style={style}
            className={baseClasses.join(' ')}
            onClick={handleClick}
            onContextMenu={handleContextMenu}
            role="treeitem"
            aria-selected={node.isSelected}
        >
            {/* Selection/Focus indicator */}
            {isHighlighted && (
                <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[var(--nh-accent-primary)] rounded-r-sm" />
            )}

            {/* Chevron for directories */}
            {data.isDir ? (
                <span
                    className="w-4 flex-shrink-0 flex items-center justify-center cursor-pointer hover:text-white transition-colors"
                    onClick={handleChevronClick}
                >
                    <Icon
                        name={node.isOpen ? 'chevron-down' : 'chevron-right'}
                        size={14}
                        className={isHighlighted ? 'text-white/80' : 'text-[var(--nh-text-muted)]'}
                    />
                </span>
            ) : (
                <span className="w-4 flex-shrink-0" />
            )}

            {/* File/Folder Icon */}
            <span className="w-[18px] flex-shrink-0 flex items-center justify-center">
                <Icon
                    name={iconName}
                    size={15}
                    className={iconColorClass}
                />
            </span>

            {/* Name or Rename Input */}
            <div className="flex-1 min-w-0 ml-2">
                {node.isEditing ? (
                    <input
                        ref={inputRef}
                        type="text"
                        defaultValue={data.name}
                        onBlur={() => node.reset()}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                const value = e.currentTarget.value.trim();
                                if (value && value !== data.name) {
                                    node.submit(value);
                                } else {
                                    node.reset();
                                }
                            }
                            if (e.key === 'Escape') {
                                node.reset();
                            }
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="
                            w-full px-1.5 py-0.5 text-[13px]
                            bg-[var(--nh-bg-main)] 
                            border border-[var(--nh-accent-primary)]
                            rounded outline-none
                            text-[var(--nh-text-primary)]
                        "
                    />
                ) : (
                    <span className="truncate leading-none block">
                        {data.name}
                    </span>
                )}
            </div>
        </div>
    );
};

export default NodeRow;
