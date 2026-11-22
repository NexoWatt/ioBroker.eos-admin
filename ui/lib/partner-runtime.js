/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
/**
 * AUTO-GENERATED RUNTIME FILE - NICHT MANUELL BEARBEITEN.
 *
 * Quelle: src-ts/runtime-executables/lib/partner-runtime.ts
 * Quell-Hash: sha256:83f56a0e2bd4207a70696c6d04436707b3b6e22d08e520e9d1958e1fa21a7162
 * Erzeugung: npm run sync:ts-runtime-executables
 *
 * Zweck:
 * Diese JavaScript-Datei ist das ausführbare Build-Artefakt für lib/partner-runtime.js.
 * Die fachliche Bearbeitung erfolgt ab 0.7.131 in der TypeScript-Quelle.
 * Ab 0.7.132 sind doppelte Legacy-JS-Bäume wie .nwcore entfernt.
 *
 * Pflege-Regel:
 * 1. Änderung zuerst in src-ts/runtime-executables/ vornehmen.
 * 2. npm run sync:ts-runtime-executables ausführen.
 * 3. npm run test:runtime-executables prüfen.
 */
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
exports.PartnerRuntime = exports.PartnerJournalStore = void 0;
exports.readPartnerProvisioning = readPartnerProvisioning;
exports.readPartnerProjection = readPartnerProjection;
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Verbindet geschützte lokale Bereitstellung, Replayjournal, Fachdienst und ausgehendes WSS.
 * Daten und Wirkung: Liest ausschließlich feste Messwertprojektionen und eine benannte Umgebungsreferenz;
 * schreibt atomar ein begrenztes Replayjournal. Keine Geräte-, Roh-State- oder Installerkonfigurationsschreibrechte.
 * Bei Änderungen: Journalverlust, Widerruf während await, Reconnectgeneration, Appzustand und Datenfrische testen.
 * Verknüpfungen: partner-service.ts, partner-websocket.ts, docs/PARTNER_RUNTIME_PROVISIONIERUNG_DE.md.
 */
const fs = __importStar(require("node:fs/promises"));
const node_fs_1 = require("node:fs");
const path = __importStar(require("node:path"));
const node_crypto_1 = require("node:crypto");
const node_perf_hooks_1 = require("node:perf_hooks");
const partner_contracts_1 = require("./partner-contracts");
const partner_service_1 = require("./partner-service");
const partner_websocket_1 = require("./partner-websocket");
const MAX_JSON_BYTES = 65536;
const MAX_JOURNAL_BYTES = 1024 * 1024;
const SAMPLE_AGE_MS = 15000;
const BALANCE_AGE_MS = 30 * 60 * 1000;
/** Externe Fehler enthalten potenziell Pfade/Geheimnisse und werden nicht weitergegeben. */
function missing(error) { return (0, partner_contracts_1.partnerRecord)(error) ? error.code === 'ENOENT' : error instanceof Error && 'code' in error && error.code === 'ENOENT'; }
/** POSIX-Eigentümer und Schutzbits prüfen; Windows-ACL-Nachweis gehört zur Inbetriebnahme. */
function secureMode(stat, directory) {
    if (stat.isSymbolicLink() || (directory ? !stat.isDirectory() : !stat.isFile()))
        return false;
    if (process.platform === 'win32')
        return false; // Kein stilles Gleichsetzen von Modebits und Windows-ACLs.
    return (stat.mode & 0o077) === 0 && (!process.getuid || stat.uid === process.getuid());
}
/** Atomare Schreibvorgänge benötigen nach Dateifsync auch das dauerhafte Verzeichnis-Rename. */
async function syncDirectory(directory) {
    const handle = await fs.open(directory, node_fs_1.constants.O_RDONLY | node_fs_1.constants.O_DIRECTORY | node_fs_1.constants.O_NOFOLLOW);
    try {
        await handle.sync();
    }
    finally {
        await handle.close();
    }
}
/** Geschützte begrenzte Datei mit O_NOFOLLOW öffnen; Prüfung gilt für den geöffneten Deskriptor. */
async function readProtected(file, maxBytes) {
    const handle = await fs.open(file, node_fs_1.constants.O_RDONLY | node_fs_1.constants.O_NOFOLLOW | node_fs_1.constants.O_NONBLOCK);
    try {
        const stat = await handle.stat();
        if (!secureMode(stat, false) || stat.size > maxBytes)
            throw new Error('PARTNER_PERSISTENCE_UNSAFE');
        const buffer = Buffer.alloc(maxBytes + 1);
        let offset = 0;
        while (offset < buffer.length) {
            const result = await handle.read(buffer, offset, buffer.length - offset, null);
            if (!result.bytesRead)
                break;
            offset += result.bytesRead;
        }
        if (offset > maxBytes)
            throw new Error('PARTNER_PERSISTENCE_TOO_LARGE');
        return buffer.subarray(0, offset).toString('utf8');
    }
    finally {
        await handle.close();
    }
}
/**
 * Replayjournal enthält keine Geheimnisse; Dateirechte verhindern Fremdänderungen durch andere lokale Nutzer.
 * Der Marker im Elternverzeichnis macht den Verlust des Journalverzeichnisses erkennbar.
 * Gegen absichtlichen Rollback durch denselben Betriebssystemnutzer ist zusätzlich geschützter Hostbetrieb nötig.
 */
