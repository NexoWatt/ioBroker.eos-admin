"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.eosPostgresProfilePaths = eosPostgresProfilePaths;
exports.validateEosPostgresProvisioningDocuments = validateEosPostgresProvisioningDocuments;
exports.getEosPostgresProvisioningStatus = getEosPostgresProvisioningStatus;
/**
 * NexoWatt PostgreSQL prerequisite inspection.
 * Reads only root-provisioned, local profiles. It never installs packages,
 * starts a privileged process, returns credentials or switches a historian.
 */
const node_fs_1 = require("node:fs");
const fs = __importStar(require("node:fs/promises"));
const node_crypto_1 = require("node:crypto");
const ROOT = '/etc/nexowatt-eos/postgresql';
const record = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
function eosPostgresProfilePaths(namespace) {
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
function validateEosPostgresProvisioningDocuments(namespace, ready, runtime, backup, now = Date.now()) {
    const paths = eosPostgresProfilePaths(namespace);
    if (!record(ready) ||
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
        !/^postgres \(PostgreSQL\) 17\.\d[^\r\n]{0,120}$/.test(ready.serverVersion)) {
        return false;
    }
    for (const [value, suffix] of [
        [runtime, 'runtime'],
        [backup, 'backup'],
    ]) {
        if (!record(value) ||
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
            Object.keys(value).some(key => ![
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
            ].includes(key))) {
            return false;
        }
    }
    return true;
}
async function rootProtectedFile(file) {
    for (const directory of ['/etc', '/etc/nexowatt-eos', ROOT]) {
        const stat = await fs.lstat(directory);
        if (!stat.isDirectory() ||
            stat.isSymbolicLink() ||
            stat.uid !== 0 ||
            (stat.mode & 0o022) !== 0 ||
            (await fs.realpath(directory)) !== directory) {
            throw new Error('EOS_POSTGRES_PROFILE_PERMISSIONS');
        }
    }
    const handle = await fs.open(file, node_fs_1.constants.O_RDONLY | node_fs_1.constants.O_NOFOLLOW);
    try {
        const stat = await handle.stat();
        if (!stat.isFile() || stat.uid !== 0 || (stat.mode & 0o137) !== 0 || stat.size === 0 || stat.size > 16384) {
            throw new Error('EOS_POSTGRES_PROFILE_PERMISSIONS');
        }
        return await handle.readFile('utf8');
    }
    finally {
        await handle.close();
    }
}
async function getEosPostgresProvisioningStatus(namespace) {
    const base = {
        schema: 1,
        provider: 'postgresql',
        namespace,
        localOnly: true,
        tlsRequired: true,
        connectionVerified: false,
    };
    try {
        const paths = eosPostgresProfilePaths(namespace);
        const [readyText, runtimeText, backupText, caText] = await Promise.all([
            rootProtectedFile(paths.ready),
            rootProtectedFile(paths.runtime),
            rootProtectedFile(paths.backup),
            rootProtectedFile(paths.ca),
        ]);
        const ready = JSON.parse(readyText);
        const runtime = JSON.parse(runtimeText);
        const backup = JSON.parse(backupText);
        if (!validateEosPostgresProvisioningDocuments(namespace, ready, runtime, backup) || !record(ready)) {
            throw new Error('EOS_POSTGRES_PROFILE_INVALID');
        }
        const ca = new node_crypto_1.X509Certificate(caText);
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
    }
    catch (error) {
        const missing = record(error) && error.code === 'ENOENT';
        return {
            ...base,
            status: missing ? 'setup-required' : 'invalid',
            code: missing ? 'EOS_POSTGRES_SETUP_REQUIRED' : 'EOS_POSTGRES_SETUP_INVALID',
            administratorBootstrapRequired: true,
        };
    }
}
//# sourceMappingURL=eosPostgresProvisioning.js.map