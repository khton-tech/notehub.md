import type { IPlugin, PluginManifest, NotehubCore } from '@notehub/core';
import { useState, useEffect, useRef, useCallback, type FC, type ChangeEvent, type KeyboardEvent } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Button } from '@notehub/ck-standard';

// =============== Types ===============

/**
 * Dialog state interface - represents the current active dialog
 */
export interface DialogState {
    id: string;
    type: 'alert' | 'confirm' | 'prompt';
    title: string;
    message: string;
    defaultValue: string | undefined;
    resolve: (value: any) => void;
    reject: () => void;
}

// =============== Dialog Component with Tailwind + Focus Trap ===============

interface DialogOverlayProps {
    dialog: DialogState;
    onClose: () => void;
}

const DialogOverlay: FC<DialogOverlayProps> = ({ dialog, onClose }) => {
    const [inputValue, setInputValue] = useState(dialog.defaultValue || '');
    const dialogRef = useRef<HTMLDivElement>(null);
    const firstFocusableRef = useRef<HTMLElement | null>(null);

    const handleConfirm = useCallback(() => {
        if (dialog.type === 'alert') {
            dialog.resolve(undefined);
        } else if (dialog.type === 'confirm') {
            dialog.resolve(true);
        } else if (dialog.type === 'prompt') {
            dialog.resolve(inputValue);
        }
        onClose();
    }, [dialog, inputValue, onClose]);

    const handleCancel = useCallback(() => {
        if (dialog.type === 'confirm') {
            dialog.resolve(false);
        } else if (dialog.type === 'prompt') {
            dialog.resolve(null);
        }
        onClose();
    }, [dialog, onClose]);

    const handleInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            handleConfirm();
        } else if (e.key === 'Escape') {
            handleCancel();
        }
    };

    const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
        setInputValue(e.target.value);
    };

    // Focus trap implementation
    useEffect(() => {
        const dialogEl = dialogRef.current;
        if (!dialogEl) return;

        // Get all focusable elements
        const getFocusableElements = (): HTMLElement[] => {
            const nodeList = dialogEl.querySelectorAll<HTMLElement>(
                'button, input, [tabindex]:not([tabindex="-1"])'
            );
            return Array.from(nodeList);
        };

        // Store the element that had focus before dialog opened
        const previouslyFocused = document.activeElement as HTMLElement;

        // Focus first focusable element
        const focusable = getFocusableElements();
        if (focusable.length > 0) {
            const firstEl = focusable[0];
            if (firstEl) {
                firstFocusableRef.current = firstEl;
                firstEl.focus();
            }
        }

        // Handle tab key for focus trap
        const handleKeyDown = (e: globalThis.KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                handleCancel();
                return;
            }

            if (e.key !== 'Tab') return;

            const focusable = getFocusableElements();
            if (focusable.length === 0) return;

            const first = focusable[0];
            const last = focusable[focusable.length - 1];

            if (!first || !last) return;

            if (e.shiftKey) {
                // Shift + Tab
                if (document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                }
            } else {
                // Tab
                if (document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                }
            }
        };

        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            // Restore focus to previous element
            previouslyFocused?.focus?.();
        };
    }, [handleCancel]);

    return (
        <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[9999] animate-[dialogFadeIn_0.2s_ease-out]"
            onClick={handleCancel}
            role="dialog"
            aria-modal="true"
            aria-labelledby="dialog-title"
            aria-describedby="dialog-message"
        >
            <div
                ref={dialogRef}
                className="bg-[var(--nh-bg-surface,#2a2a2a)] rounded-xl border border-[var(--nh-border-secondary,#3a3a3a)] shadow-2xl p-6 min-w-[20rem] max-w-[30rem] animate-[dialogSlideIn_0.2s_ease-out] font-[var(--nh-font-family,system-ui)]"
                onClick={(e) => e.stopPropagation()}
            >
                <h2
                    id="dialog-title"
                    className="text-lg font-semibold text-[var(--nh-text-primary,#e0e0e0)] mb-3"
                >
                    {dialog.title}
                </h2>
                <p
                    id="dialog-message"
                    className="text-sm text-[var(--nh-text-secondary,#a0a0a0)] mb-5 leading-relaxed"
                >
                    {dialog.message}
                </p>

                {dialog.type === 'prompt' && (
                    <input
                        id="dialog-prompt-input"
                        type="text"
                        className="w-full px-3 py-2.5 text-sm bg-[var(--nh-bg-main,#1a1a1a)] border border-[var(--nh-border-secondary,#3a3a3a)] rounded-lg text-[var(--nh-text-primary,#e0e0e0)] mb-5 outline-none focus:border-[var(--nh-accent-primary,#6b5ce7)] focus:ring-1 focus:ring-[var(--nh-accent-primary,#6b5ce7)] transition-colors"
                        value={inputValue}
                        onChange={handleInputChange}
                        onKeyDown={handleInputKeyDown}
                        placeholder="Enter value..."
                    />
                )}

                <div className="flex justify-end gap-3">
                    {dialog.type !== 'alert' && (
                        <Button variant="ghost" onClick={handleCancel}>
                            Cancel
                        </Button>
                    )}
                    <Button variant="primary" onClick={handleConfirm}>
                        {dialog.type === 'alert' ? 'OK' : 'Confirm'}
                    </Button>
                </div>
            </div>

            {/* CSS Keyframes for animations */}
            <style>{`
                @keyframes dialogFadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes dialogSlideIn {
                    from { transform: scale(0.95) translateY(-10px); opacity: 0; }
                    to { transform: scale(1) translateY(0); opacity: 1; }
                }
            `}</style>
        </div>
    );
};


