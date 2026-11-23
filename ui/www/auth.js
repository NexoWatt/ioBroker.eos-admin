/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
/**
 * AUTO-GENERATED RUNTIME FILE - NICHT MANUELL BEARBEITEN.
 *
 * Quelle: src-ts/runtime-executables/www/auth.ts
 * Quell-Hash: sha256:3d3c196cb55ebe6a52535cb2c16909a0b58058fa46826605716710551963df0b
 * Erzeugung: npm run sync:ts-runtime-executables
 *
 * Zweck:
 * Diese JavaScript-Datei ist das ausführbare Build-Artefakt für www/auth.js.
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
 * Aufgabe: Sperrt jede Runtime-Oberfläche bis zur serverseitig bestätigten
 * Sitzung; übernimmt das explizite ioBroker-/EOS-Anmeldeprofil unverändert.
 * Daten und Wirkung: Liest nur den Status der eigenen Instanz, setzt CSRF-Header
 * für eigene mutierende API-Aufrufe und führt zur separaten Anmeldeseite.
 * Passwörter werden hier weder abgefragt noch gespeichert. Rollen/Capabilities
 * dienen der Anzeige; der Server autorisiert jeden Daten- und Schreibzugriff.
 * Bei Änderungen: Statusfehler, Offline-/BFCache-Rückkehr, Instanzproxy,
 * fehlende CSRF-Token, Rollenentzug und fachliche HTTP-403-Antworten mitprüfen.
 * Verknüpfungen: docs/operations/ANMELDEPROFILE_1_0_37_DE.md
 */
