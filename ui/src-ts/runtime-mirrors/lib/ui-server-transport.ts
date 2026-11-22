/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
// @ts-nocheck
/**
 * TypeScript-Parallelspiegel: lib/ui-server-transport.js
 *
 * Zweck:
 * Diese Datei ist die TypeScript-Vorbereitung der bestehenden JavaScript-Runtime-Datei.
 * Sie wird noch nicht produktiv ausgeführt. Die zugehörige erzeugte JavaScript-Laufzeitdatei ist:
 * lib/ui-server-transport.js
 *
 * Zusammenhang:
 * Der Spiegel hilft uns, die JS-Datei später schrittweise zu typisieren, zu testen und
 * kontrolliert auf TypeScript umzustellen. Produktive Originalquellen liegen unter
 * src-ts/runtime-executables/ bzw. den im generierten JS genannten TS-Pfaden.
 * Dort ändern, Laufzeit erzeugen und danach die Spiegel synchronisieren.
 * Build-/Prüfskripte ohne TS-Original werden weiterhin unter scripts/ gepflegt.
 *
 * Wichtig für die Migration:
 * - Diese Datei enthält vorübergehend @ts-nocheck.
 * - Der nächste Schritt ist pro Modul echte Typisierung statt pauschalem No-Check.
 * - Fachliche Kommentare markieren die Abschnitte, die später einzeln migriert werden.
 *
 * Original-Hash: 95e380f0af6dc93de004dae7aee441b76c7abad301faf5760737f25757ee8530
 */

/**
 * Code-Teil: Runtime-Spiegel der kompletten Datei
 *
 * Zweck:
 * Dieser Abschnitt enthält den ursprünglichen JavaScript-Code als TypeScript-Parallelkopie.
 * Einzelne Funktionen werden später pro Modul weiter typisiert; Dateien ohne eigene
 * Funktionsdeklarationen bleiben trotzdem über diesen Dateikommentar dokumentiert.
 */

/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
/**
 * AUTO-GENERATED RUNTIME FILE - NICHT MANUELL BEARBEITEN.
 *
 * Quelle: src-ts/runtime-executables/lib/ui-server-transport.ts
 * Quell-Hash: sha256:1c00bce2b740c137b3e8844af114505ff71411fead2f163c544b3bcde64411b0
 * Erzeugung: npm run sync:ts-runtime-executables
 *
 * Zweck:
 * Diese JavaScript-Datei ist das ausführbare Build-Artefakt für lib/ui-server-transport.js.
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
exports.UiTlsConfigurationError = exports.UI_TLS_LIMITS = void 0;
exports.resolveUiTlsOptions = resolveUiTlsOptions;
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Löst den ausdrücklich gewählten direkten HTTPS-Transport der UI auf.
 * Daten und Wirkung: Liest benannte Zertifikate über die zentrale Controller-API,
 * begrenzt PEM-Inhalte und prüft Zertifikate, Schlüsselpaar und TLS-Kontext.
 * Liefert HTTPS-Optionen; erzeugt selbst weder Listener noch Schlüssel oder Dateien.
 * Bei Änderungen: Zertifikatsauswahl, PEM-Grenzen, Kette, Fristen sowie tatsächliche HTTPS-Start-/Stop-Fälle prüfen.
 * Sicherheitsgrenze: secure=true schlägt bei Fehlern geschlossen fehl. Es gibt
 * keinen HTTP-Fallback und keine automatische Auswahl gemeinsamer Zertifikate.
 * Die Controller-Lese-API besitzt keinen Abbruchvertrag: Nach 5 s wird das
 * Startwarten beendet; eine ausstehende Abfrage bleibt bis zum Callback belegt.
 * Späte Antworten dürfen keinen Serverstart auslösen. Ein blockierender fremder
 * Controller-Aufruf kann im selben JavaScript-Thread nicht gewaltsam beendet werden.
 * Verknüpfung: docs/security/UI_TLS_TRANSPORT_HELPER_DE.md
 */
