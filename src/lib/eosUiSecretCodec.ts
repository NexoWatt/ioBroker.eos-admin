/** Copyright (c) 2026 NexoWatt. Proprietary; see LICENSE. */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/**
 * Wire-compatible with ioBroker js-controller-common-db tools.encrypt/decrypt.
 * Preserve its existing AES-192-CBC envelope and legacy XOR migration format;
 * no new credential format is introduced by the process boundary.
 * Compatibility is checked bidirectionally against the installed controller SDK.
 */
export function createUiSecretCodec(secret: unknown): {
    encrypt(value: unknown): string;
    decrypt(value: unknown): string;
} {
    const input = (value: unknown, maxCharacters: number): { key: string; value: string } => {
        if (
            typeof secret !== 'string' ||
            !secret ||
            secret.length > 4096 ||
            typeof value !== 'string' ||
            value.length > maxCharacters
        ) {
            throw new Error('EOS_UI_PROCESS_SECRET_UNAVAILABLE');
        }
        return { key: secret, value };
    };
    const legacy = (key: string, value: string): string => {
        let result = '';
        for (let index = 0; index < value.length; index++) {
            result += String.fromCharCode(value.charCodeAt(index) ^ key.charCodeAt(index % key.length));
        }
        return result;
    };
    return {
        encrypt(value: unknown): string {
            const checked = input(value, 65536);
            if (Buffer.byteLength(checked.value, 'utf8') > 65536) {
                throw new Error('EOS_UI_PROCESS_SECRET_INVALID');
            }
            if (!/^[0-9a-f]{48}$/.test(checked.key)) {
                return legacy(checked.key, checked.value);
            }
            const iv = randomBytes(16);
            const cipher = createCipheriv('aes-192-cbc', Buffer.from(checked.key, 'hex'), iv);
            const encrypted = Buffer.concat([cipher.update(checked.value), cipher.final()]);
            return `$/aes-192-cbc:${iv.toString('hex')}:${encrypted.toString('hex')}`;
        },
        decrypt(value: unknown): string {
            // AES ciphertext is hex plus one padded block and its existing envelope.
            const checked = input(value, 131200);
            if (!checked.value.startsWith('$/aes-192-cbc:') || !/^[0-9a-f]{48}$/.test(checked.key)) {
                return legacy(checked.key, checked.value);
            }
            const parts = checked.value.split(':', 3);
            const iv = parts[1];
            const ciphertext = parts[2];
            if (
                typeof iv !== 'string' ||
                typeof ciphertext !== 'string' ||
                !/^[0-9a-f]{32}$/i.test(iv) ||
                !/^(?:[0-9a-f]{32})+$/i.test(ciphertext)
            ) {
                throw new Error('EOS_UI_PROCESS_SECRET_INVALID');
            }
            const decipher = createDecipheriv('aes-192-cbc', Buffer.from(checked.key, 'hex'), Buffer.from(iv, 'hex'));
            return Buffer.concat([decipher.update(Buffer.from(ciphertext, 'hex')), decipher.final()]).toString();
        },
    };
}
