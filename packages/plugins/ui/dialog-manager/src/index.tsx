import type { IPlugin, PluginManifest, NotehubCore } from '@notehub/core';
import { useState, useEffect, type FC, type CSSProperties, type ChangeEvent, type KeyboardEvent } from 'react';
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

// =============== Styles ===============

const overlayStyle: CSSProperties = {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    animation: 'dialogFadeIn 0.2s ease-out',
};

const dialogStyle: CSSProperties = {
    backgroundColor: 'var(--nh-bg-secondary, #1e1e2e)',
    borderRadius: '12px',
    border: '1px solid var(--nh-border, #333)',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
    padding: '24px',
    minWidth: '320px',
    maxWidth: '480px',
    animation: 'dialogSlideIn 0.2s ease-out',
    fontFamily: 'var(--nh-font-family, system-ui, sans-serif)',
};

const titleStyle: CSSProperties = {
    fontSize: '18px',
    fontWeight: 600,
    color: 'var(--nh-text-primary, #e0e0e0)',
    marginBottom: '12px',
};

const messageStyle: CSSProperties = {
    fontSize: '14px',
    color: 'var(--nh-text-secondary, #a0a0a0)',
    marginBottom: '20px',
    lineHeight: 1.5,
};

const inputStyle: CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    fontSize: '14px',
    backgroundColor: 'var(--nh-bg-primary, #121212)',
    border: '1px solid var(--nh-border, #333)',
    borderRadius: '8px',
    color: 'var(--nh-text-primary, #e0e0e0)',
    marginBottom: '20px',
    outline: 'none',
    boxSizing: 'border-box',
};

const actionsStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
};

// =============== Dialog Component ===============

interface DialogOverlayProps {
    dialog: DialogState;
    onClose: () => void;
}

const DialogOverlay: FC<DialogOverlayProps> = ({ dialog, onClose }) => {
    const [inputValue, setInputValue] = useState(dialog.defaultValue || '');

    const handleConfirm = () => {
        if (dialog.type === 'alert') {
            dialog.resolve(undefined);
        } else if (dialog.type === 'confirm') {
            dialog.resolve(true);
        } else if (dialog.type === 'prompt') {
            dialog.resolve(inputValue);
        }
        onClose();
    };

    const handleCancel = () => {
        if (dialog.type === 'confirm') {
            dialog.resolve(false);
        } else if (dialog.type === 'prompt') {
            dialog.resolve(null);
        }
        onClose();
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            handleConfirm();
        } else if (e.key === 'Escape') {
            handleCancel();
        }
    };

    const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
        setInputValue(e.target.value);
    };

    // Focus input on mount for prompt dialogs
    useEffect(() => {
        if (dialog.type === 'prompt') {
            const input = document.getElementById('dialog-prompt-input');
            input?.focus();
        }
    }, [dialog.type]);

    return (
        <div style={overlayStyle} onClick={handleCancel}>
            <div style={dialogStyle} onClick={(e) => e.stopPropagation()}>
                <div style={titleStyle}>{dialog.title}</div>
                <div style={messageStyle}>{dialog.message}</div>

                {dialog.type === 'prompt' && (
                    <input
                        id="dialog-prompt-input"
                        type="text"
                        style={inputStyle}
                        value={inputValue}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                        placeholder="Enter value..."
                    />
                )}

                <div style={actionsStyle}>
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
