/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
/**
 * AUTO-GENERATED RUNTIME FILE - NICHT MANUELL BEARBEITEN.
 *
 * Quelle: src-ts/runtime-executables/lib/influx-config.ts
 * Quell-Hash: sha256:f729bc8db4b96d8a3174ada1e38f6d9efbe1c5dc32a79ce608873348027ffad5
 * Erzeugung: npm run sync:ts-runtime-executables
 *
 * Zweck:
 * Diese JavaScript-Datei ist das ausführbare Build-Artefakt für lib/influx-config.js.
 * Die fachliche Bearbeitung erfolgt ab 0.7.131 in der TypeScript-Quelle.
 * Ab 0.7.132 sind doppelte Legacy-JS-Bäume wie .nwcore entfernt.
 *
 * Pflege-Regel:
 * 1. Änderung zuerst in src-ts/runtime-executables/ vornehmen.
 * 2. npm run sync:ts-runtime-executables ausführen.
 * 3. npm run test:runtime-executables prüfen.
 */
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prepareInfluxHistoryChange = prepareInfluxHistoryChange;
exports.redactInfluxHistoryConfig = redactInfluxHistoryConfig;
exports.protectInfluxHistoryConfig = protectInfluxHistoryConfig;
exports.restoreInfluxHistoryConfig = restoreInfluxHistoryConfig;
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Prüft und schützt die direkte InfluxDB-2-Konfiguration bei Speicherung, Abruf und Wiederherstellung.
 * Daten und Wirkung: Validiert feste Felder und Netzadresse, schützt den Token mit vorhandener ioBroker-Kryptografie und blendet Zugangsdaten in öffentlichen Antworten aus.
 * Bei Änderungen: Zielwechsel, leere Tokenfelder, falsche Wiederherstellungsschlüssel und den Erhalt der übrigen Geräte-/EMS-Konfiguration gemeinsam testen.
 */
/** Narrow history credential boundary. Runtime uses a plaintext token only in
 * memory. State/backup writes store a purpose-bound encrypted envelope; every
 * browser/export view removes both forms. Unrelated saved settings are preserved. */
const influx_direct_1 = require("./influx-direct");
const influx_network_policy_1 = require("./influx-network-policy");
function record(value) { return !!value && typeof value === 'object' && !Array.isArray(value); }
function failure(code) { return Object.assign(new Error(code), { code }); }
function keys(value, allowed) {
    if (Object.keys(value).some(key => !allowed.includes(key)))
        throw failure('EOS_INFLUX_CONFIG_INVALID');
}
function cloneRoot(root) {
    if (!record(root))
        return {};
    const history = record(root.history) ? { ...root.history } : undefined;
    if (history && record(history.influxdb2))
        history.influxdb2 = { ...history.influxdb2 };
    return { ...root, ...(history ? { history } : {}) };
}
function tokenValue(value) {
    if (typeof value !== 'string' || !value || value.length > 8192 || !/^[!-~]+$/.test(value))
        throw failure('EOS_INFLUX_TOKEN_INVALID');
    return value;
}
function tokenPresent(config) { return (typeof config.token === 'string' && !!config.token) || record(config.tokenEncrypted); }
/** Only the dedicated installer API accepts new connection values. Blank token
 * preserves the old value only on the same normalized origin, never another host. */
