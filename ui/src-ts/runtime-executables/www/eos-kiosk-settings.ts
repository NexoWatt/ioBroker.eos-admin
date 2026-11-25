/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
// @runtime-transpile
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Zeigt den serverseitigen Kioskzustand und ändert ihn nur nach bestätigter
 * Administratoranmeldung. Revision verhindert verlorene Änderungen mehrerer
 * Browser. auth.ts liefert CSRF; der Server prüft Rolle, Ursprung und Revision.
 * Aktivierung verwirft bestehende Sitzungen; erst die bestätigte Antwort führt
 * zum Dashboard. Kein lokaler Freischalter, kein Passwort und keine Tokens im Speicher.
 */
(function () {
  'use strict';
  const statusNode = document.getElementById('eosKioskStatus');
  const toggle = document.getElementById('eosKioskToggle') as HTMLButtonElement | null;
  const admin = document.getElementById('eosKioskAdmin') as HTMLAnchorElement | null;
  if (!statusNode || !toggle || !admin) return;
  const elements = { statusNode, toggle, admin };
  const host = window as Window & { NW_AUTH?: { refreshStatus(): Promise<{ role: string; authed: boolean; kiosk?: boolean; statusError: boolean }> } };
  interface KioskView { enabled: boolean; revision: number }
  let view: KioskView | null = null;
  let busy = false;
  let generation = 0;

  async function request(method: 'GET' | 'PUT', payload?: KioskView): Promise<KioskView & { reauthenticate?: boolean }> {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 6000);
    try {
      const response = await fetch('/api/eos/kiosk', { method, credentials: 'same-origin', cache: 'no-store', redirect: 'error',
        signal: controller.signal, headers: { Accept: 'application/json', ...(payload ? { 'Content-Type': 'application/json' } : {}) },
        ...(payload ? { body: JSON.stringify(payload) } : {}) });
      if (!response.ok) throw new Error(response.status === 409 ? 'conflict' : 'unconfirmed');
      if (!/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type') || '')) throw new Error('invalid');
      const reader = response.body?.getReader(); if (!reader) throw new Error('body');
      let length = 0, text = ''; const decoder = new TextDecoder('utf-8', { fatal: true });
      try {
        while (true) {
          const part = await reader.read(); if (part.done) break;
          length += part.value.byteLength; if (length > 16384) throw new Error('limit');
          text += decoder.decode(part.value, { stream: true });
        }
        text += decoder.decode();
      } finally { await reader.cancel().catch(() => undefined); }
      const value: unknown = JSON.parse(text);
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid');
      const data = value as Record<string, unknown>;
      if (typeof data.enabled !== 'boolean' || !Number.isSafeInteger(data.revision) || Number(data.revision) < 0
        || (method === 'PUT' && data.ok !== true)) throw new Error('invalid');
      return { enabled: data.enabled, revision: Number(data.revision), reauthenticate: data.reauthenticate === true };
    } finally { window.clearTimeout(timer); }
  }

  async function administrator(): Promise<boolean> {
    const access = await host.NW_AUTH?.refreshStatus();
    const allowed = access?.authed === true && access.role === 'admin' && !access.kiosk && !access.statusError;
    elements.admin.hidden = allowed;
    return allowed;
  }

  function render(): void {
    elements.statusNode.textContent = view?.enabled ? 'Kioskmodus ist aktiv.' : 'Kioskmodus ist ausgeschaltet.';
    elements.toggle.textContent = view?.enabled ? 'Kioskmodus deaktivieren' : 'Kioskmodus aktivieren';
    elements.toggle.disabled = busy || !view;
  }

  async function load(): Promise<void> {
    if (busy) return;
    busy = true; elements.toggle.disabled = true; const ticket = ++generation;
    try {
      if (!await administrator()) {
        view = null; elements.statusNode.textContent = 'Zum Ändern des Kioskmodus bitte als Administrator anmelden.'; return;
      }
      const result = await request('GET'); if (ticket !== generation) return;
      view = result; render();
    } catch {
      if (ticket === generation) { view = null; elements.statusNode.textContent = 'Kioskstatus nicht erreichbar. Bitte die Seite erneut öffnen.'; }
    } finally { if (ticket === generation) { busy = false; elements.toggle.disabled = !view; } }
  }

  elements.toggle.addEventListener('click', () => {
    if (busy || !view) return;
    const next = { enabled: !view.enabled, revision: view.revision };
    busy = true; elements.toggle.disabled = true; const ticket = ++generation;
    elements.statusNode.textContent = 'Kioskmodus wird gespeichert …';
    void (async () => {
      try {
        if (!await administrator()) throw new Error('denied');
        const result = await request('PUT', next); if (ticket !== generation) return;
        if (result.enabled !== next.enabled || result.revision <= next.revision) throw new Error('unconfirmed');
        view = result;
        if (result.enabled || result.reauthenticate) { window.location.replace('/'); return; }
        render();
      } catch (error) {
        if (ticket !== generation) return;
        view = null;
        elements.statusNode.textContent = error instanceof Error && error.message === 'conflict'
          ? 'Der Kioskmodus wurde zwischenzeitlich geändert. Bitte die Seite neu laden.'
          : 'Die Änderung ist nicht bestätigt. Bitte die Seite neu laden und den Status prüfen.';
      } finally { if (ticket === generation) { busy = false; elements.toggle.disabled = !view; } }
    })();
  });
  window.addEventListener('pagehide', () => { generation += 1; view = null; busy = false; elements.toggle.disabled = true; });
  window.addEventListener('pageshow', event => { if (event.persisted) void load(); });
  void load();
})();
