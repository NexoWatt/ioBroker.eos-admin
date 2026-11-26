"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validatePostgresProfile = validatePostgresProfile;
exports.loadPostgresProfile = loadPostgresProfile;
exports.exportPostgresHistory = exportPostgresHistory;
exports.exportVerifiedPostgresProfile = exportVerifiedPostgresProfile;
/** Copyright (c) 2026 NexoWatt. Confidential and proprietary. */
const node_fs_1 = require("node:fs");
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const node_crypto_1 = require("node:crypto");
const command_1 = require("./command");
const types_1 = require("./types");
async function trustedFile(path, maximum, privateFile) {
    let parent = (0, node_path_1.dirname)(path);
    while (true) {
        const info = await (0, promises_1.lstat)(parent);
        if (!info.isDirectory() || info.isSymbolicLink() || info.uid !== 0 || (info.mode & 0o022) !== 0)
            throw (0, types_1.fail)('EOS_BACKUP_POSTGRES_PROFILE_PERMISSIONS');
        if (parent === (0, node_path_1.parse)(parent).root)
            break;
        parent = (0, node_path_1.dirname)(parent);
    }
    const fd = await (0, promises_1.open)(path, node_fs_1.constants.O_RDONLY | node_fs_1.constants.O_NOFOLLOW);
    try {
        const st = await fd.stat();
        if (!st.isFile() || st.nlink !== 1 || st.uid !== 0 || (st.mode & (privateFile ? 0o027 : 0o022)) !== 0 || st.size < 1 || st.size > maximum)
            throw (0, types_1.fail)('EOS_BACKUP_POSTGRES_PROFILE_PERMISSIONS');
        const bytes = Buffer.alloc(maximum + 1);
        let length = 0;
        while (length < bytes.length) {
            const result = await fd.read(bytes, length, bytes.length - length, null);
            if (!result.bytesRead)
                break;
            length += result.bytesRead;
        }
        if (length > maximum)
            throw (0, types_1.fail)('EOS_BACKUP_POSTGRES_PROFILE_SIZE');
        return bytes.subarray(0, length);
    }
    finally {
        await fd.close();
    }
}
function validatePostgresProfile(value, namespace) {
    if (!/^eos-admin\.\d+$/.test(namespace))
        throw (0, types_1.fail)('EOS_BACKUP_POSTGRES_NAMESPACE');
    const instance = namespace.slice('eos-admin.'.length);
    if (!(0, types_1.record)(value) || value.schemaVersion !== 1 || value.provider !== 'postgresql' || value.provisioned !== true || value.newInstallation !== true ||
        value.host !== '127.0.0.1' || value.port !== 55432 || value.database !== `eos_history_${instance}` || value.user !== `eos_history_${instance}_backup` ||
        typeof value.password !== 'string' || value.password.length < 32 || value.password.length > 256 || /[\0\r\n]/.test(value.password) ||
        value.caFile !== '/etc/nexowatt-eos/postgresql/ca.crt' || value.servername !== 'localhost' || value.schema !== 'eos_history')
        throw (0, types_1.fail)('EOS_BACKUP_POSTGRES_PROFILE');
    return { schemaVersion: 1, provider: 'postgresql', host: '127.0.0.1', port: value.port, database: value.database, user: value.user, password: value.password, caFile: value.caFile, servername: 'localhost', schema: 'eos_history' };
}
async function loadPostgresProfile(namespace) {
    if (!/^eos-admin\.\d+$/.test(namespace))
        throw (0, types_1.fail)('EOS_BACKUP_POSTGRES_NAMESPACE');
    const bytes = await trustedFile(`/etc/nexowatt-eos/postgresql/backup-${namespace}.json`, 16384, true);
    const profile = validatePostgresProfile(JSON.parse(bytes.toString()), namespace);
    bytes.fill(0);
    const ca = await trustedFile(profile.caFile, 32768, false);
    const cert = new node_crypto_1.X509Certificate(ca);
    if (!cert.ca || Date.parse(cert.validFrom) > Date.now() || Date.parse(cert.validTo) <= Date.now())
        throw (0, types_1.fail)('EOS_BACKUP_POSTGRES_CA');
    return profile;
}
async function exportPostgresHistory(namespace, folder) {
    const profile = await loadPostgresProfile(namespace);
    await exportVerifiedPostgresProfile(profile, namespace, folder);
}
/** Internal boundary after protected-profile verification; not exposed through the module/API. */
async function exportVerifiedPostgresProfile(profile, namespace, folder) {
    const output = (0, node_path_1.join)(folder, 'database.dump');
    await (0, command_1.run)(await (0, command_1.executable)('pg_dump'), ['--host', profile.host, '--port', String(profile.port), '--username', profile.user,
        '--format=custom', '--data-only', '--schema=eos_history', '--table=eos_history.samples', '--no-owner', '--no-privileges', '--dbname', profile.database], { cwd: folder, output, environment: { PGPASSWORD: profile.password, PGSSLMODE: 'verify-full', PGSSLROOTCERT: profile.caFile, PGCONNECT_TIMEOUT: '5', PGOPTIONS: '-c statement_timeout=600000 -c lock_timeout=5000' } });
    const fd = await (0, promises_1.open)(output, node_fs_1.constants.O_RDONLY | node_fs_1.constants.O_NOFOLLOW);
    try {
        const magic = Buffer.alloc(5);
        await fd.read(magic, 0, 5, 0);
        if (!magic.equals(Buffer.from('PGDMP')) || (await fd.stat()).size < 16)
            throw (0, types_1.fail)('EOS_BACKUP_POSTGRES_DUMP');
    }
    finally {
        await fd.close();
    }
    await (0, promises_1.writeFile)((0, node_path_1.join)(folder, 'restore-requirements.json'), JSON.stringify({ schema: 'nexowatt-postgresql-restore/v1', namespace,
        database: profile.database, schemaName: profile.schema, tls: 'verify-full', rolesFrom: 'trusted EOS provisioning tool',
        privilegesFromArchive: false, schemaFromArchive: false, restoreFlags: ['--data-only', '--no-owner', '--no-privileges', '--schema=eos_history', '--table=samples'],
        requiresIsolatedTarget: true, containsRolePasswords: false }, null, 2), { flag: 'wx', mode: 0o600 });
}
