/** Copyright (c) 2026 NexoWatt. Confidential and proprietary. */
import { createHash, createPublicKey } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fail, record } from './types';
export function validatePublicTrust(value: unknown): Record<string, string> {
    if (!record(value) || Object.keys(value).length < 1 || Object.keys(value).length > 32) throw fail('EOS_BACKUP_PUBLIC_TRUST_INVALID');
    const result: Record<string, string> = {};
    for (const [kid, pem] of Object.entries(value)) {
        if (!/^[A-Za-z0-9_-]{1,128}$/.test(kid) || ['__proto__', 'constructor', 'prototype'].includes(kid) || typeof pem !== 'string' || pem.length > 1024 ||
            !/^-----BEGIN PUBLIC KEY-----\r?\n[A-Za-z0-9+/=\r\n]+\r?\n-----END PUBLIC KEY-----\s*$/.test(pem)) throw fail('EOS_BACKUP_PUBLIC_TRUST_INVALID');
        const key = createPublicKey(pem);
        if (key.type !== 'public' || key.asymmetricKeyType !== 'ed25519') throw fail('EOS_BACKUP_PUBLIC_TRUST_INVALID');
        result[kid] = key.export({ format: 'pem', type: 'spki' }).toString();
    }
    return result;
}
export async function capturePublicTrust(): Promise<Record<string, string> | null> {
    // Existing service validates root ownership and every parent before reading. No new trust reader/fallback.
    const service = require('../../../build/lib/eosLicenseService.js') as { readProductTrust: () => Promise<unknown> };
    try { return validatePublicTrust(await service.readProductTrust()); }
    catch (error) {
        if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return null;
        throw fail('EOS_BACKUP_PUBLIC_TRUST_UNAVAILABLE');
    }
}
export async function archivePublicTrust(profileDir: string, value: unknown): Promise<void> {
    if (value === null || value === undefined) return;
    const keys = validatePublicTrust(value);
    const fingerprints = Object.fromEntries(Object.entries(keys).map(([kid, pem]) => [kid, createHash('sha256').update(createPublicKey(pem).export({ type: 'spki', format: 'der' })).digest('hex')]));
    await writeFile(join(profileDir, 'recovery-public-trust.json'), JSON.stringify(keys, null, 2), { flag: 'wx', mode: 0o600 });
    await writeFile(join(profileDir, 'recovery-public-trust-instructions.json'), JSON.stringify({ schema: 'nexowatt-trust-recovery/v1', fingerprints,
        automaticTrustInstallation: false, action: 'Use the EOS authorized trust import against independent release/OS pins. For an unpinned authority the manufacturer must provision the trusted base system. Never accept this archive as its own authority.' }, null, 2), { flag: 'wx', mode: 0o600 });
}
