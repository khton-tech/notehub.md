import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { PluginContext } from '@notehub.md/api';
import type { VaultCrypto } from './crypto';
import { PasswordModal } from './PasswordModal';

interface Props {
    ctx: PluginContext;
    vaultCrypto: VaultCrypto;
    /** Delegate setup (key generation + mass encryption) to the plugin (BUG-1/2 fix). */
    onSetup: (password: string) => Promise<void>;
    onEncryptionDisabled: () => Promise<void>;
    /** Re-encrypt all vault files with a new password (BUG-3: old approach replaced vaultCrypto.setup directly). */
    onPasswordChanged: (newPassword: string) => Promise<void>;
    /** Called after successful setup or unlock from the settings panel so the plugin
     *  can clear its initPromise and unblock hooks (BUG-10). */
    onUnlocked: () => void;
}

type StatusMsg = { type: 'ok' | 'err'; text: string } | null;

const S = {
    root: {
        padding: '28px',
        color: 'var(--nh-text-primary, #cdd6f4)',
        fontFamily: 'var(--nh-font-family, system-ui, sans-serif)',
        maxWidth: '580px',
    } satisfies React.CSSProperties,

    card: {
        padding: '20px',
        borderRadius: '10px',
        border: '1px solid var(--nh-border-secondary, #313244)',
        backgroundColor: 'var(--nh-bg-surface, #1e1e2e)',
        marginBottom: '18px',
    } satisfies React.CSSProperties,

    dot: (color: string): React.CSSProperties => ({
        width: '10px',
        height: '10px',
        borderRadius: '50%',
        backgroundColor: color,
        flexShrink: 0,
    }),
} as const;

function btn(primary = false, disabled = false): React.CSSProperties {
    return {
        padding: '8px 18px',
        borderRadius: '7px',
        border: primary ? 'none' : '1px solid var(--nh-border-secondary, #313244)',
        backgroundColor: primary ? 'var(--nh-accent-primary, #6c6fe6)' : 'transparent',
        color: primary ? '#fff' : 'var(--nh-text-primary, #cdd6f4)',
        fontSize: '13px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontWeight: primary ? 600 : 400,
        opacity: disabled ? 0.55 : 1,
    };
}

