/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Liest ausschließlich die festgelegten npm-Metadaten und das signierte EOS-Paket mit harten Größen- und Zeitgrenzen.
 * Daten und Wirkung: HTTPS-Antworten werden begrenzt, Signaturen und Paketidentität vor jeder Installationsvorbereitung geprüft. Es werden keine Befehle ausgeführt.
 * Bei Änderungen: Registry-Vertrauensquelle, Abbruch, Archivpfade, Signaturen und Versionsvergleiche gemeinsam negativ prüfen.
 */
import { createHash, createPublicKey, verify } from 'node:crypto';
import { createReadStream } from 'node:fs';
import * as https from 'node:https';
import { createGunzip } from 'node:zlib';
import semver from 'semver';

export const UPDATE_PACKAGE = 'iobroker.eos-admin';
export const UPDATE_REGISTRY = 'https://registry.npmjs.org';
export const UPDATE_METADATA_URL = `${UPDATE_REGISTRY}/${UPDATE_PACKAGE}/latest`;
export const UPDATE_KEYS_URL = `${UPDATE_REGISTRY}/-/npm/v1/keys`;
export const UPDATE_MAX_ARCHIVE_BYTES = 64 * 1024 * 1024;
const MAX_EXPANDED_BYTES = 256 * 1024 * 1024;
export const updateError = (code: string): Error => new Error(`EOS_UPDATE_${code}`);
export const isRecord = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === 'object' && !Array.isArray(value);
export const stableVersion = (value: unknown): value is string =>
    typeof value === 'string' &&
    /^(0|[1-9]\d{0,4})\.(0|[1-9]\d{0,4})\.(0|[1-9]\d{0,4})$/.test(value) &&
    !!semver.valid(value);

export interface UpdateCandidate {
    version: string;
    integrity: string;
    tarball: string;
    engines: string;
    signatures: Array<{ keyid: string; sig: string }>;
}
export interface UpdateFileDigest {
    path: string;
    sha256: string;
}
export interface UpdateArchive {
    files: UpdateFileDigest[];
    packageJsonSha256: string;
}
export type UpdateFetch = (url: string, maximum: number, signal: AbortSignal) => Promise<Buffer>;

/** A caller owns one five-second signal for its whole external transaction. */
export function fetchUpdateResource(url: string, maximum: number, signal: AbortSignal): Promise<Buffer> {
    const allowed =
        url === UPDATE_METADATA_URL ||
        url === UPDATE_KEYS_URL ||
        /^https:\/\/registry\.npmjs\.org\/iobroker\.eos-admin\/-\/iobroker\.eos-admin-\d{1,5}\.\d{1,5}\.\d{1,5}\.tgz$/.test(
            url,
        );
    if (!allowed || !Number.isSafeInteger(maximum) || maximum < 1 || maximum > UPDATE_MAX_ARCHIVE_BYTES) {
        return Promise.reject(updateError('SOURCE'));
    }
    return new Promise((resolve, reject) => {
        if (signal.aborted) {
            reject(updateError('ABORTED'));
            return;
        }
        let settled = false;
        const finish = (error?: Error, data?: Buffer): void => {
            if (settled) {
                return;
            }
            settled = true;
            if (error) {
                reject(error);
            } else {
                resolve(data || Buffer.alloc(0));
            }
        };
        const request = https.get(
            url,
            {
                signal,
                agent: false,
                rejectUnauthorized: true,
                headers: {
                    Accept: 'application/json, application/octet-stream',
                    'Accept-Encoding': 'identity',
                    'User-Agent': 'NexoWatt-EOS-Update',
                },
            },
            response => {
                const declared = response.headers['content-length'];
                if (
                    response.statusCode !== 200 ||
                    (declared !== undefined && (!/^\d+$/.test(declared) || Number(declared) > maximum)) ||
                    (response.headers['content-encoding'] && response.headers['content-encoding'] !== 'identity')
                ) {
                    response.destroy();
                    request.destroy();
                    finish(updateError('HTTP'));
                    return;
                }
                const chunks: Buffer[] = [];
                let length = 0;
                response.on('data', (chunk: Buffer) => {
                    length += chunk.length;
                    if (length > maximum) {
                        response.destroy();
                        request.destroy();
                        finish(updateError('SIZE'));
                        return;
                    }
                    chunks.push(chunk);
                });
                response.on('end', () => finish(undefined, Buffer.concat(chunks, length)));
                response.on('aborted', () => finish(updateError('ABORTED')));
                response.on('error', () => finish(updateError('NETWORK')));
            },
        );
        request.on('error', () => finish(updateError(signal.aborted ? 'ABORTED' : 'NETWORK')));
    });
}

