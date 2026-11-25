/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
// @runtime-transpile
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Meldet echte Bedienung an die gemeinsame EOS-Sitzungsgrenze und
 * verdeckt abgelaufene Seiten vor der Rückkehr zur Anmeldung. Die verbindliche
 * Zehn-Minuten-Frist sowie Token-/Socket-Sperre erzwingt ausschließlich der Server.
 * Daten und Wirkung: Gleichursprüngliches Status-GET und CSRF-geschütztes POST;
 * keine Gerätebefehle, kein EMS-Stopp, keine Zugangsdaten im Browser-Speicher.
 * Hintergrundabfragen, Sichtbarkeit und Nachrichten anderer Tabs erneuern nichts.
 * Tabs teilen nur eine öffentliche Sitzungskennung und fragen dann den Server.
 * Bei Änderungen: letzte Eingabe, ruhende Tabs, Schlaffunktion, Offline-Rückkehr, BFCache,
 * Tokenrotation, mehrere unabhängige Anmeldungen und Eingaben in eigenen Frames.
 */
(function () {
  'use strict';
  const host = window as Window & { __nwSessionIdle?: boolean };
  if (host.__nwSessionIdle || typeof window.fetch !== 'function' || /\/login\.html$/.test(window.location.pathname)) return;
  host.__nwSessionIdle = true;
  const request = window.fetch.bind(window);
  const IDLE_MS = 600000;
  const SEND_INTERVAL_MS = 1000;
  const NETWORK_MS = 5000;
  const pagePath = window.NW_RUNTIME?.pathname() ?? window.location.pathname;
  const credentialRequired = !/^\/(?:index\.html|evcs\.html|storagefarm\.html|history\.html|smarthome\.html)?$/.test(pagePath);
  interface IdleStatus {
    authenticated: boolean; serverNow: number; idleTimeoutMs: number;
    idleExpiresAt: number | null; sessionKey: string | null; csrfToken: string;
    kiosk?: boolean;
  }
  let sessionKey = '';
  let csrfToken = '';
  let deadline = 0;
  let kiosk = false;
  let kioskTimer: ReturnType<typeof setTimeout> | undefined;
  let lastGesture = -Infinity;
  let lastSent = -Infinity;
  let pendingGesture = false;
  let stopped = false;
  let busy: Promise<void> | null = null;
  let expiryTimer: ReturnType<typeof setTimeout> | undefined;
  let activityTimer: ReturnType<typeof setTimeout> | undefined;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let channel: BroadcastChannel | null = null;
  let observer: MutationObserver | null = null;
  const now = (): number => performance.now();
  const clear = (timer: ReturnType<typeof setTimeout> | undefined): void => { if (timer !== undefined) clearTimeout(timer); };

  /** Feste Größen-/Zeitgrenzen gelten einschließlich Antwortkörper. */
  async function readJson(response: Response): Promise<unknown> {
    if (!/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type') || '')) throw new Error('idle_response');
    const reader = response.body?.getReader();
    if (!reader) throw new Error('idle_body');
    const decoder = new TextDecoder();
    let length = 0, text = '';
    try {
      while (true) {
        const result = await reader.read();
        if (result.done) break;
        length += result.value.byteLength;
        if (length > 16384) throw new Error('idle_body_limit');
        text += decoder.decode(result.value, { stream: true });
      }
      text += decoder.decode();
      return JSON.parse(text) as unknown;
    } finally { await reader.cancel().catch(() => undefined); }
  }

  function validate(value: unknown): IdleStatus {
    if (!value || typeof value !== 'object') throw new Error('idle_status');
    const data = value as Partial<IdleStatus>;
    if (data.kiosk === true) {
      if (credentialRequired) throw new Error('idle_credentials_required');
      if (data.authenticated !== true || !Number.isFinite(data.serverNow) || data.idleTimeoutMs !== 0
        || data.idleExpiresAt !== null || typeof data.sessionKey !== 'string' || !/^kiosk:[A-Za-z0-9_-]{16,128}$/.test(data.sessionKey)
        || typeof data.csrfToken !== 'string' || !/^[a-f0-9]{64}$/.test(data.csrfToken)) throw new Error('idle_kiosk_status');
      return data as IdleStatus;
    }
    if (typeof data.authenticated !== 'boolean' || !Number.isFinite(data.serverNow) || data.idleTimeoutMs !== IDLE_MS) throw new Error('idle_status');
    if (data.authenticated && (typeof data.idleExpiresAt !== 'number' || !Number.isFinite(data.idleExpiresAt) ||
      data.idleExpiresAt > Number(data.serverNow) + IDLE_MS || typeof data.sessionKey !== 'string' ||
      !/^[a-zA-Z0-9_-]{16,128}$/.test(data.sessionKey) || typeof data.csrfToken !== 'string' ||
      !/^[a-f0-9]{64}$/.test(data.csrfToken))) throw new Error('idle_status');
    return data as IdleStatus;
  }

  /** Sperrt nur die Darstellung. Die Anlagenregelung bleibt vollständig unberührt. */
  function privacyLock(): void {
    document.documentElement.classList.add('nw-session-idle-locked');
    if (!document.getElementById('nwSessionIdleStyle')) {
      const style = document.createElement('style'); style.id = 'nwSessionIdleStyle';
      style.textContent = '.nw-session-idle-locked body>*:not(#nwSessionIdleGate){visibility:hidden!important;pointer-events:none!important}.nw-session-idle-locked body{overflow:hidden!important}#nwSessionIdleGate{position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;background:#03131c;color:#e4fff5;font:600 18px/1.6 system-ui;padding:24px}';
      document.head.appendChild(style);
    }
    if (document.body && !document.getElementById('nwSessionIdleGate')) {
      const gate = document.createElement('div'); gate.id = 'nwSessionIdleGate';
      gate.setAttribute('role', 'status'); gate.textContent = 'Sitzung wird geprüft …';
      document.body.appendChild(gate);
    }
  }
  function unlock(): void {
    document.documentElement.classList.remove('nw-session-idle-locked');
    document.getElementById('nwSessionIdleGate')?.remove();
  }
  function login(): void {
    if (stopped) return;
    stopped = true; privacyLock();
    clear(expiryTimer); clear(activityTimer); clear(retryTimer); clear(kioskTimer);
    try { channel?.close(); } catch { /* Privacy modes may close a transport first. */ }
    channel = null;
    observer?.disconnect(); observer = null;
    // Only this EOS origin is a navigation target; no server-supplied redirect URL.
    const target = '/login.html?reason=idle' + (credentialRequired ? '&admin=1&returnTo=' + encodeURIComponent(window.location.pathname) : '');
    try {
      if (window.top && window.top !== window && window.top.location.origin === window.location.origin) {
        window.top.location.replace(target); return;
      }
    } catch { /* A cross-origin parent cannot be navigated by this page. */ }
    window.location.replace(target);
  }

  function scheduleExpiry(): void {
    clear(expiryTimer);
    expiryTimer = setTimeout(() => {
      privacyLock();
      void synchronize('expire');
    }, Math.max(0, deadline - now()));
  }

  function accept(status: IdleStatus, started: number): void {
    clear(kioskTimer);
    kiosk = status.kiosk === true;
    if (kiosk) {
      clear(expiryTimer); clear(activityTimer); clear(retryTimer);
      pendingGesture = false; deadline = 0;
      sessionKey = status.sessionKey || ''; csrfToken = status.csrfToken;
      unlock();
      // Read-only verification detects disabling kiosk without inventing activity.
      kioskTimer = setTimeout(() => { void synchronize('status'); }, 30000);
      return;
    }
    if (!status.authenticated || status.idleExpiresAt === null || status.idleExpiresAt <= status.serverNow) { login(); return; }
    sessionKey = status.sessionKey || ''; csrfToken = status.csrfToken;
    // Count the whole request duration conservatively; wall-clock adjustments
    // cannot prolong a browser page beyond the server's authoritative deadline.
    deadline = started + status.idleExpiresAt - status.serverNow;
    if (deadline <= now()) { login(); return; }
    unlock(); scheduleExpiry();
  }

  /** GET/expire never renew; only a still-pending trusted gesture may call activity. */
  function synchronize(kind: 'status' | 'activity' | 'expire'): Promise<void> {
    if (stopped) return Promise.resolve();
    if (busy) return busy;
    if (kiosk) kind = 'status';
    if (kind === 'activity' && (!pendingGesture || now() - lastGesture > NETWORK_MS)) return Promise.resolve();
    if (kind === 'activity' && deadline && now() >= deadline) { privacyLock(); kind = 'expire'; }
    if (kind !== 'status' && !csrfToken) kind = 'status';
    const operation = kind;
    const started = now();
    if (operation === 'activity') { pendingGesture = false; lastSent = started; }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), NETWORK_MS);
    busy = (async () => {
      try {
        const response = await request('/api/auth/' + (operation === 'status' ? 'idle' : operation) + (credentialRequired ? '?admin=1' : ''), {
          method: operation === 'status' ? 'GET' : 'POST', credentials: 'same-origin', cache: 'no-store',
          redirect: 'error', signal: controller.signal,
          headers: operation === 'status' ? { Accept: 'application/json' } : {
            Accept: 'application/json', 'Content-Type': 'application/json', 'X-NW-CSRF': csrfToken,
          },
          ...(operation === 'status' ? {} : { body: '{}' }),
        });
        if (response.status === 401) { login(); return; }
        if (response.status === 403 && operation !== 'status') {
          // A concurrent token refresh changes CSRF. Fetch the new proof but
          // do not convert that status read into background user activity.
          csrfToken = ''; if (operation === 'activity') pendingGesture = true;
          clear(retryTimer); retryTimer = setTimeout(() => { void synchronize('status'); }, 0); return;
        }
        if (!response.ok) throw new Error('idle_response');
        const status = validate(await readJson(response));
        if (stopped) return;
        accept(status, started);
        if (operation === 'activity' && !stopped) channel?.postMessage({ type: 'activity', sessionKey });
      } catch {
        if (stopped) return;
        if (!deadline || now() >= deadline) { privacyLock(); login(); return; }
        // A short read-only retry cannot keep an unavailable session alive.
        clear(retryTimer); retryTimer = setTimeout(() => { void synchronize('status'); }, Math.min(5000, deadline - now()));
      } finally {
        clearTimeout(timer); busy = null;
        if (!stopped && pendingGesture && csrfToken && now() - lastGesture <= NETWORK_MS) scheduleActivity();
      }
    })();
    return busy;
  }

  function scheduleActivity(): void {
    if (kiosk) return;
    clear(activityTimer);
    const delay = Math.max(0, lastSent + SEND_INTERVAL_MS - now());
    // A token refresh near the old deadline must not push a genuine final
    // input past expiry merely to satisfy the browser's traffic throttle.
    activityTimer = setTimeout(() => { void synchronize('activity'); }, deadline - now() <= delay + 250 ? 0 : delay);
  }
  function interaction(event: Event): void {
    if (stopped || kiosk || !event.isTrusted || document.visibilityState === 'hidden') return;
    if (event.type === 'pointermove' && (!('buttons' in event) || typeof event.buttons !== 'number' || event.buttons <= 0)) return;
    if (deadline && now() >= deadline) { privacyLock(); void synchronize('expire'); return; }
    lastGesture = now(); pendingGesture = true;
    if (csrfToken) scheduleActivity(); else void synchronize('status');
  }

  // No mousemove/scroll/heartbeat: programmatic scroll and status traffic must
  // not count. Dragging a control is recognized while a real pointer is held.
  const observedDocuments = new WeakSet<Document>();
  function observeDocument(target: Document): void {
    if (observedDocuments.has(target)) return;
    observedDocuments.add(target);
    for (const type of ['pointerdown', 'keydown', 'touchstart', 'wheel', 'pointermove']) {
      target.addEventListener(type, interaction, { capture: true, passive: true });
    }
  }
  observeDocument(document);
  // Same-origin configuration frames are part of using the Admin. Cross-origin
  // documents are deliberately inaccessible and cannot claim trusted input.
  const observedFrames = new WeakSet<HTMLIFrameElement>();
  function scanFrames(): void {
    for (const frame of Array.from(document.querySelectorAll('iframe')).slice(0, 128)) {
      if (observedFrames.has(frame)) continue;
      observedFrames.add(frame);
      const bind = (): void => { try { if (frame.contentDocument) observeDocument(frame.contentDocument); } catch { /* Cross-origin frame. */ } };
      frame.addEventListener('load', bind); bind();
    }
  }
  scanFrames();
  observer = new MutationObserver(records => {
    // Ordinary value/text refreshes need no iframe inventory scan.
    if (records.some(record => Array.from(record.addedNodes).some(node =>
      node instanceof Element && (node.tagName === 'IFRAME' || node.querySelector('iframe'))))) scanFrames();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  const recheck = (): void => {
    if (stopped || document.visibilityState === 'hidden') return;
    if (!kiosk && (!deadline || now() >= deadline)) privacyLock();
    void synchronize('status');
  };
  document.addEventListener('visibilitychange', recheck);
  window.addEventListener('pageshow', recheck);
  window.addEventListener('focus', recheck);
  window.addEventListener('online', recheck);
  window.addEventListener('pagehide', () => { clear(activityTimer); clear(kioskTimer); pendingGesture = false; });
  if (typeof BroadcastChannel === 'function') {
    try {
      channel = new BroadcastChannel('nexowatt-eos-idle-v1');
      channel.onmessage = (event: MessageEvent<unknown>): void => {
        const data = event.data as { type?: unknown; sessionKey?: unknown } | null;
        if (!stopped && data?.type === 'activity' && data.sessionKey === sessionKey && sessionKey) void synchronize('status');
      };
    } catch { channel = null; /* The server deadline still coordinates sibling tabs. */ }
  }
  void synchronize('status');
})();
