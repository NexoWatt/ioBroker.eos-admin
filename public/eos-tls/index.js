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
        PASSWORD_CHANGE_REQUIRED: 'Ändere zuerst dein EOS-Passwort und öffne danach die Zertifikatsverwaltung erneut.',
        AUTH_CSRF: 'Die Sicherheitsfreigabe ist abgelaufen. Status aktualisieren und erneut versuchen.',
        EOS_TLS_INVALID_NAMES: 'Bitte gültige Gerätenamen und IP-Adressen eingeben.',
        EOS_TLS_LOCAL_NAME_NOT_ASSIGNED: 'Die lokale Ausstellung verwendet nur Namen und IP-Adressen dieses EOS. Nutze für weitere bestätigte Namen den optionalen Weg über NexoWatt.',
        EOS_TLS_PENDING_REQUEST_EXISTS: 'Ein Entwurf liegt bereits vor. Aktiviere zum Ersetzen das Kontrollfeld in Schritt 1.',
        EOS_TLS_REQUEST_MISMATCH: 'Der Vorgang gehört nicht zum aktuellen Entwurf. Bitte Status aktualisieren.',
        EOS_TLS_LOCAL_CERTIFICATE_NOT_FOUND: 'Der lokale Entwurf ist nicht mehr verfügbar. Bitte Status aktualisieren.',
        EOS_TLS_ROOT_FINGERPRINT_MISMATCH: 'Der bestätigte Fingerabdruck passt nicht zum Stammzertifikat.',
        EOS_TLS_SAN_MISMATCH: 'Das Zertifikat enthält nicht alle angeforderten Namen und IP-Adressen.',
        EOS_TLS_KEY_OR_CA_MISMATCH: 'Zertifikat, Geräteschlüssel und Stamm-CA passen nicht zusammen.',
        EOS_TLS_SERVER_USAGE_REQUIRED: 'Das Zertifikat ist nicht ausdrücklich für HTTPS-Server ausgestellt.',
        EOS_TLS_LIFETIME_INVALID: 'Das Gerätezertifikat muss noch mindestens einen Tag gültig sein und darf höchstens 397 Tage Laufzeit haben.',
        EOS_TLS_OPENSSL_FAILED: 'Die Zertifikatsaktion ist fehlgeschlagen. Prüfe das Systemprotokoll und die OpenSSL-Verfügbarkeit.',
        EOS_TLS_STORAGE_UNAVAILABLE: 'Der geschützte Zertifikatsspeicher ist nicht verfügbar. Bestehenden HTTPS-Zugang beibehalten und das Systemprotokoll prüfen.',
        EOS_TLS_BUSY: 'Eine Zertifikatsaktion läuft bereits. Kurz warten und den Status aktualisieren.',
        EOS_TLS_STORAGE_SYNC_WARNING: 'Der neue Stand wurde gespeichert, aber das Dateisystem konnte die dauerhafte Verzeichnissicherung nicht bestätigen. Datenträger und Systemprotokoll prüfen.',
        EOS_TLS_PENDING_CLEANUP_WARNING: 'Das Zertifikat wurde übernommen. Eine verbrauchte Anfragedatei konnte noch nicht bereinigt werden und bleibt gesperrt.',
    };

    function message(value, error = false) {
        byId('message').textContent = value;
        byId('message').className = error ? 'eos-message is-error' : 'eos-message';
    }

    function describeError(code, fallback = 'Die Zertifikatsaktion konnte nicht abgeschlossen werden.') {
        return Object.hasOwn(errors, code) ? errors[code] : fallback;
    }

    async function api(path, data) {
        if (data && (!csrf || state?.error)) throw new Error('Bitte zuerst den aktuellen Status laden.');
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 45000);
        try {
            const response = await fetch(path, {
                method: data ? 'POST' : 'GET',
                credentials: 'same-origin',
                cache: 'no-store',
                redirect: 'error',
                signal: controller.signal,
                headers: data ? { 'Content-Type': 'application/json', 'x-nw-csrf': csrf } : {},
                body: data ? JSON.stringify(data) : undefined,
            });
            const result = await response.json();
            if (!response.ok) throw new Error(describeError(result?.error));
            return result;
        } finally {
            clearTimeout(timer);
        }
    }

    function fingerprintHex(value) {
        if (typeof value !== 'string') return '';
        const hex = value.replaceAll(':', '').toUpperCase();
        return /^[A-F0-9]{64}$/.test(hex) ? hex : '';
    }

    function currentPending() {
        const pending = state?.pending;
        return typeof pending?.requestId === 'string' && /^[a-f0-9]{32}$/.test(pending.requestId) ? pending : null;
    }

    function localDraft() {
        const pending = currentPending();
        return pending?.local === true && fingerprintHex(pending.rootFingerprint) ? pending : null;
    }

    function setActions() {
        byId('reload').disabled = busy;
        byId('generateLocal').disabled = busy || !csrf || !!state?.error;
        byId('generateExternal').disabled = busy || !csrf || !!state?.error;
        const pending = currentPending();
        const local = localDraft();
        byId('copyFingerprint').disabled = busy || !local;
        byId('activateLocal').disabled = busy || !csrf || !local || !!state?.error;
        byId('importCertificate').disabled = busy || !csrf || !pending || pending.local === true || !!state?.error;
    }

    function render(value) {
        state = value;
        if (typeof value.csrfToken === 'string') csrf = value.csrfToken;
        const status = byId('status');
        status.replaceChildren();
        const rows = [
            ['Betrieb', value.restartRequired ? 'Zertifikat geprüft und gespeichert. Aktivierung beim nächsten regulären Adapterneustart.' : value.mode === 'nexowatt-managed' ? 'Verwaltetes EOS-Zertifikat aktiv' : 'Bestehendes ioBroker-Zertifikat aktiv'],
            ['Aussteller', value.issuer || 'Noch kein EOS-Zertifikat übernommen'],
            ['Zertifikatskette gültig bis', value.effectiveValidTo || value.validTo || '—'],
            ['Zertifikatsstatus', value.valid === false ? 'Abgelaufen oder noch nicht gültig. Erneuerung erforderlich.' : value.expiresSoon ? 'Erneuerung innerhalb von 30 Tagen erforderlich.' : value.valid ? 'Zeitlich gültig' : '—'],
            ['Namen und IP-Adressen', (value.names || []).join(', ') || '—'],
            ['Stamm-CA SHA-256', value.rootFingerprint || '—'],
            ['Gerätezertifikat SHA-256', value.fingerprint || '—'],
        ];
        for (const [name, content] of rows) {
            const term = document.createElement('dt');
            term.textContent = name;
            const detail = document.createElement('dd');
            detail.textContent = content;
            status.append(term, detail);
        }

        const pending = currentPending();
        const local = localDraft();
        const external = Boolean(pending && pending.local !== true);
        const localFingerprint = fingerprintHex(local?.rootFingerprint);
        const activeFingerprint = fingerprintHex(value.rootFingerprint);
        byId('localDraft').hidden = !local;
        byId('noLocalDraft').hidden = Boolean(local);
        byId('localFingerprint').value = localFingerprint.match(/../g)?.join(':') || '';
        byId('trustChange').hidden = !local || !activeFingerprint || localFingerprint === activeFingerprint;
        for (const [id, file] of [['localTrustDownload', 'root.cer'], ['localRootDownload', 'root.pem'], ['localDeviceDownload', 'device.pem']]) {
            const link = byId(id);
            if (local) link.href = `/api/eos/tls/local/${file}?requestId=${local.requestId}`;
            else link.removeAttribute('href');
        }
        byId('rootDownload').hidden = !activeFingerprint;
        byId('externalDraft').hidden = !external;
        byId('noExternalDraft').hidden = external;
        if (external) byId('externalWorkflow').open = true;
        if (!byId('names').value) byId('names').value = (pending?.names || value.suggestedNames || []).join('\n');
        setActions();
        if (value.error) message(describeError(value.error), true);
        else if (value.warnings?.length) message(value.warnings.map(code => describeError(code)).join(' '), true);
    }

    async function run(task) {
        if (busy) return;
        busy = true;
        setActions();
        try {
            await task();
        } catch (error) {
            message(error.name === 'AbortError' ? 'Zeitüberschreitung. Status aktualisieren, bevor du die Aktion erneut ausführst.' : error.message, true);
        } finally {
            busy = false;
            setActions();
        }
    }

    function pendingInput() {
        return {
            names: byId('names').value.split(/[\n,]+/).map(value => value.trim()).filter(Boolean),
            replace: byId('replace').checked,
        };
    }

    function showActivation(value) {
        render(value);
        if (value.error || value.warnings?.length) return;
        message(value.restartRequired
            ? 'Gespeichert. Beim nächsten regulären Adapterneustart wird das Zertifikat aktiv.'
            : 'Das Zertifikat ist jetzt aktiv. Richte das Vertrauen auf deinen Endgeräten ein.');
    }

    byId('reload').addEventListener('click', () => {
        void run(async () => {
            const value = await api('/api/eos/tls');
            render(value);
            if (!value.error && !value.warnings?.length) message('Status aktualisiert.');
        });
    });
    byId('localForm').addEventListener('submit', event => {
        event.preventDefault();
        void run(async () => {
            const value = await api('/api/eos/tls/local', pendingInput());
            render(value);
            byId('replace').checked = false;
            if (localDraft() && !value.error && !value.warnings?.length) message('Zertifikate und Fingerabdruck stehen in Schritt 2 bereit.');
        });
    });
    byId('copyFingerprint').addEventListener('click', async () => {
        const field = byId('localFingerprint');
        if (busy || !field.value) return;
        try {
            await navigator.clipboard.writeText(field.value);
            message('SHA-256-Fingerabdruck kopiert.');
        } catch {
            field.focus();
            field.select();
            message('Der Fingerabdruck ist markiert. Kopiere ihn über die Tastatur oder das Auswahlmenü.');
        }
    });
    byId('activateLocal').addEventListener('click', () => {
        void run(async () => {
            const local = localDraft();
            if (!local) throw new Error('Bitte zuerst HTTPS-Zertifikate erstellen.');
            showActivation(await api('/api/eos/tls/local/activate', {
                requestId: local.requestId,
                rootFingerprint: byId('localFingerprint').value,
            }));
        });
    });
    byId('requestForm').addEventListener('submit', event => {
        event.preventDefault();
        void run(async () => {
            if (!byId('names').reportValidity()) return;
            const value = await api('/api/eos/tls/request', pendingInput());
            render(value);
            byId('replace').checked = false;
            if (!value.error && !value.warnings?.length) message('Anfrage erstellt. Lade sie herunter und lasse sie von NexoWatt signieren.');
        });
    });
    byId('importForm').addEventListener('submit', event => {
        event.preventDefault();
        void run(async () => {
            const pending = currentPending();
            if (!pending || pending.local === true) throw new Error('Bitte zuerst eine Anfrage für NexoWatt erstellen.');
            const certificate = byId('certificate').files[0];
            const root = byId('root').files[0];
            if (!certificate || !root || certificate.size > 48000 || root.size > 16000) throw new Error('Bitte gültige PEM-Dateien auswählen (Gerätekette bis 48 kB, Stammzertifikat bis 16 kB).');
            const value = await api('/api/eos/tls/certificate', {
                requestId: pending.requestId,
                certificate: await certificate.text(),
                rootCertificate: await root.text(),
                rootFingerprint: byId('fingerprint').value.trim(),
            });
            showActivation(value);
            byId('importForm').reset();
        });
    });
    void run(async () => { render(await api('/api/eos/tls')); });
})();
