/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
// @runtime-transpile
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Prüft und schützt die direkte InfluxDB-2-Konfiguration bei Speicherung, Abruf und Wiederherstellung.
 * Daten und Wirkung: Validiert feste Felder und Netzadresse, schützt den Token mit vorhandener ioBroker-Kryptografie und blendet Zugangsdaten in öffentlichen Antworten aus.
 * Bei Änderungen: Zielwechsel, leere Tokenfelder, falsche Wiederherstellungsschlüssel und den Erhalt der übrigen Geräte-/EMS-Konfiguration gemeinsam testen.
 */
/** Narrow history credential boundary. Runtime uses a plaintext token only in
 * memory. State/backup writes store a purpose-bound encrypted envelope; every
 * browser/export view removes both forms. Unrelated saved settings are preserved. */
import { validateInfluxDirectConfig } from './influx-direct';
import { validateInfluxUrl } from './influx-network-policy';

type Dict = Record<string, unknown>;
export interface InfluxSecretCodec { encrypt(value: string): string; decrypt(value: string): string }
function record(value: unknown): value is Dict { return !!value && typeof value === 'object' && !Array.isArray(value); }
function failure(code: string): Error & { code: string } { return Object.assign(new Error(code), { code }); }
function keys(value: Dict, allowed: readonly string[]): void {
    if (Object.keys(value).some(key => !allowed.includes(key))) throw failure('EOS_INFLUX_CONFIG_INVALID');
}
function cloneRoot(root: unknown): Dict {
    if (!record(root)) return {};
    const history = record(root.history) ? { ...root.history } : undefined;
    if (history && record(history.influxdb2)) history.influxdb2 = { ...history.influxdb2 };
    return { ...root, ...(history ? { history } : {}) };
}
function tokenValue(value: unknown): string {
    if (typeof value !== 'string' || !value || value.length > 8192 || !/^[!-~]+$/.test(value)) throw failure('EOS_INFLUX_TOKEN_INVALID');
    return value;
}
function tokenPresent(config: Dict): boolean { return (typeof config.token === 'string' && !!config.token) || record(config.tokenEncrypted); }

/** Only the dedicated installer API accepts new connection values. Blank token
 * preserves the old value only on the same normalized origin, never another host. */
export function prepareInfluxHistoryChange(previous: unknown, incoming: unknown): Dict {
    if (!record(incoming)) throw failure('EOS_INFLUX_CONFIG_INVALID');
    keys(incoming, ['provider', 'instance', 'influxdb2']);
    const oldHistory = record(previous) ? previous : {};
    const provider = incoming.provider === undefined ? (oldHistory.provider ?? 'adapter') : incoming.provider;
    if (provider !== 'adapter' && provider !== 'influxdb2') throw failure('EOS_INFLUX_PROVIDER_INVALID');
    if (incoming.instance !== undefined && (typeof incoming.instance !== 'string' ||
        (incoming.instance !== '' && !/^[a-z][a-z0-9_-]{0,63}\.\d{1,6}$/.test(incoming.instance)))) throw failure('EOS_INFLUX_CONFIG_INVALID');
    const nextHistory = { ...oldHistory, ...(incoming.instance !== undefined ? { instance: incoming.instance } : {}), provider };
    const oldConnection = record(oldHistory.influxdb2) ? oldHistory.influxdb2 : {};
    if (incoming.influxdb2 === undefined && provider === 'adapter') return nextHistory;
    if (incoming.influxdb2 !== undefined && !record(incoming.influxdb2)) throw failure('EOS_INFLUX_CONFIG_INVALID');
    const candidate = record(incoming.influxdb2) ? incoming.influxdb2 : {};
    keys(candidate, ['url', 'organization', 'bucket', 'token', 'caCertificate', 'clearCaCertificate']);
    if ((candidate.url !== undefined && typeof candidate.url !== 'string') ||
        (candidate.organization !== undefined && typeof candidate.organization !== 'string') ||
        (candidate.bucket !== undefined && typeof candidate.bucket !== 'string')) throw failure('EOS_INFLUX_CONFIG_INVALID');
    if (candidate.clearCaCertificate !== undefined && typeof candidate.clearCaCertificate !== 'boolean') throw failure('EOS_INFLUX_CONFIG_INVALID');
    if (candidate.token !== undefined && typeof candidate.token !== 'string') throw failure('EOS_INFLUX_TOKEN_INVALID');
    if (candidate.caCertificate !== undefined && typeof candidate.caCertificate !== 'string') throw failure('EOS_INFLUX_CA_INVALID');
    const url = validateInfluxUrl(candidate.url ?? oldConnection.url);
    const providedToken = typeof candidate.token === 'string' ? candidate.token.trim() : '';
    if (!providedToken && tokenPresent(oldConnection)) {
        let oldOrigin = '';
        try { oldOrigin = validateInfluxUrl(oldConnection.url).origin; } catch { /* Invalid old destination cannot authorize secret reuse. */ }
        if (url.origin !== oldOrigin) throw failure('EOS_INFLUX_NEW_DESTINATION_REQUIRES_TOKEN');
    }
    const rawCa = candidate.clearCaCertificate === true ? '' : candidate.caCertificate || oldConnection.caCertificate || '';
    const config = {
        url: url.href,
        organization: candidate.organization ?? oldConnection.organization,
        bucket: candidate.bucket ?? oldConnection.bucket,
        token: tokenValue(providedToken || oldConnection.token),
        ...(rawCa ? { caCertificate: rawCa } : {}),
    };
    const result: Dict = { ...nextHistory, influxdb2: validateInfluxDirectConfig(config) };
    delete result.credentialError;
    return result;
}