export const VaultLockSettings: React.FC<Props> = ({
    ctx,
    vaultCrypto,
    onSetup,
    onEncryptionDisabled,
    onPasswordChanged,
    onUnlocked,
}) => {
    const [isSetup, setIsSetup] = useState(false);
    const [isUnlocked, setIsUnlocked] = useState(false);
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState<StatusMsg>(null);
    // BUG-11: keep a ref to the flash timer so we can clear it on unmount
    const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Sync unlock state from vaultCrypto (poll while the tab is open)
    useEffect(() => {
        const sync = () => setIsUnlocked(vaultCrypto.isUnlocked());
        sync();
        const id = setInterval(sync, 1000);
        return () => clearInterval(id);
    }, [vaultCrypto]);

    // BUG-14: check both salt AND verifier, not just salt
    useEffect(() => {
        Promise.all([
            ctx.storage.get<string>('salt'),
            ctx.storage.get<string>('verifier'),
        ]).then(([s, v]) => setIsSetup(!!s && !!v));
    }, [ctx]);

    // BUG-11: clear the flash timer on unmount to avoid state updates on unmounted component
    useEffect(() => {
        return () => {
            if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
        };
    }, []);

    const flash = useCallback((type: 'ok' | 'err', text: string) => {
        if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
        setMsg({ type, text });
        flashTimerRef.current = setTimeout(() => {
            setMsg(null);
            flashTimerRef.current = null;
        }, 5000);
    }, []);

    const handleSetup = useCallback(async () => {
        const pw = await PasswordModal.prompt('setup');
        if (!pw) return;
        setBusy(true);
        try {
            await onSetup(pw);
            setIsSetup(true);
            setIsUnlocked(true);
            // BUG-10: notify plugin to clear initPromise and set encryptionConfigured
            onUnlocked();
            flash('ok', 'Encryption enabled. New notes will be encrypted automatically.');
        } catch (e) {
            flash('err', 'Setup failed: ' + String(e));
        } finally {
            setBusy(false);
        }
    }, [onSetup, onUnlocked, flash]);

    const handleUnlock = useCallback(async () => {
        const salt = await ctx.storage.get<string>('salt');
        const verifier = await ctx.storage.get<string>('verifier');
        if (!salt || !verifier) { flash('err', 'Encryption not configured'); return; }

        let attempt = 0;
        let hint: string | undefined;

        while (attempt < 3) {
            const pw = await PasswordModal.prompt('unlock', hint);
            if (!pw) return;
            setBusy(true);
            const ok = await vaultCrypto.unlock(pw, salt, verifier);
            setBusy(false);
            if (ok) {
                setIsUnlocked(true);
                // BUG-10: notify plugin
                onUnlocked();
                flash('ok', 'Vault unlocked.');
                return;
            }
            hint = 'Incorrect password — try again';
            attempt++;
        }
        flash('err', 'Too many failed attempts. Vault remains locked.');
    }, [ctx, vaultCrypto, onUnlocked, flash]);

    const handleLock = useCallback(() => {
        vaultCrypto.lock();
        setIsUnlocked(false);
        flash('ok', 'Vault locked. Encrypted files are protected.');
    }, [vaultCrypto, flash]);

    const handleChangePassword = useCallback(async () => {
        if (!isUnlocked) { flash('err', 'Unlock the vault first.'); return; }
        const pw = await PasswordModal.prompt('setup');
        if (!pw) return;
        setBusy(true);
        try {
            // BUG-3: delegate to plugin which re-encrypts all existing files before
            // switching to the new key, instead of calling vaultCrypto.setup() directly
            // (which would orphan all files encrypted with the old key).
            await onPasswordChanged(pw);
            flash('ok', 'Password changed. All files have been re-encrypted.');
        } catch (e) {
            flash('err', 'Failed: ' + String(e));
        } finally {
            setBusy(false);
        }
    }, [isUnlocked, onPasswordChanged, flash]);

    const handleDisable = useCallback(async () => {
        if (!isUnlocked) { flash('err', 'Unlock the vault first.'); return; }
        const confirmed = window.confirm(
            'Disable encryption?\n\n' +
            'All .md files will be decrypted and written back as plain text. ' +
            'This cannot be undone automatically.\n\n' +
            'Proceed?'
        );
        if (!confirmed) return;
        setBusy(true);
        try {
            await onEncryptionDisabled();
            setIsSetup(false);
            setIsUnlocked(false);
            flash('ok', 'Encryption disabled. All notes have been decrypted.');
        } catch (e) {
            flash('err', 'Failed to disable encryption: ' + String(e));
        } finally {
            setBusy(false);
        }
    }, [isUnlocked, onEncryptionDisabled, flash]);

    const dotColor = !isSetup ? '#585b70' : isUnlocked ? '#a6e3a1' : '#f38ba8';
    const statusLabel = !isSetup ? 'Not Configured' : isUnlocked ? 'Unlocked' : 'Locked';
    const statusDesc = !isSetup
        ? 'Set up a password to start encrypting notes'
        : isUnlocked
            ? 'Notes are encrypted/decrypted transparently'
            : 'Encrypted files cannot be read until unlocked';

    return (
        <div style={S.root}>
            <h2 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 700 }}>Vault Lock</h2>
            <p style={{ margin: '0 0 24px', fontSize: '14px', color: 'var(--nh-text-secondary, #a6adc8)', lineHeight: 1.5 }}>
                Transparent AES-256-GCM encryption for .md files.
                Uses the Web Crypto API — no OS dependencies, works on all platforms.
            </p>

            {/* Status card */}
            <div style={S.card}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px' }}>
                    <div style={S.dot(dotColor)} />
                    <div>
                        <div style={{ fontWeight: 600, fontSize: '15px' }}>{statusLabel}</div>
                        <div style={{ fontSize: '13px', color: 'var(--nh-text-secondary, #a6adc8)', marginTop: '3px' }}>
                            {statusDesc}
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    {!isSetup && (
                        <button style={btn(true, busy)} onClick={handleSetup} disabled={busy}>
                            Enable Encryption
                        </button>
                    )}
                    {isSetup && !isUnlocked && (
                        <button style={btn(true, busy)} onClick={handleUnlock} disabled={busy}>
                            Unlock Vault
                        </button>
                    )}
                    {isSetup && isUnlocked && (
                        <>
                            <button style={btn(false, busy)} onClick={handleLock} disabled={busy}>
                                Lock Vault
                            </button>
                            <button style={btn(false, busy)} onClick={handleChangePassword} disabled={busy}>
                                Change Password
                            </button>
                            <button
                                style={{ ...btn(false, busy), color: 'var(--nh-color-red, #f38ba8)', borderColor: 'rgba(243,139,168,0.35)' }}
                                onClick={handleDisable}
                                disabled={busy}
                            >
                                Disable Encryption
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Algorithm details */}
            <div style={{ ...S.card, borderStyle: 'dashed', opacity: 0.75 }}>
                <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em', marginBottom: '12px', color: 'var(--nh-text-secondary, #a6adc8)' }}>
                    ENCRYPTION DETAILS
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '7px 20px', fontSize: '13px' }}>
                    {[
                        ['Algorithm', 'AES-256-GCM (authenticated)'],
                        ['Key derivation', 'PBKDF2 · SHA-256 · 100 000 iterations'],
                        ['File format', 'NH_ENC_V1:<base64(IV + ciphertext)>'],
                        ['Scope', '.md files, excluding .notehub/ directory'],
                        ['Session key', 'In-memory only, cleared on lock/unload'],
                        ['Crypto API', 'Web Crypto (cross-platform, no native deps)'],
                    ].map(([k, v]) => (
                        <React.Fragment key={k}>
                            <span style={{ color: 'var(--nh-text-secondary, #a6adc8)' }}>{k}</span>
                            <span>{v}</span>
                        </React.Fragment>
                    ))}
                </div>
            </div>

            {/* Status flash */}
            {msg && (
                <div style={{
                    padding: '12px 16px',
                    borderRadius: '8px',
                    backgroundColor: msg.type === 'ok' ? 'rgba(166,227,161,0.13)' : 'rgba(243,139,168,0.13)',
                    border: `1px solid ${msg.type === 'ok' ? 'rgba(166,227,161,0.28)' : 'rgba(243,139,168,0.28)'}`,
                    color: msg.type === 'ok' ? '#a6e3a1' : '#f38ba8',
                    fontSize: '14px',
                }}>
                    {msg.text}
                </div>
            )}
        </div>
    );
};