class PartnerJournalStore {
    constructor(dataDirectory) {
        this.dataDirectory = dataDirectory;
        this.serial = Promise.resolve();
        if (!path.isAbsolute(dataDirectory))
            throw new Error('PARTNER_DATA_DIRECTORY_INVALID');
        this.directory = path.join(dataDirectory, 'partner-runtime');
        this.file = path.join(this.directory, 'journal.json');
        this.fence = path.join(this.directory, 'revocation.json');
        this.marker = path.join(dataDirectory, 'partner-runtime.initialized');
    }
    /** Vor jedem Zugriff feste eigene Verzeichnisse und Elternpfade ohne Symlinks überprüfen. */
    async checkParents() {
        let current = path.resolve(this.dataDirectory);
        while (true) {
            const stat = await fs.lstat(current);
            if (!stat.isDirectory() || stat.isSymbolicLink())
                throw new Error('PARTNER_DATA_DIRECTORY_INVALID');
            // Eltern dürfen vom Administrator verwaltet sein; unprivilegierte Fremdschreiber sind verboten.
            if ((stat.mode & 0o022) !== 0 && !(stat.mode & 0o1000))
                throw new Error('PARTNER_DATA_DIRECTORY_UNSAFE');
            const parent = path.dirname(current);
            if (parent === current)
                break;
            current = parent;
        }
        const stat = await fs.lstat(this.directory);
        if (!secureMode(stat, true))
            throw new Error('PARTNER_PERSISTENCE_UNSAFE');
    }
    /** Nur eine echte Erstinbetriebnahme erzeugt ein leeres Journal; Verlust nach Initialisierung sperrt. */
    load() { return this.ordered(() => this.loadInternal()); }
    async loadInternal() {
        let hasDirectory = true;
        let hasMarker = true;
        try {
            await fs.lstat(this.directory);
        }
        catch (error) {
            if (!missing(error))
                throw new Error('JOURNAL_UNAVAILABLE');
            hasDirectory = false;
        }
        try {
            if (await readProtected(this.marker, 128) !== 'nexowatt.partner.journal.v1\n')
                throw new Error('JOURNAL_INVALID');
        }
        catch (error) {
            if (!missing(error))
                throw new Error('JOURNAL_UNAVAILABLE');
            hasMarker = false;
        }
        if (!hasDirectory && !hasMarker) {
            await fs.mkdir(this.directory, { mode: 0o700 });
            await this.checkParents();
            // Marker zuerst: ein Stromausfall beim Erstaufbau darf kein unbemerktes Reset erlauben.
            const marker = await fs.open(this.marker, node_fs_1.constants.O_WRONLY | node_fs_1.constants.O_CREAT | node_fs_1.constants.O_EXCL | node_fs_1.constants.O_NOFOLLOW, 0o600);
            try {
                await marker.writeFile('nexowatt.partner.journal.v1\n');
                await marker.sync();
            }
            finally {
                await marker.close();
            }
            await syncDirectory(this.dataDirectory);
            await this.atomicWrite(this.fence, JSON.stringify({ schema: 'nexowatt.partner.revocation.v1', version: 0 }));
            await this.persistInternal([]);
        }
        else if (!hasDirectory || !hasMarker)
            throw new Error('JOURNAL_UNAVAILABLE');
        await this.checkParents();
        await this.revokedVersion();
        const text = await readProtected(this.file, MAX_JOURNAL_BYTES);
        let value;
        try {
            value = JSON.parse(text);
        }
        catch {
            throw new Error('JOURNAL_INVALID');
        }
        if (!(0, partner_contracts_1.partnerRecord)(value) || !(0, partner_contracts_1.partnerKeys)(value, ['schema', 'entries']) || value.schema !== 'nexowatt.partner.journal.v1' || !Array.isArray(value.entries))
            throw new Error('JOURNAL_INVALID');
        return value.entries;
    }
    /** Erst nach fsync+Rename+Verzeichnisfsync darf der Fachdienst einen neuen Wunsch freigeben. */
    persist(entries) { return this.ordered(() => this.persistInternal(entries)); }
    async persistInternal(entries) {
        await this.checkParents();
        const marker = await readProtected(this.marker, 128);
        if (marker !== 'nexowatt.partner.journal.v1\n')
            throw new Error('JOURNAL_INVALID');
        const text = JSON.stringify({ schema: 'nexowatt.partner.journal.v1', entries });
        if (!Array.isArray(entries) || entries.length > 2048 || Buffer.byteLength(text) > MAX_JOURNAL_BYTES)
            throw new Error('JOURNAL_FULL');
        await this.atomicWrite(this.file, text);
    }
    /** Eine einmal bestätigte Widerrufsrevision bleibt auch nach Neustart gesperrt. */
    async revokedVersion() {
        await this.checkParents();
        let value;
        try {
            value = JSON.parse(await readProtected(this.fence, 512));
        }
        catch {
            throw new Error('REVOCATION_FENCE_UNAVAILABLE');
        }
        if (!(0, partner_contracts_1.partnerRecord)(value) || !(0, partner_contracts_1.partnerKeys)(value, ['schema', 'version']) || value.schema !== 'nexowatt.partner.revocation.v1' || !(0, partner_contracts_1.partnerInteger)(value.version, 0, Number.MAX_SAFE_INTEGER))
            throw new Error('REVOCATION_FENCE_INVALID');
        return value.version;
    }
    /** Die HTTP-Antwort darf erfolgreichen Widerruf erst nach dieser dauerhaften Schranke melden. */
    revoke(version) { return this.ordered(() => this.revokeInternal(version)); }
    async revokeInternal(version) {
        const previous = await this.revokedVersion();
        if (!(0, partner_contracts_1.partnerInteger)(version, 1, Number.MAX_SAFE_INTEGER))
            throw new Error('REVOCATION_VERSION_INVALID');
        await this.atomicWrite(this.fence, JSON.stringify({ schema: 'nexowatt.partner.revocation.v1', version: Math.max(version, previous) }));
    }
    /** Ein Hot-Reload liest erst nach allen bereits begonnenen alten Journal-Schreibvorgängen. */
    ordered(operation) {
        const result = this.serial.then(operation);
        this.serial = result.then(() => undefined, () => undefined);
        return result;
    }
    async atomicWrite(file, text) {
        const temp = path.join(this.directory, `.journal-${(0, node_crypto_1.randomBytes)(16).toString('hex')}.tmp`);
        const handle = await fs.open(temp, node_fs_1.constants.O_WRONLY | node_fs_1.constants.O_CREAT | node_fs_1.constants.O_EXCL | node_fs_1.constants.O_NOFOLLOW, 0o600);
        try {
            await handle.writeFile(text);
            await handle.sync();
        }
        catch {
            await handle.close();
            await fs.unlink(temp).catch(() => undefined);
            throw new Error('JOURNAL_UNAVAILABLE');
        }
        await handle.close();
        try {
            await fs.rename(temp, file);
            await syncDirectory(this.directory);
        }
        catch {
            await fs.unlink(temp).catch(() => undefined);
            throw new Error('JOURNAL_UNAVAILABLE');
        }
    }
}
exports.PartnerJournalStore = PartnerJournalStore;
/**
 * Die UI kennt nur eine Umgebungsreferenz. Ihr Inhalt bindet Identität, festes TLS-Ziel und Ablaufzeit.
 * Es existieren keine Secrets im Konfigbackup, Querystring, Status, Log oder Rückfallwert.
 */
