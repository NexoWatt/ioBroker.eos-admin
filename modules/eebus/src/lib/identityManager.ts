import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { chmod, mkdir, mkdtemp, open, readFile, rm, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { EebusConfig } from './config';
import { EebusIdentity } from './eebusTypes';
import { sanitizeCertificateSubjectValue } from './sanitizer';
import { validateKeyPair } from './certificateIdentity';

const execFileAsync = promisify(execFile);
/** Device SHIP identity belongs to this installation, never to npm/native UI config. */
export class IdentityManager {
    public constructor(private readonly dataDir: string, private readonly config: EebusConfig) {}
    public async ensureIdentity(): Promise<EebusIdentity> {
        await mkdir(this.dataDir, { recursive: true, mode: 0o700 });
        await chmod(this.dataDir, 0o700);
        const filename = join(this.dataDir, 'ship-identity.json');
        try {
            const handle = await open(filename, constants.O_RDONLY | constants.O_NOFOLLOW);
            try {
                const stat = await handle.stat();
                if (!stat.isFile() || stat.size > 65536 || (stat.mode & 0o077)) throw new Error('EEBUS_IDENTITY_PERMISSIONS');
                const value: unknown = JSON.parse(await handle.readFile('utf8'));
                return validateIdentity(value);
            } finally { await handle.close(); }
        } catch (error) {
            if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') throw error;
        }
        const generated = await this.generateIdentity();
        const temp = `${filename}.${randomUUID()}.tmp`;
        const file = await open(temp, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
        try { await file.writeFile(JSON.stringify(generated)); await file.sync(); }
        finally { await file.close(); }
        try { await rename(temp, filename); }
        catch (error) { await rm(temp, { force: true }); throw error; }
        return generated;
    }
    private async generateIdentity(): Promise<EebusIdentity> {
        const workDir = await mkdtemp(join(this.dataDir, '.identity-'));
        const keyFile = join(workDir, 'local.key');
        const certFile = join(workDir, 'local.crt');
        const subject = `/CN=${sanitizeCertificateSubjectValue(this.config.serviceName)}/O=${sanitizeCertificateSubjectValue(this.config.brand, 'NexoWatt')}`;
        try {
            await execFileAsync('openssl', ['req', '-new', '-x509', '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:prime256v1',
                '-nodes', '-keyout', keyFile, '-out', certFile, '-sha256', '-days', '3650', '-subj', subject,
                '-addext', 'subjectKeyIdentifier=hash'], { timeout: 5000, maxBuffer: 65536 });
            const privateKey = await readFile(keyFile, 'utf8');
            const certificate = await readFile(certFile, 'utf8');
            const checked = validateKeyPair(certificate, privateKey);
            return { certificate, privateKey, localSki: checked.ski, certificateFingerprint: checked.fingerprint,
                shipId: `i:${this.config.ianaPen}_u:${randomUUID().replace(/-/g, '')}`, createdAt: new Date().toISOString() };
        } catch { throw new Error('EEBUS_IDENTITY_GENERATION_FAILED'); }
        finally { await rm(workDir, { recursive: true, force: true }); }
    }
}
function validateIdentity(value: unknown): EebusIdentity {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('EEBUS_IDENTITY_INVALID');
    const row = value as Record<string, unknown>;
    if (typeof row.certificate !== 'string' || typeof row.privateKey !== 'string' || typeof row.shipId !== 'string' ||
        !/^i:\d{1,6}_u:[a-fA-F0-9]{32}$/.test(row.shipId)) throw new Error('EEBUS_IDENTITY_INVALID');
    const checked = validateKeyPair(row.certificate, row.privateKey);
    if (row.localSki !== checked.ski || row.certificateFingerprint !== checked.fingerprint) throw new Error('EEBUS_IDENTITY_MISMATCH');
    return { certificate: row.certificate, privateKey: row.privateKey, shipId: row.shipId, localSki: checked.ski,
        certificateFingerprint: checked.fingerprint, createdAt: typeof row.createdAt === 'string' ? row.createdAt : '' };
}
