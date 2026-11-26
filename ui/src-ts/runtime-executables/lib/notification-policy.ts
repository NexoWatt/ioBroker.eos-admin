/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
// @ts-nocheck
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Verwaltet Störungszustände, Versandintervalle, Entwarnungen und Wiederholschutz unabhängig vom SMTP-Transport.
 * Daten und Wirkung: Erhält Ereignisse und Zeitstempel; liefert versandfähige Gruppen sowie einen speicherbaren Status. Kritische Fehler werden bei Erkennung fällig, normale im 30-Minuten-Fenster, Hinweise/Erinnerungen täglich.
 * Bei Änderungen: Einheiten, Vorzeichen, Gültigkeit und Aufrufer mitprüfen; Kommentare und docs:build nach fachlichen Änderungen aktualisieren.
 * Verknüpfungen: docs/quellcode/src-ts/runtime-executables/lib/notification-policy.md
 * Einstieg: docs/QUELLCODE_WEGWEISER_DE.md; Pflege: docs/DOKUMENTATIONSSTANDARD_DE.md
 */
'use strict';
const HOUR = 3600000;
const DAY = 24 * HOUR;
const NORMAL_INTERVAL = 30 * 60000;
const LEGACY_CAP = 256;
const SUPERVISOR_CAP = 3 * 256 + 6;
const clean = value => String(value || '').replace(/[\r\n]+/g, ' ').slice(0, 400);

