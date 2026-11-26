/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
// @ts-nocheck
/**
 * TypeScript-Parallelspiegel: lib/notification-mail.js
 *
 * Zweck:
 * Diese Datei ist die TypeScript-Vorbereitung der bestehenden JavaScript-Runtime-Datei.
 * Sie wird noch nicht produktiv ausgeführt. Die zugehörige erzeugte JavaScript-Laufzeitdatei ist:
 * lib/notification-mail.js
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
 * Original-Hash: cf6f4fcb4c35377cedaff6f4b5bfab04cd30ddc06127c267a9a370fa306a96b7
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
 * Quelle: src-ts/runtime-executables/lib/notification-mail.ts
 * Quell-Hash: sha256:289e8a310154f01dcdada49e2e11b9a9ddfb27b89c9240af64afcb2eece56795
 * Erzeugung: npm run sync:ts-runtime-executables
 *
 * Zweck:
 * Diese JavaScript-Datei ist das ausführbare Build-Artefakt für lib/notification-mail.js.
 * Die fachliche Bearbeitung erfolgt ab 0.7.131 in der TypeScript-Quelle.
 * Ab 0.7.132 sind doppelte Legacy-JS-Bäume wie .nwcore entfernt.
 *
 * Pflege-Regel:
 * 1. Änderung zuerst in src-ts/runtime-executables/ vornehmen.
 * 2. npm run sync:ts-runtime-executables ausführen.
 * 3. npm run test:runtime-executables prüfen.
 */
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Sammelt wichtige Anlagenstörungen und versendet freigegebene Meldungsgruppen über verschlüsselt gespeicherte SMTP-Konfiguration.
 * Daten und Wirkung: Liest Kundenfreigabe, Empfänger und Diagnose-States; nutzt NotificationPolicy für die Auswahl und Nodemailer für den TLS-Versand. Die Konfiguration liegt AES-GCM-verschlüsselt im Instanzdatenverzeichnis.
 * Bei Änderungen: Einheiten, Vorzeichen, Gültigkeit und Aufrufer mitprüfen; Kommentare und docs:build nach fachlichen Änderungen aktualisieren.
 * Verknüpfungen: docs/quellcode/src-ts/runtime-executables/lib/notification-mail.md
 * Einstieg: docs/QUELLCODE_WEGWEISER_DE.md; Pflege: docs/DOKUMENTATIONSSTANDARD_DE.md
 */
'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { NotificationPolicy } = require('./notification-policy');
const FROM = 'info@nexowatt.com';
const ADDRESS = /^[^\s<>@,;\r\n]+@[^\s<>@,;\r\n]+\.[^\s<>@,;\r\n]+$/;
const CATEGORY_FLAGS = {system:'notifySystem', inverters:'notifyInverters', charging:'notifyCharging', communications:'notifyCommunication', grid:'notifyHardCurtailment'};
/**
 * Code-Teil: validAddress
 *
 * Zweck:
 * Automatisch markierter Arrow-Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
const validAddress = v => typeof v === 'string' && v.length <= 254 && ADDRESS.test(v);
/**
 * Code-Teil: safeId
 *
 * Zweck:
 * Automatisch markierter Arrow-Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
const safeId = v => String(v || '').toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 64);
const MODULES = new Set(['coreLimits', 'peakShaving', 'chargingManagement', 'storage', 'storageControl', 'storageFarm', 'gridConstraints', 'para14a', 'netOperatorInterface', 'heatingRod', 'heatingRodControl', 'consumerManagement', 'speicherMapping', 'speicherRegelung', 'multiUse', 'thermalControl', 'meshMicrogrid', 'nvpCoordinator', 'bhkwControl', 'generatorControl', 'thresholdControl', 'nexoLogicBudget']);

// Match native datapoint roots (including migrated namespaces) to the same hash used by
// the worker's confirmed reachability. Never merge records on a human-readable name.
function supervisedId(namespaces, refs) {
  const found = new Set();
  for (const value of refs) {
    const ref = typeof value === 'string' ? value : value?.root;
    if (typeof ref !== 'string') continue;
    for (const kind of ['devices','ocpp']) {
      if (!namespaces?.[kind]) continue;
      const prefix = namespaces[kind] + (kind === 'devices' ? '.devices.' : '.');
      if (!ref.startsWith(prefix)) continue;
      const suffix = ref.slice(prefix.length);
      let unit;
      if (kind === 'devices') {
        // Device IDs may contain periods. An explicit root is exact. Only a known
        // producer channel can delimit a device in a telemetry datapoint reference.
        unit = typeof value === 'object' ? suffix : /^(.*?)\.(?:aliases|info|measurement)\./.exec(suffix)?.[1];
      } else if (typeof value === 'object' && value.raw && /^[A-Za-z0-9_-]+$/.test(suffix)) {
        // Raw OCPP identities can be sanitized or suffixed differently in the object tree.
        unit = value.raw;
      }
      if (!unit || unit.length > 256) continue;
      found.add('supervisor:device:' + kind + ':' + crypto.createHash('sha256').update(unit).digest('hex'));
    }
  }
  return found.size === 1 ? [...found][0] : '';
}
/**
 * Code-Teil: wallboxRefs
 *
 * Zweck:
 * Automatisch markierter Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
function wallboxRefs(row) {
  return [{root:row._eosDevice?.baseId},row.onlineId,row.statusId,row.powerId];
}
/**
 * Code-Teil: ocppRootRef
 *
 * Zweck:
 * Automatisch markierter Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
async function ocppRootRef(row, namespace, reader) {
  const prefix = namespace ? namespace + '.' : '';
  if (!prefix || !reader) return null;
  const root = [row.ocppDiscovery?.stationRoot,row.onlineId,row.statusId,row.powerId].find(value =>
    typeof value === 'string' && value.startsWith(prefix));
  if (!root) return null;
  const unit = root.slice(prefix.length).split('.')[0];
  if (!/^[A-Za-z0-9_-]+$/.test(unit)) return null;
  const station = prefix + unit;
  const identity = await reader(station + '.info.identity');
  return typeof identity?.val === 'string' && identity.ack !== false && (!identity.q || identity.q === 0)
    ? {root:station,raw:identity.val} : null;
}
/**
 * Code-Teil: migrateIncident
 *
 * Zweck:
 * Automatisch markierter Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
function migrateIncident(records, oldId, newId) {
  const previous = records.get(oldId);
  if (!previous || oldId === newId) return;
  const existing = records.get(newId);
  if (existing) {
    existing.lastSent = Math.max(existing.lastSent || 0, previous.lastSent || 0);
    existing.alertSent ||= previous.alertSent;
    existing.criticalSent ||= previous.criticalSent || Boolean(previous.active && previous.alertSent);
  } else {
    records.set(newId, {...previous, criticalSent:previous.criticalSent || Boolean(previous.active && previous.alertSent), suppressed:true, meta:{...previous.meta, id:newId}});
  }
  records.delete(oldId);
}
/**
 * Ablauf und Zusammenhang: Prüft Server, Port, Benutzer und Passwort vor dem Speichern. Ein leeres Passwortfeld übernimmt das bisherige Passwort; nur clearPassword löscht es ausdrücklich. Aktivierung ohne vollständige Zugangsdaten wird abgewiesen.
 */
