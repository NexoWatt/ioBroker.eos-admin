/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
// @runtime-transpile
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Übergibt bewusst ausgewählte Geräte an die geschützte Alias-Anlage.
 * Daten und Wirkung: Ein begrenzter POST legt Alias-Objekte an oder verwendet sie wieder.
 * Keine Gerätewerte, keine automatische Wiederholung, keine selbstständige Konfigurationsspeicherung.
 * Bei Änderungen: Teilfehler, Berechtigungen, Zeitbudget, große Antworten und parallele
 * Entwurfsänderungen prüfen. Nur IO und Quellenbasis dürfen aus der Antwort übernommen werden.
 */
interface NwAliasConfigResult { devices: Record<string, unknown>[]; created: string[]; reused: string[] }
interface NwAliasConfigApi { canCreate(): boolean; create(devices: unknown): Promise<NwAliasConfigResult> }
(function () {
  'use strict';
  const host: Window & { NW_SH_ALIAS_CONFIG?: NwAliasConfigApi; NW_AUTH?: { hasCapability(capability: string): boolean } } = window;
  if (host.NW_SH_ALIAS_CONFIG) return;
  const requestLimit = 4 * 1024 * 1024;
  const responseLimit = 5 * 1024 * 1024;
  let busy = false;
  function record(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === 'object' && !Array.isArray(value); }
  function inspect(value: unknown, depth = 0, budget = { value: 100000 }): void {
    if (--budget.value < 0 || depth > 16) throw new Error('Alias-Auswahl ist zu groß oder zu tief verschachtelt.');
    if (value === undefined || value === null || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))) return;
    if (typeof value === 'string' && value.length <= 32768) return;
    if (Array.isArray(value) && value.length <= 8192) { value.forEach(item => inspect(item, depth + 1, budget)); return; }
    if (record(value) && Object.keys(value).length <= 2048) {
      for (const [key, child] of Object.entries(value)) {
        if (['__proto__', 'constructor', 'prototype'].includes(key)) throw new Error('Ungültiger Schlüssel in Alias-Auswahl.');
        inspect(child, depth + 1, budget);
      }
      return;
    }
    throw new Error('Ungültige Alias-Auswahl.');
  }
  function clone(value: unknown): unknown { inspect(value); const parsed: unknown = JSON.parse(JSON.stringify(value)); return parsed; }
  function canCreate(): boolean { return host.NW_AUTH?.hasCapability('mapping.edit') === true; }
  function validateDevices(value: unknown): Record<string, unknown>[] {
    if (!Array.isArray(value) || value.length === 0 || value.length > 100) throw new Error('Für die Alias-Anlage 1 bis 100 Geräte auswählen.');
    const ids = new Set<string>();
    let slots = 0;
    return value.map((item: unknown) => {
      const copy = clone(item);
      if (!record(copy) || typeof copy.id !== 'string' || !copy.id || copy.id.length > 80 || ids.has(copy.id)) throw new Error('Geräte-IDs der Alias-Auswahl fehlen oder sind doppelt.');
      const io = copy.io;
      if (!record(io) || !record(io.deviceControls) || !Array.isArray(io.deviceControls.fields)) throw new Error('Für die Alias-Anlage zuerst ein vollständiges Bedienprofil zuordnen.');
      slots += io.deviceControls.fields.length;
      if (slots > 2000) throw new Error('Eine Alias-Auswahl darf höchstens 2000 Profilfunktionen enthalten.');
      ids.add(copy.id); return copy;
    });
  }
  function ids(value: unknown): string[] {
    if (!Array.isArray(value) || value.length > 8192 || value.some(id => typeof id !== 'string' || id.length > 512)) throw new Error('Ungültige Alias-Antwort. Der Entwurf bleibt unverändert.');
    return value as string[];
  }
  function failure(status: number, payload: unknown): Error {
    const partial = record(payload) ? payload : {};
    const created = Array.isArray(partial.created) ? partial.created.length : 0;
    const reused = Array.isArray(partial.reused) ? partial.reused.length : 0;
    const uncertain = Array.isArray(partial.uncertain) ? partial.uncertain.length : 0;
    const reason = status === 401 ? 'Sitzung abgelaufen. Bitte erneut bei EOS anmelden.' : status === 403 ? 'Berechtigung mapping.edit für die Alias-Anlage fehlt.' : 'Alias-Anlage konnte nicht vollständig bestätigt werden.';
    return new Error(`${reason} Der Geräteentwurf bleibt unverändert.${created || reused || uncertain ? ` Rückmeldung: ${created} angelegt, ${reused} wiederverwendet, ${uncertain} unbestätigt.` : ''} Bereits angelegte Alias-Objekte können bestehen bleiben; es erfolgt keine automatische Wiederholung.`);
  }
  async function create(input: unknown): Promise<NwAliasConfigResult> {
    if (!canCreate()) throw new Error('Berechtigung mapping.edit für die Alias-Anlage fehlt.');
    if (busy) throw new Error('Eine Alias-Anlage läuft bereits. Bitte deren Ergebnis abwarten.');
    const originals = validateDevices(input);
    const body = JSON.stringify({ devices: originals });
    if (new TextEncoder().encode(body).byteLength > requestLimit) throw new Error('Alias-Auswahl ist zu groß. Bitte weniger Geräte auswählen.');
    busy = true;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch('/api/smarthome/aliases', { method: 'POST', credentials: 'same-origin', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body, signal: controller.signal });
      if (!response.body) throw failure(response.status, null);
      const reader = response.body.getReader(); const decoder = new TextDecoder(); let text = ''; let bytes = 0;
      try {
        for (;;) {
          const part = await reader.read(); if (part.done) break;
          bytes += part.value.byteLength;
          if (bytes > responseLimit) { controller.abort(); throw new Error('Alias-Antwort überschreitet die erlaubte Größe.'); }
          text += decoder.decode(part.value, { stream: true });
        }
        text += decoder.decode();
      } finally { reader.releaseLock(); }
      const payload: unknown = JSON.parse(text); inspect(payload);
      if (!response.ok || !record(payload) || payload.ok !== true) throw failure(response.status, payload);
      const returned = validateDevices(payload.devices);
      if (returned.length !== originals.length) throw new Error('Unvollständige Alias-Antwort. Der Entwurf bleibt unverändert.');
      const mapped = new Map(returned.map(device => [device.id, device]));
      const devices = originals.map(original => {
        const responseDevice = mapped.get(original.id);
        if (!responseDevice || !record(responseDevice.io)) throw new Error('Alias-Antwort passt nicht zur Geräteauswahl. Der Entwurf bleibt unverändert.');
        const next: Record<string, unknown> = { ...original, io: responseDevice.io };
        if (responseDevice.importProvenance !== undefined) next.importProvenance = responseDevice.importProvenance;
        else if (original.importProvenance !== undefined) throw new Error('Quellenbasis fehlt in der Alias-Antwort. Der Entwurf bleibt unverändert.');
        return next;
      });
      return { devices, created: ids(payload.created), reused: ids(payload.reused) };
    } catch (error) {
      if (controller.signal.aborted) throw new Error('Alias-Anlage nach 30 Sekunden oder wegen einer zu großen Antwort nicht bestätigt. Bereits angelegte Alias-Objekte können vorhanden sein; der Entwurf bleibt unverändert. Bitte vor einer bewussten Wiederholung prüfen.');
      if (error instanceof Error && error.name !== 'TypeError' && error.name !== 'SyntaxError') throw error;
      throw new Error('Keine vollständige Antwort auf die Alias-Anlage. Bereits angelegte Alias-Objekte können vorhanden sein; der Entwurf bleibt unverändert. Es erfolgt keine automatische Wiederholung.');
    } finally { clearTimeout(timer); busy = false; }
  }
  host.NW_SH_ALIAS_CONFIG = Object.freeze({ canCreate, create });
})();