// =============== Plugin ===============

/**
 * DialogManagerPlugin - Custom dialog system replacing native browser dialogs
 *
 * Provides Promise-based dialog methods (alert, confirm, prompt) that render
 * styled modal dialogs using the application's theme system.
 */
export class DialogManagerPlugin implements IPlugin {
    readonly manifest: PluginManifest = {
        id: 'nh.ui.dialog-manager',
        name: 'DialogManager',
        version: '1.0.0',
        type: 'ui',
    };

    private app: NotehubCore | null = null;
    private dialogContainer: HTMLDivElement | null = null;
    private dialogRoot: Root | null = null;
    private currentDialog: DialogState | null = null;

    /**
     * Log a message via the Logger plugin
     */
    private log(level: 'info' | 'warn' | 'error', message: string): void {
        if (this.app) {
            this.app.api.invoke(`logger:${level}`, this.manifest.id, message);
        }
    }

    /**
     * Generate unique dialog ID
     */
    private generateId(): string {
        return `dialog-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Render the current dialog
     */
    private renderDialog(): void {
        if (!this.dialogRoot || !this.currentDialog) return;

        this.dialogRoot.render(
            <DialogOverlay
                dialog={this.currentDialog}
                onClose={() => this.closeDialog()}
            />
        );
    }

    /**
     * Close and cleanup current dialog
     */
    private closeDialog(): void {
        if (this.dialogRoot) {
            this.dialogRoot.render(null);
        }
        const dialogId = this.currentDialog?.id;
        this.currentDialog = null;

        if (this.app && dialogId) {
            this.app.events.emit('dialog:closed', { id: dialogId });
        }
    }

    /**
     * Show a dialog of the specified type
     */
    private showDialog<T>(
        type: 'alert' | 'confirm' | 'prompt',
        title: string,
        message: string,
        defaultValue?: string
    ): Promise<T> {
        return new Promise((resolve, reject) => {
            const id = this.generateId();

            this.currentDialog = {
                id,
                type,
                title,
                message,
                defaultValue,
                resolve,
                reject,
            };

            this.renderDialog();

            if (this.app) {
                this.app.events.emit('dialog:opened', { id, type, title });
            }

            this.log('info', `Opened ${type} dialog: "${title}"`);
        });
    }

    // =============== Plugin Lifecycle ===============

    async load(app: NotehubCore): Promise<void> {
        this.app = app;
        this.log('info', 'Loading...');

        // Create dialog container
        this.dialogContainer = document.createElement('div');
        this.dialogContainer.id = 'nh-dialog-container';
        document.body.appendChild(this.dialogContainer);
        this.dialogRoot = createRoot(this.dialogContainer);

        // Register API methods
        app.api.register('dialog:alert', (title: string, message: string) => {
            return this.showDialog<void>('alert', title, message);
        });

        app.api.register('dialog:confirm', (title: string, message: string) => {
            return this.showDialog<boolean>('confirm', title, message);
        });

        app.api.register('dialog:prompt', (title: string, message: string, defaultValue?: string) => {
            return this.showDialog<string | null>('prompt', title, message, defaultValue);
        });

        this.log('info', 'Registered dialog API methods: alert, confirm, prompt');
        this.log('info', 'Loaded successfully');
    }

    async unload(_app: NotehubCore): Promise<void> {
        this.log('info', 'Unloading...');

        // Cleanup dialog container
        if (this.dialogRoot) {
            this.dialogRoot.unmount();
            this.dialogRoot = null;
        }
        if (this.dialogContainer) {
            this.dialogContainer.remove();
            this.dialogContainer = null;
        }

        this.app = null;
        this.log('info', 'Unloaded');
    }
}

// Default export for dynamic loading
export default DialogManagerPlugin;