function readPartnerProvisioning(config, environment) {
    if (!/^NEXOWATT_PARTNER_[A-Z0-9_]{1,80}$/.test(config.credentialRef))
        throw new Error('CREDENTIALS_UNAVAILABLE');
    const text = environment[config.credentialRef];
    if (typeof text !== 'string' || Buffer.byteLength(text) > MAX_JSON_BYTES)
        throw new Error('CREDENTIALS_UNAVAILABLE');
    let value;
    try {
        value = JSON.parse(text);
    }
    catch {
        throw new Error('CREDENTIALS_UNAVAILABLE');
    }
    if (!(0, partner_contracts_1.partnerRecord)(value) || !(0, partner_contracts_1.partnerKeys)(value, ['partnerId', 'allowedEndpoint', 'credentials', 'privateVpnAddresses']) || !(0, partner_contracts_1.partnerId)(value.partnerId) || value.partnerId !== config.partnerId || !(0, partner_contracts_1.partnerRecord)(value.allowedEndpoint) || !(0, partner_contracts_1.partnerRecord)(value.credentials))
        throw new Error('CREDENTIALS_INVALID');
    const endpoint = value.allowedEndpoint;
    const credentials = value.credentials;
    if (!(0, partner_contracts_1.partnerKeys)(endpoint, ['hostname', 'port', 'path']) || typeof endpoint.hostname !== 'string' || endpoint.hostname.length > 253 || !(0, partner_contracts_1.partnerInteger)(endpoint.port, 1, 65535) || typeof endpoint.path !== 'string' || endpoint.path.length > 2048 || !endpoint.path.startsWith('/') || !(0, partner_contracts_1.partnerKeys)(credentials, ['expiresAtMs', 'bearerToken', 'clientCertPem', 'clientKeyPem', 'caPem']) || !(0, partner_contracts_1.partnerInteger)(credentials.expiresAtMs, 1, Number.MAX_SAFE_INTEGER))
        throw new Error('CREDENTIALS_INVALID');
    const parsed = { expiresAtMs: credentials.expiresAtMs };
    const strings = {};
    for (const key of ['bearerToken', 'clientCertPem', 'clientKeyPem', 'caPem']) {
        const raw = credentials[key];
        if (raw !== undefined) {
            if (typeof raw !== 'string' || !raw.length || Buffer.byteLength(raw) > 32768)
                throw new Error('CREDENTIALS_INVALID');
            strings[key] = raw;
        }
    }
    const privateVpnAddresses = [];
    if (value.privateVpnAddresses !== undefined) {
        if (!Array.isArray(value.privateVpnAddresses) || value.privateVpnAddresses.length > 32 || value.privateVpnAddresses.some(address => typeof address !== 'string' || address.length > 64))
            throw new Error('CREDENTIALS_INVALID');
        for (const address of value.privateVpnAddresses)
            if (typeof address === 'string')
                privateVpnAddresses.push(address);
    }
    return { partnerId: value.partnerId, endpoint: config.endpoint, allowedEndpoint: { hostname: endpoint.hostname, port: endpoint.port, path: endpoint.path }, credentials: { ...parsed, ...strings }, privateVpnAddresses };
}
/** Endliche echte Messwerte mit ursprünglichem Zeitstempel; Strings und aufgefrischte Altwerte sind ungültig. */
function sample(read, key, now, min, max) {
    const value = read(key);
    return value && (0, partner_contracts_1.partnerNumber)(value.value, min, max) && (0, partner_contracts_1.partnerInteger)(value.ts, 1, now + 1000) && now - value.ts <= SAMPLE_AGE_MS ? { value: value.value, ts: value.ts } : null;
}
/** Nur das letzte abgeschlossene Bilanzintervall, keine Personen-, Zählerkennungen oder Rohkonfiguration. */
function balanceProjection(read, now) {
    const state = read('energyLedger.origin.lastIntervalJson');
    if (!state || typeof state.value !== 'string' || Buffer.byteLength(state.value) > MAX_JSON_BYTES || !(0, partner_contracts_1.partnerInteger)(state.ts, 1, now + 1000))
        throw new Error('DATA_UNAVAILABLE');
    let value;
    try {
        value = JSON.parse(state.value);
    }
    catch {
        throw new Error('DATA_UNAVAILABLE');
    }
    if (!(0, partner_contracts_1.partnerRecord)(value) || !(0, partner_contracts_1.partnerInteger)(value.startTs, 1, now) || !(0, partner_contracts_1.partnerInteger)(value.endTs, value.startTs + 1, now) || now - value.endTs > BALANCE_AGE_MS || !(0, partner_contracts_1.partnerRecord)(value.quality) || value.quality.status !== 'complete' || !(0, partner_contracts_1.partnerRecord)(value.evcs) || !(0, partner_contracts_1.partnerRecord)(value.evcs.sourceBreakdown) || !(0, partner_contracts_1.partnerNumber)(value.evcs.totalKwh, 0, 1e15))
        throw new Error('DATA_UNAVAILABLE');
    const source = value.evcs.sourceBreakdown;
    const out = Object.create(null);
    out.intervalCount = 1;
    out.completeIntervalCount = 1;
    out.evcsTotalKwh = value.evcs.totalKwh;
    for (const key of ['pvDirectKwh', 'otherRenewableDirectKwh', 'storedPvKwh', 'storedOtherRenewableKwh', 'gridDirectKwh', 'storedGridKwh']) {
        if (!(0, partner_contracts_1.partnerNumber)(source[key], 0, 1e15))
            throw new Error('DATA_UNAVAILABLE');
        out[key] = source[key];
    }
    const known = Object.values(source).length; // Umfang des Fremdobjekts wird nicht zurückgegeben.
    if (known > 64)
        throw new Error('DATA_UNAVAILABLE');
    const renewable = Number(out.pvDirectKwh) + Number(out.otherRenewableDirectKwh) + Number(out.storedPvKwh) + Number(out.storedOtherRenewableKwh);
    const totalKnown = renewable + Number(out.gridDirectKwh) + Number(out.storedGridKwh);
    if (totalKnown > value.evcs.totalKwh + 0.000001)
        throw new Error('DATA_UNAVAILABLE');
    out.unknownKwh = Math.max(0, value.evcs.totalKwh - totalKnown);
    out.operationalRenewableKwh = renewable;
    out.periodStartMs = value.startTs;
    out.periodEndMs = value.endTs;
    out.updatedAtMs = state.ts;
    return out;
}
/** Feste fachliche Ressourcen statt frei wählbarer ioBroker-State-IDs. Ungültige Werte bleiben unavailable. */
function readPartnerProjection(config, read, appId, resourceId, kind, now = Date.now(), telemetry) {
    if (appId === 'energyLedger') {
        if (resourceId !== 'site' || kind !== 'balance')
            throw new Error('RESOURCE_UNAVAILABLE');
        return balanceProjection(read, now);
    }
    if (appId === 'directMarketing') {
        if (resourceId !== 'site')
            throw new Error('RESOURCE_UNAVAILABLE');
        if (kind === 'capabilities')
            return { curtailmentSupported: false, maxCurtailmentW: 0 };
        if (kind !== 'telemetry')
            throw new Error('RESOURCE_UNAVAILABLE');
        const power = sample(read, 'pvPower', now, 0, 1e9);
        const imported = sample(read, 'gridBuyPower', now, 0, 1e9);
        const exported = sample(read, 'gridSellPower', now, 0, 1e9);
        return power && imported && exported && Math.max(power.ts, imported.ts, exported.ts) - Math.min(power.ts, imported.ts, exported.ts) <= 5000 ? { powerW: power.value, gridPowerW: imported.value - exported.value, updatedAtMs: Math.min(power.ts, imported.ts, exported.ts), available: true } : { available: false };
    }
    const resource = config.arbitrage.resources.find(candidate => candidate.id === resourceId);
    if (!resource || resourceId === 'farm')
        throw new Error('RESOURCE_UNAVAILABLE');
    if (kind === 'capabilities')
        return { maxChargeW: resource.maxChargeW, maxDischargeW: resource.maxDischargeW, chargeSupported: resource.maxChargeW > 0, dischargeSupported: resource.maxDischargeW > 0 };
    if (kind !== 'telemetry')
        throw new Error('RESOURCE_UNAVAILABLE');
    // Einziger Ursprung ist der vorhandene Writer mit echten Messzeitstempeln, keine Diagnose-State-Zeit.
    if (!(0, partner_contracts_1.partnerRecord)(telemetry) || telemetry.resourceId !== resourceId || telemetry.valid !== true || !(0, partner_contracts_1.partnerNumber)(telemetry.socPct, 0, 100) || !(0, partner_contracts_1.partnerNumber)(telemetry.powerW, -1e9, 1e9) || !(0, partner_contracts_1.partnerNumber)(telemetry.gridPowerW, -1e9, 1e9) || !(0, partner_contracts_1.partnerInteger)(telemetry.socTs, now - SAMPLE_AGE_MS, now + 1000) || !(0, partner_contracts_1.partnerInteger)(telemetry.powerTs, now - SAMPLE_AGE_MS, now + 1000) || !(0, partner_contracts_1.partnerInteger)(telemetry.gridTs, now - SAMPLE_AGE_MS, now + 1000) || Math.max(telemetry.socTs, telemetry.powerTs, telemetry.gridTs) - Math.min(telemetry.socTs, telemetry.powerTs, telemetry.gridTs) > 5000)
        return { available: false };
    return { socPct: telemetry.socPct, powerW: telemetry.powerW, gridPowerW: telemetry.gridPowerW, updatedAtMs: Math.min(telemetry.socTs, telemetry.powerTs, telemetry.gridTs), available: true };
}
/** Adapter-Fassade: Konfigurationswechsel und Stop widerrufen synchron, bevor asynchrone Arbeit fortsetzt. */
class PartnerRuntime {
    constructor(hooks) {
        this.hooks = hooks;
        this.service = null;
        this.transport = null;
        this.generation = 0;
        this.signature = '';
        this.stopped = true;
        this.revokedVersion = 0;
        this.credentialExpiresAt = 0;
        this.credentialDeadline = 0;
        this.fallback = { connection: 'disabled', reason: 'DISABLED', controlAvailable: false, revision: 1 };
        this.journal = new PartnerJournalStore(hooks.dataDirectory);
    }
    /** Keine Fremdexception verlässt die Lifecycle-Grenze; Fehler sperren und haben feste Statuscodes. */
    async refresh() {
        this.stop();
        this.stopped = false;
        const generation = this.generation;
        try {
            const config = (0, partner_contracts_1.currentPartnerConfig)(this.hooks.getRoot());
            this.signature = JSON.stringify(config);
            this.fallback = { connection: config.enabled ? 'blocked' : 'disabled', reason: config.enabled ? 'INITIALIZING' : 'DISABLED', controlAvailable: false, revision: config.configVersion };
            if (!config.enabled)
                return;
            const transportConfig = readPartnerProvisioning(config, this.hooks.environment || process.env);
            const certificateExpiry = transportConfig.credentials.clientCertPem ? Date.parse(new node_crypto_1.X509Certificate(transportConfig.credentials.clientCertPem).validTo) : Number.POSITIVE_INFINITY;
            this.credentialExpiresAt = Math.min(transportConfig.credentials.expiresAtMs, certificateExpiry);
            this.credentialDeadline = node_perf_hooks_1.performance.now() + this.credentialExpiresAt - this.now();
            if (!Number.isFinite(this.credentialExpiresAt) || this.credentialExpiresAt <= this.now())
                throw new Error('CREDENTIALS_EXPIRED');
            const service = new partner_service_1.PartnerIntegrationService(config, {
                loadJournal: () => this.journal.load(), persistJournal: entries => this.journal.persist(entries),
                isAppActive: appId => this.hooks.isAppActive(appId), isResourceAvailable: resourceId => this.hooks.isResourceAvailable(resourceId), controlAvailable: () => this.authorized(generation) && this.hooks.controlAvailable(),
                readData: async (appId, resourceId, kind) => {
                    if (appId === 'arbitrage' && !this.hooks.isResourceAvailable(resourceId))
                        throw new Error('RESOURCE_UNAVAILABLE');
                    return readPartnerProjection(config, id => this.hooks.readState(id), appId, resourceId, kind, this.now(), this.hooks.readTelemetry(resourceId));
                },
                now: () => this.now(),
            });
            this.service = service;
            await service.initialize();
            this.revokedVersion = Math.max(this.revokedVersion, await this.journal.revokedVersion());
            if (config.configVersion <= this.revokedVersion) {
                service.invalidate('REVOKED');
                return;
            }
            if (!this.authorized(generation))
                return;
            const socketHooks = {
                isAuthorized: () => this.authorized(generation),
                onState: (state, code) => { if (generation === this.generation)
                    service.setConnection(state, code.toUpperCase()); },
                onMessage: async (partnerIdValue, text, context) => {
                    if (!this.authorized(generation) || !context.isCurrent())
                        return;
                    const response = await service.handleMessage(partnerIdValue, text);
                    if (this.authorized(generation) && context.isCurrent())
                        context.send(response);
                },
            };
            this.transport = this.hooks.createTransport ? this.hooks.createTransport(transportConfig, socketHooks) : new partner_websocket_1.PartnerWebSocketClient(transportConfig, socketHooks);
            if (this.authorized(generation))
                this.transport.start();
            else
                this.transport.stop();
        }
        catch {
            if (generation === this.generation) {
                this.service?.invalidate('RUNTIME_UNAVAILABLE');
                this.fallback = { ...this.fallback, connection: 'blocked', reason: 'RUNTIME_UNAVAILABLE' };
            }
        }
    }
    now() { return this.hooks.now ? this.hooks.now() : Date.now(); }
    /** Auch ohne HTTP-Refresh erkennt jeder Zugriff geänderte Konfiguration oder deaktivierte Apps. */
    authorized(generation) {
        if (this.stopped || generation !== this.generation || !this.service?.authorize())
            return false;
        try {
            const config = (0, partner_contracts_1.currentPartnerConfig)(this.hooks.getRoot());
            const allowed = this.now() < this.credentialExpiresAt && node_perf_hooks_1.performance.now() < this.credentialDeadline && config.configVersion > this.revokedVersion && JSON.stringify(config) === this.signature && config.grants.some(grant => this.hooks.isAppActive(grant.appId));
            if (!allowed)
                this.service.invalidate('AUTHORIZATION_CHANGED');
            return allowed;
        }
        catch {
            return false;
        }
    }
    getCurrentRequest(resourceId) {
        try {
            return this.authorized(this.generation) ? this.service?.getCurrentRequest(resourceId) ?? null : null;
        }
        catch {
            this.block('LOCAL_STATE_UNAVAILABLE');
            return null;
        }
    }
    snapshot() {
        try {
            return this.service?.snapshot() || { ...this.fallback };
        }
        catch {
            return { ...this.fallback, connection: 'blocked', reason: 'LOCAL_STATE_UNAVAILABLE', controlAvailable: false };
        }
    }
    /** Lokaler Widerruf sofort; bestätigter Widerruf zusätzlich persistent vor der API-Quittung. */
    async invalidate(reason = 'REVOKED') {
        this.block(reason);
        if (reason !== 'REVOKED')
            return;
        this.revokedVersion = Math.max(this.revokedVersion, this.fallback.revision);
        try {
            await this.journal.load();
            await this.journal.revoke(this.revokedVersion);
        }
        catch {
            this.fallback = { ...this.fallback, connection: 'blocked', reason: 'REVOCATION_PERSIST_FAILED' };
            throw new Error('REVOCATION_PERSIST_FAILED');
        }
    }
    block(reason) { this.generation++; this.stopped = true; this.service?.invalidate(reason); this.transport?.stop(); this.transport = null; }
    stop() { this.block('STOPPED'); this.service = null; }
}
exports.PartnerRuntime = PartnerRuntime;