(function () {
    'use strict';
    const hostWindow = window;
    const originalFetch = typeof window.fetch === 'function' ? window.fetch.bind(window) : null;
    const state = {
        enabled: true, protectWrites: true, authed: false, authenticated: false,
        mode: null, user: null, role: 'none', capabilities: [], isAdmin: false,
        isInstaller: false, isCustomer: false, loginUrl: '', logoutUrl: '',
        _loaded: false, statusError: false,
    };
    let csrfToken = '';
    let statusPromise = null;
    let generation = 0;
    let lastCheck = 0;
    let redirecting = false;
    let loggingOut = false;
    const background = new Map();
    const snapshot = () => ({ ...state, capabilities: state.capabilities.slice() });
    const runtimeUrl = (path) => window.NW_RUNTIME?.url(path) ?? path;
    const runtimeRoot = () => new URL(runtimeUrl('/'), window.location.href).pathname.replace(/\/?$/, '/');
    const currentPath = () => window.NW_RUNTIME?.pathname() ?? window.location.pathname;
    /** Gleiche Rolle wie der Server; eine Capability hebt keine Fachrollengrenze auf. */
    function hasCapability(capability) {
        if (!state.authed || state.statusError)
            return false;
        if (['license.manage', 'notifications.manage'].includes(capability) && state.role !== 'admin')
            return false;
        if (['appcenter.open', 'simulation.open', 'mapping.edit', 'chargepoints.configure',
            'mesh.configure', 'exportGuard.configure', 'smarthome.configure', 'nexologic.configure',
            'diagnostics.open'].includes(capability) && !['admin', 'installer'].includes(state.role))
            return false;
        return state.capabilities.includes('*') || state.capabilities.includes(capability);
    }
    function requiredPageCapability() {
        const declared = document.body?.getAttribute('data-nw-required-capability');
        if (declared)
            return declared;
        const path = currentPath().replace(/\/+$/, '');
        const pages = new Map([
            ['/ems-apps.html', 'appcenter.open'], ['/simulation.html', 'simulation.open'],
            ['/license.html', 'license.manage'], ['/smarthome-config.html', 'smarthome.configure'],
            ['/logic.html', 'nexologic.configure'], ['/mail-setup', 'notifications.manage'],
            ['/mesh-setup', 'mesh.configure'],
        ]);
        return pages.get(path) || '';
    }
    function ensureStyles() {
        if (document.getElementById('nw-auth-styles'))
            return;
        const style = document.createElement('style');
        style.id = 'nw-auth-styles';
        style.textContent = `
      html.nw-auth-capability-pending body>*:not(#nwAuthGate){visibility:hidden!important;pointer-events:none!important}
      html.nw-auth-capability-pending body{overflow:hidden!important}
      #nwAuthGate{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;padding:24px;background:#020814;color:#edf6ff;font:16px/1.6 system-ui,sans-serif;visibility:visible!important}
      #nwAuthGate[hidden]{display:none!important}
      #nwAuthGate section{max-width:480px;padding:32px;border:1px solid #173a53;border-radius:20px;background:#07192b;box-shadow:0 16px 48px #0005}
      #nwAuthGate h2{margin:0 0 12px;font-size:24px;letter-spacing:-.03em}
      #nwAuthGate p{color:#8ea2b7;margin:0 0 24px}
      #nwAuthGate .nw-auth-actions{display:flex;gap:12px;flex-wrap:wrap}
      #nwAuthGate button,#nwAuthGate a{border:1px solid #00e676;border-radius:10px;padding:10px 16px;background:#00e676;color:#03130e;font:600 14px/1.5 system-ui,sans-serif;cursor:pointer;text-decoration:none}
      #nwAuthGate button:focus-visible,#nwAuthGate a:focus-visible{outline:3px solid #22b8ff;outline-offset:4px}
      .nw-auth-header{display:flex;align-items:center;gap:8px;margin-left:auto}
      .nw-auth-user{max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px}
    `;
        (document.head || document.documentElement).appendChild(style);
    }
    /** Verbirgt bereits gerenderte Daten bei Offline-Rückkehr oder verlorener Sitzung. */
    function lockPage(message = 'Anmeldung wird geprüft …') {
        ensureStyles();
        document.documentElement.classList.add('nw-auth-capability-pending');
        document.documentElement.classList.remove('nw-auth-capability-granted');
        if (!document.body)
            return;
        for (const node of Array.from(document.body.children)) {
            if (!(node instanceof HTMLElement) || node.id === 'nwAuthGate' || ['SCRIPT', 'STYLE'].includes(node.tagName))
                continue;
            if (!background.has(node))
                background.set(node, { inert: node.inert, ariaHidden: node.getAttribute('aria-hidden') });
            node.inert = true;
            node.setAttribute('aria-hidden', 'true');
        }
        let gate = document.getElementById('nwAuthGate');
        if (!gate) {
            gate = document.createElement('div');
            gate.id = 'nwAuthGate';
            gate.innerHTML = '<section role="status" aria-live="polite"><h2>Zugriff geschützt</h2><p></p><div class="nw-auth-actions"></div></section>';
            document.body.appendChild(gate);
        }
        gate.hidden = false;
        const description = gate.querySelector('p');
        if (description)
            description.textContent = message;
        const actions = gate.querySelector('.nw-auth-actions');
        if (!actions)
            return;
        actions.replaceChildren();
        const retry = document.createElement('button');
        retry.type = 'button';
        retry.textContent = 'Erneut prüfen';
        retry.addEventListener('click', () => { loggingOut = false; void refreshStatus(); });
        actions.appendChild(retry);
        if (state._loaded && !state.statusError && state.authed) {
            const home = document.createElement('a');
            home.href = runtimeUrl('/');
            home.textContent = 'Zur Bedienoberfläche';
            actions.appendChild(home);
            const signOut = document.createElement('button');
            signOut.type = 'button';
            signOut.textContent = 'Abmelden';
            signOut.addEventListener('click', () => { void logout(); });
            actions.appendChild(signOut);
        }
    }
    function unlockPage() {
        document.documentElement.classList.remove('nw-auth-capability-pending');
        document.documentElement.classList.add('nw-auth-capability-granted');
        for (const [node, previous] of background) {
            node.inert = previous.inert;
            if (previous.ariaHidden === null)
                node.removeAttribute('aria-hidden');
            else
                node.setAttribute('aria-hidden', previous.ariaHidden);
        }
        background.clear();
        const gate = document.getElementById('nwAuthGate');
        if (gate)
            gate.hidden = true;
    }
    function resetStatus(error) {
        Object.assign(state, { authed: false, authenticated: false, role: 'none', user: null,
            capabilities: [], isAdmin: false, isInstaller: false, isCustomer: false, _loaded: true, statusError: error });
        csrfToken = '';
        updateNavigation();
    }
    /** Maximal 64 KiB Auth-JSON; dieselbe Deadline umfasst Antwortkörper und Netzwerk. */
    async function readStatus(response, controller) {
        if (!response.ok || !/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type') || ''))
            throw new Error('auth_status_invalid');
        const reader = response.body?.getReader();
        if (!reader)
            throw new Error('auth_status_body_missing');
        const chunks = [];
        let length = 0;
        try {
            while (true) {
                const part = await reader.read();
                if (part.done)
                    break;
                length += part.value.byteLength;
                if (length > 65536) {
                    controller.abort();
                    throw new Error('auth_status_too_large');
                }
                chunks.push(part.value);
            }
            const bytes = new Uint8Array(length);
            let offset = 0;
            for (const part of chunks) {
                bytes.set(part, offset);
                offset += part.byteLength;
            }
            return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
        }
        finally {
            reader.releaseLock();
        }
    }
    /** Kein Profil-Fallback: unvollständige/alte Statusantworten bleiben gesperrt. */
    function applyStatus(value) {
        if (!value || typeof value !== 'object' || Array.isArray(value))
            throw new Error('auth_status_invalid');
        const data = value;
        if (!['iobroker', 'eos'].includes(String(data.mode)) || data.configured !== true || data.enabled !== true || data.protectWrites !== true
            || typeof data.authed !== 'boolean' || (data.authenticated !== undefined && data.authenticated !== data.authed)
            || !['none', 'customer', 'installer', 'admin'].includes(String(data.role))
            || !Array.isArray(data.capabilities) || data.capabilities.length > 128
            || !data.capabilities.every(cap => typeof cap === 'string' && cap.length <= 128)
            || (data.user !== null && data.user !== undefined && (typeof data.user !== 'string' || data.user.length > 512)))
            throw new Error('auth_status_invalid');
        const token = typeof data.csrfToken === 'string' ? data.csrfToken : '';
        if (data.authed && (data.role === 'none' || typeof data.user !== 'string' || !data.user
            || !/^[A-Za-z0-9+/_=-]{16,1024}$/.test(token)))
            throw new Error('auth_session_invalid');
        state.mode = data.mode;
        state.authed = data.authed;
        state.authenticated = data.authed;
        state.role = data.authed ? data.role : 'none';
        state.user = data.authed ? data.user : null;
        state.capabilities = data.authed ? data.capabilities.slice() : [];
        state.isAdmin = state.role === 'admin';
        state.isInstaller = state.role === 'installer';
        state.isCustomer = state.role === 'customer';
        state.loginUrl = typeof data.loginUrl === 'string' && data.loginUrl.length <= 4096 ? data.loginUrl : '';
        state.logoutUrl = typeof data.logoutUrl === 'string' && data.logoutUrl.length <= 4096 ? data.logoutUrl : '';
        state._loaded = true;
        state.statusError = false;
        csrfToken = data.authed ? token : '';
    }
    function updateNavigation() {
        for (const node of Array.from(document.querySelectorAll('[data-nw-config-link]'))) {
            const allowed = ['admin', 'installer'].includes(state.role) && hasCapability(node.getAttribute('data-nw-config-link') || '');
            node.hidden = !allowed;
            if (allowed)
                node.style.removeProperty('display');
            else
                node.style.display = 'none';
        }
        for (const node of Array.from(document.querySelectorAll('[data-nw-admin-link]'))) {
            const allowed = state.authed && !state.statusError && !loggingOut && state.role === 'admin';
            node.hidden = !allowed;
            if (allowed)
                node.style.removeProperty('display');
            else
                node.style.display = 'none';
        }
        const header = document.querySelector('header.topbar');
        if (!header)
            return;
        let box = document.getElementById('nwAuthHeader');
        if (!box) {
            box = document.createElement('div');
            box.id = 'nwAuthHeader';
            box.className = 'nw-auth-header';
            header.appendChild(box);
        }
        box.replaceChildren();
        const user = document.createElement('span');
        user.className = 'nw-auth-user';
        user.textContent = state.authed ? state.user : 'Anmeldung erforderlich';
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'btn small nw-auth-btn';
        button.textContent = state.authed ? 'Abmelden' : 'Anmelden';
        button.addEventListener('click', () => { if (state.authed)
            void logout();
        else
            showLogin(); });
        box.append(user, button);
    }
    /** Ein Frame fragt keine Kennwörter ab; die Anmeldung wird separat geöffnet. */
    function showLogin(message = 'Bitte anmelden, um die Oberfläche zu öffnen.', _options) {
        lockPage(message);
        if (state.statusError || !state._loaded || !state.mode || redirecting)
            return;
        const target = new URL(runtimeRoot() + 'login.html', window.location.origin);
        target.searchParams.set('returnTo', window.location.pathname + window.location.search + window.location.hash);
        if (window.self !== window.top) {
            const link = document.createElement('a');
            link.href = target.href;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.textContent = 'Anmeldung öffnen';
            document.querySelector('#nwAuthGate .nw-auth-actions')?.appendChild(link);
            return;
        }
        redirecting = true;
        window.location.replace(target.href);
    }
    function applyPageAccess() {
        updateNavigation();
        if (loggingOut)
            return;
        if (document.hidden) {
            lockPage();
            return;
        }
        if (state.statusError) {
            lockPage('Die Anmeldung kann gerade nicht geprüft werden. Bitte Verbindung prüfen.');
            return;
        }
        if (!state.authed) {
            showLogin();
            return;
        }
        const capability = requiredPageCapability();
        if (capability && !hasCapability(capability)) {
            lockPage('Das angemeldete Konto hat keine Berechtigung für diese Einrichtung.');
            return;
        }
        unlockPage();
    }
    /** Gleichzeitige Aufrufer teilen eine Abfrage; Antworten vor Abmeldung werden verworfen. */
    function refreshStatus() {
        if (statusPromise)
            return statusPromise;
        const ticket = generation;
        const request = (async () => {
            const controller = new AbortController();
            const timer = window.setTimeout(() => controller.abort(), 6000);
            try {
                if (!originalFetch || !['http:', 'https:'].includes(window.location.protocol) || navigator.onLine === false)
                    throw new Error('auth_offline');
                const response = await originalFetch('/api/auth/status', { credentials: 'same-origin', cache: 'no-store', redirect: 'error', signal: controller.signal });
                const payload = await readStatus(response, controller);
                if (ticket !== generation)
                    return snapshot();
                applyStatus(payload);
                lastCheck = Date.now();
                applyPageAccess();
            }
            catch {
                if (ticket === generation) {
                    resetStatus(true);
                    lockPage('Die Anmeldung kann gerade nicht geprüft werden. Bitte Verbindung prüfen.');
                }
            }
            finally {
                window.clearTimeout(timer);
            }
            return snapshot();
        })();
        statusPromise = request;
        void request.finally(() => { if (statusPromise === request)
            statusPromise = null; });
        return request;
    }
    /** Relative URLs oder HTTPS-Ziele; keine Schemas, URL-Zugangsdaten oder Steuerzeichen. */
    function centralUrl(value) {
        if (!value || value.length > 4096 || /[\\\u0000-\u0020\u007f]/.test(value) || value.startsWith('//'))
            return null;
        try {
            const target = new URL(value, window.location.origin);
            if (target.username || target.password || (target.origin !== window.location.origin && target.protocol !== 'https:'))
                return null;
            if (target.origin === window.location.origin && !['http:', 'https:'].includes(target.protocol))
                return null;
            return target.href;
        }
        catch {
            return null;
        }
    }
    /** CSRF-geschützte Abmeldung; ein Netzwerkfehler meldet keinen Erfolg. */
    async function logout() {
        if (loggingOut)
            return;
        if (!state._loaded || !csrfToken)
            await refreshStatus();
        const mode = state.mode;
        const destination = centralUrl(state.logoutUrl);
        const token = csrfToken;
        generation += 1;
        statusPromise = null;
        loggingOut = true;
        lockPage('Abmeldung wird durchgeführt …');
        const controller = new AbortController();
        const timer = window.setTimeout(() => controller.abort(), 6000);
        try {
            if (!originalFetch || !state.authed || !token)
                throw new Error('logout_session_missing');
            const response = await originalFetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin', cache: 'no-store', redirect: 'error',
                headers: { 'Content-Type': 'application/json', 'X-NW-CSRF': token }, body: '{}', signal: controller.signal });
            if (!response.ok)
                throw new Error('logout_unconfirmed');
            resetStatus(false);
            navigator.serviceWorker?.controller?.postMessage({ type: 'NW_AUTH_LOGOUT' });
            window.dispatchEvent(new CustomEvent('nw-auth-logout', { detail: snapshot() }));
            if (mode === 'eos') {
                if (!destination)
                    throw new Error('central_logout_missing');
                if (window.self === window.top) {
                    window.location.replace(destination);
                    return;
                }
                lockPage('Bitte die zentrale Abmeldung in einem eigenen Fenster abschließen.');
                const link = document.createElement('a');
                link.href = destination;
                link.target = '_blank';
                link.rel = 'noopener noreferrer';
                link.textContent = 'Zentral abmelden';
                document.querySelector('#nwAuthGate .nw-auth-actions')?.appendChild(link);
            }
            else {
                loggingOut = false;
                showLogin('Du bist abgemeldet.');
            }
        }
        catch {
            lockPage('Die Abmeldung ist nicht bestätigt. Die Ansicht bleibt gesperrt. Bitte erneut prüfen oder zentral abmelden.');
        }
        finally {
            window.clearTimeout(timer);
        }
    }
    function ownDataPath(input) {
        try {
            const text = input instanceof Request ? input.url : input instanceof URL ? input.href : input;
            const target = new URL(text, window.location.href);
            if (target.origin !== window.location.origin)
                return null;
            let path = target.pathname;
            const prefix = runtimeRoot().replace(/\/$/, '');
            if (prefix && path.startsWith(prefix + '/'))
                path = path.slice(prefix.length);
            return /^\/api(?:\/|$)/.test(path) || path === '/config' || path === '/events' ? path : null;
        }
        catch {
            return null;
        }
    }
    /** Schalt-/Speicherbefehle werden nach Anmeldung oder Fehlern niemals wiederholt. */
    if (originalFetch)
        window.fetch = async function (input, init) {
            const path = ownDataPath(input);
            if (!path || /^\/api\/(?:auth|strict-auth)\/(?:status|login)$/.test(path))
                return originalFetch(input, init);
            const method = String(init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
            const mutation = !['GET', 'HEAD', 'OPTIONS'].includes(method);
            if (!state._loaded || state.statusError || (mutation && Date.now() - lastCheck > 10000))
                await refreshStatus();
            if (!state.authed || state.statusError || loggingOut || (requiredPageCapability() && !hasCapability(requiredPageCapability()))) {
                return new Response(JSON.stringify({ error: state.statusError ? 'auth_unavailable' : 'authentication_required' }), { status: state.statusError ? 503 : 401, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
            }
            const options = { ...init, credentials: init?.credentials || (input instanceof Request ? input.credentials : 'same-origin') };
            if (mutation) {
                const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
                headers.set('X-NW-CSRF', csrfToken);
                options.headers = headers;
            }
            const response = await originalFetch(input, options);
            if (response.status === 401 || response.status === 403)
                await refreshStatus();
            return response;
        };
    async function requireCapability(capability, options = {}) {
        await refreshStatus();
        if (hasCapability(capability))
            return true;
        lockPage(state.statusError ? 'Die Berechtigungsprüfung ist nicht erreichbar.'
            : state.authed ? 'Keine Berechtigung für ' + (options.pageName || 'diesen Bereich') + '.' : 'Anmeldung erforderlich.');
        if (!state.authed && !state.statusError)
            showLogin();
        return false;
    }
    hostWindow.NW_AUTH = { getState: snapshot, refreshStatus, requireCapability, hasCapability, showLogin, logout };
    lockPage();
    const start = () => { lockPage(); void refreshStatus(); };
    const resume = () => {
        if (loggingOut)
            return;
        generation += 1;
        statusPromise = null;
        resetStatus(false);
        state._loaded = false;
        lockPage();
        void refreshStatus();
    };
    if (document.readyState === 'loading')
        document.addEventListener('DOMContentLoaded', start, { once: true });
    else
        start();
    window.addEventListener('offline', () => { generation += 1; statusPromise = null; resetStatus(true); lockPage('Du bist offline. Die Oberfläche bleibt bis zur nächsten bestätigten Anmeldung gesperrt.'); });
    window.addEventListener('online', () => { if (!loggingOut)
        void refreshStatus(); });
    window.addEventListener('pageshow', event => { if (event.persisted)
        resume(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) {
        if (!loggingOut)
            lockPage();
    }
    else
        resume(); });
    window.addEventListener('focus', () => { if (!loggingOut)
        void refreshStatus(); });
    window.setInterval(() => { if (!document.hidden && !loggingOut)
        void refreshStatus(); }, 30000);
})();
