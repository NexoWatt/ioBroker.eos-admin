// @runtime-transpile
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Zeigt verfügbare EOS-Versionen und führt angemeldete Kunden durch Vorbereitung und bestätigten Update-Start.
 * Daten und Wirkung: Liest ausschließlich die begrenzte EOS-Update-API; ein Start benötigt eine aktuelle Sitzung, CSRF und den serverseitig geprüften Plan.
 * Bei Änderungen: Verbindungsabbruch, abgelaufene Sitzung, verworfene Pläne und bestätigte Zielversion getrennt testen; niemals Browserwerte als Installationsfreigabe behandeln.
 */
(() => {
    'use strict';
    type RecordValue = Record<string, unknown>;
    type UpdateView = {
        installedVersion: string; availableVersion: string | null; checkedAt: number | null;
        state: string; canStart: boolean; reason: string | null; planId: string | null;
    };
    const endpoint = '/api/eos-update/';
    const versionPattern = /^\d{1,6}\.\d{1,6}\.\d{1,6}(?:-[a-zA-Z0-9.-]{1,60})?$/;
    const states = new Set(['current', 'available', 'checking', 'preparing', 'offline', 'incompatible', 'prepared', 'installing', 'installed', 'failed', 'interrupted']);
    const record = (value: unknown): value is RecordValue => value !== null && typeof value === 'object' && !Array.isArray(value);
    const safeVersion = (value: unknown): value is string => typeof value === 'string' && versionPattern.test(value);
    function decode(value: unknown): UpdateView {
        if (!record(value) || !safeVersion(value.installedVersion) || typeof value.state !== 'string' || !states.has(value.state)
            || value.source !== 'npm-latest' || typeof value.canStart !== 'boolean') throw new Error('UPDATE_RESPONSE');
        return {
            installedVersion: value.installedVersion,
            availableVersion: safeVersion(value.availableVersion) ? value.availableVersion : null,
            checkedAt: typeof value.checkedAt === 'number' && Number.isSafeInteger(value.checkedAt) && value.checkedAt > 0 && value.checkedAt < 8640000000000000 ? value.checkedAt : null,
            state: value.state, canStart: value.canStart,
            reason: typeof value.reason === 'string' && /^[A-Z0-9_]{1,100}$/.test(value.reason) ? value.reason : null,
            planId: typeof value.planId === 'string' && /^[a-zA-Z0-9_-]{16,128}$/.test(value.planId) ? value.planId : null,
        };
    }
    async function request(action: string, body?: RecordValue): Promise<UpdateView> {
        const signal = AbortSignal.timeout(body ? 20000 : 7000);
        const options: RequestInit = { cache: 'no-store', credentials: 'same-origin', signal };
        if (body) {
            const response = await fetch('/api/auth/status', { ...options });
            if (!response.ok) throw new Error('UPDATE_AUTH');
            const access: unknown = await response.json();
            if (!record(access) || access.authenticated !== true || access.mustChangePassword === true
                || typeof access.csrfToken !== 'string' || !/^[a-f0-9]{64}$/.test(access.csrfToken)) throw new Error('UPDATE_AUTH');
            options.method = 'POST';
            options.headers = { 'Content-Type': 'application/json', 'X-NW-CSRF': access.csrfToken };
            options.body = JSON.stringify(body);
        }
        const response = await fetch(endpoint + action, options);
        if (response.status === 401 || response.status === 403) throw new Error('UPDATE_AUTH');
        if (response.status === 409) throw new Error('UPDATE_CONFLICT');
        if (!response.ok) throw new Error('UPDATE_UNAVAILABLE');
        return decode(await response.json() as unknown);
    }
    function start(): void {
        const panel = document.getElementById('eosUpdatesPanel');
        const status = document.getElementById('eosUpdateStatus');
        const installed = document.getElementById('eosUpdateInstalled');
        const available = document.getElementById('eosUpdateAvailable');
        const checked = document.getElementById('eosUpdateChecked');
        const check = document.getElementById('eosUpdateCheck');
        const prepare = document.getElementById('eosUpdatePrepare');
        const confirm = document.getElementById('eosUpdateConfirm');
        const confirmVersion = document.getElementById('eosUpdateConfirmVersion');
        const confirmStart = document.getElementById('eosUpdateStart');
        const cancel = document.getElementById('eosUpdateCancel');
        const gear = document.querySelector<HTMLAnchorElement>('a.topbar-gear');
        let badge: HTMLSpanElement | null = null;
        let view: UpdateView | null = null;
        let busy = false;
        let pendingStart = false;
        let stopped = false;
        let poll: ReturnType<typeof setTimeout> | null = null;
        const labels: Record<string, string> = {
            current: 'EOS ist auf dem Stand der veröffentlichten stabilen Version.',
            available: 'Eine neue EOS-Version ist verfügbar.',
            checking: 'Verfügbare Version wird geprüft …',
            preparing: 'Update wird heruntergeladen und geprüft …',
            offline: 'Die Updatequelle ist momentan nicht erreichbar. EOS läuft weiter.',
            incompatible: 'Diese Version benötigt eine gesonderte Prüfung durch den Installateur.',
            prepared: 'Update geprüft und vorbereitet. Zum Installieren bitte den Start bestätigen.',
            installing: 'Update läuft. Die Verbindung kann während des EOS-Neustarts unterbrochen werden.',
            installed: 'Die Installation der neuen EOS-Version wurde bestätigt.',
            failed: 'Das Update konnte nicht erfolgreich abgeschlossen werden. Bitte die Diagnose prüfen.',
            interrupted: 'Der Updateabschluss ist nicht bestätigt. Es wird kein Auftrag automatisch wiederholt.',
        };
        function show(message: string, error = false): void {
            if (status) { status.textContent = message; status.dataset.error = String(error); }
        }
        function render(): void {
            if (!view) return;
            if (installed) installed.textContent = view.installedVersion;
            if (available) available.textContent = view.availableVersion || '—';
            if (checked) checked.textContent = view.checkedAt ? new Date(view.checkedAt).toLocaleString('de-DE') : 'Noch nicht geprüft';
            const running = ['checking', 'preparing', 'installing'].includes(view.state) || pendingStart;
            if (check instanceof HTMLButtonElement) check.disabled = busy || running;
            if (prepare instanceof HTMLButtonElement) {
                prepare.hidden = !['available', 'prepared'].includes(view.state);
                prepare.disabled = busy || running;
                prepare.textContent = view.state === 'prepared' ? 'Update starten …' : 'Update vorbereiten';
            }
            if (confirmStart instanceof HTMLButtonElement) confirmStart.disabled = busy || !view.canStart || !view.planId;
            show((labels[view.state] || 'Updatestatus wird geladen.') + (view.reason ? ` (${view.reason})` : ''), ['failed', 'interrupted'].includes(view.state));
            const notice = ['available', 'prepared', 'incompatible'].includes(view.state) && !!view.availableVersion;
            if (gear && notice) {
                if (!badge) { badge = document.createElement('span'); badge.className = 'nw-update-badge'; badge.textContent = '•'; badge.setAttribute('aria-hidden', 'true'); gear.appendChild(badge); }
                gear.title = `Einstellungen · EOS ${view.availableVersion} verfügbar`;
                gear.setAttribute('aria-label', gear.title);
            } else if (gear) {
                badge?.remove(); badge = null;
                gear.title = 'Einstellungen'; gear.setAttribute('aria-label', 'Einstellungen');
            }
            if (confirmVersion) confirmVersion.textContent = view.availableVersion || '—';
        }
        function schedule(): void {
            if (poll) clearTimeout(poll);
            if (stopped) return;
            const active = pendingStart || (view && ['preparing', 'installing', 'checking'].includes(view.state));
            poll = setTimeout(() => { void load(); }, active ? 3000 : panel ? 60000 : 15 * 60000);
        }
        function errorMessage(error: unknown): void {
            if (error instanceof Error && error.message === 'UPDATE_AUTH') {
                pendingStart = false;
                show('Bitte erneut bei EOS anmelden. Es wurde kein neuer Updateauftrag erteilt.', true);
            } else if (error instanceof Error && error.message === 'UPDATE_CONFLICT') {
                show('Der Updateplan ist nicht mehr gültig oder ein Update läuft bereits. Status neu prüfen.', true);
            } else {
                show(pendingStart ? 'EOS wird aktualisiert. Die Rückmeldung steht noch aus; bitte nicht erneut starten.' : 'Updatestatus momentan nicht erreichbar. Bitte später erneut prüfen.', true);
            }
        }
        async function load(): Promise<void> {
            if (busy || stopped || document.hidden) { schedule(); return; }
            try {
                view = await request('status');
                if (['installed', 'failed', 'interrupted'].includes(view.state)) pendingStart = false;
                render();
            } catch (error) { errorMessage(error); }
            finally { schedule(); }
        }
        async function action(kind: 'check' | 'prepare' | 'start'): Promise<void> {
            if (busy || stopped) return;
            const target = view?.availableVersion;
            const plan = view?.planId;
            if (kind === 'prepare' && !target || kind === 'start' && (!plan || view?.canStart !== true)) return;
            busy = true; render();
            try {
                if (kind === 'start') {
                    pendingStart = true;
                    if (confirm instanceof HTMLDialogElement) confirm.close();
                    show('Updateauftrag wird übermittelt …');
                }
                view = await request(kind, kind === 'prepare' ? { version: target } : kind === 'start' ? { planId: plan, confirm: true } : {});
                if (kind === 'prepare' && view.canStart && confirm instanceof HTMLDialogElement) confirm.showModal();
                if (['installed', 'failed', 'interrupted'].includes(view.state)) pendingStart = false;
            } catch (error) {
                // A lost start response is indeterminate: status polling must decide.
                errorMessage(error);
                return;
            } finally { busy = false; schedule(); }
            render();
        }
        check?.addEventListener('click', () => { void action('check'); });
        prepare?.addEventListener('click', () => {
            if (view?.state === 'prepared' && confirm instanceof HTMLDialogElement) confirm.showModal();
            else void action('prepare');
        });
        confirmStart?.addEventListener('click', () => { void action('start'); });
        cancel?.addEventListener('click', () => { if (confirm instanceof HTMLDialogElement) confirm.close(); });
        window.addEventListener('pagehide', () => { stopped = true; if (poll) clearTimeout(poll); });
        document.addEventListener('visibilitychange', () => { if (!document.hidden) void load(); });
        void load();
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
    else start();
})();
