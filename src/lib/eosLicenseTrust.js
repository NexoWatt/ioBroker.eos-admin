// @ts-check
'use strict';

// Public release metadata, not an activation or signing secret. Importing this
// exact manufacturer key is a separate administrator action. A future release
// must remove a pin when the manufacturer withdraws that authority.
const crypto = require('node:crypto');
const { TextDecoder } = require('node:util');
const { LicenseError, validatePublicKeys } = require('./eosLicenseCore');

/** @typedef {Record<string, string>} PublicKeys */
/** @typedef {{kid: string, fingerprint: string, source: 'os'|'restored'|'os+restored'}} EffectiveKey */
/** @typedef {{kid: string, fingerprint: string, source: 'release'|'os'|'release+os'}} AllowedKey */
/** @typedef {{v: 1, ready: boolean, code: string, canImport: boolean, source: 'os'|'restored'|'combined'|'none', keys: EffectiveKey[], allowedKeys: AllowedKey[]}} TrustStatus */
/** @typedef {{readImportedTrust: () => Promise<Buffer|null>, writeImportedTrust: (bytes: Buffer) => Promise<void>}} TrustStore */
/** @typedef {{keys: PublicKeys|null, explicit: boolean}} OsTrust */

const MAX_TRUST_BYTES = 32768;
const MANUFACTURER_KEYS = Object.freeze({
    'nexowattEOS-3cb665e3fc6f4085a04b8db3e692cac5':
        '-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEAshpYHxZOBI+lLizrDEbjos/rwFBQwyGX3g8ADwvU2y8=\n-----END PUBLIC KEY-----\n',
});
const MANUFACTURER_FINGERPRINTS = Object.freeze({
    'nexowattEOS-3cb665e3fc6f4085a04b8db3e692cac5': 'a485fd6e28195a0a0e458b304e95025c0bd516d97f3cb1443beb78ed9cfe4856',
});

/**
 * Reject with a non-sensitive diagnostic code.
 *
 * @param {string} code Safe diagnostic code.
 * @returns {never} Always throws.
 */
function fail(code) {
    throw new LicenseError(code);
}

/**
 * Classify an authority-read error without exposing filesystem details.
 *
 * @param {unknown} error Original error.
 * @returns {string} Safe diagnostic code.
 */
function trustErrorCode(error) {
    if (error && typeof error === 'object' && 'code' in error && typeof error.code === 'string') {
        if (/^(?:TRUST|STORAGE|SERVICE)_[A-Z_]+$/.test(error.code)) {
            return error.code;
        }
        if (error.code === 'ENOENT') {
            return 'TRUST_FILE_MISSING';
        }
        if (error.code === 'EACCES' || error.code === 'EPERM') {
            return 'TRUST_READ_DENIED';
        }
    }
    return 'TRUST_INVALID';
}

/**
 * Check an own map entry.
 *
 * @param {object} value Public-key map.
 * @param {string} key Issuer identifier.
 * @returns {boolean} Whether the entry belongs to the map.
 */
function hasOwn(value, key) {
    return Object.prototype.hasOwnProperty.call(value, key);
}

/**
 * Fingerprint canonical Ed25519 public-key bytes.
 *
 * @param {string} pem Valid public SPKI PEM.
 * @returns {string} Lowercase SHA-256 SPKI-DER fingerprint.
 */
function publicKeyFingerprint(pem) {
    const der = crypto.createPublicKey(pem).export({ type: 'spki', format: 'der' });
    return crypto.createHash('sha256').update(der).digest('hex');
}

/**
 * Validate the complete public-map input.
 *
 * @param {unknown} value Untrusted key map.
 * @returns {PublicKeys} Canonical validated public keys.
 */
function normalizedKeys(value) {
    const keys = validatePublicKeys(value);
    const bytes = Buffer.byteLength(JSON.stringify(value), 'utf8');
    if (bytes > MAX_TRUST_BYTES) {
        fail('TRUST_FILE');
    }
    return keys;
}

/**
 * Create stable public JSON for bounded persistence.
 *
 * @param {PublicKeys} keys Validated public keys.
 * @returns {Buffer} Canonical UTF-8 JSON.
 */
function canonicalTrustBytes(keys) {
    const sorted = Object.fromEntries(
        Object.keys(keys)
            .sort()
            .map(kid => [kid, keys[kid]]),
    );
    const bytes = Buffer.from(`${JSON.stringify(sorted, null, 2)}\n`, 'utf8');
    if (bytes.length > MAX_TRUST_BYTES) {
        fail('TRUST_FILE');
    }
    return bytes;
}