function normalizeConfig(input = {}, previous = {}) {
  const c = { enabled: input.enabled === true, host: String(input.host || '').trim(), port: Number(input.port || 465),
    tlsMode: input.tlsMode === 'starttls' ? 'starttls' : 'tls', user: String(input.user || FROM).trim(), from: FROM,
    siteName: String(input.siteName || '').trim().replace(/[\r\n]/g, ' ').slice(0, 100),
    password: input.clearPassword === true ? '' : (typeof input.password === 'string' && input.password !== '' ? input.password : (previous.password || '')) };
  if (c.host && (!/^[a-zA-Z0-9.-]+$/.test(c.host) || c.host.length > 253)) throw new Error('Ungültiger SMTP-Server.');
  if (!Number.isInteger(c.port) || c.port < 1 || c.port > 65535) throw new Error('Ungültiger SMTP-Port.');
  if (/[\r\n]/.test(c.user) || c.user.length > 254 || c.password.length > 4096) throw new Error('Ungültige SMTP-Zugangsdaten.');
  if (c.enabled && (!c.host || !c.user || !c.password)) throw new Error('SMTP-Server, Benutzer und Passwort sind erforderlich.');
  return c;
}
/**
 * Ablauf und Zusammenhang: Übersetzt SMTP-Fehlercodes in feste Diagnosemeldungen. Rohmeldungen des Servers werden nicht durchgereicht, weil darin Zugangsdaten oder andere vertrauliche Inhalte stehen könnten.
 */
function smtpError(error) {
  const code = String(error?.code || '');
  if (code === 'EAUTH') return 'SMTP-Anmeldung fehlgeschlagen. Zugangsdaten prüfen.';
  if (['ETIMEDOUT', 'ESOCKET', 'ECONNECTION', 'EDNS'].includes(code)) return 'Mailserver nicht erreichbar oder Verbindung abgebrochen. Erneuter Versuch folgt.';
  if (code === 'EENVELOPE') return 'Mailserver hat Absender oder Empfänger abgelehnt.';
  return 'Mailserver hat den Versand nicht bestätigt. SMTP- und TLS-Konfiguration prüfen.';
}

