"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prepareLegacyEebus = prepareLegacyEebus;
const node_fs_1 = require("node:fs");
const node_crypto_1 = require("node:crypto");
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const certificateIdentity_1 = require("./certificateIdentity");
const config_1 = require("./config");
const error = (code) => Object.assign(new Error(code), { code });
const allowedMetadata = new Set(['certificate', 'privateKey', 'shipId', 'localSki', 'certificateFingerprint', 'autoAcceptNewDevices',
    'allowCommandsToUntrustedDevices', 'debugRawMessages', 'announceShipService', 'shipHandshakeEnabled', 'deviceType', 'deviceCategories', 'nexowattUiInstance']);
const expected = { autoAcceptNewDevices: false, allowCommandsToUntrustedDevices: false, debugRawMessages: false,
    announceShipService: true, shipHandshakeEnabled: true, deviceType: 'EnergyManagementSystem' };
/** Preserve the cryptographic SHIP identity; unknown/unpinned trust cannot be invented. */
async function prepareLegacyEebus(input, context, validate) {
    if (!input || typeof input !== 'object' || Array.isArray(input) || context.sourceVersion !== '0.3.0')
        throw error('EOS_MIGRATION_EEBUS_VERSION');
    const original = input;
    const normalized = (0, config_1.getConfig)(original);
    for (const [name, value] of Object.entries(expected)) {
        if (original[name] !== undefined && original[name] !== value)
            throw error('EOS_MIGRATION_EEBUS_SECURITY_PROFILE');
    }
    if (original.deviceCategories !== undefined && String(original.deviceCategories) !== '2')
        throw error('EOS_MIGRATION_EEBUS_CATEGORY');
    const selected = {};
    for (const [key, value] of Object.entries(normalized))
        if (!allowedMetadata.has(key))
            selected[key] = value;
    // PIN is protected/encrypted by the coordinator and remains unchanged.
    selected.pairingPin = original.pairingPin || '';
    selected.enabled = false;
    const config = validate(selected);
    for (const key of Object.keys(original)) {
        if (!Object.hasOwn(config, key) && !allowedMetadata.has(key))
            throw error('EOS_MIGRATION_EEBUS_UNKNOWN_SETTING');
    }
    if (context.sourceEnabled === false && !original.certificate && !original.privateKey)
        return { config, identityImported: false };
    if (typeof original.certificate !== 'string' || typeof original.privateKey !== 'string' || !original.certificate || !original.privateKey)
        throw error('EOS_MIGRATION_EEBUS_IDENTITY_REQUIRED');
    let checked;
    try {
        checked = (0, certificateIdentity_1.validateKeyPair)(original.certificate, original.privateKey);
    }
    catch {
        throw error('EOS_MIGRATION_EEBUS_IDENTITY_INVALID');
    }
    if (original.localSki !== checked.ski || original.certificateFingerprint !== checked.fingerprint ||
        typeof original.shipId !== 'string' || !/^i:\d{1,6}_u:[a-fA-F0-9]{32}$/.test(original.shipId))
        throw error('EOS_MIGRATION_EEBUS_IDENTITY_MISMATCH');
    const identity = { certificate: original.certificate, privateKey: original.privateKey,
        localSki: checked.ski, certificateFingerprint: checked.fingerprint, shipId: original.shipId, createdAt: new Date().toISOString() };
    const trust = await context.owner.getForeignStatesAsync(`${context.source}.devices.*.pairing.trusted`);
    if (!trust || typeof trust !== 'object' || Object.keys(trust).length > 128)
        throw error('EOS_MIGRATION_EEBUS_TRUST_UNAVAILABLE');
    for (const [id, state] of Object.entries(trust)) {
        if (!id.startsWith(`${context.source}.devices.`) || !id.endsWith('.pairing.trusted'))
            throw error('EOS_MIGRATION_EEBUS_TRUST_UNAVAILABLE');
        if (state?.val !== true)
            continue;
        const pin = await context.owner.getForeignStateAsync(id.replace(/\.trusted$/, '.pinnedFingerprint'));
        if (pin?.ack !== true || typeof pin.val !== 'string' || !/^[A-Fa-f0-9]{64}$/.test(pin.val))
            throw error('EOS_MIGRATION_EEBUS_REPAIR_REQUIRED');
    }
    const filename = (0, node_path_1.join)(context.dataDir, 'ship-identity.json');
    async function verifyDirectory() {
        try {
            const stat = await (0, promises_1.lstat)(context.dataDir);
            if (!stat.isDirectory() || stat.isSymbolicLink() || (stat.mode & 0o077))
                throw error('EOS_MIGRATION_EEBUS_IDENTITY_PERMISSIONS');
        }
        catch (caught) {
            if (caught && typeof caught === 'object' && 'code' in caught && caught.code === 'ENOENT')
                return;
            throw caught;
        }
    }
    async function verifyExisting() {
        try {
            const file = await (0, promises_1.open)(filename, node_fs_1.constants.O_RDONLY | node_fs_1.constants.O_NOFOLLOW);
            try {
                const stat = await file.stat();
                if (!stat.isFile() || stat.size > 65536 || (stat.mode & 0o077))
                    throw error('EOS_MIGRATION_EEBUS_IDENTITY_PERMISSIONS');
                const found = JSON.parse(await file.readFile('utf8'));
                if (found.certificate !== identity.certificate || found.privateKey !== identity.privateKey || found.shipId !== identity.shipId)
                    throw error('EOS_MIGRATION_EEBUS_IDENTITY_EXISTS');
                return true;
            }
            finally {
                await file.close();
            }
        }
        catch (caught) {
            if (caught && typeof caught === 'object' && 'code' in caught && caught.code === 'ENOENT')
                return false;
            throw caught;
        }
    }
    await verifyDirectory();
    await verifyExisting();
    return { config, identityImported: true, async prepareFiles() {
            if (await verifyExisting())
                return;
            await (0, promises_1.mkdir)(context.dataDir, { recursive: true, mode: 0o700 });
            await verifyDirectory();
            const temp = (0, node_path_1.join)(context.dataDir, `.identity-migration-${(0, node_crypto_1.randomUUID)()}`);
            const file = await (0, promises_1.open)(temp, node_fs_1.constants.O_WRONLY | node_fs_1.constants.O_CREAT | node_fs_1.constants.O_EXCL | node_fs_1.constants.O_NOFOLLOW, 0o600);
            try {
                try {
                    await file.writeFile(JSON.stringify(identity));
                    await file.sync();
                }
                finally {
                    await file.close();
                }
                // link installs the complete bytes without replacing another identity.
                await (0, promises_1.link)(temp, filename);
            }
            finally {
                await (0, promises_1.rm)(temp, { force: true });
            }
        } };
}
