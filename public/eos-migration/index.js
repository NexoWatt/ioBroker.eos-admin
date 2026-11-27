'use strict';
(() => {
    const phases = {
        IDLE: ['Prüfung vorbereitet', 'Der Übernahmestatus wird beim Start von EOS ermittelt.'],
        DISABLED: ['Automatische Übernahme ausgeschaltet', 'Der automatische Start der Übernahme ist in den EOS-Einstellungen deaktiviert.'],
        LICENSE_REQUIRED: ['Systemfreigabe erforderlich', 'Für die Übernahme fehlt eine gültige zentrale EOS-Systemfreigabe.'],
        NOT_NEEDED: ['Keine Übernahme erforderlich', 'Bei der Prüfung wurden keine zu übernehmenden Altadapter gefunden.'],
        BLOCKED: ['Übernahme nicht gestartet', 'Die Vorprüfung konnte keine vollständige und sichere Übergabe bestätigen. Der Grund steht unten.'],
        PREPARED: ['Übernahme vorbereitet', 'Die Vorprüfung ist abgeschlossen. EOS bereitet die kontrollierte Übergabe vor.'],
        STOPPING: ['Bisherige Adapter werden beendet', 'EOS wartet auf die bestätigte Beendigung der bisherigen Instanzen, bevor der gemeinsame Betrieb startet.'],
        TRANSFERRED: ['Einstellungen übernommen', 'Die Einstellungen sind übernommen. Der Start der integrierten Module wird noch geprüft.'],
        COMMITTED: ['Übernahme abgeschlossen', 'Konfiguration und Start der integrierten Module wurden bestätigt. Die bisherigen Adapter bleiben für eine Rücknahme installiert.'],
        ROLLING_BACK: ['Vorheriger Betrieb wird wiederhergestellt', 'EOS beendet den neuen Betrieb, bevor die bisherigen Instanzen wieder aktiviert werden.'],
        ROLLED_BACK: ['Vorheriger Betrieb wiederhergestellt', 'Der neue Betrieb wurde zurückgenommen. Die Wiederaufnahme der zuvor aktiven Instanzen wurde bestätigt.'],
        ROLLBACK_REQUIRED: ['Serviceprüfung erforderlich', 'Die Übergabe oder Rücknahme konnte nicht vollständig bestätigt werden. Bitte die Instanzen und die angezeigte Meldung prüfen, bevor Einstellungen geändert werden.'],
        NOT_AVAILABLE: ['Status nicht verfügbar', 'Der Übernahmestatus steht zurzeit nicht zur Verfügung.'],
    };
    const reasons = {
        EOS_MIGRATION_LICENSE_REQUIRED: 'Die zentrale EOS-Lizenz aktivieren und hier den Status aktualisieren. Sobald die Übernahme freigegeben ist, kann die Vorprüfung gestartet werden.',
        EOS_MIGRATION_REVIEW_READY: 'Die Systemfreigabe ist gültig. Die Übernahme der bisherigen Instanzen kann jetzt gestartet werden.',
        EOS_MIGRATION_JOURNAL_PRESENT: 'EOS hat einen bereits gespeicherten Übergabestand gefunden. Den aktuellen Stand und die vorhandene Sicherung prüfen.',
        EOS_MIGRATION_RESTART_REQUIRED: 'EOS fordert für die Bestandsprüfung einmalig einen automatischen Adapterneustart an. Bleibt dieser Status dauerhaft bestehen, die EOS-Adapterinstanz einmal in ioBroker neu starten.',
        EOS_MIGRATION_PROTECTED_FIELDS_UNAVAILABLE: 'ioBroker gibt geschützte Zugangsdaten oder Schlüssel eines Altadapters nicht frei. Für eine vollständige Übernahme ist eine freigegebene Übergabe dieser Daten erforderlich; leere Ersatzwerte werden nicht eingesetzt.',
        EOS_MIGRATION_SOURCE_VERSION: 'Die Versionsangaben einer Altinstanz konnten für diesen Übergabeweg nicht bestätigt werden. In ioBroker unter „Adapter“ und „Instanzen“ die installierten Stände der angegebenen Quelle vergleichen.',
        EOS_MIGRATION_SOURCE_IDENTITY: 'Die Kennung der Altinstanz passt nicht zu ihrem Adapter. In ioBroker die angezeigte Instanz und ihren installierten Adapter prüfen.',
        EOS_MIGRATION_UI_CONFIG_SHAPE: 'EOS kann das Format der gespeicherten UI-Konfiguration nicht zuordnen. Die Konfiguration dieser Altinstanz und ihre Sicherung vergleichen.',
        EOS_MIGRATION_DEVICES_CONFIG_SHAPE: 'EOS kann das Format der gespeicherten Geräteliste nicht zuordnen. In der Altinstanz die Gerätekonfiguration und ihre Sicherung prüfen.',
        EOS_MIGRATION_MODULE_FORMAT_UNVERIFIED: 'Für das gespeicherte Format dieses Moduls ist keine vollständige Übernahme bestätigt. Den angegebenen Adapter und seine gesicherte Konfiguration prüfen.',
        EOS_DEVICES_UNKNOWN_TEMPLATE: 'Mindestens eine gespeicherte Gerätevorlage fehlt im EOS-Katalog. Die Vorlagen der angegebenen Altinstanz mit dem Katalog unter Geräte abgleichen.',
        EOS_DEVICES_TEMPLATE_PROTOCOL: 'Eine Gerätevorlage unterstützt das hinterlegte Protokoll nicht. In der angegebenen Altinstanz die Vorlage und das Geräteprotokoll vergleichen.',
        EOS_DEVICES_CONFIG_PROTOCOL: 'Ein gespeichertes Geräteprotokoll wird nicht unterstützt. Das Protokoll der Geräte in der Altinstanz prüfen.',
        EOS_DEVICES_LEGACY_CONFIG_CONFLICT: 'Die beiden gespeicherten Gerätelisten der Altinstanz unterscheiden sich. Anhand der Sicherung klären, welche Zuordnung aktuell ist.',
        EOS_DEVICES_CONFIG_JSON: 'Die gespeicherte Geräteliste kann nicht gelesen werden. Die Gerätekonfiguration der Altinstanz mit ihrer Sicherung vergleichen.',
        EOS_DEVICES_CONFIG_ID: 'Eine Gerätekennung ist ungültig. In der angegebenen Altinstanz die Gerätekennungen prüfen.',
        EOS_DEVICES_DUPLICATE_ID: 'Eine Gerätekennung ist mehrfach vergeben. In der angegebenen Altinstanz die Zuordnung dieser Geräte klären.',
        EOS_MIGRATION_CONFIG_INVALID: 'Die Konfigurationsprüfung ist fehlgeschlagen. Die angegebene Quelle in ioBroker öffnen und die betroffenen Einstellungen prüfen.',
        EOS_MIGRATION_DESTINATION_MISSING: 'Ein bereits übernommener Einstellungsbestand fehlt. Vor dem Start muss die vollständige Sicherung der gemeinsamen Konfiguration wiederhergestellt werden.',
        EOS_MIGRATION_DESTINATION_BINDING: 'Die gespeicherten Moduleinstellungen passen nicht zum bestätigten Übernahmestand. Bitte die Sicherung und Zuordnung der bisherigen Instanzen prüfen.',
        EOS_MIGRATION_DISABLED_UI_REVIEW: 'Die bisherige Oberfläche ist deaktiviert. In ioBroker den Stillstand dieser Instanz und die Erreichbarkeit ihres Hosts prüfen. EOS prüft auch die vorhandene Zielkonfiguration.',
        EOS_MIGRATION_DESTINATION_CONFIGURED: 'Für diesen Bereich bestehen bereits EOS-Einstellungen. Quell- und Zielkonfiguration anhand einer Sicherung vergleichen, bevor eine Übernahme geplant wird.',
        EOS_MIGRATION_DESTINATION_STATES: 'Im gemeinsamen EOS bestehen bereits Datenpunkte für diesen Bereich. Eine automatische Zusammenführung wird nicht vorgenommen.',
        EOS_MIGRATION_AMBIGUOUS: 'Es wurden mehrere Instanzen desselben Altadapters gefunden. Vor der Übernahme muss die gewünschte Zuordnung geklärt werden.',
        EOS_MIGRATION_SOURCE_HOST: 'Die Hostzuordnung oder Erreichbarkeit eines bisherigen Adapters konnte nicht bestätigt werden.',
        EOS_MIGRATION_MODULE_LICENSE_REQUIRED: 'Die zentrale Lizenz gibt mindestens ein zu übernehmendes Modul noch nicht frei.',
        EOS_MIGRATION_SOURCE_UNAVAILABLE: 'Eine bisherige Instanz konnte nicht vollständig gelesen werden.',
        EOS_MIGRATION_SOURCE_CHANGED: 'Ein bisheriger Adapter wurde während der Übergabe verändert. Bitte die aktuelle Konfiguration und Hostzuordnung prüfen.',
        EOS_MIGRATION_STOP_UNCONFIRMED: 'Im ioBroker prüfen, ob der Host erreichbar ist und die bisherige Instanz nach ihrer letzten Änderung als beendet gemeldet hat.',
        EOS_MIGRATION_ROLLBACK_UNCONFIRMED: 'Die Wiederaufnahme einer bisherigen Instanz konnte nicht bestätigt werden. Bitte deren Laufzustand prüfen.',
        EOS_MIGRATION_NEW_RUNTIME_FAILED: 'Der Start des gemeinsamen Betriebs wurde nicht bestätigt; die Rücknahme wurde eingeleitet.',
        EOS_MIGRATION_INTERRUPTED: 'Die vorherige Übergabe wurde unterbrochen. EOS hat die Wiederherstellung des bisherigen Betriebs eingeleitet.',
        EOS_MIGRATION_CREDENTIAL_DECRYPTION: 'Gespeicherte Zugangsdaten konnten nicht entschlüsselt werden. Der ursprüngliche Schlüssel und die Sicherung müssen geprüft werden.',
        EOS_MIGRATION_EEBUS_IDENTITY_REQUIRED: 'Die bisherige EEBus-Geräteidentität ist nicht vollständig verfügbar. Eine neue Identität würde bestehende Kopplungen verändern.',
        EOS_MIGRATION_EEBUS_IDENTITY_MISMATCH: 'Die bisherige EEBus-Geräteidentität und ihr Fingerabdruck stimmen nicht überein.',
        EOS_MIGRATION_EEBUS_REPAIR_REQUIRED: 'Eine bestehende EEBus-Kopplung besitzt keinen bestätigten Zertifikat-Fingerabdruck. Die Kopplung muss geprüft werden.',
        EOS_MIGRATION_EEBUS_SECURITY_PROFILE: 'Die bisherige EEBus-Konfiguration enthält Sicherheitseinstellungen, die nicht unverändert übernommen werden können.',
        EOS_MIGRATION_JOURNAL_INVALID: 'Der gespeicherte Übernahmestand ist beschädigt oder unvollständig. Eine Wiederherstellung muss anhand der Sicherung geprüft werden.',
        EOS_MIGRATION_DECRYPTION: 'Der gespeicherte Übernahmestand konnte nicht entschlüsselt werden.',
        EOS_MIGRATION_PREFLIGHT_UNAVAILABLE: 'Für eine beteiligte Komponente steht noch keine passende Übernahmeprüfung zur Verfügung.',
        EOS_MIGRATION_EXTERNAL_RPC_REFERENCE: 'Ein aktiver Adapter oder ein Skript sendet direkte Befehle an eine bisherige Instanz. Diese Verbindung muss vor der Zusammenlegung angepasst und geprüft werden.',
        EOS_MIGRATION_RPC_INVENTORY: 'Die direkten Verbindungen zu bisherigen Adaptern konnten nicht vollständig geprüft werden.',
        EOS_MIGRATION_SCRIPT_REVIEW: 'Ein aktives Skript konnte nicht vollständig auf Verweise zu bisherigen Adaptern geprüft werden.',
        EOS_BACKUP_LEGACY_SECRET_UNAVAILABLE: 'Ein Zugang oder Schlüssel des bisherigen Sicherungsadapters ist nicht vollständig verfügbar.',
        EOS_BACKUP_MIGRATION_GRAFANA_REVIEW: 'Die vorhandene Grafana-Sicherung benötigt vor der Übernahme eine Prüfung ihrer Ziele und Zugangsdaten.',
        EOS_BACKUP_MIGRATION_MOUNT_REVIEW: 'Die bisherige Sicherung verwendet eine Betriebssystem-Freigabe. Deren Einbindung muss für den gemeinsamen Adapter geprüft werden.',
        EOS_BACKUP_MIGRATION_MULTIHOST_REVIEW: 'Die bisherige Sicherung umfasst mehrere Hosts. Die Sicherungszuständigkeiten müssen vor der Übernahme geprüft werden.',
        EOS_BACKUP_MIGRATION_NOTIFICATIONS_REVIEW: 'Die vorhandenen Sicherungsbenachrichtigungen benötigen vor der Übernahme eine Prüfung.',
        EOS_BACKUP_MIGRATION_ZIGBEE_MQTT_REVIEW: 'Die vorhandene Zigbee2MQTT-Sicherung muss vor der Übernahme anhand ihres Datenverzeichnisses geprüft werden.',
    };
    const labels = { ui: 'EOS Oberfläche und Regelung', devices: 'Geräte', eebus: 'EEBus', backup: 'Sicherung', ocpp: 'OCPP-Ladestationen' };
    const sourceNames = { ui: 'nexowatt-ui', devices: 'nexowatt-devices', eebus: 'eebus', backup: 'nexowatt-backup', ocpp: 'ocpp21' };
    const element = id => document.getElementById(id);
    let busy = false, permitted = false, canActivateDevices = false, running = false;
    let csrf = '', revision = '', pollUntil = 0, timer = null;
    const operationErrors = {
        AUTH_CSRF: 'Die Sitzungsfreigabe ist abgelaufen. Den Status aktualisieren und die Auswahl erneut prüfen.',
        AUTH_ORIGIN: 'Bitte die Übernahme direkt im freigegebenen EOS-Adminzugang öffnen.',
        PASSWORD_CHANGE_REQUIRED: 'Vor der Übernahme das Administrationskennwort ändern und erneut anmelden.',
        EOS_MIGRATION_BUSY: 'Eine Übernahme oder Prozessänderung läuft bereits. Status aktualisieren und den Abschluss abwarten.',
        EOS_MIGRATION_REVISION_CONFLICT: 'Der Übernahmestand hat sich geändert. Status aktualisieren und die dort angebotene Aktion prüfen.',
        EOS_MIGRATION_ACTION_UNAVAILABLE: 'Der Start ist aktuell nicht freigegeben. Status aktualisieren und die angezeigte Voraussetzung prüfen.',
        EOS_MIGRATION_REQUEST_INVALID: 'Die Auswahl passt nicht mehr zum aktuellen Bestand. Status aktualisieren und die Auswahl erneut prüfen.',
    };
    function updateButtons() {
        element('refresh').disabled = busy;
        element('start-controls').hidden = !permitted;
        element('start').disabled = busy || !permitted;
        element('activate-devices-field').hidden = !permitted || !canActivateDevices;
        element('activate-devices').disabled = busy || !permitted || !canActivateDevices;
    }
    function stopTimer() {
        if (timer !== null) clearTimeout(timer);
        timer = null;
    }
    function pollWhileRunning() {
        stopTimer();
        if (!running) { pollUntil = 0; return; }
        if (!pollUntil) pollUntil = Date.now() + 240000;
        if (Date.now() >= pollUntil) element('operation-message').textContent = 'Der Abschluss ist noch unbestätigt. Mit „Status aktualisieren“ den aktuellen Stand abrufen.';
        else if (!document.hidden) timer = setTimeout(() => void refresh(), 3000);
    }
    function version(value) {
        return typeof value === 'string' && value.length <= 80 && /^\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?(?:\+[A-Za-z0-9.-]+)?$/.test(value) ? value : '';
    }
    function sourceDetails(source, phase) {
        const details = [source.namespacePreserved === true ? 'bisherige Datenpunktnamen beibehalten' : 'bisherige Instanz erfasst'];
        if (typeof source.enabled === 'boolean') {
            const original = ['PREPARED','STOPPING','TRANSFERRED','COMMITTED','ROLLING_BACK','ROLLED_BACK','ROLLBACK_REQUIRED'].includes(phase);
            details.push((original ? 'vor der Übernahme ' : 'Altinstanz ') + (source.enabled ? 'aktiviert' : 'deaktiviert'));
        }
        const installed = version(source.sourceVersion), instance = version(source.instanceVersion), adapter = version(source.adapterVersion);
        if (installed) details.push('Gefundene Version ' + installed);
        if (instance && adapter && instance !== adapter) details.push('Instanz meldet ' + instance + ', Adapter meldet ' + adapter);
        else if (!installed && instance) details.push('Instanz meldet ' + instance);
        else if (!installed && adapter) details.push('Adapter meldet ' + adapter);
        if (source.versionCode === 'EOS_MIGRATION_VERSION_INVALID') details.push('Versionsangabe nicht lesbar');
        else if (!installed && !instance && !adapter && Object.hasOwn(source, 'sourceVersion')) details.push('Versionsangabe fehlt');
        if ((source.id === 'ui' || source.id === 'devices') && ['EOS_MIGRATION_VERSION_MISSING','EOS_MIGRATION_VERSION_DIFFERENT','EOS_MIGRATION_VERSION_INVALID'].includes(source.versionCode)) {
            details.push('Die gespeicherte Konfiguration entscheidet über die Übernahme');
        }
        if (source.id === 'devices' && ['TRANSFERRED','COMMITTED'].includes(phase) && typeof source.targetEnabled === 'boolean') {
            details.push(source.targetEnabled ? 'integriertes Gerätemodul freigegeben' : 'integriertes Gerätemodul deaktiviert');
        }
        return ' · ' + details.join(' · ');
    }
    function render(value) {
        const phase = typeof value?.phase === 'string' && Object.hasOwn(phases, value.phase) ? value.phase : 'NOT_AVAILABLE';
        const code = typeof value?.code === 'string' && /^[A-Z][A-Z0-9_]{0,79}$/.test(value.code) ? value.code : '';
        const op = value?.operation;
        const nextRevision = typeof value?.revision === 'string' && /^[a-f0-9-]{36}$/.test(value.revision) ? value.revision : '';
        csrf = typeof value?.csrfToken === 'string' && value.csrfToken.length <= 512 && /^[a-zA-Z0-9+_/=-]+$/.test(value.csrfToken) ? value.csrfToken : '';
        running = op?.state === 'running' || ['PREPARED', 'STOPPING', 'TRANSFERRED', 'ROLLING_BACK'].includes(phase);
        permitted = value?.canStart === true && !!nextRevision && !!csrf && ['idle','complete','failed'].includes(op?.state) &&
            ['BLOCKED','DISABLED','NOT_NEEDED','LICENSE_REQUIRED'].includes(phase);
        canActivateDevices = permitted && value?.canActivateDevices === true;
        if (revision !== nextRevision || !canActivateDevices) element('activate-devices').checked = false;
        revision = nextRevision;
        const operationMessage = element('operation-message');
        const opCode = typeof op?.code === 'string' && /^[A-Z][A-Z0-9_]{0,79}$/.test(op.code) ? op.code : '';
        operationMessage.textContent = running ? 'Der Übernahmeauftrag läuft. EOS aktualisiert die Anzeige während der Durchführung.'
            : op?.state === 'failed' && opCode && opCode !== code ? (reasons[opCode] || 'Der Übernahmeauftrag wurde mit ' + opCode + ' beendet.') : '';
        const rechecking = op?.state === 'running' && ['BLOCKED','DISABLED','NOT_NEEDED','LICENSE_REQUIRED'].includes(phase);
        const [heading, description] = rechecking
            ? ['Vorprüfung läuft', 'EOS prüft die erfassten Altinstanzen erneut. Bis zum Ergebnis zeigt die Instanzliste den zuletzt geprüften Stand.']
            : phase === 'LICENSE_REQUIRED' && permitted
            ? ['Systemfreigabe erteilt', 'EOS kann die bisherigen Adapter jetzt prüfen.']
            : phase === 'LICENSE_REQUIRED' && code === 'EOS_MIGRATION_RESTART_REQUIRED'
            ? ['Automatischer Neustart zur Bestandsprüfung', 'Die zentrale Systemfreigabe ist gültig. EOS prüft den Bestand beim nächsten Adapterstart.']
            : phases[phase];
        element('status-heading').textContent = heading;
        element('phase-description').textContent = description;
        element('code-label').textContent = rechecking ? 'Meldung der letzten Prüfung' : 'Meldung';
        element('status-code').textContent = code || 'Keine zusätzliche Meldung';
        element('reason-description').textContent = permitted && phase === 'LICENSE_REQUIRED'
            ? 'Die Systemfreigabe ist jetzt gültig. Die Übernahme kann hier erneut geprüft und gestartet werden.'
            : code ? (reasons[code] || 'Die Übernahmeprüfung meldet den oben angegebenen Grund. Bitte die betroffene Instanz prüfen.') : '';
        const time = Number.isSafeInteger(value?.updatedAt) && value.updatedAt > 0 && value.updatedAt <= 8640000000000000 ? value.updatedAt : null;
        element('updated-at').textContent = time ? new Date(time).toLocaleString('de-DE') : 'Noch nicht gespeichert';
        const unchanged = !rechecking && value?.existingAdaptersUnchanged === true && ['BLOCKED', 'DISABLED', 'LICENSE_REQUIRED', 'NOT_NEEDED'].includes(phase);
        element('unchanged-notice').hidden = !unchanged;
        element('unchanged-notice').textContent = unchanged ? 'Die automatische Übernahme hat keine bisherigen Adapter angehalten oder deren Einstellungen verändert.' : '';
        const processLabels = { ui: 'Oberfläche', ems: 'EMS', devices: 'Geräte', eebus: 'EEBus', backup: 'Sicherung', ocpp: 'OCPP-Ladestationen' };
        const blocked = Array.isArray(value?.blockedProcesses) ? Object.keys(processLabels).filter(id => value.blockedProcesses.includes(id)) : null;
        const scope = element('scope-description');
        scope.hidden = !blocked;
        scope.textContent = blocked ? (blocked.length ? `Diese Bereiche warten auf die Betriebsfreigabe durch die Übernahme: ${blocked.map(id => processLabels[id]).join(', ')}.`
            : 'Die Bestandsübernahme hält derzeit keine Betriebsfreigabe zurück.') : '';
        const issues = Array.isArray(value?.issues) ? value.issues.slice(0, 256) : [];
        const list = element('sources'); list.replaceChildren();
        let count = 0;
        for (const source of (Array.isArray(value?.sources) ? value.sources.slice(0, 256) : [])) {
            if (!source || typeof source.id !== 'string' || !Object.hasOwn(sourceNames, source.id) || typeof source.source !== 'string' ||
                !new RegExp(`^${sourceNames[source.id]}\\.\\d{1,8}$`).test(source.source)) continue;
            const row = document.createElement('p');
            const name = document.createElement('strong'); name.textContent = `${labels[source.id]}: `;
            const id = document.createElement('code'); id.textContent = source.source;
            const note = document.createElement('span');
            note.textContent = sourceDetails(source, phase);
            row.append(name, id, note);
            if (phase === 'COMMITTED' && source.id === 'devices' && source.enabled === false && source.targetEnabled !== true) {
                const controls = document.createElement('a'); controls.href = '/runtime/';
                controls.textContent = source.targetEnabled === false ? 'Gerätemodul in der Prozessverwaltung aktivieren' : 'Gerätefreigabe in der Prozessverwaltung prüfen';
                row.append(document.createElement('br'), controls);
            }
            const issue = issues.find(item => item?.id === source.id && item.source === source.source &&
                typeof item.code === 'string' && /^[A-Z][A-Z0-9_]{0,79}$/.test(item.code));
            if (issue) {
                const reason = document.createElement('p'); reason.className = 'notice';
                reason.textContent = `${issue.code}. ${reasons[issue.code] || 'Die Konfiguration dieser Altinstanz prüfen.'}`;
                list.append(row, reason);
            } else list.append(row);
            count++;
        }
        if (!count) { const empty = document.createElement('p'); empty.textContent = 'Für diesen Status sind keine Instanzen erfasst.'; list.append(empty); }
        updateButtons();
    }
    async function refresh() {
        if (busy) return;
        stopTimer();
        busy = true; updateButtons();
        const message = element('request-message'); message.textContent = 'Status wird geladen …'; message.className = 'eos-message';
        let watch = running;
        try {
            const response = await fetch('/api/eos/migration', { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(10000) });
            if (response.status === 401 || response.status === 403) {
                watch = false;
                throw new Error(response.status === 401 ? 'Bitte erneut bei EOS anmelden, um den Übernahmestatus zu sehen.'
                    : 'Der Übernahmestatus ist nur für die EOS-Administration freigegeben.');
            }
            if (!response.ok) throw new Error('Der Übernahmestatus ist vorübergehend nicht verfügbar.');
            render(await response.json()); message.textContent = 'Status aktualisiert.';
        } catch (error) {
            render({ phase: 'NOT_AVAILABLE' });
            running = watch;
            message.textContent = watch ? 'Der aktuelle Auftragsstand ist nicht erreichbar. EOS fragt den Status erneut ab.'
                : error instanceof Error ? error.message : 'Status konnte nicht geladen werden.';
            message.className = 'eos-message is-error';
        } finally { busy = false; updateButtons(); pollWhileRunning(); }
    }
    async function start() {
        if (busy || !permitted || !csrf || !revision) return;
        const activateDevices = canActivateDevices && element('activate-devices').checked === true;
        busy = true; stopTimer(); updateButtons();
        const message = element('request-message');
        message.className = 'eos-message'; message.textContent = 'Übernahmeauftrag wird gesendet …';
        try {
            const response = await fetch('/api/eos/migration/start', {
                method: 'POST', credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(10000),
                headers: { 'Content-Type':'application/json', 'x-nw-csrf':csrf },
                body: JSON.stringify({ expectedRevision:revision, activateDevices }),
            });
            const result = await response.json();
            if (response.status !== 202) {
                const code = typeof result?.error === 'string' && /^[A-Z][A-Z0-9_]{0,79}$/.test(result.error) ? result.error : '';
                const note = Object.hasOwn(operationErrors, code) ? operationErrors[code] : reasons[code];
                throw new Error(note || (response.status === 401 ? 'Bitte erneut bei EOS anmelden.'
                    : response.status === 403 ? 'Für den Übernahmestart ist eine Administratoranmeldung erforderlich.'
                    : response.status === 409 ? 'Der Übernahmestand hat sich geändert oder ein Auftrag läuft bereits. Status aktualisieren und den aktuellen Stand prüfen.'
                    : 'Der Übernahmestart wurde nicht bestätigt. Bitte den aktuellen Status abrufen.'));
            }
            render(result); message.textContent = 'Übernahmeauftrag angenommen.';
        } catch (error) {
            // Missing confirmation is not a failed cutover. Never replay a start
            // after a timeout; a fresh status read is required before another click.
            permitted = false; canActivateDevices = false; csrf = ''; revision = '';
            message.className = 'eos-message is-error';
            message.textContent = error instanceof Error && error.name === 'Error' ? error.message
                : 'Die Bestätigung des Übernahmestarts fehlt. Bitte den aktuellen Status abrufen.';
        } finally { busy = false; updateButtons(); pollWhileRunning(); }
    }
    element('refresh').addEventListener('click', () => { pollUntil = 0; void refresh(); });
    element('start').addEventListener('click', () => void start());
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) stopTimer();
        else if (running) void refresh();
    });
    window.addEventListener('pagehide', stopTimer);
    window.addEventListener('pageshow', event => { if (event.persisted) void refresh(); });
    void refresh();
})();