/**
 * Parse a local cache which grants no authority by itself.
 *
 * @param {Buffer|null} bytes Bounded file bytes or absence.
 * @returns {PublicKeys} Validated map, empty only when no file exists.
 */
function parseImportedKeys(bytes) {
    if (!bytes) {
        return Object.create(null);
    }
    if (bytes.length < 2 || bytes.length > MAX_TRUST_BYTES) {
        fail('TRUST_FILE');
    }
    /** @type {unknown} */
    let parsed;
    try {
        parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    } catch {
        fail('TRUST_INVALID');
    }
    return normalizedKeys(parsed);
}

/**
 * Merge two authorized maps without resolving conflicting issuer identities.
 *
 * @param {PublicKeys} first Existing keys.
 * @param {PublicKeys} second Additional keys.
 * @param {number} [limit] Maximum resulting entries.
 * @returns {PublicKeys} Combined keys.
 */
function mergeKeys(first, second, limit = 32) {
    /** @type {PublicKeys} */
    const merged = Object.assign(Object.create(null), first);
    for (const [kid, pem] of Object.entries(second)) {
        if (hasOwn(merged, kid) && publicKeyFingerprint(merged[kid]) !== publicKeyFingerprint(pem)) {
            fail('TRUST_KEY_CONFLICT');
        }
        merged[kid] = pem;
    }
    if (Object.keys(merged).length > limit) {
        fail('TRUST_KEY_LIMIT');
    }
    return merged;
}

/**
 * Require an exact issuer and public-key authority match.
 *
 * @param {PublicKeys} keys Imported keys.
 * @param {PublicKeys} allowed Current independently authorized keys.
 * @returns {void} Throws when an imported key is not authorized.
 */
function authorizeImportedKeys(keys, allowed) {
    for (const [kid, pem] of Object.entries(keys)) {
        if (!hasOwn(allowed, kid)) {
            fail('TRUST_IMPORT_UNKNOWN_KEY');
        }
        if (publicKeyFingerprint(pem) !== publicKeyFingerprint(allowed[kid])) {
            fail('TRUST_KEY_CONFLICT');
        }
    }
}

class EosLicenseTrust {
    /**
     * Construct the authority manager without enabling release pins.
     *
     * @param {{store: TrustStore, readOsTrust: () => Promise<OsTrust>, manufacturerKeys?: PublicKeys}} options Internal persistence and authority dependencies.
     */
    constructor({ store, readOsTrust, manufacturerKeys }) {
        this.store = store;
        this.readOsTrust = readOsTrust;
        // Constructor-only dependency injection supports ephemeral integration
        // test issuers. Production never obtains pins from config, HTTP or env.
        const pins = manufacturerKeys === undefined ? MANUFACTURER_KEYS : manufacturerKeys;
        // A release may withdraw its final pin. Empty manufacturer metadata is
        // permitted; empty imported files and OS maps remain invalid.
        this.pins =
            pins &&
            typeof pins === 'object' &&
            !Array.isArray(pins) &&
            [null, Object.prototype].includes(Object.getPrototypeOf(pins)) &&
            Object.keys(pins).length === 0
                ? Object.freeze(Object.create(null))
                : normalizedKeys(pins);
        if (manufacturerKeys === undefined) {
            for (const [kid, expected] of Object.entries(MANUFACTURER_FINGERPRINTS)) {
                if (!hasOwn(this.pins, kid) || publicKeyFingerprint(this.pins[kid]) !== expected) {
                    fail('TRUST_RELEASE_METADATA');
                }
            }
        }
        /** @type {PublicKeys} */
        this.effective = Object.create(null);
        /** @type {TrustStatus} */
        this.view = {
            v: 1,
            ready: false,
            code: 'TRUST_STARTING',
            canImport: false,
            source: 'none',
            keys: [],
            allowedKeys: [],
        };
    }

