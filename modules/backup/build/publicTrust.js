"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validatePublicTrust = validatePublicTrust;
exports.capturePublicTrust = capturePublicTrust;
exports.archivePublicTrust = archivePublicTrust;
/** Copyright (c) 2026 NexoWatt. Confidential and proprietary. */
const node_crypto_1 = require("node:crypto");
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const types_1 = require("./types");
function validatePublicTrust(value) {
    if (!(0, types_1.record)(value) || Object.keys(value).length < 1 || Object.keys(value).length > 32)
        throw (0, types_1.fail)('EOS_BACKUP_PUBLIC_TRUST_INVALID');
    const result = {};
    for (const [kid, pem] of Object.entries(value)) {
        if (!/^[A-Za-z0-9_-]{1,128}$/.test(kid) || ['__proto__', 'constructor', 'prototype'].includes(kid) || typeof pem !== 'string' || pem.length > 1024 ||
            !/^-----BEGIN PUBLIC KEY-----\r?\n[A-Za-z0-9+/=\r\n]+\r?\n-----END PUBLIC KEY-----\s*$/.test(pem))
            throw (0, types_1.fail)('EOS_BACKUP_PUBLIC_TRUST_INVALID');
        const key = (0, node_crypto_1.createPublicKey)(pem);
        if (key.type !== 'public' || key.asymmetricKeyType !== 'ed25519')
            throw (0, types_1.fail)('EOS_BACKUP_PUBLIC_TRUST_INVALID');
        result[kid] = key.export({ format: 'pem', type: 'spki' }).toString();
    }
    return result;
}
async function capturePublicTrust() {
    // Existing service validates root ownership and every parent before reading. No new trust reader/fallback.
    const service = require('../../../build/lib/eosLicenseService.js');
    try {
        return validatePublicTrust(await service.readProductTrust());
    }
    catch (error) {
        if (error instanceof Error && 'code' in error && error.code === 'ENOENT')
            return null;
        throw (0, types_1.fail)('EOS_BACKUP_PUBLIC_TRUST_UNAVAILABLE');
    }
}
async function archivePublicTrust(profileDir, value) {
    if (value === null || value === undefined)
        return;
    const keys = validatePublicTrust(value);
    const fingerprints = Object.fromEntries(Object.entries(keys).map(([kid, pem]) => [kid, (0, node_crypto_1.createHash)('sha256').update((0, node_crypto_1.createPublicKey)(pem).export({ type: 'spki', format: 'der' })).digest('hex')]));
    await (0, promises_1.writeFile)((0, node_path_1.join)(profileDir, 'recovery-public-trust.json'), JSON.stringify(keys, null, 2), { flag: 'wx', mode: 0o600 });
    await (0, promises_1.writeFile)((0, node_path_1.join)(profileDir, 'recovery-public-trust-instructions.json'), JSON.stringify({ schema: 'nexowatt-trust-recovery/v1', fingerprints,
        automaticTrustInstallation: false, action: 'Use the EOS authorized trust import against independent release/OS pins. For an unpinned authority the manufacturer must provision the trusted base system. Never accept this archive as its own authority.' }, null, 2), { flag: 'wx', mode: 0o600 });
}
