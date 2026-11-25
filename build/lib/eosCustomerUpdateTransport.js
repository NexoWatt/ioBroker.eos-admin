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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.stableVersion = exports.isRecord = exports.updateError = exports.UPDATE_MAX_ARCHIVE_BYTES = exports.UPDATE_KEYS_URL = exports.UPDATE_METADATA_URL = exports.UPDATE_REGISTRY = exports.UPDATE_PACKAGE = void 0;
exports.fetchUpdateResource = fetchUpdateResource;
exports.parseCandidate = parseCandidate;
exports.verifyRegistrySignature = verifyRegistrySignature;
exports.verifyArchiveIntegrity = verifyArchiveIntegrity;
exports.inspectUpdateArchive = inspectUpdateArchive;
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Liest ausschließlich die festgelegten npm-Metadaten und das signierte EOS-Paket mit harten Größen- und Zeitgrenzen.
 * Daten und Wirkung: HTTPS-Antworten werden begrenzt, Signaturen und Paketidentität vor jeder Installationsvorbereitung geprüft. Es werden keine Befehle ausgeführt.
 * Bei Änderungen: Registry-Vertrauensquelle, Abbruch, Archivpfade, Signaturen und Versionsvergleiche gemeinsam negativ prüfen.
 */
const node_crypto_1 = require("node:crypto");
const node_fs_1 = require("node:fs");
const https = __importStar(require("node:https"));
const node_zlib_1 = require("node:zlib");
const semver_1 = __importDefault(require("semver"));
exports.UPDATE_PACKAGE = 'iobroker.eos-admin';
exports.UPDATE_REGISTRY = 'https://registry.npmjs.org';
exports.UPDATE_METADATA_URL = `${exports.UPDATE_REGISTRY}/${exports.UPDATE_PACKAGE}/latest`;
exports.UPDATE_KEYS_URL = `${exports.UPDATE_REGISTRY}/-/npm/v1/keys`;
exports.UPDATE_MAX_ARCHIVE_BYTES = 64 * 1024 * 1024;
const MAX_EXPANDED_BYTES = 256 * 1024 * 1024;
const updateError = (code) => new Error(`EOS_UPDATE_${code}`);
exports.updateError = updateError;
const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
exports.isRecord = isRecord;
const stableVersion = (value) => typeof value === 'string' &&
    /^(0|[1-9]\d{0,4})\.(0|[1-9]\d{0,4})\.(0|[1-9]\d{0,4})$/.test(value) &&
    !!semver_1.default.valid(value);
