/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
// @runtime-transpile
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Eigenständige Anmeldeseite für zwei ausdrücklich gewählte Profile.
 * Daten und Wirkung: Das ioBroker-Profil sendet das eingegebene Passwort genau
 * einmal an die eigene Login-API; das EOS-Profil öffnet ausschließlich die vom
 * Server konfigurierte zentrale Anmeldung. Keine Passwort-/Tokenpersistenz.
 * Rücksprünge bleiben innerhalb bekannter UI-Routen derselben Adapterinstanz.
 * Frames, unbestätigter Status, fehlende Konfiguration und Offlinebetrieb zeigen
 * keine Passwortmaske. Rollen und Seitenzugriffe prüft weiterhin der Server.
 * Bei Änderungen: Passwortübermittlung, Mehrfach-Submit, Profilwechsel und
 * verspätete Antworten sowie rollen- und instanzgebundene Rücksprünge prüfen.
 * Verknüpfungen: docs/operations/ANMELDEPROFILE_1_0_37_DE.md
 */
(function () {
  'use strict';
  interface LoginStatus {
    mode: 'iobroker' | 'eos'; authed: boolean; role: 'none' | 'customer' | 'installer' | 'admin';
    user: string | null; capabilities: string[]; loginUrl: string; nextUrl: string;
  }
  const form = document.getElementById('loginForm') as HTMLFormElement | null;
  const userInput = document.getElementById('loginUser') as HTMLInputElement | null;
  const passwordInput = document.getElementById('loginPassword') as HTMLInputElement | null;
  const submit = document.getElementById('loginSubmit') as HTMLButtonElement | null;
  const toggle = document.getElementById('loginPasswordToggle') as HTMLButtonElement | null;
  const statusNode = document.getElementById('loginStatus');
  const description = document.getElementById('loginDescription');
  const central = document.getElementById('centralLogin') as HTMLAnchorElement | null;
  const frame = document.getElementById('frameLogin') as HTMLAnchorElement | null;
  const retry = document.getElementById('loginRetry') as HTMLButtonElement | null;
  if (!form || !userInput || !passwordInput || !submit || !toggle || !statusNode || !description || !central || !frame || !retry) return;

  const elements = { form, userInput, passwordInput, submit, toggle, statusNode, description, central, frame, retry };
  let current: LoginStatus | null = null;
  let busy = false;
  let generation = 0;
  let retryAt = 0;
  let retryTimer: number | undefined;
  const rootPath = (): string => new URL(window.NW_RUNTIME?.url('/') ?? '/', window.location.href).pathname.replace(/\/?$/, '/');
  const framed = (): boolean => window.self !== window.top;
  const secureBrowser = (): boolean => window.location.protocol === 'https:'
    || (window.location.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]', '::1'].includes(window.location.hostname));

  function message(text: string, error = false): void {
    elements.statusNode.textContent = text;
    elements.statusNode.classList.toggle('nw-login-status--error', error);
  }

  function closeForms(): void {
    elements.form.hidden = true; elements.central.hidden = true; elements.frame.hidden = true;
    elements.passwordInput.value = '';
    elements.passwordInput.type = 'password';
    elements.toggle.textContent = 'Anzeigen'; elements.toggle.setAttribute('aria-pressed', 'false');
  }

  /** Begrenzte JSON-Antworten; Timeout umfasst auch langsame Antwortkörper. */
  async function requestStatus(): Promise<LoginStatus> {
    const controller = new AbortController(); const timer = window.setTimeout(() => controller.abort(), 6000);
    try {
      const response = await fetch('/api/auth/status', { credentials: 'same-origin', cache: 'no-store', redirect: 'error', signal: controller.signal });
      if (!response.ok || !/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type') || '')) throw new Error('status_unavailable');
      const reader = response.body?.getReader(); if (!reader) throw new Error('status_body_missing');
      const parts: Uint8Array[] = []; let count = 0;
      try {
        while (true) {
          const part = await reader.read(); if (part.done) break;
          count += part.value.byteLength; if (count > 65536) { controller.abort(); throw new Error('status_too_large'); }
          parts.push(part.value);
        }
      } finally { reader.releaseLock(); }
      const bytes = new Uint8Array(count); let offset = 0;
      for (const part of parts) { bytes.set(part, offset); offset += part.byteLength; }
      const value: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('status_invalid');
      const data = value as Record<string, unknown>;
      if (!['iobroker', 'eos'].includes(String(data.mode)) || data.configured !== true || data.enabled !== true || data.protectWrites !== true
        || typeof data.authed !== 'boolean' || (data.authenticated !== undefined && data.authenticated !== data.authed)
        || !['none', 'customer', 'installer', 'admin'].includes(String(data.role))
        || !Array.isArray(data.capabilities) || data.capabilities.length > 128
        || !data.capabilities.every(cap => typeof cap === 'string' && cap.length <= 128)
        || (data.authed && (typeof data.user !== 'string' || !data.user || data.user.length > 512 || data.role === 'none'))) throw new Error('status_invalid');
      return { mode: data.mode as LoginStatus['mode'], authed: data.authed, role: data.role as LoginStatus['role'],
        user: typeof data.user === 'string' ? data.user : null, capabilities: data.capabilities as string[],
        loginUrl: typeof data.loginUrl === 'string' && data.loginUrl.length <= 4096 ? data.loginUrl : '', nextUrl: ['/nexowatt/license', '/system/?passwordSetup', '/'].includes(String(data.nextUrl)) ? String(data.nextUrl) : '/' };
    } finally { window.clearTimeout(timer); }
  }

  /** Rücksprung niemals zu APIs, externen Zielen, einer anderen Instanz oder erneut zum Login. */
  function returnTarget(status: LoginStatus): string {
    if (status.nextUrl === '/nexowatt/license' || status.nextUrl === '/system/?passwordSetup') return status.nextUrl;
    const root = rootPath();
    const capabilities = status.capabilities;
    const professional = status.role === 'admin' || status.role === 'installer';
    const allowed = (cap: string): boolean => capabilities.includes('*') || capabilities.includes(cap);
    const fallback = root;
    const requested = new URLSearchParams(window.location.search).get('returnTo');
    if (!requested || requested.length > 2048 || !requested.startsWith('/') || requested.startsWith('//') || /[\\\u0000-\u0020\u007f]/.test(requested)) return fallback;
    try {
      const target = new URL(requested, window.location.origin);
      if (target.origin !== window.location.origin || target.username || target.password || !target.pathname.startsWith(root)) return fallback;
      const path = '/' + target.pathname.slice(root.length);
      const canonical = path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
      const pageName = canonical.endsWith('.html') ? canonical.slice(0, -5) : canonical;
      const userPages = new Set(['/', '/index', '/smarthome', '/settings', '/history', '/evcs', '/storagefarm',
        '/energy-ledger', '/para14a-report', '/evcs-report', '/rfid-report', '/tariff-report', '/year-report']);
      const setup = new Map([['/ems-apps.html', 'appcenter.open'], ['/simulation.html', 'simulation.open'],
        ['/smarthome-config.html', 'smarthome.configure'], ['/logic.html', 'nexologic.configure'],
        ['/license.html', 'license.manage'], ['/mail-setup', 'notifications.manage'], ['/mesh-setup', 'mesh.configure'],
        ['/ems/nvp', 'appcenter.open'], ['/ems/dynamic-grid', 'appcenter.open'], ['/ems/microgrid', 'mesh.configure'],
        ['/ems/arbitrage', 'appcenter.open'], ['/ems/partner-integrations', 'appcenter.open']]);
      const capability = setup.get(canonical);
      if (!userPages.has(pageName) && !(professional && capability && allowed(capability)
        && (!['license.manage', 'notifications.manage'].includes(capability) || status.role === 'admin'))) return fallback;
      // Nur die bekannte Seite übernehmen. Freie Abfrageparameter könnten in
      // anderen Komponenten weitere Ziele bestimmen und gehören nicht ins Login.
      const hash = /^#[A-Za-z0-9_./~-]{0,128}$/.test(target.hash) ? target.hash : '';
      return target.pathname + hash;
    } catch { return fallback; }
  }

  function centralTarget(value: string): string | null {
    if (!value || value.length > 4096 || /[\\\u0000-\u0020\u007f]/.test(value) || value.startsWith('//')) return null;
    try {
      const url = new URL(value, window.location.origin);
      if (url.username || url.password || (url.origin !== window.location.origin && url.protocol !== 'https:')) return null;
      if (!['http:', 'https:'].includes(url.protocol)) return null;
      return url.href;
    } catch { return null; }
  }

  function render(status: LoginStatus): void {
    closeForms(); elements.retry.hidden = true;
    if (framed()) {
      elements.frame.href = window.location.href; elements.frame.hidden = false;
      elements.description.textContent = 'Öffne die Anmeldung in einem eigenen Fenster. Danach kannst du hier fortfahren.';
      message('In eingebetteten Ansichten werden keine Passwörter abgefragt.'); return;
    }
    if (status.authed) { message('Angemeldet. Deine Oberfläche wird geöffnet …'); window.location.replace(returnTarget(status)); return; }
    if (status.mode === 'eos') {
      elements.description.textContent = 'Melde dich mit deinem zentralen EOS-Konto an. Dein Konto führt dich zu deinen freigegebenen Bereichen.';
      const destination = centralTarget(status.loginUrl);
      if (!destination) { message('Die zentrale Anmeldung ist noch nicht korrekt eingerichtet. Bitte den Administrator kontaktieren.', true); elements.retry.hidden = false; return; }
      elements.central.href = destination; elements.central.hidden = false;
      message(''); return;
    }
    elements.description.textContent = 'Melde dich an, um deine Energie- und SmartHome-Oberfläche zu öffnen.';
    if (!secureBrowser()) { message('Bitte die HTTPS-Adresse deiner Oberfläche öffnen. Über diese unverschlüsselte Verbindung werden keine Passwörter gesendet.', true); return; }
    elements.form.hidden = false; message('');
    if (!elements.userInput.value) elements.userInput.focus();
  }

  async function refresh(): Promise<void> {
    if (busy) return;
    const ticket = ++generation; current = null; closeForms(); elements.retry.hidden = true;
    message('Dein Anmeldezugang wird geprüft …');
    try {
      if (!['https:', 'http:'].includes(window.location.protocol) || navigator.onLine === false) throw new Error('offline');
      const status = await requestStatus(); if (ticket !== generation) return;
      current = status; render(status);
    } catch {
      if (ticket !== generation) return;
      closeForms(); message('Die Anmeldung ist derzeit nicht erreichbar oder noch nicht eingerichtet. Die Oberfläche bleibt gesperrt.', true); elements.retry.hidden = false;
    }
  }

  function setBusy(active: boolean): void {
    busy = active; elements.userInput.disabled = active; elements.passwordInput.disabled = active;
    elements.toggle.disabled = active; elements.submit.disabled = active || Date.now() < retryAt;
    elements.submit.textContent = active ? 'Anmeldung läuft …' : 'Anmelden ↗';
    elements.form.setAttribute('aria-busy', String(active));
  }

  /** Passwort exakt übernehmen, nicht trimmen/persistieren und keinen Login automatisch wiederholen. */
  elements.form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy || Date.now() < retryAt || current?.mode !== 'iobroker' || framed() || !secureBrowser()) return;
    const user = elements.userInput.value.trim(); let password = elements.passwordInput.value;
    if (!user || !password) { message('Bitte Benutzername und eigenes Passwort eingeben.', true); return; }
    setBusy(true); const ticket = ++generation;
    const controller = new AbortController(); const timer = window.setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch('/api/auth/login', { method: 'POST', credentials: 'same-origin', cache: 'no-store', redirect: 'error',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user, password }), signal: controller.signal });
      password = ''; elements.passwordInput.value = '';
      if (ticket !== generation) return;
      if (!response.ok) {
        if (response.status === 429) {
          const delay = response.headers.get('Retry-After') || '';
          const seconds = /^\d{1,5}$/.test(delay) ? Math.max(1, Math.min(3600, Number(delay))) : 30;
          retryAt = Date.now() + seconds * 1000;
          message('Zu viele Anmeldeversuche. Bitte in ' + seconds + ' Sekunden erneut versuchen.', true);
          if (retryTimer !== undefined) window.clearTimeout(retryTimer);
          retryTimer = window.setTimeout(() => { retryAt = 0; elements.submit.disabled = busy; message('Du kannst die Anmeldung erneut versuchen.'); }, seconds * 1000);
        } else if (response.status === 409) {
          current = null; closeForms(); message('Der Anmeldezugang wurde geändert. Bitte die Verbindung erneut prüfen.', true); elements.retry.hidden = false;
        } else if ([400, 401, 403].includes(response.status)) message('Anmeldung nicht möglich. Bitte Zugangsdaten und Kontoberechtigung prüfen.', true);
        else message('Die Anmeldung konnte nicht bestätigt werden. Bitte später erneut versuchen.', true);
        return;
      }
      const status = await requestStatus(); if (ticket !== generation) return;
      current = status;
      if (!status.authed) { message('Die Sitzung konnte nicht bestätigt werden. Bitte den vorgesehenen HTTPS-Zugang verwenden.', true); return; }
      render(status);
    } catch { if (ticket === generation) { current = null; closeForms(); message('Die Anmeldung konnte nicht bestätigt werden. Bitte die Verbindung erneut prüfen.', true); elements.retry.hidden = false; } }
    finally { password = ''; elements.passwordInput.value = ''; window.clearTimeout(timer); setBusy(false); }
  });

  elements.toggle.addEventListener('click', () => {
    const visible = elements.passwordInput.type === 'password'; elements.passwordInput.type = visible ? 'text' : 'password';
    elements.toggle.textContent = visible ? 'Verbergen' : 'Anzeigen'; elements.toggle.setAttribute('aria-pressed', String(visible));
    elements.toggle.setAttribute('aria-label', visible ? 'Passwort verbergen' : 'Passwort anzeigen');
  });
  elements.retry.addEventListener('click', () => { void refresh(); });
  window.addEventListener('offline', () => { generation += 1; current = null; closeForms(); message('Du bist offline. Eine Anmeldung benötigt die Verbindung zu deiner Anlage.', true); elements.retry.hidden = false; });
  window.addEventListener('online', () => { void refresh(); });
  window.addEventListener('pageshow', event => { if (event.persisted) void refresh(); });
  window.addEventListener('pagehide', () => { elements.passwordInput.value = ''; });
  document.addEventListener('visibilitychange', () => { if (document.hidden) elements.passwordInput.value = ''; else void refresh(); });
  void refresh();
})();
