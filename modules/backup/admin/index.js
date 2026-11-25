/* NexoWatt EOS Backup – same-origin session and CSRF guarded module API. */
'use strict';
(() => {
    const api = '/api/eos/modules/backup';
    let config = {},
        configurationRevision = '',
        csrf = '',
        busy = false,
        poll = null,
        lastCoverage = null;
    const byId = id => document.getElementById(id);
    function message(text, error = false) {
        byId('message').textContent = text;
        byId('message').classList.toggle('error', error);
    }
    async function request(path, method = 'GET', body) {
        const r = await fetch(api + path, {
            method,
            credentials: 'same-origin',
            headers: { 'content-type': 'application/json', ...(method === 'GET' ? {} : { 'x-nw-csrf': csrf }) },
            ...(body ? { body: JSON.stringify(body) } : {}),
        });
        let v;
        try {
            v = await r.json();
        } catch {
            throw new Error('EOS antwortet derzeit nicht. Bitte Status erneut laden.');
        }
        if (!r.ok) {
            if (v.error === 'EOS_MODULE_CONFIG_CONFLICT') throw new Error('Die Sicherungseinstellungen wurden inzwischen geändert. Deine Eingaben bleiben erhalten. Seite neu laden und Änderungen mit dem gespeicherten Stand abgleichen.');
            if (r.status === 401)
                throw new Error(
                    'Sitzung abgelaufen. Bitte erneut bei EOS anmelden; ungespeicherte Eingaben bleiben hier erhalten.',
                );
            if (v.error === 'AUTH_CSRF')
                throw new Error('Sicherheitstoken erneuern: Status aktualisieren und erneut speichern.');
            throw new Error(v.error || 'Anfrage fehlgeschlagen.');
        }
        return v;
    }
    async function command(name, payload = {}) {
        return request('/command', 'POST', { command: name, payload });
    }
    function download(name, content) {
        const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    function advanced() {
        const root = byId('advanced');
        root.replaceChildren();
        for (const [key, value] of Object.entries(config)) {
            if (byId(key) || ['enabled'].includes(key)) continue;
            const label = document.createElement('label');
            label.textContent = key;
            let input;
            if (typeof value === 'boolean') {
                input = document.createElement('input');
                input.type = 'checkbox';
                input.checked = value;
            } else if (typeof value === 'number') {
                input = document.createElement('input');
                input.type = 'number';
                input.value = String(value);
            } else if (typeof value === 'string') {
                input = document.createElement('input');
                input.type = /password|token|secret|accessjson/i.test(key) ? 'password' : 'text';
                input.value = value;
            } else {
                input = document.createElement('textarea');
                input.value = JSON.stringify(value, null, 2);
                input.rows = 3;
                input.dataset.json = 'true';
            }
            input.dataset.config = key;
            label.append(input);
            root.append(label);
        }
    }
    function fill() {
        for (const [key, value] of Object.entries(config)) {
            const e = byId(key);
            if (!e || !['INPUT', 'SELECT'].includes(e.tagName)) continue;
            if (e.type === 'checkbox') e.checked = value === true;
            else e.value = value ?? '';
        }
        advanced();
    }
    function renderEntries(remote) {
        const root = byId('remoteEntries');
        root.replaceChildren();
        for (const file of remote.entries || []) {
            const row = document.createElement('div');
            row.className = 'job';
            const label = document.createElement('span');
            label.textContent = file.name + ' · ' + (file.size / 1024 / 1024).toFixed(1) + ' MiB ';
            const button = document.createElement('button');
            button.textContent = remote.provider === 'legacy' ? 'Verschlüsselt übernehmen' : 'Auf EOS laden';
            button.addEventListener('click', () =>
                task(async () => {
                    await command(remote.provider === 'legacy' ? 'legacyImport' : 'remoteFetch', {
                        provider: remote.provider,
                        name: file.name,
                        kind: remote.kind || 'iobroker',
                    });
                    message('Übernahme gestartet. Das Original bleibt erhalten.');
                    await load(false);
                }),
            );
            row.append(label, button);
            root.append(row);
        }
    }
    function render(view) {
        byId('status').textContent =
            (view.status?.active ? 'Bereit' : view.status?.reason || 'Nicht aktiv') +
            (view.status?.details?.current ? ' · Sicherung läuft' : '');
        const coverage = view.status?.details?.coverage || lastCoverage;
        if (coverage) lastCoverage = coverage;
        const coverageLabels = {
            iobroker: 'ioBroker', 'eos-profile': 'EOS einschließlich Geräteeinstellungen', influxDB: 'InfluxDB-Historie', 'postgresql-history': 'PostgreSQL-Historie',
            EOS_BACKUP_EOS_PROFILE_REQUIRED: 'EOS-Profil in der Sicherung aktivieren',
            EOS_BACKUP_ACTIVE_INFLUX_NOT_COVERED: 'Die aktive InfluxDB-Historie ist noch nicht als Sicherungsziel eingerichtet (Server, Organisation und Bucket prüfen)',
            EOS_BACKUP_HISTORY_SCOPE_UNRESOLVED: 'Aktive Historienquelle noch nicht eindeutig ermittelt oder nicht als Gesamtsicherung unterstützt',
        };
        const coverageText = coverage
            ? (coverage.complete ? 'Sicherungsumfang eingerichtet: ' : 'Gesamtsicherung unvollständig: ') +
              (coverage.complete ? coverage.required.map(item => coverageLabels[item] || item).join(' + ') : coverage.missing.map(item => coverageLabels[item] || item).join('; ')) +
              (coverage.externalTargetConfigured ? ' · Zusätzliches Sicherungsziel eingerichtet; tatsächliche Ablage nach dem Lauf prüfen.' : ' · Nur lokale Ablage: kein Schutz vor Verlust des Systemdatenträgers.')
            : 'Sicherungsumfang noch nicht ermittelt.';
        byId('coverage').textContent = coverageText;
        byId('coverage').classList.toggle('error', !coverage?.complete);
        const history = view.status?.details?.history || [];
        const latestRemote = history.find(job => job.remote && Array.isArray(job.remote.entries));
        if (latestRemote) {
            renderEntries(latestRemote.remote);
            if ((latestRemote.remote.entries || []).length === 50) {
                const all = document.createElement('button');
                all.textContent = 'Alle gefundenen Sicherungen anzeigen';
                all.addEventListener('click', () =>
                    task(async () => {
                        const { job } = await command('list', { jobId: latestRemote.id });
                        renderEntries(job.remote);
                    }),
                );
                byId('remoteEntries').append(all);
            }
        }
        clearTimeout(poll);
        if (view.status?.details?.current)
            poll = setTimeout(() => {
                void load(false).catch(e => message(e.message, true));
            }, 1500);
        const root = byId('jobs');
        root.replaceChildren();
        for (const job of view.status?.details?.history || []) {
            const div = document.createElement('article');
            div.className = 'job';
            const title = document.createElement('strong');
            title.textContent =
                new Date(job.startedAt).toLocaleString() + ' · ' + job.state + (job.error ? ' · ' + job.error : '');
            div.append(title, document.createElement('br'));
            for (const file of job.files || []) {
                const a = document.createElement('a');
                a.href = api + '/download/' + encodeURIComponent(file.name);
                a.textContent = file.kind + ' herunterladen (' + (file.size / 1024 / 1024).toFixed(1) + ' MiB)';
                div.append(a);
                const restore = document.createElement('button');
                restore.textContent = 'Wiederherstellung vorbereiten';
                restore.addEventListener('click', () =>
                    task(async () => {
                        const plan = await command('restorePlan', { name: file.name });
                        byId('restorePlan').textContent = plan.message + '\n\n' + plan.command.join(' ');
                    }),
                );
                div.append(restore);
            }
            if (job.moreFiles) {
                const all = document.createElement('button');
                all.textContent = 'Alle Dateien dieses Auftrags anzeigen';
                all.addEventListener('click', () =>
                    task(async () => {
                        const full = await command('list', { jobId: job.id });
                        render({ status: { active: true, details: { history: [full.job] } } });
                    }),
                );
                div.append(all);
            }
            root.append(div);
        }
    }
    async function load(replace = false) {
        const v = await request('');
        csrf = v.csrfToken || csrf;
        if (replace) {
            config = v.config || {};
            configurationRevision = typeof v.configurationRevision === 'string' ? v.configurationRevision : '';
            fill();
        }
        render(v);
    }
    async function task(fn) {
        if (busy) return;
        busy = true;
        try {
            await fn();
        } catch (e) {
            message(e.message || String(e), true);
        } finally {
            busy = false;
        }
    }
    async function save() {
        const next = structuredClone(config);
        for (const e of document.querySelectorAll('#settings input,#settings select,[data-config]')) {
            const key = e.dataset.config || e.id;
            next[key] =
                e.type === 'checkbox'
                    ? e.checked
                    : e.type === 'number'
                      ? Number(e.value)
                      : e.dataset.json
                        ? JSON.parse(e.value)
                        : e.value;
        }
        const v = await request('', 'PUT', { config: next, expectedConfigurationRevision: configurationRevision });
        config = v.config;
        message('Einstellungen gespeichert.');
        await load(true);
    }
    byId('settings').addEventListener('submit', e => {
        e.preventDefault();
        void task(save);
    });
    byId('saveAdvanced').addEventListener('click', () => task(save));
    byId('refresh').addEventListener('click', () =>
        task(async () => {
            await load(false);
            message('Status aktualisiert.');
        }),
    );
    byId('start').addEventListener('click', () =>
        task(async () => {
            await command('start');
            message('Sicherung gestartet. Der Fortschritt erscheint unter Status.');
            await load(false);
        }),
    );
    byId('startCcu').addEventListener('click', () =>
        task(async () => {
            await command('start', { kind: 'ccu' });
            message('CCU-Sicherung gestartet.');
            await load(false);
        }),
    );
    byId('cancel').addEventListener('click', () =>
        task(async () => {
            await command('cancel');
            message('Abbruch angefordert.');
        }),
    );
    byId('remoteList').addEventListener('click', () =>
        task(async () => {
            const provider = byId('remoteProvider').value;
            await command(provider === 'legacy' ? 'legacyList' : 'remoteList', {
                provider,
                kind: byId('remoteKind').value,
            });
            message('Sicherungen werden gesucht.');
            await load(false);
        }),
    );
    byId('scanSd').addEventListener('click', () =>
        task(async () => {
            const values = await command('getSdCardTargets');
            const list = byId('sdTargets');
            list.replaceChildren();
            for (const value of values) {
                const option = document.createElement('option');
                option.value = value.mountPoint;
                option.textContent = value.label;
                list.append(option);
            }
            message(
                values.length
                    ? 'Gefundene Einhängepunkte stehen im SD-Kartenfeld zur Auswahl.'
                    : 'Keine passende eingebundene SD-Karte gefunden.',
            );
        }),
    );
    byId('key').addEventListener('click', () =>
        task(async () => {
            const v = await command('exportRecoveryKey', { confirm: true });
            download(v.filename, v.content);
            message('Wiederherstellungsschlüssel heruntergeladen. Getrennt und geschützt aufbewahren.');
        }),
    );
    window.addEventListener('pagehide', () => clearTimeout(poll));
    void task(() => load(true));
})();