exports.stableVersion = stableVersion;
/** A caller owns one five-second signal for its whole external transaction. */
function fetchUpdateResource(url, maximum, signal) {
    const allowed = url === exports.UPDATE_METADATA_URL ||
        url === exports.UPDATE_KEYS_URL ||
        /^https:\/\/registry\.npmjs\.org\/iobroker\.eos-admin\/-\/iobroker\.eos-admin-\d{1,5}\.\d{1,5}\.\d{1,5}\.tgz$/.test(url);
    if (!allowed || !Number.isSafeInteger(maximum) || maximum < 1 || maximum > exports.UPDATE_MAX_ARCHIVE_BYTES) {
        return Promise.reject((0, exports.updateError)('SOURCE'));
    }
    return new Promise((resolve, reject) => {
        if (signal.aborted) {
            reject((0, exports.updateError)('ABORTED'));
            return;
        }
        let settled = false;
        const finish = (error, data) => {
            if (settled) {
                return;
            }
            settled = true;
            if (error) {
                reject(error);
            }
            else {
                resolve(data || Buffer.alloc(0));
            }
        };
        const request = https.get(url, {
            signal,
            agent: false,
            rejectUnauthorized: true,
            headers: {
                Accept: 'application/json, application/octet-stream',
                'Accept-Encoding': 'identity',
                'User-Agent': 'NexoWatt-EOS-Update',
            },
        }, response => {
            const declared = response.headers['content-length'];
            if (response.statusCode !== 200 ||
                (declared !== undefined && (!/^\d+$/.test(declared) || Number(declared) > maximum)) ||
                (response.headers['content-encoding'] && response.headers['content-encoding'] !== 'identity')) {
                response.destroy();
                request.destroy();
                finish((0, exports.updateError)('HTTP'));
                return;
            }
            const chunks = [];
            let length = 0;
            response.on('data', (chunk) => {
                length += chunk.length;
                if (length > maximum) {
                    response.destroy();
                    request.destroy();
                    finish((0, exports.updateError)('SIZE'));
                    return;
                }
                chunks.push(chunk);
            });
            response.on('end', () => finish(undefined, Buffer.concat(chunks, length)));
            response.on('aborted', () => finish((0, exports.updateError)('ABORTED')));
            response.on('error', () => finish((0, exports.updateError)('NETWORK')));
        });
        request.on('error', () => finish((0, exports.updateError)(signal.aborted ? 'ABORTED' : 'NETWORK')));
    });
}
function parseCandidate(data, currentVersion, nodeVersion) {
    let value;
    try {
        value = JSON.parse(data.toString('utf8'));
    }
    catch {
        throw (0, exports.updateError)('METADATA');
    }
    if (!(0, exports.isRecord)(value) ||
        value.name !== exports.UPDATE_PACKAGE ||
        !(0, exports.stableVersion)(value.version) ||
        !(0, exports.isRecord)(value.dist) ||
        !(0, exports.isRecord)(value.engines) ||
        typeof value.engines.node !== 'string' ||
        value.engines.node.length > 256 ||
        !semver_1.default.validRange(value.engines.node) ||
        (typeof value.deprecated === 'string' && value.deprecated.length > 0)) {
        throw (0, exports.updateError)('METADATA');
    }
    if (!(0, exports.stableVersion)(currentVersion) || !semver_1.default.valid(nodeVersion)) {
        throw (0, exports.updateError)('RUNTIME');
    }
    if (semver_1.default.major(value.version) !== semver_1.default.major(currentVersion) ||
        !semver_1.default.satisfies(nodeVersion, value.engines.node)) {
        throw (0, exports.updateError)('INCOMPATIBLE');
    }
    const integrity = value.dist.integrity;
    if (typeof integrity !== 'string' ||
        !/^sha512-[A-Za-z0-9+/]{86}==$/.test(integrity) ||
        value.dist.tarball !== `${exports.UPDATE_REGISTRY}/${exports.UPDATE_PACKAGE}/-/${exports.UPDATE_PACKAGE}-${value.version}.tgz` ||
        !Array.isArray(value.dist.signatures) ||
        value.dist.signatures.length < 1 ||
        value.dist.signatures.length > 8) {
        throw (0, exports.updateError)('SIGNATURE_METADATA');
    }
    const signatures = value.dist.signatures.map((item) => {
        if (!(0, exports.isRecord)(item) ||
            typeof item.keyid !== 'string' ||
            !/^SHA256:[A-Za-z0-9+/]{43}=?$/.test(item.keyid) ||
            typeof item.sig !== 'string' ||
            !/^[A-Za-z0-9+/]{80,200}={0,2}$/.test(item.sig)) {
            throw (0, exports.updateError)('SIGNATURE_METADATA');
        }
        return { keyid: item.keyid, sig: item.sig };
    });
    return { version: value.version, integrity, tarball: value.dist.tarball, engines: value.engines.node, signatures };
}
/** Registry keys are obtained only from npm's TLS-authenticated key endpoint. This is not a manufacturer signature. */
function verifyRegistrySignature(candidate, data, now) {
    let value;
    try {
        value = JSON.parse(data.toString('utf8'));
    }
    catch {
        throw (0, exports.updateError)('KEYS');
    }
    if (!(0, exports.isRecord)(value) || !Array.isArray(value.keys) || value.keys.length < 1 || value.keys.length > 32) {
        throw (0, exports.updateError)('KEYS');
    }
    const payload = Buffer.from(`${exports.UPDATE_PACKAGE}@${candidate.version}:${candidate.integrity}`);
    for (const entry of value.keys) {
        if (!(0, exports.isRecord)(entry) ||
            typeof entry.keyid !== 'string' ||
            typeof entry.key !== 'string' ||
            entry.key.length > 1024 ||
            entry.keytype !== 'ecdsa-sha2-nistp256' ||
            entry.scheme !== 'ecdsa-sha2-nistp256' ||
            !(entry.expires === null ||
                (typeof entry.expires === 'string' &&
                    Number.isFinite(Date.parse(entry.expires)) &&
                    Date.parse(entry.expires) > now))) {
            continue;
        }
        const match = candidate.signatures.find(signature => signature.keyid === entry.keyid);
        if (!match) {
            continue;
        }
        try {
            const bytes = Buffer.from(entry.key, 'base64');
            const key = (0, node_crypto_1.createPublicKey)({ key: bytes, type: 'spki', format: 'der' });
            if (key.asymmetricKeyType !== 'ec' || key.asymmetricKeyDetails?.namedCurve !== 'prime256v1') {
                continue;
            }
            if ((0, node_crypto_1.verify)('sha256', payload, key, Buffer.from(match.sig, 'base64'))) {
                return;
            }
        }
        catch {
            /* Invalid public metadata is a closed signature failure. */
        }
    }
    throw (0, exports.updateError)('SIGNATURE');
}
function verifyArchiveIntegrity(data, integrity) {
    if (`sha512-${(0, node_crypto_1.createHash)('sha512').update(data).digest('base64')}` !== integrity) {
        throw (0, exports.updateError)('INTEGRITY');
    }
}
/** Validate the actual npm tar members without extracting or executing their content. */
async function inspectUpdateArchive(filename, candidate, signal) {
    if (signal?.aborted) {
        throw (0, exports.updateError)('ABORTED');
    }
    const source = (0, node_fs_1.createReadStream)(filename);
    const stream = (0, node_zlib_1.createGunzip)();
    source.on('error', () => stream.destroy((0, exports.updateError)('ARCHIVE_READ')));
    source.pipe(stream);
    const abort = () => {
        source.destroy();
        stream.destroy((0, exports.updateError)('ABORTED'));
    };
    signal?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(abort, 5000);
    timer.unref();
    let pending = Buffer.alloc(0), expanded = 0, remaining = 0, padding = 0, zeroBlocks = 0;
    let current = null;
    let paxData = null, paxPath = null;
    let paxSize = null;
    const files = [];
    const seen = new Set();
    let manifest = null;
    let ioManifest = null;
    const text = (header, start, end) => header.subarray(start, end).toString('utf8').replace(/\0.*$/s, '');
    const octal = (header, start, end) => {
        const value = text(header, start, end).trim();
        if (!/^[0-7]{1,12}$/.test(value)) {
            throw (0, exports.updateError)('ARCHIVE_HEADER');
        }
        return Number.parseInt(value, 8);
    };
    const finish = () => {
        if (current) {
            const digest = current.hash.digest('hex');
            files.push({ path: current.path, sha256: digest });
            if (current.manifest) {
                if (current.path === 'package.json') {
                    manifest = Buffer.concat(current.manifest);
                }
                else {
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
                const space = data.indexOf(32, offset), sizeText = data.subarray(offset, space).toString('ascii');
                if (space < offset || !/^\d{1,5}$/.test(sizeText)) {
                    throw (0, exports.updateError)('ARCHIVE_PAX');
                }
                const size = Number(sizeText), end = offset + size;
                if (size <= space - offset + 1 || end > data.length || data[end - 1] !== 10) {
                    throw (0, exports.updateError)('ARCHIVE_PAX');
                }
                const row = data.subarray(space + 1, end - 1).toString('utf8'), equal = row.indexOf('=');
                const key = row.slice(0, equal), val = row.slice(equal + 1);
                if (equal < 1 ||
                    !['path', 'size', 'mtime', 'atime', 'ctime', 'uid', 'gid', 'uname', 'gname'].includes(key)) {
                    throw (0, exports.updateError)('ARCHIVE_PAX');
                }
                if (key === 'path') {
                    if (paxPath !== null) {
                        throw (0, exports.updateError)('ARCHIVE_PAX');
                    }
                    paxPath = val;
                }
                if (key === 'size') {
                    if (paxSize !== null || !/^\d{1,9}$/.test(val) || Number(val) > exports.UPDATE_MAX_ARCHIVE_BYTES) {
                        throw (0, exports.updateError)('ARCHIVE_PAX');
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
                throw (0, exports.updateError)('ARCHIVE_READ');
            }
            const chunk = part;
            expanded += chunk.length;
            if (expanded > MAX_EXPANDED_BYTES) {
                throw (0, exports.updateError)('ARCHIVE_SIZE');
            }
            pending = Buffer.concat([pending, chunk]);
            while (pending.length) {
                if (remaining) {
                    const count = Math.min(remaining, pending.length), bytes = pending.subarray(0, count);
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
                    throw (0, exports.updateError)('ARCHIVE_TRAILING');
                }
                const checksum = octal(header, 148, 156);
                let sum = 0;
                for (let index = 0; index < 512; index++) {
                    sum += index >= 148 && index < 156 ? 32 : header[index] || 0;
                }
                if (sum !== checksum) {
                    throw (0, exports.updateError)('ARCHIVE_HEADER');
                }
                const size = octal(header, 124, 136), type = text(header, 156, 157), prefix = text(header, 345, 500);
                const path = paxPath || `${prefix ? `${prefix}/` : ''}${text(header, 0, 100)}`;
                if (type !== 'x') {
                    if (paxSize !== null && paxSize !== size) {
                        throw (0, exports.updateError)('ARCHIVE_PAX');
                    }
                    paxPath = null;
                    paxSize = null;
                }
                if (!Number.isSafeInteger(size) || size < 0 || size > exports.UPDATE_MAX_ARCHIVE_BYTES) {
                    throw (0, exports.updateError)('ARCHIVE_SIZE');
                }
                remaining = size;
                padding = (512 - (size % 512)) % 512;
                if (type === 'x') {
                    if (size > 16384) {
                        throw (0, exports.updateError)('ARCHIVE_PAX');
                    }
                    paxData = [];
                }
                else {
                    if (!path.startsWith('package/') ||
                        path.length > 520 ||
                        path.includes('\\') ||
                        path.includes(':') ||
                        path.includes('\ufffd') ||
                        Array.from(path).some(character => character.charCodeAt(0) <= 32 || character.charCodeAt(0) === 127) ||
                        path
                            .split('/')
                            .some(segment => segment === '.' || segment === '..' || segment === 'node_modules')) {
                        throw (0, exports.updateError)('ARCHIVE_PATH');
                    }
                    const relative = path.slice(8).replace(/\/$/, '');
                    if (relative.split('/').some(segment => segment === '') && relative !== '') {
                        throw (0, exports.updateError)('ARCHIVE_PATH');
                    }
                    if (type === '5') {
                        if (size !== 0) {
                            throw (0, exports.updateError)('ARCHIVE_HEADER');
                        }
                    }
                    else if (type === '0' || type === '') {
                        if (!relative || seen.has(relative) || seen.size >= 8192) {
                            throw (0, exports.updateError)('ARCHIVE_DUPLICATE');
                        }
                        seen.add(relative);
                        if ((relative === 'package.json' && size > 65536) ||
                            (relative === 'io-package.json' && size > 1024 * 1024)) {
                            throw (0, exports.updateError)('ARCHIVE_MANIFEST');
                        }
                        current = {
                            path: relative,
                            hash: (0, node_crypto_1.createHash)('sha256'),
                            manifest: relative === 'package.json' || relative === 'io-package.json' ? [] : null,
                        };
                    }
                    else {
                        throw (0, exports.updateError)('ARCHIVE_LINK');
                    }
                }
                if (!remaining) {
                    finish();
                }
            }
        }
        if (remaining ||
            padding ||
            pending.some(byte => byte !== 0) ||
            zeroBlocks < 2 ||
            !manifest ||
            !ioManifest ||
            paxPath !== null ||
            paxSize !== null ||
            files.length < 2) {
            throw (0, exports.updateError)('ARCHIVE_INCOMPLETE');
        }
        const parseManifest = (value) => {
            if (!Buffer.isBuffer(value)) {
                throw (0, exports.updateError)('ARCHIVE_MANIFEST');
            }
            try {
                return JSON.parse(value.toString('utf8'));
            }
            catch {
                throw (0, exports.updateError)('ARCHIVE_MANIFEST');
            }
        };
        const packageJson = parseManifest(manifest);
        const ioPackage = parseManifest(ioManifest);
        if (!(0, exports.isRecord)(packageJson) ||
            packageJson.name !== exports.UPDATE_PACKAGE ||
            packageJson.version !== candidate.version ||
            !(0, exports.isRecord)(ioPackage) ||
            !(0, exports.isRecord)(ioPackage.common) ||
            ioPackage.common.name !== 'eos-admin' ||
            ioPackage.common.version !== candidate.version ||
            !(0, exports.isRecord)(packageJson.engines) ||
            packageJson.engines.node !== candidate.engines) {
            throw (0, exports.updateError)('ARCHIVE_IDENTITY');
        }
        return { files, packageJsonSha256: (0, node_crypto_1.createHash)('sha256').update(manifest).digest('hex') };
    }
    finally {
        clearTimeout(timer);
        signal?.removeEventListener('abort', abort);
        source.destroy();
        stream.destroy();
    }
}
//# sourceMappingURL=eosCustomerUpdateTransport.js.map