    /**
     * Read current external authority and enforce explicit OS restrictions.
     *
     * @returns {Promise<{os: PublicKeys, allowed: PublicKeys, allowedKeys: AllowedKey[]}>} Current authority maps and bounded public descriptors.
     */
    async authority() {
        const result = await this.readOsTrust();
        const os = result.keys === null ? Object.create(null) : normalizedKeys(result.keys);
        // A conflicting manufacturer identity is never resolved by precedence.
        // The registry may contain 32 OS keys plus 32 unused release pins. Only
        // imported/effective maps have the stricter 32-key operational limit.
        const combined = mergeKeys(this.pins, os, 64);
        const allowed = result.explicit ? os : combined;
        /** @type {AllowedKey[]} */
        const allowedKeys = Object.keys(allowed)
            .sort()
            .map(kid => ({
                kid,
                fingerprint: publicKeyFingerprint(allowed[kid]),
                source: hasOwn(os, kid) ? (hasOwn(this.pins, kid) ? 'release+os' : 'os') : 'release',
            }));
        return { os, allowed, allowedKeys };
    }

    /**
     * Copy non-secret diagnostics.
     *
     * @returns {TrustStatus} Public status without PEM or license data.
     */
    statusView() {
        return {
            ...this.view,
            keys: this.view.keys.map(key => ({ ...key })),
            allowedKeys: this.view.allowedKeys.map(key => ({ ...key })),
        };
    }

    /**
     * Reauthorize persisted selections against current OS and release policy.
     *
     * @returns {Promise<PublicKeys>} Current effective public authority.
     */
    async load() {
        /** @type {AllowedKey[]} */
        let allowedKeys = [];
        let canImport = false;
        try {
            const authority = await this.authority();
            allowedKeys = authority.allowedKeys;
            canImport = allowedKeys.length > 0;
            const imported = parseImportedKeys(await this.store.readImportedTrust());
            authorizeImportedKeys(imported, authority.allowed);
            const effective = mergeKeys(authority.os, imported);
            const hasOs = Object.keys(authority.os).length > 0;
            const hasImported = Object.keys(imported).length > 0;
            /** @type {EffectiveKey[]} */
            const keys = Object.keys(effective)
                .sort()
                .map(kid => ({
                    kid,
                    fingerprint: publicKeyFingerprint(effective[kid]),
                    source: hasOwn(authority.os, kid) ? (hasOwn(imported, kid) ? 'os+restored' : 'os') : 'restored',
                }));
            this.effective = effective;
            this.view = {
                v: 1,
                ready: keys.length > 0,
                code: keys.length > 0 ? 'TRUST_READY' : 'TRUST_MISSING',
                canImport,
                source: hasOs ? (hasImported ? 'combined' : 'os') : hasImported ? 'restored' : 'none',
                keys,
                allowedKeys,
            };
            if (!keys.length) {
                fail('TRUST_MISSING');
            }
            return Object.freeze({ ...effective });
        } catch (error) {
            const code = trustErrorCode(error);
            this.effective = Object.create(null);
            this.view = {
                v: 1,
                ready: false,
                code,
                canImport: code === 'TRUST_MISSING' && canImport,
                source: 'none',
                keys: [],
                allowedKeys,
            };
            throw new LicenseError(code);
        }
    }

    /**
     * Add only independently authorized public keys.
     *
     * @param {unknown} candidate Untrusted imported public map.
     * @returns {Promise<PublicKeys>} Revalidated effective authority.
     */
    async importKeys(candidate) {
        // Validate all input and the existing map before the only write. A bad
        // upload must preserve both the previous map and the encrypted license.
        const incoming = normalizedKeys(candidate);
        const authority = await this.authority();
        authorizeImportedKeys(incoming, authority.allowed);
        const before = await this.store.readImportedTrust();
        const previous = parseImportedKeys(before);
        authorizeImportedKeys(previous, authority.allowed);
        const merged = mergeKeys(previous, incoming);
        mergeKeys(authority.os, merged);
        const bytes = canonicalTrustBytes(merged);
        if (!before || !before.equals(bytes)) {
            await this.store.writeImportedTrust(bytes);
        }
        // Re-read after persistence. An OS-policy change during the operation
        // must not become a transient entitlement grant.
        return this.load();
    }

    /**
     * Export the current effective public map after service-level refresh.
     *
     * @returns {PublicKeys} Canonical public keys only.
     */
    exportKeys() {
        if (!this.view.ready) {
            fail(this.view.code);
        }
        return Object.fromEntries(
            Object.keys(this.effective)
                .sort()
                .map(kid => [kid, this.effective[kid]]),
        );
    }
}

module.exports = {
    EosLicenseTrust,
    MANUFACTURER_KEYS,
    MANUFACTURER_FINGERPRINTS,
    MAX_TRUST_BYTES,
    canonicalTrustBytes,
    publicKeyFingerprint,
    trustErrorCode,
};
