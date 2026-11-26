"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IdentityManager = void 0;
const node_child_process_1 = require("node:child_process");
const node_crypto_1 = require("node:crypto");
const node_fs_1 = require("node:fs");
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const node_util_1 = require("node:util");
const sanitizer_1 = require("./sanitizer");
const certificateIdentity_1 = require("./certificateIdentity");
const execFileAsync = (0, node_util_1.promisify)(node_child_process_1.execFile);
/** Device SHIP identity belongs to this installation, never to npm/native UI config. */
class IdentityManager {
    dataDir;
    config;
    constructor(dataDir, config) {
        this.dataDir = dataDir;
        this.config = config;
    }
    async ensureIdentity() {
        await (0, promises_1.mkdir)(this.dataDir, { recursive: true, mode: 0o700 });
        await (0, promises_1.chmod)(this.dataDir, 0o700);
        const filename = (0, node_path_1.join)(this.dataDir, 'ship-identity.json');
        try {
            const handle = await (0, promises_1.open)(filename, node_fs_1.constants.O_RDONLY | node_fs_1.constants.O_NOFOLLOW);
            try {
                const stat = await handle.stat();
                if (!stat.isFile() || stat.size > 65536 || (stat.mode & 0o077))
                    throw new Error('EEBUS_IDENTITY_PERMISSIONS');
                const value = JSON.parse(await handle.readFile('utf8'));
                return validateIdentity(value);
            }
            finally {
                await handle.close();
            }
        }
        catch (error) {
            if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT')
                throw error;
        }
        const generated = await this.generateIdentity();
        const temp = `${filename}.${(0, node_crypto_1.randomUUID)()}.tmp`;
        const file = await (0, promises_1.open)(temp, node_fs_1.constants.O_WRONLY | node_fs_1.constants.O_CREAT | node_fs_1.constants.O_EXCL | node_fs_1.constants.O_NOFOLLOW, 0o600);
        try {
            await file.writeFile(JSON.stringify(generated));
            await file.sync();
        }
        finally {
            await file.close();
        }
        try {
            await (0, promises_1.rename)(temp, filename);
        }
        catch (error) {
            await (0, promises_1.rm)(temp, { force: true });
            throw error;
        }
        return generated;
    }
    async generateIdentity() {
        const workDir = await (0, promises_1.mkdtemp)((0, node_path_1.join)(this.dataDir, '.identity-'));
        const keyFile = (0, node_path_1.join)(workDir, 'local.key');
        const certFile = (0, node_path_1.join)(workDir, 'local.crt');
        const subject = `/CN=${(0, sanitizer_1.sanitizeCertificateSubjectValue)(this.config.serviceName)}/O=${(0, sanitizer_1.sanitizeCertificateSubjectValue)(this.config.brand, 'NexoWatt')}`;
        try {
            await execFileAsync('openssl', ['req', '-new', '-x509', '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:prime256v1',
                '-nodes', '-keyout', keyFile, '-out', certFile, '-sha256', '-days', '3650', '-subj', subject,
                '-addext', 'subjectKeyIdentifier=hash'], { timeout: 5000, maxBuffer: 65536 });
            const privateKey = await (0, promises_1.readFile)(keyFile, 'utf8');
            const certificate = await (0, promises_1.readFile)(certFile, 'utf8');
            const checked = (0, certificateIdentity_1.validateKeyPair)(certificate, privateKey);
            return { certificate, privateKey, localSki: checked.ski, certificateFingerprint: checked.fingerprint,
                shipId: `i:${this.config.ianaPen}_u:${(0, node_crypto_1.randomUUID)().replace(/-/g, '')}`, createdAt: new Date().toISOString() };
        }
        catch {
            throw new Error('EEBUS_IDENTITY_GENERATION_FAILED');
        }
        finally {
            await (0, promises_1.rm)(workDir, { recursive: true, force: true });
        }
    }
}
exports.IdentityManager = IdentityManager;
function validateIdentity(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new Error('EEBUS_IDENTITY_INVALID');
    const row = value;
    if (typeof row.certificate !== 'string' || typeof row.privateKey !== 'string' || typeof row.shipId !== 'string' ||
        !/^i:\d{1,6}_u:[a-fA-F0-9]{32}$/.test(row.shipId))
        throw new Error('EEBUS_IDENTITY_INVALID');
    const checked = (0, certificateIdentity_1.validateKeyPair)(row.certificate, row.privateKey);
    if (row.localSki !== checked.ski || row.certificateFingerprint !== checked.fingerprint)
        throw new Error('EEBUS_IDENTITY_MISMATCH');
    return { certificate: row.certificate, privateKey: row.privateKey, shipId: row.shipId, localSki: checked.ski,
        certificateFingerprint: checked.fingerprint, createdAt: typeof row.createdAt === 'string' ? row.createdAt : '' };
}