export function parseCandidate(data: Buffer, currentVersion: string, nodeVersion: string): UpdateCandidate {
    let value: unknown;
    try {
        value = JSON.parse(data.toString('utf8'));
    } catch {
        throw updateError('METADATA');
    }
    if (
        !isRecord(value) ||
        value.name !== UPDATE_PACKAGE ||
        !stableVersion(value.version) ||
        !isRecord(value.dist) ||
        !isRecord(value.engines) ||
        typeof value.engines.node !== 'string' ||
        value.engines.node.length > 256 ||
        !semver.validRange(value.engines.node) ||
        (typeof value.deprecated === 'string' && value.deprecated.length > 0)
    ) {
        throw updateError('METADATA');
    }
    if (!stableVersion(currentVersion) || !semver.valid(nodeVersion)) {
        throw updateError('RUNTIME');
    }
    if (
        semver.major(value.version) !== semver.major(currentVersion) ||
        !semver.satisfies(nodeVersion, value.engines.node)
    ) {
        throw updateError('INCOMPATIBLE');
    }
    const integrity = value.dist.integrity;
    if (
        typeof integrity !== 'string' ||
        !/^sha512-[A-Za-z0-9+/]{86}==$/.test(integrity) ||
        value.dist.tarball !== `${UPDATE_REGISTRY}/${UPDATE_PACKAGE}/-/${UPDATE_PACKAGE}-${value.version}.tgz` ||
        !Array.isArray(value.dist.signatures) ||
        value.dist.signatures.length < 1 ||
        value.dist.signatures.length > 8
    ) {
        throw updateError('SIGNATURE_METADATA');
    }
    const signatures = value.dist.signatures.map((item: unknown) => {
        if (
            !isRecord(item) ||
            typeof item.keyid !== 'string' ||
            !/^SHA256:[A-Za-z0-9+/]{43}=?$/.test(item.keyid) ||
            typeof item.sig !== 'string' ||
            !/^[A-Za-z0-9+/]{80,200}={0,2}$/.test(item.sig)
        ) {
            throw updateError('SIGNATURE_METADATA');
        }
        return { keyid: item.keyid, sig: item.sig };
    });
    return { version: value.version, integrity, tarball: value.dist.tarball, engines: value.engines.node, signatures };
}

/** Registry keys are obtained only from npm's TLS-authenticated key endpoint. This is not a manufacturer signature. */
export function verifyRegistrySignature(candidate: UpdateCandidate, data: Buffer, now: number): void {
    let value: unknown;
    try {
        value = JSON.parse(data.toString('utf8'));
    } catch {
        throw updateError('KEYS');
    }
    if (!isRecord(value) || !Array.isArray(value.keys) || value.keys.length < 1 || value.keys.length > 32) {
        throw updateError('KEYS');
    }
    const payload = Buffer.from(`${UPDATE_PACKAGE}@${candidate.version}:${candidate.integrity}`);
    for (const entry of value.keys) {
        if (
            !isRecord(entry) ||
            typeof entry.keyid !== 'string' ||
            typeof entry.key !== 'string' ||
            entry.key.length > 1024 ||
            entry.keytype !== 'ecdsa-sha2-nistp256' ||
            entry.scheme !== 'ecdsa-sha2-nistp256' ||
            !(
                entry.expires === null ||
                (typeof entry.expires === 'string' &&
                    Number.isFinite(Date.parse(entry.expires)) &&
                    Date.parse(entry.expires) > now)
            )
        ) {
            continue;
        }
        const match = candidate.signatures.find(signature => signature.keyid === entry.keyid);
        if (!match) {
            continue;
        }
        try {
            const bytes = Buffer.from(entry.key, 'base64');
            const key = createPublicKey({ key: bytes, type: 'spki', format: 'der' });
            if (key.asymmetricKeyType !== 'ec' || key.asymmetricKeyDetails?.namedCurve !== 'prime256v1') {
                continue;
            }
            if (verify('sha256', payload, key, Buffer.from(match.sig, 'base64'))) {
                return;
            }
        } catch {
            /* Invalid public metadata is a closed signature failure. */
        }
    }
    throw updateError('SIGNATURE');
}

export function verifyArchiveIntegrity(data: Buffer, integrity: string): void {
    if (`sha512-${createHash('sha512').update(data).digest('base64')}` !== integrity) {
        throw updateError('INTEGRITY');
    }
}