/** Bounded, durable incident transitions. Delivery is committed only after SMTP acceptance. */
class NotificationPolicy {
  /**
   * Ablauf und Zusammenhang: Stellt den persistenten Meldungszustand mit begrenzten Listen wieder her. Zeitangaben sind Millisekunden; die Instanz selbst stellt keine Netzwerkverbindung her.
   */
  constructor(saved = {}) {
    this.records = new Map(Array.isArray(saved.records) ? saved.records.slice(0, LEGACY_CAP + SUPERVISOR_CAP) : []);
    this.sent = Array.isArray(saved.sent) ? saved.sent.filter(Number.isFinite).slice(-24) : [];
    this.nextAttempt = Number(saved.nextAttempt) || 0;
    this.failures = Number(saved.failures) || 0;
    this.lastTest = Number(saved.lastTest) || 0;
    this.lastDigest = Number(saved.lastDigest) || 0;
    this.lastNormal = Number(saved.lastNormal) || 0;
    this.recipientHash = String(saved.recipientHash || '');
    this.supervisedNamespaces = saved.supervisedNamespaces || {};
  }
  /**
   * Ablauf und Zusammenhang: Vergleicht den Hash der Kundenadresse. Bei Empfängerwechsel wird die bisherige Ereigniszuordnung gelöscht, damit der neue Empfänger keinen fremden Störungsverlauf erbt.
   */
  setRecipient(hash) {
    if (hash !== this.recipientHash) { this.records.clear(); this.recipientHash = hash; }
  }
  /**
   * Ablauf und Zusammenhang: Gleicht aktuelle Ereignisse mit bereits bekannten Störungen ab. Kurzes Flattern behält den Wiederholschutz; eine Eskalation auf kritisch und eine nach stabiler Erholung neue Störung werden gesondert behandelt.
   */
  observe(events, now, categories, owns = () => true) {
    if (!this.lastDigest) this.lastDigest = now;
    if (!this.lastNormal) this.lastNormal = now;
    const seen = new Set();
    let supervisedCount = 0, deviceCount = 0;
    for (const id of this.records.keys()) {
      if (id.startsWith('supervisor:')) supervisedCount++;
      if (id.startsWith('supervisor:device:')) deviceCount++;
    }
    for (const event of events) {
      if (!event || !event.id || !owns(event.id) || !categories.has(event.category)) continue;
      seen.add(event.id);
      let r = this.records.get(event.id);
      if (event.hold) {
        if (r) { r.suppressed = true; if (!r.active) r.clearSince = 0; }
        continue;
      }
      if (!r) {
        if (event.id.startsWith('supervisor:')) {
          if (supervisedCount >= SUPERVISOR_CAP) continue;
          if (event.id.startsWith('supervisor:device:')) { if (deviceCount >= SUPERVISOR_CAP - 6) continue; deviceCount++; }
          supervisedCount++;
        } else if (this.records.size - supervisedCount >= LEGACY_CAP) continue;
      }
      if (!r) r = { active: false, alertSent: false, lastSent: 0, since: now };
      // A stable recovery ends the incident; brief flapping keeps its delivery history.
      const newEpisode = !r.active && r.clearSince && now - r.clearSince >= 300000;
      const escalated = r.meta && r.meta.severity !== 'critical' && event.severity === 'critical' && !r.criticalSent;
      if (newEpisode) r.criticalSent = false;
      if (newEpisode || escalated) { r.alertSent = false; r.lastSent = 0; }
      if (!r.active || escalated) { r.since = now; r.active = true; }
      r.clearSince = 0;
      r.suppressed = event.suppressed === true;
      r.meta = { id: clean(event.id), category: event.category, title: clean(event.title).slice(0, 140), message: clean(event.message).slice(0, 300),
        severity: ['critical', 'warning', 'info'].includes(event.severity) ? event.severity : 'warning', persistMs: event.severity === 'critical' ? 0 : 60000 };
      if (event.physicalId) r.meta.physicalId = clean(event.physicalId);
      this.records.set(event.id, r);
    }
    for (const [id, r] of this.records) {
      if (!owns(id)) continue;
      if (!categories.has(r.meta?.category)) { this.records.delete(id); continue; }
      if (!seen.has(id)) {
        r.suppressed = false;
        if (r.active || !r.clearSince) { r.active = false; r.clearSince = now; }
        const pending = !r.lastSent && (r.meta.severity === 'critical' || r.meta.severity === 'info' || r.clearSince - r.since >= 60000);
        if ((!r.alertSent && !r.lastSent && !pending) || (now - (r.clearSince || now) > 2 * DAY)) this.records.delete(id);
      }
    }
  }
  /**
   * Ablauf und Zusammenhang: Prüft Wiederholpause und Testmail-Kontingent. Testmails sind zusätzlich auf drei pro Stunde begrenzt; die reguläre Alarmwahl folgt anschließend in batch.
   */
  quota(now, test = false) {
    this.sent = this.sent.filter(ts => ts > now - DAY && ts <= now + 60000);
    if (now < this.nextAttempt) return false;
    if (test) return (!this.lastTest || now - this.lastTest >= 300000) && this.sent.filter(ts => ts > now - HOUR).length < 3;
    return true;
  }
  /**
   * Ablauf und Zusammenhang: Wählt fällige Meldungen: neue kritische Fehler sofort, normale Fehler gesammelt nach 30 Minuten, Hinweise/Erinnerungen/Entwarnungen täglich. Unterdrückte Folgefehler werden ausgelassen; auch während SMTP-Ausfall bereits behobene unversandte harte Fehler bleiben meldbar.
   */
  batch(now, recovery = true, allowed = () => true) {
    if (!this.quota(now)) return [];
    const immediate = [], daily = [];
    const digestDue = now - this.lastDigest >= DAY;
    const normalDue = now - this.lastNormal >= NORMAL_INTERVAL;
    for (const [id, r] of this.records) {
      if (r.suppressed) continue;
      if (r.active && now - r.since >= r.meta.persistMs) {
        const item = { ...r.meta, kind: 'alarm', since: r.since };
        if (r.meta.severity === 'warning') {
          if (normalDue && (!r.lastSent || now - r.lastSent >= NORMAL_INTERVAL)) immediate.push({ ...item, normal: true });
        } else if (!r.alertSent && !r.lastSent && r.meta.severity !== 'info') {
          immediate.push(item);
        } else if (digestDue && (!r.lastSent || now - r.lastSent >= DAY)) daily.push({ ...item, daily: true });
      } else if (!r.active && !r.alertSent && !r.lastSent) {
        // Do not lose an undelivered hard fault merely because it cleared while SMTP was down.
        const item = { ...r.meta, kind: 'alarm', since: r.since, resolved: true };
        if (r.meta.severity === 'critical') immediate.push(item);
        else if (r.meta.severity === 'warning') { if (normalDue) immediate.push({ ...item, normal: true }); }
        else if (digestDue) daily.push({ ...item, daily: true });
      } else if (!r.active && r.alertSent && now - r.clearSince >= 300000) {
        if (recovery && digestDue) daily.push({ ...r.meta, kind: 'recovery', since: r.since, daily: true });
        else if (!recovery && allowed(r.meta)) r.alertSent = false;
      }
    }
    // Advance empty half-hour windows too; a new warning cannot bypass the collection interval.
    if (normalDue && !immediate.some(item => item.normal)) this.lastNormal = now;
    immediate.sort((a, b) => Number(b.severity === 'critical') - Number(a.severity === 'critical')
      || Number(b.id.startsWith('supervisor:process:')) - Number(a.id.startsWith('supervisor:process:')));
    // Leave another live collector its window; its own fresh observations decide delivery.
    const selected = immediate.concat(daily).filter(allowed).slice(0,64);
    const selectedIds = new Set(selected.map(item => item.id));
    this.deferNormal = immediate.some(item => item.normal && !selectedIds.has(item.id));
    this.deferDigest = daily.some(item => !selectedIds.has(item.id));
    return selected;
  }
  /**
   * Ablauf und Zusammenhang: Setzt vor dem tatsächlichen Versand eine zweiminütige Versuchsreservierung. Bei Testmails wird zusätzlich deren letzter Versuch festgehalten.
   */
  reserve(now, test = false) {
    this.nextAttempt = now + 120000;
    if (test) this.lastTest = now;
  }
  /**
   * Ablauf und Zusammenhang: Bestätigt Meldungen erst nach SMTP-Annahme. Fehler erhöhen die Wiederholpause exponentiell bis maximal eine Stunde; Erfolg aktualisiert Versandzeiten und hebt die Versuchsreservierung auf.
   */
  complete(batch, now, accepted) {
    if (!accepted) {
      this.failures = Math.min(8, this.failures + 1);
      this.nextAttempt = now + Math.min(HOUR, 120000 * 2 ** (this.failures - 1));
      return;
    }
    this.failures = 0;
    this.nextAttempt = 0;
    if (!batch.length) this.sent.push(now);
    if (!this.deferDigest && batch.some(item => item.daily)) this.lastDigest = now;
    if (!this.deferNormal && batch.some(item => item.normal)) this.lastNormal = now;
    this.sent = this.sent.slice(-24);
    for (const item of batch) {
      const r = this.records.get(item.id);
      if (!r) continue;
      if (item.kind === 'recovery') r.alertSent = false;
      else { r.alertSent = r.active; r.lastSent = now; if (item.severity === 'critical') r.criticalSent = true; }
    }
  }
  /**
   * Ablauf und Zusammenhang: Gibt einen JSON-speicherbaren Zustand zurück. NotificationMail.saveLedger schreibt ihn auf Datenträger, damit Neustarts keine bereits gemeldeten Vorfälle erneut als neu einstufen.
   */
  snapshot() {
    return { records: Array.from(this.records.entries()), sent: this.sent, nextAttempt: this.nextAttempt,
      failures: this.failures, lastTest: this.lastTest, lastDigest: this.lastDigest, lastNormal: this.lastNormal, recipientHash: this.recipientHash, supervisedNamespaces:this.supervisedNamespaces };
  }
}
module.exports = { NotificationPolicy };
