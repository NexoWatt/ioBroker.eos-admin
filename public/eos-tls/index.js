/* Copyright (c) 2026 NexoWatt. Confidential and proprietary. */
'use strict';
(() => {
    const byId = id => document.getElementById(id);
    let state = null;
    let csrf = '';
    let busy = false;
    const errors = {
        AUTHENTICATION_REQUIRED: 'Bitte erneut bei EOS anmelden. Die Eingaben bleiben in diesem Fenster erhalten.',
        ADMIN_REQUIRED: 'Für die Zertifikatsverwaltung ist ein Administratorkonto erforderlich.',
        AUTH_CSRF: 'Die Sicherheitsfreigabe ist abgelaufen. Status aktualisieren und erneut versuchen.',
        EOS_TLS_PENDING_REQUEST_EXISTS: 'Eine Anfrage liegt bereits vor. Zum Ersetzen das Kontrollfeld ausdrücklich aktivieren.',
        EOS_TLS_REQUEST_MISMATCH: 'Diese Antwort gehört nicht zur aktuellen Anfrage. Status aktualisieren und die aktuelle Anfrage signieren lassen.',
        EOS_TLS_ROOT_FINGERPRINT_MISMATCH: 'Der bestätigte Fingerabdruck passt nicht zum Stammzertifikat.',
        EOS_TLS_SAN_MISMATCH: 'Das Zertifikat enthält nicht alle angeforderten Namen und IP-Adressen.',
        EOS_TLS_KEY_OR_CA_MISMATCH: 'Zertifikat, Geräteschlüssel und Stamm-CA passen nicht zusammen.',
        EOS_TLS_SERVER_USAGE_REQUIRED: 'Das Zertifikat ist nicht ausdrücklich für HTTPS-Server ausgestellt.',
        EOS_TLS_LIFETIME_INVALID: 'Das Gerätezertifikat muss noch mindestens einen Tag gültig sein und darf höchstens 397 Tage Laufzeit haben.',
        EOS_TLS_OPENSSL_FAILED: 'Die Zertifikatsprüfung ist fehlgeschlagen. Signatur, Kette, Gültigkeit und OpenSSL-Verfügbarkeit prüfen.',
        EOS_TLS_STORAGE_UNAVAILABLE: 'Der geschützte Zertifikatsspeicher ist nicht verfügbar. Bestehenden HTTPS-Zugang beibehalten und das Systemprotokoll prüfen.',
        EOS_TLS_BUSY: 'Eine Zertifikatsaktion läuft bereits. Kurz warten und den Status aktualisieren.',
        EOS_TLS_STORAGE_SYNC_WARNING: 'Der neue Stand wurde übernommen, aber das Dateisystem konnte die dauerhafte Verzeichnissicherung nicht bestätigen. Datenträger und Systemprotokoll prüfen.',
        EOS_TLS_PENDING_CLEANUP_WARNING: 'Das Zertifikat wurde übernommen; eine verbrauchte Anfragedatei konnte noch nicht bereinigt werden. Sie ist gesperrt und kann nicht erneut aktiviert werden.',
    };
    function message(value, error = false) { byId('message').textContent = value; byId('message').className = error ? 'eos-message is-error' : 'eos-message'; }
    async function api(path, data) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 15000);
        try {
            const response = await fetch(path, { method: data ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store', signal: controller.signal,
                headers: data ? { 'Content-Type': 'application/json', 'x-nw-csrf': csrf } : {}, body: data ? JSON.stringify(data) : undefined });
            const result = await response.json();
            if (!response.ok) throw new Error(errors[result.error] || `Die Aktion konnte nicht abgeschlossen werden (${result.error || response.status}).`);
            return result;
        } finally { clearTimeout(timer); }
    }
    function render(value) {
        state = value;
        if (value.csrfToken) csrf = value.csrfToken;
        const status = byId('status'); status.replaceChildren();
        const rows = [
            ['Betrieb', value.restartRequired ? 'Zertifikat geprüft und gespeichert; Aktivierung beim nächsten regulären Adapterneustart.' : value.mode === 'nexowatt-managed' ? 'NexoWatt-Zertifikat aktiv' : 'Bestehendes ioBroker-Zertifikat aktiv'],
            ['Aussteller', value.issuer || 'Noch kein NexoWatt-Zertifikat übernommen'],
            ['Zertifikatskette gültig bis', value.effectiveValidTo || value.validTo || '—'], ['Zertifikatsstatus', value.valid === false ? 'Abgelaufen oder noch nicht gültig; Erneuerung erforderlich.' : value.expiresSoon ? 'Erneuerung innerhalb von 30 Tagen erforderlich.' : value.valid ? 'Zeitlich gültig' : '—'],
            ['Namen / IP-Adressen', (value.names || []).join(', ') || '—'],
            ['Stamm-CA SHA-256', value.rootFingerprint || '—'], ['Gerätezertifikat SHA-256', value.fingerprint || '—'],
            ['Offene Anfrage', value.pending ? value.pending.createdAt : 'Keine'],
        ];
        for (const [name, content] of rows) { const term = document.createElement('dt'); term.textContent = name; const detail = document.createElement('dd'); detail.textContent = content; status.append(term, detail); }
        byId('rootDownload').hidden = !value.rootFingerprint;
        byId('requestDownload').hidden = !value.pending;
        if (!byId('names').value) byId('names').value = (value.pending?.names || value.suggestedNames || []).join('\n');
        if (value.error) message(errors[value.error] || value.error, true);
        if (value.warnings?.length) message(value.warnings.map(code => errors[code] || code).join(' '), true);
    }
    async function run(task) {
        if (busy) return;
        busy = true;
        document.querySelectorAll('button').forEach(button => { button.disabled = true; });
        try { await task(); } catch (error) { message(error.name === 'AbortError' ? 'Zeitüberschreitung. Status aktualisieren, bevor die Aktion erneut ausgeführt wird.' : error.message, true); }
        finally { busy = false; document.querySelectorAll('button').forEach(button => { button.disabled = false; }); }
    }
    byId('reload').addEventListener('click', () => { void run(async () => { const value = await api('/api/eos/tls'); render(value); if (!value.error && !value.warnings?.length) message('Status aktualisiert.'); }); });
    byId('requestForm').addEventListener('submit', event => { event.preventDefault(); void run(async () => {
        if (!csrf) render(await api('/api/eos/tls'));
        const value = await api('/api/eos/tls/request', { names: byId('names').value.split(/[\n,]+/).map(value => value.trim()).filter(Boolean), replace: byId('replace').checked }); render(value);
        byId('replace').checked = false; if (!value.error && !value.warnings?.length) message('Anfrage erstellt. Lade sie herunter und lasse sie von NexoWatt signieren.');
    }); });
    byId('importForm').addEventListener('submit', event => { event.preventDefault(); void run(async () => {
        if (!state?.pending) throw new Error('Bitte zuerst eine Zertifikatsanfrage erstellen.');
        const certificate = byId('certificate').files[0]; const root = byId('root').files[0];
        if (!certificate || !root || certificate.size > 48000 || root.size > 16000) throw new Error('Bitte gültige PEM-Dateien auswählen (Gerätekette bis 48 kB, Stammzertifikat bis 16 kB).');
        const value = await api('/api/eos/tls/certificate', { requestId: state.pending.requestId, certificate: await certificate.text(), rootCertificate: await root.text(), rootFingerprint: byId('fingerprint').value.trim() });
        render(value); byId('importForm').reset(); if (!value.warnings?.length) message(value.restartRequired ? 'Geprüft und gespeichert. Beim nächsten regulären Adapterneustart wird das NexoWatt-Zertifikat aktiv.' : 'Das erneuerte NexoWatt-Zertifikat ist jetzt aktiv.');
    }); });
    void run(async () => { render(await api('/api/eos/tls')); });
})();
