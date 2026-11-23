import { constants } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { link, lstat, mkdir, open, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { validateKeyPair } from './certificateIdentity';
import { getConfig } from './config';
import { EebusIdentity } from './eebusTypes';

interface Owner {
    getForeignStatesAsync(pattern: string): Promise<Record<string, ioBroker.State>>;
    getForeignStateAsync(id: string): Promise<ioBroker.State | null | undefined>;
}
interface Context { owner: Owner; source: string; sourceVersion: string; sourceEnabled?: boolean; dataDir: string }
const error = (code: string): Error & { code: string } => Object.assign(new Error(code), { code });
const allowedMetadata = new Set(['certificate', 'privateKey', 'shipId', 'localSki', 'certificateFingerprint', 'autoAcceptNewDevices',
    'allowCommandsToUntrustedDevices', 'debugRawMessages', 'announceShipService', 'shipHandshakeEnabled', 'deviceType', 'deviceCategories', 'nexowattUiInstance']);
const expected = { autoAcceptNewDevices: false, allowCommandsToUntrustedDevices: false, debugRawMessages: false,
    announceShipService: true, shipHandshakeEnabled: true, deviceType: 'EnergyManagementSystem' };

/** Preserve the cryptographic SHIP identity; unknown/unpinned trust cannot be invented. */
export async function prepareLegacyEebus(input: unknown, context: Context, validate: (input: unknown) => Record<string, unknown>) {
    if (!input || typeof input !== 'object' || Array.isArray(input) || context.sourceVersion !== '0.3.0') throw error('EOS_MIGRATION_EEBUS_VERSION');
    const original = input as Record<string, unknown>;
    const normalized = getConfig(original);
    for (const [name, value] of Object.entries(expected)) {
        if (original[name] !== undefined && original[name] !== value) throw error('EOS_MIGRATION_EEBUS_SECURITY_PROFILE');
    }
    if (original.deviceCategories !== undefined && String(original.deviceCategories) !== '2') throw error('EOS_MIGRATION_EEBUS_CATEGORY');
    const selected: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(normalized)) if (!allowedMetadata.has(key)) selected[key] = value;
    // PIN is protected/encrypted by the coordinator and remains unchanged.
    selected.pairingPin = original.pairingPin || '';
    selected.enabled = false;
    const config = validate(selected);
    for (const key of Object.keys(original)) {
        if (!Object.hasOwn(config, key) && !allowedMetadata.has(key)) throw error('EOS_MIGRATION_EEBUS_UNKNOWN_SETTING');
    }
    if (context.sourceEnabled === false && !original.certificate && !original.privateKey) return { config, identityImported: false };
    if (typeof original.certificate !== 'string' || typeof original.privateKey !== 'string' || !original.certificate || !original.privateKey) throw error('EOS_MIGRATION_EEBUS_IDENTITY_REQUIRED');
    let checked: ReturnType<typeof validateKeyPair>;
    try { checked = validateKeyPair(original.certificate, original.privateKey); }
    catch { throw error('EOS_MIGRATION_EEBUS_IDENTITY_INVALID'); }
    if (original.localSki !== checked.ski || original.certificateFingerprint !== checked.fingerprint ||
        typeof original.shipId !== 'string' || !/^i:\d{1,6}_u:[a-fA-F0-9]{32}$/.test(original.shipId)) throw error('EOS_MIGRATION_EEBUS_IDENTITY_MISMATCH');
    const identity: EebusIdentity = { certificate: original.certificate, privateKey: original.privateKey,
        localSki: checked.ski, certificateFingerprint: checked.fingerprint, shipId: original.shipId, createdAt: new Date().toISOString() };
    const trust = await context.owner.getForeignStatesAsync(`${context.source}.devices.*.pairing.trusted`);
    if (!trust || typeof trust !== 'object' || Object.keys(trust).length > 128) throw error('EOS_MIGRATION_EEBUS_TRUST_UNAVAILABLE');
    for (const [id, state] of Object.entries(trust)) {
        if (!id.startsWith(`${context.source}.devices.`) || !id.endsWith('.pairing.trusted')) throw error('EOS_MIGRATION_EEBUS_TRUST_UNAVAILABLE');
        if (state?.val !== true) continue;
        const pin = await context.owner.getForeignStateAsync(id.replace(/\.trusted$/, '.pinnedFingerprint'));
        if (pin?.ack !== true || typeof pin.val !== 'string' || !/^[A-Fa-f0-9]{64}$/.test(pin.val)) throw error('EOS_MIGRATION_EEBUS_REPAIR_REQUIRED');
    }
    const filename = join(context.dataDir, 'ship-identity.json');
    async function verifyDirectory(): Promise<void> {
        try {
            const stat = await lstat(context.dataDir);
            if (!stat.isDirectory() || stat.isSymbolicLink() || (stat.mode & 0o077)) throw error('EOS_MIGRATION_EEBUS_IDENTITY_PERMISSIONS');
        } catch (caught) {
            if (caught && typeof caught === 'object' && 'code' in caught && caught.code === 'ENOENT') return;
            throw caught;
        }
    }
    async function verifyExisting(): Promise<boolean> {
        try {
            const file = await open(filename, constants.O_RDONLY | constants.O_NOFOLLOW);
            try {
                const stat = await file.stat();
                if (!stat.isFile() || stat.size > 65536 || (stat.mode & 0o077)) throw error('EOS_MIGRATION_EEBUS_IDENTITY_PERMISSIONS');
                const found = JSON.parse(await file.readFile('utf8')) as EebusIdentity;
                if (found.certificate !== identity.certificate || found.privateKey !== identity.privateKey || found.shipId !== identity.shipId) throw error('EOS_MIGRATION_EEBUS_IDENTITY_EXISTS');
                return true;
            } finally { await file.close(); }
        } catch (caught) {
            if (caught && typeof caught === 'object' && 'code' in caught && caught.code === 'ENOENT') return false;
            throw caught;
        }
    }
    await verifyDirectory(); await verifyExisting();
    return { config, identityImported: true, async prepareFiles(): Promise<void> {
        if (await verifyExisting()) return;
        await mkdir(context.dataDir, { recursive: true, mode: 0o700 });
        await verifyDirectory();
        const temp = join(context.dataDir, `.identity-migration-${randomUUID()}`);
        const file = await open(temp, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
        try {
            try { await file.writeFile(JSON.stringify(identity)); await file.sync(); }
            finally { await file.close(); }
            // link installs the complete bytes without replacing another identity.
            await link(temp, filename);
        } finally { await rm(temp, { force: true }); }
    } };
}