/** Validate the actual npm tar members without extracting or executing their content. */
export async function inspectUpdateArchive(
    filename: string,
    candidate: UpdateCandidate,
    signal?: AbortSignal,
): Promise<UpdateArchive> {
    if (signal?.aborted) {
        throw updateError('ABORTED');
    }
    const source = createReadStream(filename);
    const stream = createGunzip();
    source.on('error', () => stream.destroy(updateError('ARCHIVE_READ')));
    source.pipe(stream);
    const abort = (): void => {
        source.destroy();
        stream.destroy(updateError('ABORTED'));
    };
    signal?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(abort, 5000);
    timer.unref();
    let pending = Buffer.alloc(0),
        expanded = 0,
        remaining = 0,
        padding = 0,
        zeroBlocks = 0;
    let current: { path: string; hash: ReturnType<typeof createHash>; manifest: Buffer[] | null } | null = null;
    let paxData: Buffer[] | null = null,
        paxPath: string | null = null;
    let paxSize: number | null = null;
    const files: UpdateFileDigest[] = [];
    const seen = new Set<string>();
    let manifest: Buffer | null = null;
    let ioManifest: Buffer | null = null;
    const text = (header: Buffer, start: number, end: number): string =>
        header.subarray(start, end).toString('utf8').replace(/\0.*$/s, '');
    const octal = (header: Buffer, start: number, end: number): number => {
        const value = text(header, start, end).trim();
        if (!/^[0-7]{1,12}$/.test(value)) {
            throw updateError('ARCHIVE_HEADER');
        }
        return Number.parseInt(value, 8);
    };
    const finish = (): void => {
        if (current) {
            const digest = current.hash.digest('hex');
            files.push({ path: current.path, sha256: digest });
            if (current.manifest) {
                if (current.path === 'package.json') {
                    manifest = Buffer.concat(current.manifest);
                } else {
                    ioManifest = Buffer.concat(current.manifest);
                }
            }
            current = null;
        }
        if (paxData) {
            const data = Buffer.concat(paxData);
            paxData = null;
            let offset = 0;
            while (offset < data.length) {
                const space = data.indexOf(32, offset),
                    sizeText = data.subarray(offset, space).toString('ascii');
                if (space < offset || !/^\d{1,5}$/.test(sizeText)) {
                    throw updateError('ARCHIVE_PAX');
                }
                const size = Number(sizeText),
                    end = offset + size;
                if (size <= space - offset + 1 || end > data.length || data[end - 1] !== 10) {
                    throw updateError('ARCHIVE_PAX');
                }
                const row = data.subarray(space + 1, end - 1).toString('utf8'),
                    equal = row.indexOf('=');
                const key = row.slice(0, equal),
                    val = row.slice(equal + 1);
                if (
                    equal < 1 ||
                    !['path', 'size', 'mtime', 'atime', 'ctime', 'uid', 'gid', 'uname', 'gname'].includes(key)
                ) {
                    throw updateError('ARCHIVE_PAX');
                }
                if (key === 'path') {
                    if (paxPath !== null) {
                        throw updateError('ARCHIVE_PAX');
                    }
                    paxPath = val;
                }
                if (key === 'size') {
                    if (paxSize !== null || !/^\d{1,9}$/.test(val) || Number(val) > UPDATE_MAX_ARCHIVE_BYTES) {
                        throw updateError('ARCHIVE_PAX');
                    }
                    paxSize = Number(val);
                }
                offset = end;
            }
        }
    };
    try {
        for await (const part of stream) {
            if (!Buffer.isBuffer(part)) {
                throw updateError('ARCHIVE_READ');
            }
            const chunk = part;
            expanded += chunk.length;
            if (expanded > MAX_EXPANDED_BYTES) {
                throw updateError('ARCHIVE_SIZE');
            }
            pending = Buffer.concat([pending, chunk]);
            while (pending.length) {
                if (remaining) {
                    const count = Math.min(remaining, pending.length),
                        bytes = pending.subarray(0, count);
                    current?.hash.update(bytes);
                    current?.manifest?.push(Buffer.from(bytes));
                    paxData?.push(Buffer.from(bytes));
                    remaining -= count;
                    pending = pending.subarray(count);
                    if (!remaining) {
                        finish();
                    }
                    continue;
                }
                if (padding) {
                    const count = Math.min(padding, pending.length);
                    padding -= count;
                    pending = pending.subarray(count);
                    continue;
                }
                if (pending.length < 512) {
                    break;
                }
                const header = pending.subarray(0, 512);
                pending = pending.subarray(512);
                if (header.every(byte => byte === 0)) {
                    zeroBlocks++;
                    continue;
                }
                if (zeroBlocks) {
                    throw updateError('ARCHIVE_TRAILING');
                }
                const checksum = octal(header, 148, 156);
                let sum = 0;
                for (let index = 0; index < 512; index++) {
                    sum += index >= 148 && index < 156 ? 32 : header[index] || 0;
                }
                if (sum !== checksum) {
                    throw updateError('ARCHIVE_HEADER');
                }
                const size = octal(header, 124, 136),
                    type = text(header, 156, 157),
                    prefix = text(header, 345, 500);
                const path = paxPath || `${prefix ? `${prefix}/` : ''}${text(header, 0, 100)}`;
                if (type !== 'x') {
                    if (paxSize !== null && paxSize !== size) {
                        throw updateError('ARCHIVE_PAX');
                    }
                    paxPath = null;
                    paxSize = null;
                }
                if (!Number.isSafeInteger(size) || size < 0 || size > UPDATE_MAX_ARCHIVE_BYTES) {
                    throw updateError('ARCHIVE_SIZE');
                }
                remaining = size;
                padding = (512 - (size % 512)) % 512;
                if (type === 'x') {
                    if (size > 16384) {
                        throw updateError('ARCHIVE_PAX');
                    }
                    paxData = [];
                } else {
                    if (
                        !path.startsWith('package/') ||
                        path.length > 520 ||
                        path.includes('\\') ||
                        path.includes(':') ||
                        path.includes('\ufffd') ||
                        Array.from(path).some(
                            character => character.charCodeAt(0) <= 32 || character.charCodeAt(0) === 127,
                        ) ||
                        path
                            .split('/')
                            .some(segment => segment === '.' || segment === '..' || segment === 'node_modules')
                    ) {
                        throw updateError('ARCHIVE_PATH');
                    }
                    const relative = path.slice(8).replace(/\/$/, '');
                    if (relative.split('/').some(segment => segment === '') && relative !== '') {
                        throw updateError('ARCHIVE_PATH');
                    }
                    if (type === '5') {
                        if (size !== 0) {
                            throw updateError('ARCHIVE_HEADER');
                        }
                    } else if (type === '0' || type === '') {
                        if (!relative || seen.has(relative) || seen.size >= 8192) {
                            throw updateError('ARCHIVE_DUPLICATE');
                        }
                        seen.add(relative);
                        if (
                            (relative === 'package.json' && size > 65536) ||
                            (relative === 'io-package.json' && size > 1024 * 1024)
                        ) {
                            throw updateError('ARCHIVE_MANIFEST');
                        }
                        current = {
                            path: relative,
                            hash: createHash('sha256'),
                            manifest: relative === 'package.json' || relative === 'io-package.json' ? [] : null,
                        };
                    } else {
                        throw updateError('ARCHIVE_LINK');
                    }
                }
                if (!remaining) {
                    finish();
                }
            }
        }
        if (
            remaining ||
            padding ||
            pending.some(byte => byte !== 0) ||
            zeroBlocks < 2 ||
            !manifest ||
            !ioManifest ||
            paxPath !== null ||
            paxSize !== null ||
            files.length < 2
        ) {
            throw updateError('ARCHIVE_INCOMPLETE');
        }
        const parseManifest = (value: unknown): unknown => {
            if (!Buffer.isBuffer(value)) {
                throw updateError('ARCHIVE_MANIFEST');
            }
            try {
                return JSON.parse(value.toString('utf8'));
            } catch {
                throw updateError('ARCHIVE_MANIFEST');
            }
        };
        const packageJson = parseManifest(manifest);
        const ioPackage = parseManifest(ioManifest);
        if (
            !isRecord(packageJson) ||
            packageJson.name !== UPDATE_PACKAGE ||
            packageJson.version !== candidate.version ||
            !isRecord(ioPackage) ||
            !isRecord(ioPackage.common) ||
            ioPackage.common.name !== 'eos-admin' ||
            ioPackage.common.version !== candidate.version ||
            !isRecord(packageJson.engines) ||
            packageJson.engines.node !== candidate.engines
        ) {
            throw updateError('ARCHIVE_IDENTITY');
        }
        return { files, packageJsonSha256: createHash('sha256').update(manifest).digest('hex') };
    } finally {
        clearTimeout(timer);
        signal?.removeEventListener('abort', abort);
        source.destroy();
        stream.destroy();
    }
}
