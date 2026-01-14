import React, { useState, useRef } from 'react';

interface HotkeyRecorderProps {
    value?: string;
    onChange: (hotkey: string) => void;
    onReset?: () => void;
    placeholder?: string;
}

export const HotkeyRecorder: React.FC<HotkeyRecorderProps> = ({
    value,
    onChange,
    onReset,
    placeholder = 'Click to record...'
}) => {
    const [isRecording, setIsRecording] = useState(false);
    const inputRef = useRef<HTMLDivElement>(null);

    // Normalize display for Mac
    const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform);

    const formatDisplay = (hotkey: string) => {
        if (!hotkey) return '';
        // Convert 'mod' to appropriate symbol/text
        return hotkey
            .replace('mod', isMac ? '⌘' : 'Ctrl')
            .replace('shift', 'Shift')
            .replace('alt', isMac ? '⌥' : 'Alt')
            .replace('meta', 'Win') // rare if mod handles it
            .replace('ctrl', 'Ctrl')
            .toUpperCase();
    };

    /**
     * Convert event to "MOD+..." string
     */
    const handleKeyDown = (e: React.KeyboardEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (e.key === 'Escape') {
            setIsRecording(false);
            return;
        }

        // Ignore if only modifiers are pressed
        if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) {
            return;
        }

        const parts: string[] = [];

        if ((isMac && e.metaKey) || (!isMac && e.ctrlKey)) {
            parts.push('mod');
        } else {
            if (e.ctrlKey) parts.push('ctrl');
            if (e.metaKey) parts.push('meta');
        }

        if (e.shiftKey) parts.push('shift');
        if (e.altKey) parts.push('alt');

        let key = e.key.toLowerCase();

        // Handle special keys
        if (key === ' ') key = 'space';
        if (e.code.startsWith('Key')) key = e.code.slice(3).toLowerCase();
        if (e.code.startsWith('Digit')) key = e.code.slice(5);

        parts.push(key);

        const hotkey = parts.join('+');
        onChange(hotkey);
        setIsRecording(false);
    };

    const handleClick = () => {
        setIsRecording(true);
    };

    const handleBlur = () => {
        setIsRecording(false);
    };

    return (
        <div className="flex items-center gap-2">
            <div
                ref={inputRef}
                tabIndex={0}
                onClick={handleClick}
                onContextMenu={(e) => {
                    e.preventDefault();
                    onReset?.();
                }}
                onKeyDown={isRecording ? handleKeyDown : undefined}
                onBlur={handleBlur}
                className={`
                    relative flex items-center justify-center min-w-[80px] px-3 py-1.5 
                    text-xs font-mono rounded cursor-pointer transition-all select-none
                    border
                    ${isRecording
                        ? 'bg-background border-primary ring-1 ring-primary text-primary'
                        : 'bg-surface border-border hover:border-border-hover text-text-muted hover:text-text'}
                `}
            >
                {isRecording ? (
                    <span>Press keys...</span>
                ) : (
                    <span className={!value ? 'opacity-50' : ''}>
                        {value ? formatDisplay(value) : (placeholder || 'None')}
                    </span>
                )}
            </div>

            {onReset && value && (
                <button
                    onClick={onReset}
                    className="p-1 hover:bg-surface-hover rounded text-text-muted hover:text-text transition-colors"
                    title="Reset to default"
                >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                </button>
            )}
        </div>
    );
};
