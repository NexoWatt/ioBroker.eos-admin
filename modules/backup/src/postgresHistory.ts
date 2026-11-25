/** Copyright (c) 2026 NexoWatt. Confidential and proprietary. */
import { constants } from 'node:fs';
import { open, lstat, writeFile } from 'node:fs/promises';
import { join, dirname, parse } from 'node:path';
import { X509Certificate } from 'node:crypto';
import { run, executable } from './command';
import { fail, record } from './types';
export interface PostgresBackupProfile { schemaVersion: 1; provider: 'postgresql'; host: '127.0.0.1'; port: number; database: string; user: string; password: string; caFile: string; servername: 'localhost'; schema: 'eos_history' }
async function trustedFile(path: string, maximum: number, privateFile: boolean): Promise<Buffer> {
    let parent = dirname(path);
    while (true) {
        const info = await lstat(parent);
        if (!info.isDirectory() || info.isSymbolicLink() || info.uid !== 0 || (info.mode & 0o022) !== 0) throw fail('EOS_BACKUP_POSTGRES_PROFILE_PERMISSIONS');
        if (parent === parse(parent).root) break;
        parent = dirname(parent);
    }
    const fd = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
        const st = await fd.stat();
        if (!st.isFile() || st.nlink !== 1 || st.uid !== 0 || (st.mode & (privateFile ? 0o027 : 0o022)) !== 0 || st.size < 1 || st.size > maximum) throw fail('EOS_BACKUP_POSTGRES_PROFILE_PERMISSIONS');
        const bytes = Buffer.alloc(maximum + 1);
        let length = 0;
        while (length < bytes.length) { const result = await fd.read(bytes, length, bytes.length - length, null); if (!result.bytesRead) break; length += result.bytesRead; }
        if (length > maximum) throw fail('EOS_BACKUP_POSTGRES_PROFILE_SIZE');
        return bytes.subarray(0, length);
    } finally { await fd.close(); }
}
export function validatePostgresProfile(value: unknown, namespace: string): PostgresBackupProfile {
    if (!/^eos-admin\.\d+$/.test(namespace)) throw fail('EOS_BACKUP_POSTGRES_NAMESPACE');
    const instance = namespace.slice('eos-admin.'.length);
    if (!record(value) || value.schemaVersion !== 1 || value.provider !== 'postgresql' || value.provisioned !== true || value.newInstallation !== true ||
        value.host !== '127.0.0.1' || value.port !== 55432 || value.database !== `eos_history_${instance}` || value.user !== `eos_history_${instance}_backup` ||
        typeof value.password !== 'string' || value.password.length < 32 || value.password.length > 256 || /[\0\r\n]/.test(value.password) ||
        value.caFile !== '/etc/nexowatt-eos/postgresql/ca.crt' || value.servername !== 'localhost' || value.schema !== 'eos_history') throw fail('EOS_BACKUP_POSTGRES_PROFILE');
    return { schemaVersion: 1, provider: 'postgresql', host: '127.0.0.1', port: value.port, database: value.database, user: value.user, password: value.password, caFile: value.caFile, servername: 'localhost', schema: 'eos_history' };
}
export async function loadPostgresProfile(namespace: string): Promise<PostgresBackupProfile> {
    if (!/^eos-admin\.\d+$/.test(namespace)) throw fail('EOS_BACKUP_POSTGRES_NAMESPACE');
    const bytes = await trustedFile(`/etc/nexowatt-eos/postgresql/backup-${namespace}.json`, 16384, true);
    const profile = validatePostgresProfile(JSON.parse(bytes.toString()) as unknown, namespace);
    bytes.fill(0);
    const ca = await trustedFile(profile.caFile, 32768, false);
    const cert = new X509Certificate(ca);
    if (!cert.ca || Date.parse(cert.validFrom) > Date.now() || Date.parse(cert.validTo) <= Date.now()) throw fail('EOS_BACKUP_POSTGRES_CA');
    return profile;
}
export async function exportPostgresHistory(namespace: string, folder: string): Promise<void> {
    const profile = await loadPostgresProfile(namespace);
    await exportVerifiedPostgresProfile(profile, namespace, folder);
}
/** Internal boundary after protected-profile verification; not exposed through the module/API. */
export async function exportVerifiedPostgresProfile(profile: PostgresBackupProfile, namespace: string, folder: string): Promise<void> {
    const output = join(folder, 'database.dump');
    await run(await executable('pg_dump'), ['--host', profile.host, '--port', String(profile.port), '--username', profile.user,
        '--format=custom', '--data-only', '--schema=eos_history', '--table=eos_history.samples', '--no-owner', '--no-privileges', '--dbname', profile.database],
    { cwd: folder, output, environment: { PGPASSWORD: profile.password, PGSSLMODE: 'verify-full', PGSSLROOTCERT: profile.caFile, PGCONNECT_TIMEOUT: '5', PGOPTIONS: '-c statement_timeout=600000 -c lock_timeout=5000' } });
    const fd = await open(output, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
        const magic = Buffer.alloc(5); await fd.read(magic, 0, 5, 0);
        if (!magic.equals(Buffer.from('PGDMP')) || (await fd.stat()).size < 16) throw fail('EOS_BACKUP_POSTGRES_DUMP');
    } finally { await fd.close(); }
    await writeFile(join(folder, 'restore-requirements.json'), JSON.stringify({ schema: 'nexowatt-postgresql-restore/v1', namespace,
        database: profile.database, schemaName: profile.schema, tls: 'verify-full', rolesFrom: 'trusted EOS provisioning tool',
        privilegesFromArchive: false, schemaFromArchive: false, restoreFlags: ['--data-only', '--no-owner', '--no-privileges', '--schema=eos_history', '--table=samples'],
        requiresIsolatedTarget: true, containsRolePasswords: false }, null, 2), { flag: 'wx', mode: 0o600 });
}
