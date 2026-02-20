/**
 * VaultCrypto — pure Web Crypto API engine.
 * No OS or Node.js dependencies: works identically on Tauri (desktop),
 * Capacitor (mobile) and any future target.
 *
 * Scheme:
 *   Key derivation : PBKDF2 / SHA-256 / 100 000 iterations
 *   Encryption     : AES-256-GCM  (authenticated, detects tampering)
 *   File marker    : "NH_ENC_V1:" prefix on every encrypted text file
 *   Verifier       : encrypted copy of a known string, stored in plugin
 *                    storage to validate the password on next launch.
 */

const ENC_MARKER = 'NH_ENC_V1:';
const SALT_BYTES = 16;
const IV_BYTES = 12;
const PBKDF2_ITERATIONS = 100_000;
const VERIFIER_PLAINTEXT = 'vault-lock-verify-v1';

// ─── helpers ─────────────────────────────────────────────────────────────────

function bufToBase64(buf: Uint8Array): string {
    // Use Array.from to avoid O(n²) string concatenation
    return btoa(Array.from(buf, b => String.fromCharCode(b)).join(''));
}

// Return type is Uint8Array<ArrayBuffer> because `new Uint8Array(n)` always
// allocates a plain ArrayBuffer — required by the SubtleCrypto API in TS ≥ 5.6.
function base64ToBuf(b64: string): Uint8Array<ArrayBuffer> {
    const bin = atob(b64);
    const buf = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
        buf[i] = bin.charCodeAt(i);
    }
    return buf;
}

// ─── main class ──────────────────────────────────────────────────────────────

export class VaultCrypto {
    private key: CryptoKey | null = null;

    isUnlocked(): boolean {
        return this.key !== null;
    }

    /** Drop the session key from memory — files become unreadable until unlocked again. */
    lock(): void {
        this.key = null;
    }

    /**
     * First-time setup: generate a random salt, derive a key from `password`,
     * encrypt a known verifier string, and return the two values that should
     * be persisted in plugin storage.
     */
    async setup(password: string): Promise<{ salt: string; verifier: string }> {
        const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
        this.key = await this.deriveKey(password, salt);

        const enc = new TextEncoder();
        const encrypted = await this.encryptBytes(enc.encode(VERIFIER_PLAINTEXT));

        return {
            salt: bufToBase64(salt),
            verifier: bufToBase64(encrypted),
        };
    }

    /**
     * Subsequent launches: re-derive the key from `password` + stored `salt`,
     * then verify it by decrypting `verifier`.
     * Returns `true` on success, `false` on wrong password.
     */
    async unlock(password: string, saltB64: string, verifierB64: string): Promise<boolean> {
        try {
            const salt = base64ToBuf(saltB64);
            const key = await this.deriveKey(password, salt);

            const verifierBytes = base64ToBuf(verifierB64);
            const decrypted = await this.decryptBytesWithKey(key, verifierBytes);

            if (new TextDecoder().decode(decrypted) !== VERIFIER_PLAINTEXT) return false;

            this.key = key;
            return true;
        } catch {
            return false;
        }
    }

    /** Encrypt a plain-text string and return it with the NH_ENC_V1: prefix. */
    async encryptText(plaintext: string): Promise<string> {
        if (!this.key) throw new Error('[VaultLock] Vault is locked');
        const enc = new TextEncoder();
        const encrypted = await this.encryptBytes(enc.encode(plaintext));
        return ENC_MARKER + bufToBase64(encrypted);
    }

    /**
     * Decrypt a string that starts with NH_ENC_V1:.
     * If the vault is locked or the content is not encrypted, returns it unchanged.
     */
    async decryptText(content: string): Promise<string> {
        if (!content.startsWith(ENC_MARKER)) return content;
        if (!this.key) return content; // locked — caller will see the raw marker
        try {
            const encrypted = base64ToBuf(content.slice(ENC_MARKER.length));
            const decrypted = await this.decryptBytes(encrypted);
            return new TextDecoder().decode(decrypted);
        } catch {
            return '# 🔒 Decryption Failed\n\nThe file appears to be corrupted or the password is incorrect.\n⚠️ DO NOT SAVE THIS FILE as it will overwrite your encrypted data.';
        }
    }

    isEncrypted(content: string): boolean {
        return content.startsWith(ENC_MARKER);
    }

    // ── private ──────────────────────────────────────────────────────────────

    private async deriveKey(password: string, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
        const enc = new TextEncoder();
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            enc.encode(password),
            'PBKDF2',
            false,
            ['deriveKey'],
        );
        return crypto.subtle.deriveKey(
            { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
            keyMaterial,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt'],
        );
    }

    private async encryptBytes(data: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
        const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
        const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, this.key!, data);
        const result = new Uint8Array(IV_BYTES + ciphertext.byteLength);
        result.set(iv);
        result.set(new Uint8Array(ciphertext), IV_BYTES);
        return result;
    }

    private async decryptBytes(data: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
        return this.decryptBytesWithKey(this.key!, data);
    }

    private async decryptBytesWithKey(key: CryptoKey, data: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
        const iv = data.slice(0, IV_BYTES);
        const ciphertext = data.slice(IV_BYTES);
        const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
        return new Uint8Array(plaintext);
    }
}
