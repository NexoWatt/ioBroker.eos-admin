/**
 * NexoWatt PostgreSQL prerequisite inspection.
 * Reads only root-provisioned, local profiles. It never installs packages,
 * starts a privileged process, returns credentials or switches a historian.
 */
import { constants } from 'node:fs';
import * as fs from 'node:fs/promises';
import { X509Certificate } from 'node:crypto';

export interface EosPostgresProvisioningStatus {
    schema: 1;
    provider: 'postgresql';
    status: 'setup-required' | 'configured' | 'invalid';
    code: string;
    namespace: string;
    localOnly: true;
    tlsRequired: true;
    administratorBootstrapRequired: boolean;
    connectionVerified: false;
    database?: string;
    schemaRevision?: number;
    verifiedAt?: number;
}

const ROOT = '/etc/nexowatt-eos/postgresql';
const record = (value: unknown): value is Record<string, unknown> =>
    !!value && typeof value === 'object' && !Array.isArray(value);

export function eosPostgresProfilePaths(namespace: string): {
    runtime: string;
    backup: string;
    ready: string;
    ca: string;
    database: string;
} {
    if (!/^eos-admin\.(0|[1-9]\d{0,3})$/.test(namespace)) {
        throw new Error('EOS_POSTGRES_NAMESPACE_INVALID');
    }
    return {
        runtime: `${ROOT}/client-${namespace}.json`,
        backup: `${ROOT}/backup-${namespace}.json`,
        ready: `${ROOT}/ready-${namespace}.json`,
        ca: `${ROOT}/ca.crt`,
        database: `eos_history_${namespace.split('.')[1]}`,
    };
}

/** Validation is exported for tests; it does not confer trust on input files. */
export function validateEosPostgresProvisioningDocuments(
    namespace: string,
    ready: unknown,
    runtime: unknown,
    backup: unknown,
    now = Date.now(),
): boolean {
    const paths = eosPostgresProfilePaths(namespace);
    if (
        !record(ready) ||
        ready.schemaVersion !== 1 ||
        ready.namespace !== namespace ||
        ready.provider !== 'postgresql' ||
        ready.newInstallation !== true ||
        ready.provisioned !== true ||
        ready.major !== 17 ||
        ready.port !== 55432 ||
        ready.schemaRevision !== 1 ||
        typeof ready.verifiedAt !== 'number' ||
        !Number.isSafeInteger(ready.verifiedAt) ||
        ready.verifiedAt <= 0 ||
        ready.verifiedAt > now + 60_000 ||
        typeof ready.serverVersion !== 'string' ||
        !/^postgres \(PostgreSQL\) 17\.\d[^\r\n]{0,120}$/.test(ready.serverVersion)
    ) {
        return false;
    }
    for (const [value, suffix] of [
        [runtime, 'runtime'],
        [backup, 'backup'],
    ] as const) {
        if (
            !record(value) ||
            value.schemaVersion !== 1 ||
            value.provider !== 'postgresql' ||
            value.provisioned !== true ||
            value.newInstallation !== true ||
            value.host !== '127.0.0.1' ||
            value.port !== 55432 ||
            value.servername !== 'localhost' ||
            value.caFile !== paths.ca ||
            value.database !== paths.database ||
            value.user !== `${paths.database}_${suffix}` ||
            value.schema !== 'eos_history' ||
            typeof value.password !== 'string' ||
            !/^[a-f0-9]{64}$/.test(value.password) ||
            Object.keys(value).some(
                key =>
                    ![
                        'schemaVersion',
                        'provider',
                        'provisioned',
                        'newInstallation',
                        'host',
                        'port',
                        'database',
                        'user',
                        'password',
                        'caFile',
                        'servername',
                        'schema',
                    ].includes(key),
            )
        ) {
            return false;
        }
    }
    return true;
}

async function rootProtectedFile(file: string): Promise<string> {
    for (const directory of ['/etc', '/etc/nexowatt-eos', ROOT]) {
        const stat = await fs.lstat(directory);
        if (
            !stat.isDirectory() ||
            stat.isSymbolicLink() ||
            stat.uid !== 0 ||
            (stat.mode & 0o022) !== 0 ||
            (await fs.realpath(directory)) !== directory
        ) {
            throw new Error('EOS_POSTGRES_PROFILE_PERMISSIONS');
        }
    }
    const handle = await fs.open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
        const stat = await handle.stat();
        if (!stat.isFile() || stat.uid !== 0 || (stat.mode & 0o137) !== 0 || stat.size === 0 || stat.size > 16384) {
            throw new Error('EOS_POSTGRES_PROFILE_PERMISSIONS');
        }
        return await handle.readFile('utf8');
    } finally {
        await handle.close();
    }
}

export async function getEosPostgresProvisioningStatus(namespace: string): Promise<EosPostgresProvisioningStatus> {
    const base = {
        schema: 1 as const,
        provider: 'postgresql' as const,
        namespace,
        localOnly: true as const,
        tlsRequired: true as const,
        connectionVerified: false as const,
    };
    try {
        const paths = eosPostgresProfilePaths(namespace);
        const [readyText, runtimeText, backupText, caText] = await Promise.all([
            rootProtectedFile(paths.ready),
            rootProtectedFile(paths.runtime),
            rootProtectedFile(paths.backup),
            rootProtectedFile(paths.ca),
        ]);
        const ready: unknown = JSON.parse(readyText);
        const runtime: unknown = JSON.parse(runtimeText);
        const backup: unknown = JSON.parse(backupText);
        if (!validateEosPostgresProvisioningDocuments(namespace, ready, runtime, backup) || !record(ready)) {
            throw new Error('EOS_POSTGRES_PROFILE_INVALID');
        }
        const ca = new X509Certificate(caText);
        const now = Date.now();
        if (!ca.ca || Date.parse(ca.validFrom) > now || Date.parse(ca.validTo) <= now || !ca.verify(ca.publicKey)) {
            throw new Error('EOS_POSTGRES_CA_INVALID');
        }
        return {
            ...base,
            status: 'configured',
            code: 'EOS_POSTGRES_PROFILE_CONFIGURED',
            administratorBootstrapRequired: false,
            database: paths.database,
            schemaRevision: 1,
            verifiedAt: Number(ready.verifiedAt),
        };
    } catch (error: unknown) {
        const missing = record(error) && error.code === 'ENOENT';
        return {
            ...base,
            status: missing ? 'setup-required' : 'invalid',
            code: missing ? 'EOS_POSTGRES_SETUP_REQUIRED' : 'EOS_POSTGRES_SETUP_INVALID',
            administratorBootstrapRequired: true,
        };
    }
}
