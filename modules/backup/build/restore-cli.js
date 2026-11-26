"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.installRecoveryKey = installRecoveryKey;
exports.prepareRestore = prepareRestore;
exports.prepareRestoreSet = prepareRestoreSet;
/**
 * Copyright (c) 2026 NexoWatt. Proprietary EOS integration.
 * Retained upstream MIT rights and notices remain applicable; see ../upstream/LICENSE.
 */
const node_fs_1 = require("node:fs");
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const node_crypto_1 = require("node:crypto");
const files_1 = require("./files");
const types_1 = require("./types");
const preflight_1 = require("./preflight");
async function recoveryKey(path) {
    const fd = await (0, promises_1.open)(path, node_fs_1.constants.O_RDONLY | node_fs_1.constants.O_NOFOLLOW);
    let value;
    try {
        const info = await fd.stat();
        if (!info.isFile() || info.size > 4096)
            throw (0, types_1.fail)('EOS_BACKUP_KEY_INVALID');
        value = JSON.parse(await fd.readFile('utf8'));
    }
    finally {
        await fd.close();
    }
    if (!(0, types_1.record)(value) || value.format !== 'nexowatt-eos-recovery-key/v1' || typeof value.key !== 'string')
        throw (0, types_1.fail)('EOS_BACKUP_KEY_INVALID');
    const key = Buffer.from(value.key, 'base64');
    if (key.length !== 32 ||
        (typeof value.fingerprint === 'string' && (0, node_crypto_1.createHash)('sha256').update(key).digest('hex') !== value.fingerprint)) {
        key.fill(0);
        throw (0, types_1.fail)('EOS_BACKUP_KEY_INVALID');
    }
    return key;
}
/** Offline maintenance only. An existing runtime key is never overwritten. */
async function installRecoveryKey(keyPath, dataDir) {
    const key = await recoveryKey(keyPath);
    const target = (0, node_path_1.join)(dataDir, 'recovery.key');
    let created = false;
    try {
        await (0, files_1.privateDir)(dataDir);
        const fd = await (0, promises_1.open)(target, node_fs_1.constants.O_WRONLY | node_fs_1.constants.O_CREAT | node_fs_1.constants.O_EXCL | node_fs_1.constants.O_NOFOLLOW, 0o600);
        created = true;
        try {
            await fd.writeFile(key);
            await fd.sync();
        }
        finally {
            await fd.close();
        }
        return target;
    }
    catch (error) {
        if (created)
            await (0, promises_1.rm)(target, { force: true });
        throw error;
    }
    finally {
        key.fill(0);
    }
}
async function prepareRestore(archive, keyPath, output) {
    if (!files_1.ARCHIVE_NAME.test((0, node_path_1.basename)(archive)))
        throw (0, types_1.fail)('EOS_BACKUP_ARCHIVE_NAME');
    const key = await recoveryKey(keyPath);
    let created = false;
    try {
        await (0, promises_1.mkdir)(output, { mode: 0o700 });
        created = true;
        await (0, files_1.privateDir)(output);
        const destination = (0, node_path_1.join)(output, (0, node_path_1.basename)(archive, '.nwb') + '.archive');
        await (0, files_1.decryptFile)(archive, destination, key, 100 * 1024 ** 3);
        const fd = await (0, promises_1.open)(destination, 'r'), magic = Buffer.alloc(4);
        try {
            await fd.read(magic, 0, 4, 0);
        }
        finally {
            await fd.close();
        }
        let extension = magic[0] === 0x50 && magic[1] === 0x4b
            ? '.zip'
            : magic[0] === 0x1f && magic[1] === 0x8b
                ? '.tar.gz'
                : '.archive';
        if (/-(?:legacy-homematic|ccu)-\d+\.nwb$/.test(archive))
            extension = '.tar.sbk';
        const final = (0, node_path_1.join)(output, (0, node_path_1.basename)(archive, '.nwb') + extension);
        if (final !== destination)
            await (0, promises_1.rename)(destination, final);
        return final;
    }
    catch (error) {
        if (created)
            await (0, promises_1.rm)(output, { recursive: true, force: true });
        throw error;
    }
    finally {
        key.fill(0);
    }
}
/** Verify and prepare the entire matching set; never write controller, DB, role or trust state. */
async function prepareRestoreSet(setArchive, keyPath, output) {
    if (!files_1.ARCHIVE_NAME.test((0, node_path_1.basename)(setArchive)) || !/-recovery-set-\d+\.nwb$/.test(setArchive))
        throw (0, types_1.fail)('EOS_BACKUP_RECOVERY_SET_NAME');
    const key = await recoveryKey(keyPath);
    let created = false;
    try {
        await (0, promises_1.mkdir)(output, { mode: 0o700 });
        created = true;
        await (0, files_1.privateDir)(output);
        const manifestPath = (0, node_path_1.join)(output, 'recovery-set.json');
        await (0, files_1.decryptFile)(setArchive, manifestPath, key, 1024 ** 2);
        const fd = await (0, promises_1.open)(manifestPath, node_fs_1.constants.O_RDONLY | node_fs_1.constants.O_NOFOLLOW);
        let manifest;
        try {
            manifest = JSON.parse(await fd.readFile('utf8'));
        }
        finally {
            await fd.close();
        }
        if (!(0, types_1.record)(manifest) || manifest.format !== 'nexowatt-eos-recovery-set/v1' || typeof manifest.jobId !== 'string' ||
            !/^[0-9a-f-]{36}$/.test(manifest.jobId) || !(0, node_path_1.basename)(setArchive).startsWith('eos-backup-' + manifest.jobId + '-') ||
            !(0, types_1.record)(manifest.coverage) || manifest.coverage.complete !== true || !Array.isArray(manifest.coverage.required) ||
            !Array.isArray(manifest.files) || manifest.files.length < 2 || manifest.files.length > 512)
            throw (0, types_1.fail)('EOS_BACKUP_RECOVERY_SET_INVALID');
        const names = new Set(), kinds = new Set();
        const components = [];
        for (const item of manifest.files) {
            if (!(0, types_1.record)(item) || typeof item.name !== 'string' || !files_1.ARCHIVE_NAME.test(item.name) || names.has(item.name) ||
                !item.name.startsWith('eos-backup-' + manifest.jobId + '-') || typeof item.kind !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(item.kind) || item.kind === 'recovery-set' ||
                !Number.isSafeInteger(item.size) || Number(item.size) < 36 || Number(item.size) > 100 * 1024 ** 3 + 64 || typeof item.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(item.sha256))
                throw (0, types_1.fail)('EOS_BACKUP_RECOVERY_COMPONENT_INVALID');
            const archive = (0, node_path_1.join)((0, node_path_1.dirname)(setArchive), item.name);
            if (await (0, files_1.assertRegular)(archive) !== item.size || await (0, files_1.hashFile)(archive) !== item.sha256)
                throw (0, types_1.fail)('EOS_BACKUP_RECOVERY_COMPONENT_INTEGRITY');
            await (0, preflight_1.assertFreeSpace)(output, Number(item.size) + 64 * 1024 ** 2);
            names.add(item.name);
            kinds.add(item.kind);
            const destination = await prepareRestore(archive, keyPath, (0, node_path_1.join)(output, `component-${components.length}`));
            components.push({ kind: item.kind, file: destination.slice(output.length + 1), sha256: await (0, files_1.hashFile)(destination) });
        }
        if (!kinds.has('iobroker') || !kinds.has('eos-profile') || manifest.coverage.required.some(kind => typeof kind !== 'string' || !kinds.has(kind)))
            throw (0, types_1.fail)('EOS_BACKUP_RECOVERY_COMPONENT_MISSING');
        const plan = (0, node_path_1.join)(output, 'recovery-plan.json');
        await (0, promises_1.writeFile)(plan, JSON.stringify({ schema: 'nexowatt-eos-restore-plan/v1', jobId: manifest.jobId, verified: true,
            files: components, automaticRestore: false, controllerMustBeStopped: true, isolatedTargetRequired: true,
            steps: [
                'Provision the supported operating system, matching controller and database tools using trusted installation media.',
                'Keep EMS actuators disconnected; stop the controller. Restore the ioBroker archive through the controller CLI.',
                'Restore the EOS private profile and preserved legacy data paths with private ownership. Restore the recovery key separately.',
                'Review external integration grants and revoke obsolete identities before enabling access; an older backup can contain grants revoked after its snapshot.',
                'Public license trust requires the existing authorized import or independent manufacturer provisioning; never trust this archive alone.',
                'For InfluxDB restore into a new isolated service; preserve the separately held operator token if required by the server version.',
                'For managed PostgreSQL provision roles, TLS and schema from trusted media first. Inspect the authenticated trusted-source dump before restoring into an empty isolated target with a non-superuser login limited to the required table rights; use --data-only --no-owner --no-privileges --schema=eos_history --table=samples. These filters do not sandbox a malicious archive. Never connect as superuser (including superuser plus --role), or import archived authority/schema.',
                'Compare expected identities, settings and historical sample points; test new writes and restart before reconnecting actuators.'
            ] }, null, 2), { flag: 'wx', mode: 0o600 });
        return plan;
    }
    catch (error) {
        if (created)
            await (0, promises_1.rm)(output, { recursive: true, force: true });
        throw error;
    }
    finally {
        key.fill(0);
    }
}
if (require.main === module) {
    const args = process.argv.slice(2);
    const get = (key) => {
        const i = args.indexOf(key), value = args[i + 1];
        if (i < 0 || !value)
            throw (0, types_1.fail)('EOS_BACKUP_CLI_ARGUMENT');
        return (0, node_path_1.resolve)(value);
    };
    void Promise.resolve()
        .then(() => args.includes('--install-key')
        ? installRecoveryKey(get('--key-file'), get('--data-dir'))
        : args.includes('--set')
            ? prepareRestoreSet(get('--set'), get('--key-file'), get('--output'))
            : prepareRestore(get('--archive'), get('--key-file'), get('--output')))
        .then(path => {
        process.stdout.write('Vorbereitet: ' + path + '\nKeine laufenden Controllerdaten verändert.\n');
    }, error => {
        process.stderr.write((error instanceof Error ? error.message : 'EOS_BACKUP_RESTORE_FAILED') + '\n');
        process.exitCode = 1;
    });
}