/**
 * Code-Teil: NotificationMail
 *
 * Zweck:
 * Automatisch markierter Klasse-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
class NotificationMail {
  /**
   * Ablauf und Zusammenhang: Hält genau den Versandzustand dieser Adapter-Instanz. Uhr, Verzeichnis und Transport sind für lokale Tests austauschbar; produktiv kommen Zeit, Instanzdatenverzeichnis und Nodemailer zum Einsatz.
   */
  constructor(adapter, options = {}) {
    this.adapter = adapter;
    this.options = options;
    this.startedAt = (options.now || Date.now)();
    this.now = options.now || Date.now;
    this.config = normalizeConfig();
    this.policy = new NotificationPolicy();
    this.busy = false;
    this.closed = false;
    this.transport = null;
    this.lastSnapshot = '';
    this.lastStatus = '';
  }
  /**
   * Ablauf und Zusammenhang: Initialisiert den Versand nur einmal und teilt das Initialisierungs-Promise mit parallelen Aufrufern. Nach einem Ladefehler wird ein späterer neuer Versuch zugelassen.
   */
  async init() {
    if (!this.initPromise) this.initPromise = this._load().catch(error => { this.initPromise = null; throw error; });
    return this.initPromise;
  }
  /**
   * Ablauf und Zusammenhang: Leitet den AES-Schlüssel aus ioBroker-Systemschlüssel und Instanzname ab. Entschlüsselt die lokale Mailkonfiguration und lädt den Wiederholschutz; ein beschädigtes Protokoll löst eine vorsichtige Versandpause aus.
   */
  async _load() {
    this.directory = this.options.directory || require('@iobroker/adapter-core').getAbsoluteInstanceDataDir(this.adapter);
    await fs.mkdir(this.directory, { recursive: true, mode: 0o700 });
    const system = await this.adapter.getForeignObjectAsync('system.config');
    const secret = system?.native?.secret;
    if (!secret || typeof secret !== 'string') throw new Error('Systemschlüssel für geschützten Mailversand fehlt.');
    this.key = crypto.createHash('sha256').update(`${secret}:nexowatt-mail:${this.adapter.namespace}`).digest();
    await this.reloadSmtp();
    await this.reloadLedger();
  }
  async reloadSmtp() {
    let encrypted;
    try { encrypted = await fs.readFile(path.join(this.directory, 'notification-mail.json'), 'utf8'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; encrypted = ''; }
    if (encrypted === this.lastEncrypted) return;
    this.transport?.close(); this.transport = null;
    this.config = normalizeConfig();
    this.lastEncrypted = undefined;
    if (encrypted) {
      const stored = JSON.parse(encrypted);
      const decipher = crypto.createDecipheriv('aes-256-gcm', this.key, Buffer.from(stored.iv, 'hex'));
      decipher.setAuthTag(Buffer.from(stored.tag, 'hex'));
      const plain = Buffer.concat([decipher.update(Buffer.from(stored.data, 'hex')), decipher.final()]);
      this.config = normalizeConfig(JSON.parse(plain.toString('utf8')));
    }
    this.lastEncrypted = encrypted;
  }
  async reloadLedger() {
    let saved = '';
    try { saved = await fs.readFile(path.join(this.directory, 'notification-ledger.json'), 'utf8'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (saved === this.loadedLedger && this.loadedLedger !== undefined) return;
    try { this.policy = new NotificationPolicy(saved ? JSON.parse(saved) : {}); }
    catch { this.policy = new NotificationPolicy(); this.policy.nextAttempt = this.now() + 3600000; }
    this.loadedLedger = saved; this.lastSnapshot = saved;
  }
  // SQLite provides only the kernel-managed, crash-released process lock. All persisted delivery
  // history stays in the existing JSON ledger. Zero busy timeout keeps both event loops responsive.
  async withDeliveryLock(operation) {
    const { DatabaseSync } = require('node:sqlite');
    const db = new DatabaseSync(path.join(this.directory, 'notification-gate.sqlite'));
    try {
      db.exec('PRAGMA busy_timeout=0');
      try { db.exec('BEGIN IMMEDIATE'); }
      catch (error) { if (error.errcode === 5 || error.errcode === 6) return { ok: false, error: 'Ein Mailversand läuft bereits.' }; throw error; }
      await this.reloadLedger();
      await this.reloadSmtp();
      if (this.closed) return { ok: false, error: 'Adapter wird beendet.' };
      this.deliveryReports = new Map();
      return await operation();
    } finally {
      db.close();
      const reports = this.deliveryReports;
      this.deliveryReports = null;
      if (reports && this.options.authorized?.() !== false) await Promise.all([...reports].map(([key,value]) =>
        Promise.resolve().then(() => this.adapter._notifySetDebugState(key,value)).catch(() => {})));
    }
  }
  async report(key, value) {
    if (this.options.authorized?.() === false) return;
    if (this.deliveryReports) { this.deliveryReports.set(key,value); return; }
    try { await this.adapter._notifySetDebugState(key,value); } catch { /* Diagnostics are best effort. */ }
  }
  /**
   * Ablauf und Zusammenhang: Schreibt JSON in eine zufällige, exklusiv neu erstellte
   * Datei mit Besitzerrechten. Vorbereitete Symlinks/Altdateien dürfen nicht verfolgt
   * werden. Datei und auf POSIX Verzeichniseintrag werden vor Rückkehr synchronisiert;
   * das Versand-Ledger muss vor SMTP dauerhaft vorliegen. Bei Fehlern bleibt der
   * Aufruf fehlgeschlagen und noch vorhandene temporäre Dateien werden entfernt.
   */
  async atomic(name, value) {
    const target = path.join(this.directory, name);
    const temporary = `${target}.${crypto.randomBytes(16).toString('hex')}.tmp`;
    let created = false;
    try {
      const handle = await fs.open(temporary, 'wx', 0o600); created = true;
      try { await handle.writeFile(JSON.stringify(value)); await handle.sync(); }
      finally { await handle.close(); }
      if (this.options.authorized?.() === false) throw new Error('Berechtigung für diesen Instanzdatenbestand wurde zurückgegeben.');
      await fs.rename(temporary, target); created = false;
      if (process.platform !== 'win32') {
        const directory = await fs.open(this.directory, 'r');
        try { await directory.sync(); } finally { await directory.close(); }
      }
    } finally { if (created) await fs.unlink(temporary).catch(() => {}); }
  }
  /**
   * Ablauf und Zusammenhang: Speichert den Snapshot der Versand-Policy nur bei Änderung. Dieses Protokoll erhält den Wiederholschutz auch über Adapter-Neustarts hinweg.
   */
  async saveLedger() {
    const data = this.policy.snapshot();
    const json = JSON.stringify(data);
    if (json !== this.lastSnapshot) { await this.atomic('notification-ledger.json', data); this.lastSnapshot = this.loadedLedger = json; }
  }
  /**
   * Ablauf und Zusammenhang: Entfernt das Passwort aus der Konfigurationsantwort. Die Oberfläche bekommt nur passwordSet als Hinweis, ob ein Passwort vorhanden ist; der Passwortwert wird nicht zurückgegeben.
   */
  publicConfig() {
    const { password, ...publicFields } = this.config;
    return { ...publicFields, passwordSet: !!password };
  }
  /**
   * Ablauf und Zusammenhang: Übernimmt eine zuvor von der Admin-Route autorisierte Eingabe. Prüft die Werte, speichert AES-256-GCM-Chiffre mit neuem IV und verwirft den bisherigen SMTP-Transport; busy verhindert eine parallele Umkonfiguration während des Versands.
   */
  async configure(input) {
    await this.init();
    if (this.busy) throw new Error('Mailversand läuft. Bitte kurz warten.');
    this.busy = true;
    try {
      const result = await this.withDeliveryLock(async () => {
        const config = normalizeConfig(input, this.config);
        const iv = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv('aes-256-gcm', this.key, iv);
        const data = Buffer.concat([cipher.update(JSON.stringify(config), 'utf8'), cipher.final()]);
        const envelope = { iv: iv.toString('hex'), tag: cipher.getAuthTag().toString('hex'), data: data.toString('hex') };
        await this.atomic('notification-mail.json', envelope);
        this.lastEncrypted = JSON.stringify(envelope);
        this.transport?.close(); this.transport = null;
        this.config = config;
        return this.publicConfig();
      });
      if (result?.ok === false) throw new Error(result.error);
      return result;
    } finally { this.busy = false; }
  }
  /**
   * Ablauf und Zusammenhang: Schreibt einen geänderten Versandstatus in den Diagnose-State lastMailResult. Gleiche Meldungen werden nicht bei jedem Tick erneut geschrieben.
   */
  async status(message) {
    if (this.lastStatus === message) return;
    this.lastStatus = message;
    await this.report('lastMailResult', message);
  }
  /**
   * Ablauf und Zusammenhang: Sendet genau eine Nachricht mit verpflichtendem TLS und Zertifikatsprüfung. Erfolg bedeutet Annahme durch den SMTP-Server, nicht nachgewiesene Zustellung im Kundenpostfach; ungültige Empfänger und ausgeschalteter Versand werden abgewiesen.
   */
  async send(to, subject, text) {
    if (!this.config.enabled) return { ok: false, error: 'Direkter Mailversand ist im Installerbereich noch nicht eingerichtet oder deaktiviert.' };
    if (!validAddress(to)) return { ok: false, error: 'Eine gültige einzelne Empfängeradresse ist erforderlich.' };
    if (this.closed) return { ok: false, error: 'Adapter wird beendet.' };
    try {
      if (!this.transport) {
        const create = this.options.createTransport || require('nodemailer').createTransport;
        this.transport = create({ host: this.config.host, port: this.config.port, secure: this.config.tlsMode === 'tls',
          requireTLS: true, auth: { user: this.config.user, pass: this.config.password },
          tls: { minVersion: 'TLSv1.2', rejectUnauthorized: true },
          connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 20000,
          pool: false, logger: false, debug: false, disableFileAccess: true, disableUrlAccess: true });
      }
      const info = await this.transport.sendMail({ from: { name: 'NexoWatt EOS', address: FROM }, to,
        subject: String(subject).replace(/[\r\n]/g, ' ').slice(0, 200), text: String(text).slice(0, 48000),
        disableFileAccess: true, disableUrlAccess: true });
      const accepted = Array.isArray(info?.accepted) && info.accepted.some(v => String(v).toLowerCase() === to.toLowerCase());
      if (!accepted || info?.rejected?.length) return { ok: false, error: 'Mailserver hat die Empfängeradresse nicht angenommen.' };
      return { ok: true, status: 'smtp-accepted' };
    } catch (error) { return { ok: false, error: smtpError(error) }; }
  }
  /**
   * Ablauf und Zusammenhang: Reserviert den Versandversuch und speichert ihn vor dem Netzwerkaufruf. Nach der SMTP-Antwort werden Erfolg oder Wiederholpause in der Policy festgehalten; ein Neustart soll dadurch keine ungebremste Wiederholung auslösen.
   */
  async deliver(to, subject, text, batch, test = false) {
    const now = this.now();
    this.policy.reserve(now, test);
    await this.saveLedger(); // A restart cannot turn repeated timeouts into an unbounded send loop.
    if (this.options.authorized?.() === false || this.closed) return {ok:false,error:'Adapter wird beendet.'};
    const result = await this.send(to, subject, text);
    // An old standalone adapter may already own the legacy namespace by the time
    // SMTP returns. It does not participate in this version's SQLite delivery lock.
    if (this.options.authorized?.() === false) return result;
    this.policy.complete(batch, this.now(), result.ok);
    await this.saveLedger();
    await this.status(result.ok ? 'smtp-accepted' : result.error);
    if (result.ok) {
      await this.report('lastMailTs', this.now());
      await this.report('lastMailSubject', subject);
    }
    return result;
  }
  /**
   * Ablauf und Zusammenhang: Versendet eine Testnachricht an die gespeicherte/übergebene einzelne Kundenadresse. Nutzt denselben geschützten Transport, aber eine eigene Testmail-Begrenzung von mindestens fünf Minuten.
   */
  async test(to) {
    if (this.busy) return { ok: false, error: 'Ein Mailversand läuft bereits.' };
    this.busy = true;
    try {
      await this.init();
      if (!validAddress(to)) return { ok: false, error: 'Bitte eine gültige Empfängeradresse speichern.' };
      return await this.withDeliveryLock(async () => {
        if (!this.config.enabled) return { ok: false, error: 'Mailversand im Installerbereich einrichten und aktivieren.' };
        if (!this.policy.quota(this.now(), true)) return { ok: false, error: 'Versandpause aktiv. Testmails frühestens nach fünf Minuten wiederholen.' };
        return await this.deliver(to, 'NexoWatt EOS: Test-Benachrichtigung', `${this.config.siteName || 'NexoWatt EOS'}\nDer direkte E-Mail-Versand wurde getestet.\nAbsender: ${FROM}`, [], true);
      });
    } catch (_error) { return { ok: false, error: 'Geschützte Versandkonfiguration oder Versandprotokoll nicht verfügbar.' }; }
    finally { this.busy = false; }
  }
  /**
   * Ablauf und Zusammenhang: Liest Kundenfreigabe und Empfänger, sammelt relevante Ereignisse und lässt NotificationPolicy die fällige Gruppe auswählen. Die ersten 30 Sekunden nach Start werden ausgespart; busy verhindert doppelte parallele Versandläufe.
   */
  async tick() {
    if (this.busy || this.closed) return;
    this.busy = true;
    try {
      await this.init();
      const a = this.adapter;
      const enabled = a._notifyGetSettingBool('notifyEnabled', false);
      const to = a._notifyGetSettingString('email', '');
/**
 * Code-Teil: owns
 *
 * Zweck:
 * Automatisch markierter Arrow-Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
      const owns = id => this.options.supervision === true ? id.startsWith('supervisor:') : !id.startsWith('supervisor:');
      if (!enabled) {
        if (!this.disabledCleared) await this.withDeliveryLock(async () => {
          for (const id of this.policy.records.keys()) if (owns(id)) this.policy.records.delete(id);
          await this.saveLedger(); this.disabledCleared = true;
        });
        return;
      }
      this.disabledCleared = false;
      if (!validAddress(to)) { await this.status('Gültige Kunden-E-Mail-Adresse fehlt.'); return; }
      await this.reloadSmtp();
      if (!this.config.enabled) { await this.status('Mailversand im Installerbereich einrichten und aktivieren.'); return; }
      if (this.now() - this.startedAt < 30000) return;
      const categories = new Set(Object.keys(CATEGORY_FLAGS).filter(c => a._notifyGetSettingBool(CATEGORY_FLAGS[c], true)));
      const recoveries = a._notifyGetSettingBool('notifyRecovery', true);
      // No device reads while holding the delivery lock; a stopped collector cannot monopolize delivery.
      await this.reloadLedger();
      const observed = this.options.supervision ? await this.options.observations() : await this.collect(categories);
      const legacyRefs = new Map();
      if (this.options.supervision) {
        const rows = observed?.chargingManagement?.wallboxes;
        for (const row of (Array.isArray(rows) ? rows : []).slice(0,128)) {
          const id = 'lp:' + row?.key + ':offline';
          if (!row?.key || !this.policy.records.has(id)) continue;
          legacyRefs.set(id,[...wallboxRefs(row),await ocppRootRef(row, observed.namespaces?.ocpp, a.getForeignStateAsync?.bind(a))]);
        }
      }
/**
 * Code-Teil: permission
 *
 * Zweck:
 * Automatisch markierter Arrow-Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
      const permission = () => !this.closed && this.options.authorized?.() !== false
        && a._notifyGetSettingBool('notifyEnabled', false) && a._notifyGetSettingString('email', '') === to;
      // Re-read actual consent after potentially slow polling. A stale worker must never
      // roll back a recipient change or clear another sender's ledger under the old address.
      if (!permission()) return;
      if (typeof a.getForeignStatesAsync === 'function') {
        const prefix = a.namespace + '.settings.';
        const keys = ['notifyEnabled','email','notifyRecovery',...Object.values(CATEGORY_FLAGS)];
        const states = await a.getForeignStatesAsync(keys.map(key => prefix + key));
/**
 * Code-Teil: current
 *
 * Zweck:
 * Automatisch markierter Arrow-Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
        const current = (key, fallback) => {
          const state = states?.[prefix+key];
          if (!state) return fallback;
          if (state.ack === false || (state.q !== undefined && state.q !== 0)) return undefined;
          return state.val;
        };
        if (current('notifyEnabled') !== true || String(current('email') || '').trim() !== to
          || current('notifyRecovery',true) !== recoveries
          || Object.entries(CATEGORY_FLAGS).some(([key,flag]) => current(flag,true) !== categories.has(key))) return;
      }
      await this.withDeliveryLock(async () => {
        if (!permission()) return;
        this.policy.setRecipient(crypto.createHash('sha256').update(to.toLowerCase()).digest('hex'));
        let events;
        if (this.options.supervision) {
          if (observed?.namespaces) this.policy.supervisedNamespaces = observed.namespaces;
          events = this.options.events(observed, categories, this.policy.records);
          const confirmed = new Set(events.filter(event => !event.hold).map(event => event.id));
          for (const [id,rec] of this.policy.records) {
            if (owns(id) || !categories.has(rec.meta?.category)) continue;
            const refs = legacyRefs.get(id) || (id.startsWith('inverter:') ? [{root:id.slice(9)}] : []);
            const canonical = rec.meta?.physicalId || supervisedId(this.policy.supervisedNamespaces, refs);
            if (confirmed.has(canonical)) migrateIncident(this.policy.records, id, canonical);
          }
        } else {
          events = [];
          for (const event of observed) {
            const refs = this.overlapRefs?.get(event.id) || [];
            const canonical = supervisedId(this.policy.supervisedNamespaces, refs);
            const primary = this.policy.records.get(canonical);
            if (categories.has('communications') && canonical && primary?.active && !primary.suppressed) {
              migrateIncident(this.policy.records, event.id, canonical);
            } else {
              events.push(canonical ? {...event,physicalId:canonical} : event);
            }
          }
        }
        if (this.options.supervision && !this.hasObservation) {
          for (const [id,record] of this.policy.records) if (owns(id) && !record.active) record.clearSince = 0;
          this.hasObservation = true;
        }
        this.policy.observe(events, this.now(), categories, owns);
        await this.saveLedger();
        const active = [...this.policy.records.values()].filter(r => r.active && !r.suppressed);
        await this.report('activeCount', active.length);
        await this.report('activeJson', JSON.stringify(active.map(r => {
          const id = r.meta.id.startsWith('supervisor:device:') ? r.meta.id.slice(0, r.meta.id.lastIndexOf(':')) : r.meta.id;
          return {id,title:r.meta.title,severity:r.meta.severity};
        })));
        const batch = this.policy.batch(this.now(), recoveries, item => owns(item.id) && categories.has(item.category));
        if (!batch.length) { await this.saveLedger(); return; }
        const alarms = batch.filter(e => e.kind === 'alarm').length;
        const subject = `NexoWatt EOS${this.config.siteName ? ' – ' + this.config.siteName : ''}: ${alarms} Störung(en), ${batch.length - alarms} Entwarnung(en)`;
        const body = [`Anlage: ${this.config.siteName || a.namespace}`, `Zeit: ${new Date(this.now()).toISOString()}`, '',
          ...batch.flatMap(e => [`${e.kind === 'recovery' ? 'WIEDER OK' : (e.severity === 'critical' ? 'STÖRUNG' : (e.severity === 'info' ? 'HINWEIS' : 'WARNUNG'))}: ${e.title}`, e.kind === 'recovery' ? 'Die Störung besteht seit mindestens fünf Minuten nicht mehr.' : (e.resolved ? `${e.message} (Zwischenzeitlich nicht mehr aktiv; Meldung nachgeholt.)` : e.message), '']),
          'Normale Fehler werden alle 30 Minuten gebündelt, solange sie bestehen. Hinweise und Entwarnungen sowie Erinnerungen an harte Fehler werden täglich zusammengefasst.',
          'Details finden Sie in Ihrem NexoWatt EOS.'];
        await this.deliver(to, subject, body.join('\n'), batch);
      });
    } catch (_error) { await this.status('Benachrichtigungsprüfung oder geschütztes Versandprotokoll nicht verfügbar.'); }
    finally { this.busy = false; }
  }
  /**
   * Ablauf und Zusammenhang: Übersetzt EMS-, Modul-, Geräte- und Ladepunkt-Diagnosen in Ereignisse mit stabilen IDs. Reguläre Ladepausen sollen keine Störung werden; bei einer ausgefallenen übergeordneten Quelle werden Folgeereignisse unterdrückt statt falsche Entwarnungen erzeugt.
   */
  async collect(categories) {
    const a = this.adapter, now = this.now(), events = [];
    this.overlapRefs = new Map();
/**
 * Code-Teil: read
 *
 * Zweck:
 * Automatisch markierter Arrow-Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
    const read = async id => { const s = await a.getStateAsync(id); return s?.val; };
/**
 * Code-Teil: add
 *
 * Zweck:
 * Automatisch markierter Arrow-Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
    const add = (id, category, title, message, persistMs = 60000, severity = 'warning') => events.push({ id, category, title, message, persistMs, severity });
/**
 * Code-Teil: retain
 *
 * Zweck:
 * Automatisch markierter Arrow-Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
    const retain = prefix => { for (const [id, record] of this.policy.records) if (id.startsWith(prefix) && record.active) events.push({ ...record.meta, suppressed: true }); };
    const last = Number(await read('ems.core.lastTickStart'));
    const engineStalled = a.config?.ems?.enabled !== false && last > 0 && now - last > 120000;
    if (categories.has('system')) {
      // Ein gemeinsames Mesh-Ereignis vermeidet eine Mail pro ausgefallenem Haus.
      const meshEvent = a._meshCoordinator?.notificationEvent?.();
      if (meshEvent) add('mesh:control', 'system', meshEvent.title, meshEvent.message, meshEvent.severity === 'critical' ? 0 : 60000, meshEvent.severity);
      const archiveEvent = a._meshCoordinator?.energy?.notificationEvent?.();
      if (archiveEvent) add('mesh:archive', 'system', archiveEvent.title, archiveEvent.message, 60000, archiveEvent.severity);

      if (a.config?.ems?.enabled !== false && a._nwEmsInitError) add('ems:init', 'system', 'Energiemanagement konnte nicht starten', 'Die Regelung konnte nicht initialisiert werden. Bitte die EOS-Diagnose prüfen.', 0, 'critical');
      if (engineStalled) add('ems:stalled', 'system', 'Energieregelung antwortet nicht', 'Der Regelzyklus wurde seit über zwei Minuten nicht mehr ausgeführt.', 0, 'critical');
      const diag = a.emsEngine?.mm?.lastTickDiag;
      if (a.config?.ems?.enabled !== false && diag && now - diag.ts < 120000) {
        for (const m of (diag.results || [])) if (m.enabled === true && m.ok === false && MODULES.has(m.key)) {
          add(`module:${m.key}`, 'system', `EOS-Modul ausgefallen: ${m.key}`, 'Das aktive Regelungsmodul meldet einen Fehler oder antwortet nicht. Bitte die EOS-Diagnose prüfen.', 0, 'critical');
        }
      }
      const error = await a.getStateAsync('ems.core.lastTickError');
      if (error?.val && now - Number(error.ts) < 120000 && !engineStalled) add('ems:error', 'system', 'Fehler im Energiemanagement', 'Der laufende Regelzyklus meldet einen Fehler. Bitte die EOS-Diagnose prüfen.', 0, 'critical');
    }
    const downInstances = new Set();
    if (categories.has('system') || categories.has('communications')) {
      await a._notifyRefreshWatchedInstances(false);
      for (const inst of (a._notify.watchedInstances?.instances || []).slice(0, 128)) {
        const instance = await a.getForeignObjectAsync(`system.adapter.${inst}`);
        if (!instance || instance.common?.enabled === false) continue;
        const alive = await a.getForeignStateAsync(`system.adapter.${inst}.alive`);
        const conn = await a.getForeignStateAsync(`${inst}.info.connection`);
        if (alive?.val === false || conn?.val === false) {
          downInstances.add(inst);
          const category = alive?.val === false && categories.has('system') ? 'system' : 'communications';
          if (categories.has(category)) add(`adapter:${inst}`, category, `Verbindung ausgefallen: ${inst}`, 'Eine für die Anlage verwendete Datenquelle ist ausgefallen oder meldet einen Verbindungsverlust.', 0, alive?.val === false ? 'critical' : 'warning');
        }
      }
    }
/**
 * Code-Teil: sourceDown
 *
 * Zweck:
 * Automatisch markierter Arrow-Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
    const sourceDown = id => {
      let source = String(id || '');
      const aliases = a._notify.watchedInstances?.aliasTargets || {};
      for (let n = 0; n < 16 && aliases[source]; n++) source = aliases[source];
      return Array.from(downInstances).some(inst => source.startsWith(inst + '.'));
    };
    if (categories.has('inverters')) {
      await a._notifyRefreshNwDevicesCache(false);
      for (const d of (a._notify.nwDevices?.pvInverters || []).slice(0, 128)) {
        if (!d.dp?.connected) continue;
        this.overlapRefs.set('inverter:' + d.id, [{root:d.id},d.dp.connected]);
        if (sourceDown(d.dp.connected)) { retain(`inverter:${d.id}`); continue; }
        const state = await a.getForeignStateAsync(d.dp.connected);
        if (!state) { retain(`inverter:${d.id}`); continue; }
        // Connection flags can legitimately be event-driven; an old true is not an outage.
        if (state?.val === false || state?.val === 0) add(`inverter:${d.id}`, 'inverters', `Wechselrichter nicht erreichbar: ${d.name}`, 'Der Geräteadapter meldet eine unterbrochene Verbindung.', 300000);
      }
    }
    if (categories.has('communications') && !engineStalled) {
      const dp = a.emsEngine?.dp;
      const entry = dp?.entries?.get('grid.powerW');
      if (entry?.objectId && !sourceDown(entry.objectId) && dp.getAgeMs('grid.powerW') > 300000) {
        add('grid:meter', 'communications', 'Netzmessung liefert keine aktuellen Werte', 'Die für die Regelung verwendete Netzmessung ist seit über fünf Minuten nicht aktuell.', 0, 'critical');
      }
    }
    if (engineStalled) { retain('lp:'); retain('module:'); retain('grid:meter'); retain('storage:'); }
    if (!engineStalled && (categories.has('system') || categories.has('communications'))) {
      const state = await a.getStateAsync('storageFarm.storagesStatusJson');
      if (state && now - Number(state.ts) < 120000) {
        let rows = [];
        try { rows = JSON.parse(String(state.val || '[]')); } catch (_error) { retain('storage:'); }
        for (const row of (Array.isArray(rows) ? rows : []).slice(0, 128)) {
          const id = `storage:${safeId(row.dispatchKey || row.name)}`;
          if (sourceDown(row.signedPowerId || row.chargePowerId || row.socId)) { retain(id); continue; }
          if (categories.has('system') && row.dispatchBlockedReasons?.includes('fault_active')) {
            add(id, 'system', `Speicher meldet eine Störung: ${row.name}`, 'Der konfigurierte Speicher meldet einen aktiven Gerätefehler.', 0, 'critical');
          } else if (categories.has('communications') && (row.state === 'offline' || row.degradedReason === 'stale')) {
            this.overlapRefs.set(id, [row.signedPowerId, row.chargePowerId, row.socId]);
            add(id, 'communications', `Speicher nicht erreichbar: ${row.name}`, 'Der konfigurierte Speicher meldet einen Verbindungsverlust oder veraltete Betriebsdaten.');
          }
        }
      } else retain('storage:');
    }
    const cm = a.config?.chargingManagement;
    if (!engineStalled && cm?.enabled !== false && (categories.has('charging') || categories.has('communications'))) {
      for (const w of (cm?.wallboxes || []).slice(0, 128)) {
        if (w.enabled === false || !w.key) continue;
        this.overlapRefs.set('lp:' + w.key + ':offline', wallboxRefs(w));
        const base = `chargingManagement.wallboxes.${safeId(w.key)}`;
        const fields = ['online', 'faultActive', 'faultReason', 'userEnabled', 'userStationEnabled', 'vehiclePlugged', 'vehicleDemandConfirmed', 'targetPowerW', 'actualPowerW', 'meterStale', 'statusClass', 'reason', 'hardwareCommandState', 'applyStatus'];
        const values = await Promise.all(fields.map(f => read(`${base}.${f}`)));
        const s = Object.fromEntries(fields.map((f, i) => [f, values[i]]));
        const label = String(w.name || w.key);
        if ([w.onlineId, w.powerId, w.statusId].some(sourceDown) || s.online == null) { retain(`lp:${w.key}:`); continue; }
        if (categories.has('communications') && s.online === false) {
          const station = await ocppRootRef(w,this.policy.supervisedNamespaces?.ocpp,a.getForeignStateAsync?.bind(a));
          if (station) this.overlapRefs.get('lp:' + w.key + ':offline').push(station);
          add(`lp:${w.key}:offline`, 'communications', `Ladepunkt nicht erreichbar: ${label}`, 'Die Verbindung zur Ladestation ist unterbrochen.'); retain(`lp:${w.key}:fault`); retain(`lp:${w.key}:interrupted`); continue;
        }
        if (categories.has('charging') && s.online === true && s.faultActive === true) {
          add(`lp:${w.key}:fault`, 'charging', `Ladestation meldet eine Störung: ${label}`, 'Die Station meldet einen bestätigten Fehler. Bitte den Ladepunkt prüfen.', 0, 'critical'); retain(`lp:${w.key}:interrupted`); retain(`lp:${w.key}:write`); continue;
        }
        if (categories.has('communications') && s.online === true && s.meterStale === true && (s.vehiclePlugged === true || Number(s.targetPowerW) > 0)) {
          add(`lp:${w.key}:stale`, 'communications', `Ladedaten fehlen: ${label}`, 'Die Station ist erreichbar, liefert aber keine ausreichend aktuellen Leistungsdaten.', 180000); retain(`lp:${w.key}:interrupted`); continue;
        }
        if (categories.has('charging') && s.online === true && s.applyStatus === 'ocpp-zero-held-not-stopped') {
          add(`lp:${w.key}:stop`, 'charging', `Ladestopp nicht bestätigt: ${label}`, 'Die Station bestätigt den geforderten Ladestopp nicht. Bitte den Ladepunkt unmittelbar prüfen.', 0, 'critical'); continue;
        }
        if (!categories.has('charging') || s.userEnabled === false || s.userStationEnabled === false || s.online !== true) continue;
        if (/failed|error|rejected|timeout/i.test(String(s.hardwareCommandState || ''))
          || /write_failed|executor_error|ocpp-command-not-confirmed|no_dp_registry/.test(String(s.applyStatus || ''))) {
          add(`lp:${w.key}:write`, 'charging', `Ladebefehl fehlgeschlagen: ${label}`, 'Die Station hat einen Ladebefehl nicht erfolgreich bestätigt.', 120000); continue;
        }
        const normalPause = /finish|complete|suspend|available|disconnected|idle/i.test(String(s.statusClass || ''))
          || /phase.*switch|cooldown|no.demand|no.vehicle|user|rfid|budget|peak|safety|pv.*wait|pause/i.test(String(s.reason || ''));
        if (s.vehiclePlugged === true && s.vehicleDemandConfirmed === true && Number(s.targetPowerW) >= 1000
          && Number.isFinite(s.actualPowerW) && s.actualPowerW < 100 && s.meterStale === false && !normalPause) {
          add(`lp:${w.key}:interrupted`, 'charging', `Ladung bleibt aus: ${label}`, 'Trotz freigegebener Ladeleistung und bestätigtem Ladebedarf fließt seit mindestens einer Minute kein Ladestrom. Möglicher Ladeabbruch oder fehlgeschlagener Ladestart.', 180000, 'warning');
        }
      }
    }
    if (categories.has('grid')) {
      const action = String(await read('gridConstraints.zeroExport.action') || '');
      if (/failsafe/i.test(action)) add('grid:failsafe', 'grid', 'Netzregelung im Sicherheitsbetrieb', 'Die Netzregelung meldet einen Kommunikations- oder Sicherheitszustand. Bitte die EOS-Diagnose prüfen.', 0, 'critical');
    }
    return events;
  }
  /**
   * Ablauf und Zusammenhang: Markiert den Dienst als beendet und schließt den SMTP-Transport beim Adapter-Unload. Spätere Versandversuche werden dadurch abgewehrt.
   */
  close() { this.closed = true; this.transport?.close(); this.transport = null; }
}
module.exports = { NotificationMail, normalizeConfig, validAddress, smtpError, FROM, supervisedId, migrateIncident };
