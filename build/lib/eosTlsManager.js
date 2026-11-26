"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EosTlsManager = void 0;
exports.tlsNames = tlsNames;
/** Copyright (c) 2026 NexoWatt. Confidential and proprietary. */
const node_crypto_1 = require("node:crypto");
const node_fs_1 = require("node:fs");
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const node_net_1 = require("node:net");
const node_os_1 = require("node:os");
const node_child_process_1 = require("node:child_process");
const node_tls_1 = require("node:tls");
const MAX_BYTES = 128 * 1024;
const DAY = 86_400_000;
function fail(code) {
    throw Object.assign(new Error(code), { code });
}
function record(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        fail('EOS_TLS_INVALID_INPUT');
    }
    return value;
}
function text(value, maximum = MAX_BYTES) {
    if (typeof value !== 'string' || !value.length || Buffer.byteLength(value) > maximum) {
        fail('EOS_TLS_INVALID_INPUT');
    }
    return value;
}
function tlsNames(value) {
    if (!Array.isArray(value) || !value.length || value.length > 32) {
        fail('EOS_TLS_INVALID_NAMES');
    }
    const names = value.map((entry) => {
        const name = text(entry, 253).toLowerCase();
        if (!name.includes('%') && (0, node_net_1.isIP)(name)) {
            return name;
        }
        if (!/^(?=.{1,253}$)[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(name) ||
            name.split('.').some(label => label.length > 63 || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label))) {
            fail('EOS_TLS_INVALID_NAMES');
        }
        return name;
    });
    return [...new Set(names)].sort();
}
function certificates(value, maximum) {
    const pem = text(value);
    const matches = pem.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g) || [];
    if (!matches.length ||
        matches.length > maximum ||
        pem.replace(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g, '').trim()) {
        fail('EOS_TLS_INVALID_CERTIFICATE');
    }
    return matches.map(cert => `${new node_crypto_1.X509Certificate(cert).toString().trim()}\n`);
}
function fingerprint(cert) {
    return cert.fingerprint256.replace(/:/g, '').toLowerCase();
}
function boundedCertificateKey(certificate) {
    const key = certificate.publicKey;
    const details = key.asymmetricKeyDetails;
    if (key.asymmetricKeyType === 'ec' && ['prime256v1', 'secp384r1'].includes(details?.namedCurve || '')) {
        return;
    }
    if (key.asymmetricKeyType === 'rsa' &&
        details?.modulusLength &&
        details.modulusLength >= 2048 &&
        details.modulusLength <= 4096) {
        return;
    }
    fail('EOS_TLS_KEY_PROFILE_UNSUPPORTED');
}
function checkedFingerprint(value) {
    const hash = text(value, 100).replace(/:/g, '').toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(hash)) {
        fail('EOS_TLS_ROOT_FINGERPRINT_REQUIRED');
    }
    return hash;
}
async function privateDirectory(path) {
    await (0, promises_1.mkdir)(path, { mode: 0o700, recursive: true });
    const stat = await (0, promises_1.lstat)(path);
    if (!stat.isDirectory() ||
        stat.isSymbolicLink() ||
        stat.mode & 0o077 ||
        (process.getuid && stat.uid !== process.getuid())) {
        fail('EOS_TLS_STORAGE_PERMISSIONS');
    }
}
async function readPrivate(path) {
    const handle = await (0, promises_1.open)(path, node_fs_1.constants.O_RDONLY | node_fs_1.constants.O_NOFOLLOW).catch((error) => {
        if (record(error).code === 'ENOENT') {
            return null;
        }
        throw error;
    });
    if (!handle) {
        return null;
    }
    try {
        const stat = await handle.stat();
        if (!stat.isFile() ||
            stat.nlink !== 1 ||
            stat.mode & 0o077 ||
            stat.size > MAX_BYTES ||
            (process.getuid && stat.uid !== process.getuid())) {
            fail('EOS_TLS_STORAGE_PERMISSIONS');
        }
        return await handle.readFile('utf8');
    }
    finally {
        await handle.close();
    }
}
async function atomicPrivate(directory, file, value) {
    const temporary = (0, node_path_1.join)(directory, `.write-${(0, node_crypto_1.randomBytes)(16).toString('hex')}`);
    const handle = await (0, promises_1.open)(temporary, node_fs_1.constants.O_WRONLY | node_fs_1.constants.O_CREAT | node_fs_1.constants.O_EXCL | node_fs_1.constants.O_NOFOLLOW, 0o600);
    let committed = false;
    try {
        try {
            await handle.writeFile(`${JSON.stringify(value)}\n`, 'utf8');
            await handle.sync();
        }
        finally {
            await handle.close();
        }
        await (0, promises_1.rename)(temporary, (0, node_path_1.join)(directory, file));
        committed = true;
        try {
            const dir = await (0, promises_1.open)(directory, node_fs_1.constants.O_RDONLY);
            try {
                await dir.sync();
            }
            finally {
                await dir.close();
            }
            return true;
        }
        catch {
            // Rename already committed. Report durability uncertainty explicitly,
            // never claim that the still-active certificate was left unchanged.
            return false;
        }
    }
    finally {
        if (!committed) {
            await (0, promises_1.rm)(temporary, { force: true });
        }
    }
}
async function writePrivate(path, value) {
    const handle = await (0, promises_1.open)(path, node_fs_1.constants.O_WRONLY | node_fs_1.constants.O_CREAT | node_fs_1.constants.O_EXCL | node_fs_1.constants.O_NOFOLLOW, 0o600);
    try {
        await handle.writeFile(value, 'utf8');
    }
    finally {
        await handle.close();
    }
}
function openssl(args, input) {
    return new Promise((resolvePromise, reject) => {
        let inputFailed = false;
        const child = (0, node_child_process_1.execFile)('/usr/bin/openssl', args, {
            timeout: 5000,
            maxBuffer: MAX_BYTES,
            windowsHide: true,
            env: { PATH: '/usr/bin:/bin', LANG: 'C', OPENSSL_CONF: '/dev/null' },
        }, error => error || inputFailed
            ? reject(Object.assign(new Error('EOS_TLS_OPENSSL_FAILED'), { code: 'EOS_TLS_OPENSSL_FAILED' }))
            : resolvePromise());
        if (input) {
            const stdin = child.stdin;
            if (!stdin) {
                inputFailed = true;
                child.kill();
                return;
            }
            // The child callback reports failure only after OpenSSL has exited.
            stdin.once('error', () => {
                inputFailed = true;
                child.kill();
            });
            stdin.end(input);
        }
    });
}
function ecKey() {
    return new Promise((resolvePromise, reject) => {
        (0, node_crypto_1.generateKeyPair)('ec', {
            namedCurve: 'prime256v1',
            privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
            publicKeyEncoding: { type: 'spki', format: 'pem' },
        }, (error, _publicKey, privateKey) => (error ? reject(error) : resolvePromise(privateKey)));
    });
}
function localSigningKey(passphrase) {
    return new Promise((resolvePromise, reject) => {
        (0, node_crypto_1.generateKeyPair)('ec', { namedCurve: 'secp384r1' }, (error, _publicKey, privateKey) => {
            if (error) {
                reject(error);
                return;
            }
            try {
                const pem = privateKey.export({ type: 'pkcs8', format: 'pem', cipher: 'aes-256-cbc', passphrase });
                if (typeof pem !== 'string') {
                    fail('EOS_TLS_OPENSSL_FAILED');
                }
                resolvePromise(pem);
            }
            catch (exportError) {
                reject(exportError instanceof Error ? exportError : new Error('EOS_TLS_OPENSSL_FAILED'));
            }
        });
    });
}
function sanExtension(names) {
    return `subjectAltName=${names.map(name => `${(0, node_net_1.isIP)(name) ? 'IP' : 'DNS'}:${name}`).join(',')}`;
}
function createCsr(directory, names) {
    return openssl([
        'req',
        '-new',
        '-sha256',
        '-key',
        (0, node_path_1.join)(directory, 'key.pem'),
        '-out',
        (0, node_path_1.join)(directory, 'request.pem'),
        '-subj',
        '/O=NexoWatt/CN=nexowatt',
        '-addext',
        sanExtension(names),
    ]);
}
async function readGeneratedPem(path) {
    // OpenSSL inherits the process umask. Its public output lives in a private
    // directory, but is also restricted before being read by the file guard.
    const handle = await (0, promises_1.open)(path, node_fs_1.constants.O_RDONLY | node_fs_1.constants.O_NOFOLLOW);
    try {
        const stat = await handle.stat();
        if (!stat.isFile() || stat.nlink !== 1 || (process.getuid && stat.uid !== process.getuid())) {
            fail('EOS_TLS_STORAGE_PERMISSIONS');
        }
        await handle.chmod(0o600);
    }
    finally {
        await handle.close();
    }
    const pem = await readPrivate(path);
    if (!pem) {
        fail('EOS_TLS_OPENSSL_FAILED');
    }
    return pem;
}
function localCertificate(value) {
    const data = record(value);
    const cert = certificates(data.cert, 1)[0];
    const root = certificates(data.root, 1)[0];
    if (!cert || !root) {
        fail('EOS_TLS_INVALID_CERTIFICATE');
    }
    return { cert, root };
}
function canonicalDeviceName(name) {
    const lowerName = name.toLowerCase();
    return (0, node_net_1.isIP)(lowerName) === 6 ? new URL(`http://[${lowerName}]/`).hostname.slice(1, -1) : lowerName;
}
function deviceAddresses() {
    return Object.values((0, node_os_1.networkInterfaces)()).flatMap(entries => (entries || [])
        .filter(entry => !entry.internal && !entry.address.includes('%') && (0, node_net_1.isIP)(entry.address))
        .map(entry => entry.address));
}
function identity(value) {
    const data = record(value);
    if (data.version !== 1 || !/^[a-f0-9]{32}$/.test(text(data.requestId, 32))) {
        fail('EOS_TLS_STORAGE_INVALID');
    }
    return {
        version: 1,
        requestId: text(data.requestId, 32),
        names: tlsNames(data.names),
        key: text(data.key),
        cert: text(data.cert),
        root: text(data.root),
    };
}
/** Per-device TLS identity; the manufacturer's CA private key is never accepted here. */
class EosTlsManager {
    hostname;
    directory;
    active = null;
    pending = null;
    context = null;
    server = null;
    busy = false;
    initialized = false;
    startupError = '';
    storageSyncWarning = false;
    pendingCleanupWarning = false;
    constructor(directory, hostname = 'nexowatt') {
        this.hostname = hostname;
        this.directory = (0, node_path_1.resolve)(directory);
    }
    async initialize() {
        if (this.initialized) {
            return;
        }
        await privateDirectory(this.directory);
        const active = await readPrivate((0, node_path_1.join)(this.directory, 'active.json'));
        if (active) {
            const candidate = identity(JSON.parse(active));
            // Expired identities remain available for authenticated renewal; import always requires a valid lifetime.
            await this.validate(candidate, true);
            this.active = candidate;
            this.context = (0, node_tls_1.createSecureContext)({ ...this.material(), minVersion: 'TLSv1.2' });
        }
        const pending = await readPrivate((0, node_path_1.join)(this.directory, 'pending.json'));
        if (pending) {
            const data = record(JSON.parse(pending));
            const requestId = text(data.requestId, 32);
            if (data.version !== 1 || !/^[a-f0-9]{32}$/.test(requestId)) {
                fail('EOS_TLS_STORAGE_INVALID');
            }
            if (requestId !== this.active?.requestId) {
                const draft = {
                    version: 1,
                    requestId,
                    names: tlsNames(data.names),
                    key: text(data.key),
                    csr: text(data.csr),
                    createdAt: text(data.createdAt, 50),
                };
                if (data.local !== undefined) {
                    const local = localCertificate(data.local);
                    await this.validate({ ...draft, ...local }, true);
                    this.pending = { ...draft, local };
                }
                else {
                    this.pending = draft;
                }
            }
        }
        this.initialized = true;
    }
    markUnavailable() {
        this.startupError = 'EOS_TLS_STORAGE_UNAVAILABLE';
    }
    material() {
        return this.active ? { key: this.active.key, cert: this.active.cert } : null;
    }
    secureContext() {
        return this.context;
    }
    attachManagedServer(server) {
        this.server = server;
    }
    detach() {
        this.server = null;
    }
    status() {
        const certificate = this.active ? new node_crypto_1.X509Certificate(this.active.cert) : null;
        const root = this.active ? new node_crypto_1.X509Certificate(this.active.root) : null;
        const now = Date.now();
        const chain = this.active
            ? [...certificates(this.active.cert, 5), this.active.root].map(pem => new node_crypto_1.X509Certificate(pem))
            : [];
        const effectiveExpiry = chain.length ? Math.min(...chain.map(cert => Date.parse(cert.validTo))) : null;
        let addresses = [];
        let addressDiscoveryUnavailable = false;
        try {
            addresses = deviceAddresses();
        }
        catch {
            // Interface enumeration is advisory; an OS failure must not invalidate a saved CSR or kill a route.
            addressDiscoveryUnavailable = true;
        }
        return {
            mode: this.active ? 'nexowatt-managed' : 'existing-iobroker-certificate',
            restartRequired: !!this.active && !this.server,
            error: this.startupError || undefined,
            warnings: [
                ...(this.storageSyncWarning ? ['EOS_TLS_STORAGE_SYNC_WARNING'] : []),
                ...(this.pendingCleanupWarning ? ['EOS_TLS_PENDING_CLEANUP_WARNING'] : []),
            ],
            busy: this.busy,
            issuer: certificate?.issuer,
            subject: certificate?.subject,
            validFrom: certificate?.validFrom,
            validTo: certificate?.validTo,
            effectiveValidTo: effectiveExpiry ? new Date(effectiveExpiry).toISOString() : null,
            valid: chain.length
                ? chain.every(cert => now >= Date.parse(cert.validFrom) && now < Date.parse(cert.validTo))
                : null,
            expiresSoon: effectiveExpiry ? effectiveExpiry - now < 30 * DAY : false,
            fingerprint: certificate ? fingerprint(certificate) : null,
            rootFingerprint: root ? fingerprint(root) : null,
            names: this.active?.names || [],
            pending: this.pending
                ? {
                    requestId: this.pending.requestId,
                    names: this.pending.names,
                    createdAt: this.pending.createdAt,
                    ...(this.pending.local
                        ? { local: true, rootFingerprint: fingerprint(new node_crypto_1.X509Certificate(this.pending.local.root)) }
                        : {}),
                }
                : null,
            addressDiscoveryUnavailable,
            suggestedNames: [...new Set([this.hostname, `${this.hostname}.local`, ...addresses])].slice(0, 32),
        };
    }
    publicRoot() {
        if (!this.active) {
            fail('EOS_TLS_ROOT_NOT_CONFIGURED');
        }
        return new node_crypto_1.X509Certificate(this.active.root).raw;
    }
    publicRequest() {
        if (!this.pending || this.pending.local) {
            fail('EOS_TLS_REQUEST_NOT_FOUND');
        }
        return this.pending.csr;
    }
    async createRequest(value) {
        return this.exclusive(async () => {
            const data = record(value);
            const names = tlsNames(data.names);
            if (this.pending && data.replace !== true) {
                if (this.pending.local || JSON.stringify(names) !== JSON.stringify(this.pending.names)) {
                    fail('EOS_TLS_PENDING_REQUEST_EXISTS');
                }
                return this.status();
            }
            const directory = await (0, promises_1.mkdtemp)((0, node_path_1.join)(this.directory, '.request-'));
            try {
                const key = await ecKey();
                await writePrivate((0, node_path_1.join)(directory, 'key.pem'), key);
                await createCsr(directory, names);
                const csr = await readGeneratedPem((0, node_path_1.join)(directory, 'request.pem'));
                const pending = {
                    version: 1,
                    requestId: (0, node_crypto_1.randomBytes)(16).toString('hex'),
                    names,
                    key,
                    csr,
                    createdAt: new Date().toISOString(),
                };
                this.storageSyncWarning = !(await atomicPrivate(this.directory, 'pending.json', pending));
                this.pendingCleanupWarning = false;
                this.pending = pending;
                return this.status();
            }
            finally {
                await (0, promises_1.rm)(directory, { recursive: true, force: true });
            }
        });
    }
    async importCertificate(value) {
        return this.exclusive(async () => {
            const data = record(value);
            const pending = this.matchingPending(data.requestId);
            const chain = certificates(data.certificate, 5);
            const roots = certificates(data.rootCertificate, 1);
            const root = roots[0];
            if (!root || fingerprint(new node_crypto_1.X509Certificate(root)) !== checkedFingerprint(data.rootFingerprint)) {
                fail('EOS_TLS_ROOT_FINGERPRINT_MISMATCH');
            }
            const cert = chain.join('');
            if (pending.local) {
                if (cert !== pending.local.cert || root !== pending.local.root) {
                    fail('EOS_TLS_LOCAL_CERTIFICATE_MISMATCH');
                }
                this.localNames(pending.names);
            }
            return this.commitCertificate(pending, { cert, root });
        });
    }
    async createLocalCertificate(value) {
        return this.exclusive(async () => {
            const data = record(value);
            const names = this.localNames(data.names);
            if (this.pending && data.replace !== true) {
                if (!this.pending.local || JSON.stringify(names) !== JSON.stringify(this.pending.names)) {
                    fail('EOS_TLS_PENDING_REQUEST_EXISTS');
                }
                if (Date.parse(new node_crypto_1.X509Certificate(this.pending.local.cert).validTo) <= Date.now() + DAY) {
                    fail('EOS_TLS_LIFETIME_INVALID');
                }
                return this.status();
            }
            const requestId = (0, node_crypto_1.randomBytes)(16).toString('hex');
            const directory = await (0, promises_1.mkdtemp)((0, node_path_1.join)(this.directory, '.local-'));
            // The persisted file contains an encrypted, one-time signing key.
            // Its independent passphrase is sent over stdin and never written.
            const passphrase = Buffer.from((0, node_crypto_1.randomBytes)(32).toString('hex'), 'ascii');
            const stdin = Buffer.concat([passphrase, Buffer.from('\n')]);
            try {
                const key = await ecKey();
                const caFile = (0, node_path_1.join)(directory, 'issuer.pem');
                const rootFile = (0, node_path_1.join)(directory, 'root.pem');
                const certFile = (0, node_path_1.join)(directory, 'certificate.pem');
                const csrFile = (0, node_path_1.join)(directory, 'request.pem');
                const extensions = (0, node_path_1.join)(directory, 'server.cnf');
                await writePrivate((0, node_path_1.join)(directory, 'key.pem'), key);
                await createCsr(directory, names);
                await writePrivate(caFile, await localSigningKey(passphrase));
                await openssl([
                    'req',
                    '-new',
                    '-x509',
                    '-sha384',
                    '-days',
                    '398',
                    '-key',
                    caFile,
                    '-passin',
                    'stdin',
                    '-out',
                    rootFile,
                    '-subj',
                    `/O=NexoWatt/CN=NexoWatt EOS Local Root ${requestId}`,
                    '-addext',
                    'basicConstraints=critical,CA:TRUE,pathlen:0',
                    '-addext',
                    'keyUsage=critical,keyCertSign,cRLSign',
                    '-addext',
                    'subjectKeyIdentifier=hash',
                    '-addext',
                    'authorityKeyIdentifier=keyid:always',
                ], stdin);
                await writePrivate(extensions, [
                    '[server]',
                    'basicConstraints=critical,CA:FALSE',
                    'keyUsage=critical,digitalSignature',
                    'extendedKeyUsage=serverAuth',
                    'subjectKeyIdentifier=hash',
                    'authorityKeyIdentifier=keyid,issuer',
                    sanExtension(names),
                    '',
                ].join('\n'));
                await openssl([
                    'x509',
                    '-req',
                    '-sha256',
                    '-days',
                    '397',
                    '-in',
                    csrFile,
                    '-CA',
                    rootFile,
                    '-CAkey',
                    caFile,
                    '-passin',
                    'stdin',
                    '-set_serial',
                    `0x${(0, node_crypto_1.randomBytes)(19).toString('hex')}`,
                    '-extfile',
                    extensions,
                    '-extensions',
                    'server',
                    '-out',
                    certFile,
                ], stdin);
                await (0, promises_1.rm)(caFile);
                passphrase.fill(0);
                stdin.fill(0);
                const local = localCertificate({
                    cert: await readGeneratedPem(certFile),
                    root: await readGeneratedPem(rootFile),
                });
                // Keeping the public CSR in the version 1 format lets an
                // earlier adapter load this pending request after a rollback.
                const pending = {
                    version: 1,
                    requestId,
                    names,
                    key,
                    csr: await readGeneratedPem(csrFile),
                    createdAt: new Date().toISOString(),
                    local,
                };
                await this.validate({ ...pending, ...local }, false);
                this.storageSyncWarning = !(await atomicPrivate(this.directory, 'pending.json', pending));
                this.pendingCleanupWarning = false;
                this.pending = pending;
                return this.status();
            }
            finally {
                passphrase.fill(0);
                stdin.fill(0);
                await (0, promises_1.rm)(directory, { recursive: true, force: true });
            }
        });
    }
    publicLocalCertificate(kind, requestId) {
        const pending = this.matchingPending(requestId);
        if (!pending.local) {
            fail('EOS_TLS_REQUEST_MISMATCH');
        }
        return kind === 'device' ? pending.local.cert : pending.local.root;
    }
    async activateLocalCertificate(value) {
        return this.exclusive(async () => {
            const data = record(value);
            const pending = this.matchingPending(data.requestId);
            if (!pending.local) {
                fail('EOS_TLS_REQUEST_MISMATCH');
            }
            if (fingerprint(new node_crypto_1.X509Certificate(pending.local.root)) !== checkedFingerprint(data.rootFingerprint)) {
                fail('EOS_TLS_ROOT_FINGERPRINT_MISMATCH');
            }
            this.localNames(pending.names);
            return this.commitCertificate(pending, pending.local);
        });
    }
    matchingPending(requestId) {
        if (!this.pending || requestId !== this.pending.requestId || requestId === this.active?.requestId) {
            fail('EOS_TLS_REQUEST_MISMATCH');
        }
        return this.pending;
    }
    localNames(value) {
        const names = [...new Set(tlsNames(value).map(canonicalDeviceName))].sort();
        const local = [this.hostname, `${this.hostname}.local`, 'localhost', '127.0.0.1', '::1'];
        let addresses = [];
        try {
            addresses = deviceAddresses();
        }
        catch {
            // Interface discovery is advisory. Without it, issue only for the
            // fixed local hostnames and loopback addresses.
        }
        const assigned = new Set([...local, ...addresses].map(canonicalDeviceName));
        if (names.some(name => !assigned.has(name))) {
            fail('EOS_TLS_LOCAL_NAME_NOT_ASSIGNED');
        }
        return names;
    }
    async commitCertificate(pending, { cert, root }) {
        const candidate = {
            version: 1,
            requestId: pending.requestId,
            names: pending.names,
            key: pending.key,
            cert,
            root,
        };
        await this.validate(candidate, false);
        const context = (0, node_tls_1.createSecureContext)({ key: candidate.key, cert: candidate.cert, minVersion: 'TLSv1.2' });
        const previous = this.active;
        this.storageSyncWarning = !(await atomicPrivate(this.directory, 'active.json', candidate));
        try {
            this.server?.setSecureContext({ key: candidate.key, cert: candidate.cert, minVersion: 'TLSv1.2' });
        }
        catch (error) {
            if (previous) {
                this.storageSyncWarning = !(await atomicPrivate(this.directory, 'active.json', previous));
            }
            else {
                await (0, promises_1.rm)((0, node_path_1.join)(this.directory, 'active.json'), { force: true });
            }
            throw error;
        }
        this.active = candidate;
        this.context = context;
        this.pending = null;
        // An interrupted cleanup cannot replay the request: active.requestId is checked on load and import.
        try {
            await (0, promises_1.rm)((0, node_path_1.join)(this.directory, 'pending.json'), { force: true });
            this.pendingCleanupWarning = false;
        }
        catch {
            this.pendingCleanupWarning = true;
        }
        return this.status();
    }
    async exclusive(task) {
        if (!this.initialized || this.startupError) {
            fail('EOS_TLS_STORAGE_UNAVAILABLE');
        }
        if (this.busy) {
            fail('EOS_TLS_BUSY');
        }
        this.busy = true;
        try {
            return await task();
        }
        finally {
            this.busy = false;
        }
    }
    async validate(candidate, allowExpired) {
        const chain = certificates(candidate.cert, 5);
        const rootPem = certificates(candidate.root, 1)[0];
        const leafPem = chain[0];
        if (!rootPem || !leafPem) {
            fail('EOS_TLS_INVALID_CERTIFICATE');
        }
        const leaf = new node_crypto_1.X509Certificate(leafPem);
        const root = new node_crypto_1.X509Certificate(rootPem);
        for (const certificate of [...chain, rootPem]) {
            boundedCertificateKey(new node_crypto_1.X509Certificate(certificate));
        }
        if (leaf.ca ||
            !root.ca ||
            root.subject !== root.issuer ||
            !root.verify(root.publicKey) ||
            !leaf.checkPrivateKey((0, node_crypto_1.createPrivateKey)(candidate.key))) {
            fail('EOS_TLS_KEY_OR_CA_MISMATCH');
        }
        if (!leaf.keyUsage?.includes('1.3.6.1.5.5.7.3.1')) {
            fail('EOS_TLS_SERVER_USAGE_REQUIRED');
        }
        for (const name of candidate.names) {
            if (!((0, node_net_1.isIP)(name) ? leaf.checkIP(name) : leaf.checkHost(name, { subject: 'never', wildcards: false }))) {
                fail('EOS_TLS_SAN_MISMATCH');
            }
        }
        if (!allowExpired &&
            (Date.parse(leaf.validTo) - Date.parse(leaf.validFrom) > 397 * DAY ||
                Date.parse(leaf.validTo) <= Date.now() + DAY)) {
            fail('EOS_TLS_LIFETIME_INVALID');
        }
        const directory = await (0, promises_1.mkdtemp)((0, node_path_1.join)(this.directory, '.verify-'));
        try {
            await writePrivate((0, node_path_1.join)(directory, 'leaf.pem'), leafPem);
            await writePrivate((0, node_path_1.join)(directory, 'root.pem'), rootPem);
            const intermediates = chain
                .slice(1)
                .filter(cert => fingerprint(new node_crypto_1.X509Certificate(cert)) !== fingerprint(root));
            if (intermediates.length) {
                await writePrivate((0, node_path_1.join)(directory, 'chain.pem'), intermediates.join(''));
            }
            await openssl([
                'verify',
                '-x509_strict',
                '-auth_level',
                '2',
                '-purpose',
                'sslserver',
                '-no-CAfile',
                '-no-CApath',
                '-no-CAstore',
                '-trusted',
                (0, node_path_1.join)(directory, 'root.pem'),
                ...(intermediates.length ? ['-untrusted', (0, node_path_1.join)(directory, 'chain.pem')] : []),
                ...(allowExpired ? ['-no_check_time'] : []),
                (0, node_path_1.join)(directory, 'leaf.pem'),
            ]);
        }
        finally {
            await (0, promises_1.rm)(directory, { recursive: true, force: true });
        }
    }
}
exports.EosTlsManager = EosTlsManager;
//# sourceMappingURL=eosTlsManager.js.map