/** Whole-root view for /config, installer reads and JSON exports; never mutates runtime. */
export function redactInfluxHistoryConfig(root: unknown): Dict {
    const copy = cloneRoot(root);
    if (record(copy.history) && record(copy.history.influxdb2)) {
        const connection = copy.history.influxdb2;
        connection.hasToken = tokenPresent(connection);
        connection.hasCaCertificate = typeof connection.caCertificate === 'string' && !!connection.caCertificate;
        delete connection.token; delete connection.tokenEncrypted; delete connection.caCertificate;
    }
    return copy;
}

/** No silent plaintext fallback if ioBroker crypto/system secret is unavailable. */
export function protectInfluxHistoryConfig(root: unknown, codec: InfluxSecretCodec): Dict {
    const copy = cloneRoot(root);
    if (!record(copy.history) || !record(copy.history.influxdb2)) return copy;
    const connection = copy.history.influxdb2;
    if (copy.history.credentialError) {
        // A failed restore must never re-encrypt a plaintext token inherited from
        // an older merge. Keep its recoverable envelope and quarantine this history.
        delete connection.token;
        return copy;
    }
    if (connection.token === undefined || connection.token === '') {
        delete connection.token;
        return copy;
    }
    const token = tokenValue(connection.token);
    const origin = validateInfluxUrl(connection.url).origin;
    const plaintext = JSON.stringify({ purpose: 'nexowatt.history.influxdb2.token.v1', origin, token });
    let encrypted: string;
    try { encrypted = codec.encrypt(plaintext); } catch { throw failure('EOS_INFLUX_TOKEN_ENCRYPTION_FAILED'); }
    if (typeof encrypted !== 'string' || !encrypted || encrypted === plaintext || encrypted === token || encrypted.length > 32768) {
        throw failure('EOS_INFLUX_TOKEN_ENCRYPTION_FAILED');
    }
    connection.tokenEncrypted = { v: 1, encrypted };
    delete connection.token; delete connection.hasToken;
    return copy;
}

export function restoreInfluxHistoryConfig(root: unknown, codec: InfluxSecretCodec): Dict {
    const copy = cloneRoot(root);
    if (!record(copy.history) || !record(copy.history.influxdb2)) return copy;
    const connection = copy.history.influxdb2;
    if (connection.tokenEncrypted === undefined) {
        if (connection.token !== undefined && connection.token !== '') {
            try {
                validateInfluxUrl(connection.url);
                validateInfluxDirectConfig(connection);
                delete copy.history.credentialError;
            } catch {
                delete connection.token;
                copy.history.credentialError = 'EOS_INFLUX_CONFIG_INVALID';
            }
        }
        return copy;
    }
    const envelope = connection.tokenEncrypted;
    try {
        if (!record(envelope) || envelope.v !== 1 || typeof envelope.encrypted !== 'string' || !envelope.encrypted || envelope.encrypted.length > 32768) throw new Error();
        const plaintext = codec.decrypt(envelope.encrypted);
        if (typeof plaintext !== 'string' || plaintext.length > 16384 || plaintext === envelope.encrypted) throw new Error();
        const decoded: unknown = JSON.parse(plaintext);
        if (!record(decoded) || decoded.purpose !== 'nexowatt.history.influxdb2.token.v1' ||
            decoded.origin !== validateInfluxUrl(connection.url).origin) throw new Error();
        connection.token = tokenValue(decoded.token);
        validateInfluxDirectConfig(connection);
        delete connection.tokenEncrypted; delete connection.hasToken;
        delete copy.history.credentialError;
    } catch {
        // A restored database can belong to another ioBroker system secret. Keep
        // every device/EMS setting and the recoverable ciphertext; isolate history.
        delete connection.token;
        copy.history.credentialError = 'EOS_INFLUX_TOKEN_DECRYPTION_FAILED';
    }
    return copy;
}