function prepareInfluxHistoryChange(previous, incoming) {
    if (!record(incoming))
        throw failure('EOS_INFLUX_CONFIG_INVALID');
    keys(incoming, ['provider', 'instance', 'influxdb2']);
    const oldHistory = record(previous) ? previous : {};
    const provider = incoming.provider === undefined ? (oldHistory.provider ?? 'adapter') : incoming.provider;
    if (provider !== 'adapter' && provider !== 'influxdb2')
        throw failure('EOS_INFLUX_PROVIDER_INVALID');
    if (incoming.instance !== undefined && (typeof incoming.instance !== 'string' ||
        (incoming.instance !== '' && !/^[a-z][a-z0-9_-]{0,63}\.\d{1,6}$/.test(incoming.instance))))
        throw failure('EOS_INFLUX_CONFIG_INVALID');
    const nextHistory = { ...oldHistory, ...(incoming.instance !== undefined ? { instance: incoming.instance } : {}), provider };
    const oldConnection = record(oldHistory.influxdb2) ? oldHistory.influxdb2 : {};
    if (incoming.influxdb2 === undefined && provider === 'adapter')
        return nextHistory;
    if (incoming.influxdb2 !== undefined && !record(incoming.influxdb2))
        throw failure('EOS_INFLUX_CONFIG_INVALID');
    const candidate = record(incoming.influxdb2) ? incoming.influxdb2 : {};
    keys(candidate, ['url', 'organization', 'bucket', 'token', 'caCertificate', 'clearCaCertificate']);
    if ((candidate.url !== undefined && typeof candidate.url !== 'string') ||
        (candidate.organization !== undefined && typeof candidate.organization !== 'string') ||
        (candidate.bucket !== undefined && typeof candidate.bucket !== 'string'))
        throw failure('EOS_INFLUX_CONFIG_INVALID');
    if (candidate.clearCaCertificate !== undefined && typeof candidate.clearCaCertificate !== 'boolean')
        throw failure('EOS_INFLUX_CONFIG_INVALID');
    if (candidate.token !== undefined && typeof candidate.token !== 'string')
        throw failure('EOS_INFLUX_TOKEN_INVALID');
    if (candidate.caCertificate !== undefined && typeof candidate.caCertificate !== 'string')
        throw failure('EOS_INFLUX_CA_INVALID');
    const url = (0, influx_network_policy_1.validateInfluxUrl)(candidate.url ?? oldConnection.url);
    const providedToken = typeof candidate.token === 'string' ? candidate.token.trim() : '';
    if (!providedToken && tokenPresent(oldConnection)) {
        let oldOrigin = '';
        try {
            oldOrigin = (0, influx_network_policy_1.validateInfluxUrl)(oldConnection.url).origin;
        }
        catch { /* Invalid old destination cannot authorize secret reuse. */ }
        if (url.origin !== oldOrigin)
            throw failure('EOS_INFLUX_NEW_DESTINATION_REQUIRES_TOKEN');
    }
    const rawCa = candidate.clearCaCertificate === true ? '' : candidate.caCertificate || oldConnection.caCertificate || '';
    const config = {
        url: url.href,
        organization: candidate.organization ?? oldConnection.organization,
        bucket: candidate.bucket ?? oldConnection.bucket,
        token: tokenValue(providedToken || oldConnection.token),
        ...(rawCa ? { caCertificate: rawCa } : {}),
    };
    const result = { ...nextHistory, influxdb2: (0, influx_direct_1.validateInfluxDirectConfig)(config) };
    delete result.credentialError;
    return result;
}
/** Whole-root view for /config, installer reads and JSON exports; never mutates runtime. */
function redactInfluxHistoryConfig(root) {
    const copy = cloneRoot(root);
    if (record(copy.history) && record(copy.history.influxdb2)) {
        const connection = copy.history.influxdb2;
        connection.hasToken = tokenPresent(connection);
        connection.hasCaCertificate = typeof connection.caCertificate === 'string' && !!connection.caCertificate;
        delete connection.token;
        delete connection.tokenEncrypted;
        delete connection.caCertificate;
    }
    return copy;
}
/** No silent plaintext fallback if ioBroker crypto/system secret is unavailable. */
function protectInfluxHistoryConfig(root, codec) {
    const copy = cloneRoot(root);
    if (!record(copy.history) || !record(copy.history.influxdb2))
        return copy;
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
    const origin = (0, influx_network_policy_1.validateInfluxUrl)(connection.url).origin;
    const plaintext = JSON.stringify({ purpose: 'nexowatt.history.influxdb2.token.v1', origin, token });
    let encrypted;
    try {
        encrypted = codec.encrypt(plaintext);
    }
    catch {
        throw failure('EOS_INFLUX_TOKEN_ENCRYPTION_FAILED');
    }
    if (typeof encrypted !== 'string' || !encrypted || encrypted === plaintext || encrypted === token || encrypted.length > 32768) {
        throw failure('EOS_INFLUX_TOKEN_ENCRYPTION_FAILED');
    }
    connection.tokenEncrypted = { v: 1, encrypted };
    delete connection.token;
    delete connection.hasToken;
    return copy;
}
function restoreInfluxHistoryConfig(root, codec) {
    const copy = cloneRoot(root);
    if (!record(copy.history) || !record(copy.history.influxdb2))
        return copy;
    const connection = copy.history.influxdb2;
    if (connection.tokenEncrypted === undefined) {
        if (connection.token !== undefined && connection.token !== '') {
            try {
                (0, influx_network_policy_1.validateInfluxUrl)(connection.url);
                (0, influx_direct_1.validateInfluxDirectConfig)(connection);
                delete copy.history.credentialError;
            }
            catch {
                delete connection.token;
                copy.history.credentialError = 'EOS_INFLUX_CONFIG_INVALID';
            }
        }
        return copy;
    }
    const envelope = connection.tokenEncrypted;
    try {
        if (!record(envelope) || envelope.v !== 1 || typeof envelope.encrypted !== 'string' || !envelope.encrypted || envelope.encrypted.length > 32768)
            throw new Error();
        const plaintext = codec.decrypt(envelope.encrypted);
        if (typeof plaintext !== 'string' || plaintext.length > 16384 || plaintext === envelope.encrypted)
            throw new Error();
        const decoded = JSON.parse(plaintext);
        if (!record(decoded) || decoded.purpose !== 'nexowatt.history.influxdb2.token.v1' ||
            decoded.origin !== (0, influx_network_policy_1.validateInfluxUrl)(connection.url).origin)
            throw new Error();
        connection.token = tokenValue(decoded.token);
        (0, influx_direct_1.validateInfluxDirectConfig)(connection);
        delete connection.tokenEncrypted;
        delete connection.hasToken;
        delete copy.history.credentialError;
    }
    catch {
        // A restored database can belong to another ioBroker system secret. Keep
        // every device/EMS setting and the recoverable ciphertext; isolate history.
        delete connection.token;
        copy.history.credentialError = 'EOS_INFLUX_TOKEN_DECRYPTION_FAILED';
    }
    return copy;
}