const node_crypto_1 = require("node:crypto");
const node_perf_hooks_1 = require("node:perf_hooks");
const node_tls_1 = require("node:tls");
exports.UI_TLS_LIMITS = Object.freeze({
    readBudgetMs: 5000,
    handshakeTimeoutMs: 5000,
    keyBytes: 64 * 1024,
    publicBytes: 64 * 1024,
    chainBytes: 256 * 1024,
    certificateCount: 8,
    nameLength: 256,
});
const ERROR_MESSAGES = {
    NW_UI_TLS_MODE_INVALID: 'HTTPS ist nicht eindeutig konfiguriert. Die Einstellung muss ein Ein-/Aus-Wert sein.',
    NW_UI_TLS_CERTIFICATE_SELECTION_REQUIRED: 'Für HTTPS müssen ein öffentliches Zertifikat und ein privater Schlüssel in der Systemverwaltung ausgewählt sein.',
    NW_UI_TLS_CERTIFICATE_NAME_INVALID: 'Die Zertifikatsauswahl ist ungültig. Nur Namen aus der zentralen Zertifikatverwaltung sind zulässig.',
    NW_UI_TLS_CERTIFICATE_READER_UNAVAILABLE: 'Die zentrale Zertifikatverwaltung ist für diesen Serverstart nicht verfügbar.',
    NW_UI_TLS_CERTIFICATE_READ_PENDING: 'Eine frühere Zertifikatsabfrage ist noch nicht abgeschlossen. HTTPS bleibt bis zur Klärung gesperrt.',
    NW_UI_TLS_CERTIFICATE_READ_FAILED: 'Die ausgewählten Zertifikate konnten nicht aus der Systemverwaltung geladen werden.',
    NW_UI_TLS_CERTIFICATE_READ_TIMEOUT: 'Die Zertifikatsprüfung wurde nicht innerhalb von fünf Sekunden abgeschlossen. HTTPS bleibt gesperrt.',
    NW_UI_TLS_CERTIFICATE_SIZE_EXCEEDED: 'Die ausgewählten Zertifikatsdaten überschreiten die zulässige Größe oder Anzahl.',
    NW_UI_TLS_CERTIFICATE_FORMAT_INVALID: 'Die ausgewählten Zertifikate enthalten keine vollständig gültigen PEM-Zertifikate.',
    NW_UI_TLS_KEY_FORMAT_INVALID: 'Der ausgewählte private Schlüssel ist kein unterstützter unverschlüsselter PEM-Schlüssel.',
    NW_UI_TLS_KEY_MISMATCH: 'Öffentliches Zertifikat und privater Schlüssel gehören nicht zusammen.',
    NW_UI_TLS_CERTIFICATE_TIME_INVALID: 'Ein ausgewähltes Zertifikat ist abgelaufen oder noch nicht gültig. Zertifikate und Systemzeit prüfen.',
    NW_UI_TLS_CHAIN_INVALID: 'Die ausgewählte Zertifikatskette passt nicht vollständig zum Serverzertifikat.',
    NW_UI_TLS_CONTEXT_INVALID: 'Aus den ausgewählten Zertifikaten konnte kein gültiger TLS-Serverkontext erstellt werden.',
};
const ERROR_MESSAGE_LOOKUP = new Map(Object.entries(ERROR_MESSAGES));
/** Ausschließlich feste Meldungen; fremde Fehler, Dateipfade und PEM bleiben intern. */
class UiTlsConfigurationError extends Error {
    constructor(code) {
        super(ERROR_MESSAGE_LOOKUP.get(code) ?? ERROR_MESSAGES.NW_UI_TLS_CONTEXT_INVALID);
        this.name = 'UiTlsConfigurationError';
        this.code = code;
    }
}
exports.UiTlsConfigurationError = UiTlsConfigurationError;
const pendingReads = new WeakMap();
/**
 * Code-Teil: fail
 *
 * Zweck:
 * Automatisch markierter Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
function fail(code) { throw new UiTlsConfigurationError(code); }
/**
 * Code-Teil: certificateName
 *
 * Zweck:
 * Automatisch markierter Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
function certificateName(value, required) {
    if (value === undefined || value === null || value === '') {
        if (required)
            fail('NW_UI_TLS_CERTIFICATE_SELECTION_REQUIRED');
        return undefined;
    }
    if (typeof value !== 'string' || value.length > exports.UI_TLS_LIMITS.nameLength || !value.trim()
        || value !== value.trim() || /[\u0000-\u001f\u007f]/u.test(value) || value.includes('-----BEGIN')) {
        fail('NW_UI_TLS_CERTIFICATE_NAME_INVALID');
    }
    return value;
}
/**
 * Code-Teil: checkDeadline
 *
 * Zweck:
 * Automatisch markierter Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
function checkDeadline(deadline) {
    if (node_perf_hooks_1.performance.now() >= deadline)
        fail('NW_UI_TLS_CERTIFICATE_READ_TIMEOUT');
}
/** Eine Controller-Abfrage pro Adapter; kein unbounded Retry nach Lesezeitüberschreitung. */
function readCertificates(adapter, publicName, privateName, chainedName, deadline) {
    let reader;
    try {
        reader = adapter.getCertificates;
    }
    catch {
        fail('NW_UI_TLS_CERTIFICATE_READER_UNAVAILABLE');
    }
    if (typeof reader !== 'function')
        fail('NW_UI_TLS_CERTIFICATE_READER_UNAVAILABLE');
    if (pendingReads.has(adapter))
        fail('NW_UI_TLS_CERTIFICATE_READ_PENDING');
    checkDeadline(deadline);
    const identity = Symbol('ui-certificate-read');
    pendingReads.set(adapter, identity);
    return new Promise((resolve, reject) => {
        let settled = false;
        const remaining = Math.max(1, Math.ceil(deadline - node_perf_hooks_1.performance.now()));
        const timer = setTimeout(() => {
            if (settled)
                return;
            settled = true;
            // Die Controller-API kann nicht abgebrochen werden. Den Slot deshalb
            // nicht freigeben und keine parallele Ersatzabfrage zulassen.
            reject(new UiTlsConfigurationError('NW_UI_TLS_CERTIFICATE_READ_TIMEOUT'));
        }, remaining);
/**
 * Code-Teil: finish
 *
 * Zweck:
 * Automatisch markierter Arrow-Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
        const finish = (error, certificates) => {
            if (pendingReads.get(adapter) === identity)
                pendingReads.delete(adapter);
            if (settled)
                return;
            settled = true;
            clearTimeout(timer);
            if (node_perf_hooks_1.performance.now() >= deadline) {
                reject(new UiTlsConfigurationError('NW_UI_TLS_CERTIFICATE_READ_TIMEOUT'));
                return;
            }
            if (error !== null && error !== undefined) {
                reject(new UiTlsConfigurationError('NW_UI_TLS_CERTIFICATE_READ_FAILED'));
                return;
            }
            resolve(certificates);
        };
        try {
            // Alle Namen werden ausdrücklich übergeben. Keine Default-Key-Auswahl,
            // keine eigene Datenbank-/Dateilesestrecke und keine automatische ACME-Anlage.
            const returned = reader.call(adapter, publicName, privateName, chainedName, finish);
            // Manche Controller-Versionen liefern zusätzlich ein Promise. Auch dessen
            // Fehler wird abgefangen; nur der belegte Callback liefert Zertifikate.
            void Promise.resolve(returned).catch(() => { finish(new UiTlsConfigurationError('NW_UI_TLS_CERTIFICATE_READ_FAILED')); });
        }
        catch {
            finish(new UiTlsConfigurationError('NW_UI_TLS_CERTIFICATE_READ_FAILED'));
        }
    });
}
/**
 * Code-Teil: ownField
 *
 * Zweck:
 * Automatisch markierter Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
function ownField(value, key) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        fail('NW_UI_TLS_CERTIFICATE_FORMAT_INVALID');
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value'))
        return undefined;
    return descriptor.value;
}
/** Nur begrenzter ASCII-PEM-Inhalt, keine Dateinamen und keine Objektkonvertierung. */
function pemText(value, maxBytes, kind) {
    const invalid = kind === 'key' ? 'NW_UI_TLS_KEY_FORMAT_INVALID' : 'NW_UI_TLS_CERTIFICATE_FORMAT_INVALID';
    let text;
    if (Buffer.isBuffer(value)) {
        if (value.byteLength > maxBytes)
            fail('NW_UI_TLS_CERTIFICATE_SIZE_EXCEEDED');
        text = value.toString('utf8');
    }
    else if (typeof value === 'string') {
        if (value.length > maxBytes || Buffer.byteLength(value, 'utf8') > maxBytes)
            fail('NW_UI_TLS_CERTIFICATE_SIZE_EXCEEDED');
        text = value;
    }
    else {
        fail(invalid);
    }
    if (!text.trim() || /[^\x09\x0a\x0d\x20-\x7e]/u.test(text))
        fail(invalid);
    return text.replace(/\r\n?/gu, '\n').trim();
}
/** Linearer PEM-Parser. Außer Whitespace dürfen keine Inhalte außerhalb der Blöcke stehen. */
function pemBlocks(text, kind, maxCount) {
    const invalid = kind === 'key' ? 'NW_UI_TLS_KEY_FORMAT_INVALID' : 'NW_UI_TLS_CERTIFICATE_FORMAT_INVALID';
    const allowed = kind === 'key' ? new Set(['PRIVATE KEY', 'RSA PRIVATE KEY', 'EC PRIVATE KEY']) : new Set(['CERTIFICATE']);
    const blocks = [];
    const lines = text.split('\n');
    let label = '';
    let body = [];
    for (const raw of lines) {
        const line = raw.trim();
        if (!line)
            continue;
        if (!label) {
            if (!line.startsWith('-----BEGIN ') || !line.endsWith('-----'))
                fail(invalid);
            label = line.slice(11, -5);
            if (!allowed.has(label))
                fail(invalid);
            body = [line];
        }
        else if (line === '-----END ' + label + '-----') {
            if (body.length < 2)
                fail(invalid);
            body.push(line);
            blocks.push(body.join('\n') + '\n');
            if (blocks.length > maxCount)
                fail('NW_UI_TLS_CERTIFICATE_SIZE_EXCEEDED');
            label = '';
            body = [];
        }
        else {
            if (!/^[A-Za-z0-9+/]+={0,2}$/u.test(line))
                fail(invalid);
            body.push(line);
        }
    }
    if (label || blocks.length === 0)
        fail(invalid);
    return blocks;
}
/**
 * Code-Teil: validatedOptions
 *
 * Zweck:
 * Automatisch markierter Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
function validatedOptions(value, withChain, deadline) {
    checkDeadline(deadline);
    const key = pemBlocks(pemText(ownField(value, 'key'), exports.UI_TLS_LIMITS.keyBytes, 'key'), 'key', 1)[0];
    if (!key)
        fail('NW_UI_TLS_KEY_FORMAT_INVALID');
    const certificates = pemBlocks(pemText(ownField(value, 'cert'), exports.UI_TLS_LIMITS.publicBytes, 'certificate'), 'certificate', exports.UI_TLS_LIMITS.certificateCount);
    if (withChain)
        certificates.push(...pemBlocks(pemText(ownField(value, 'ca'), exports.UI_TLS_LIMITS.chainBytes, 'certificate'), 'certificate', exports.UI_TLS_LIMITS.certificateCount));
    if (certificates.length > exports.UI_TLS_LIMITS.certificateCount)
        fail('NW_UI_TLS_CERTIFICATE_SIZE_EXCEEDED');
    const parsed = [];
    const unique = [];
    const fingerprints = new Set();
    for (const pem of certificates) {
        checkDeadline(deadline);
        let certificate;
        try {
            certificate = new node_crypto_1.X509Certificate(pem);
        }
        catch {
            fail('NW_UI_TLS_CERTIFICATE_FORMAT_INVALID');
        }
        const now = Date.now(), validFrom = Date.parse(certificate.validFrom), validTo = Date.parse(certificate.validTo);
        if (!Number.isFinite(validFrom) || !Number.isFinite(validTo) || now < validFrom || now > validTo)
            fail('NW_UI_TLS_CERTIFICATE_TIME_INVALID');
        if (!fingerprints.has(certificate.fingerprint256)) {
            fingerprints.add(certificate.fingerprint256);
            parsed.push(certificate);
            unique.push(pem);
        }
    }
    const leaf = parsed[0];
    if (!leaf)
        fail('NW_UI_TLS_CERTIFICATE_FORMAT_INVALID');
    try {
        if (!leaf.checkPrivateKey((0, node_crypto_1.createPrivateKey)(key)))
            fail('NW_UI_TLS_KEY_MISMATCH');
    }
    catch (error) {
        if (error instanceof UiTlsConfigurationError)
            throw error;
        fail('NW_UI_TLS_KEY_FORMAT_INVALID');
    }
    let child = leaf;
    for (const issuer of parsed.slice(1)) {
        checkDeadline(deadline);
        if (!issuer.ca || !child.checkIssued(issuer) || !child.verify(issuer.publicKey))
            fail('NW_UI_TLS_CHAIN_INVALID');
        child = issuer;
    }
    const options = { key, cert: unique.join(''), minVersion: 'TLSv1.2', requestCert: false, honorCipherOrder: true, handshakeTimeout: exports.UI_TLS_LIMITS.handshakeTimeoutMs };
    try {
        (0, node_tls_1.createSecureContext)(options);
    }
    catch {
        fail('NW_UI_TLS_CONTEXT_INVALID');
    }
    checkDeadline(deadline);
    return options;
}
/**
 * Null ausschließlich für vorhandenen HTTP-/Proxybetrieb. Bei HTTPS liefert
 * jeder Fehler einen festen, geheimnisfreien UiTlsConfigurationError; der
 * Aufrufer darf anschließend keinen HTTP-Listener als Ersatz eröffnen.
 * Neue Zertifikate werden beim nächsten kontrollierten Adapterstart gelesen.
 */
async function resolveUiTlsOptions(adapter, config) {
    try {
        if (config.secure === undefined || config.secure === false)
            return null;
        if (config.secure !== true)
            fail('NW_UI_TLS_MODE_INVALID');
        const deadline = node_perf_hooks_1.performance.now() + exports.UI_TLS_LIMITS.readBudgetMs;
        const publicName = certificateName(config.certPublic, true);
        const privateName = certificateName(config.certPrivate, true);
        const chainedName = certificateName(config.certChained, false);
        if (!publicName || !privateName)
            fail('NW_UI_TLS_CERTIFICATE_SELECTION_REQUIRED');
        const certificates = await readCertificates(adapter, publicName, privateName, chainedName, deadline);
        return validatedOptions(certificates, chainedName !== undefined, deadline);
    }
    catch (error) {
        if (error instanceof UiTlsConfigurationError)
            throw error;
        // Auch ungewöhnliche Proxy-/Getter-/Kryptoausnahmen verlassen die Grenze
        // niemals mit fremder message/cause oder Schlüsselmaterial.
        fail('NW_UI_TLS_CONTEXT_INVALID');
    }
}
