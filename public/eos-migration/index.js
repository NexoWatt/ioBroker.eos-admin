'use strict';
(() => {
    const phases = {
        IDLE: ['Prüfung vorbereitet', 'Der Übernahmestatus wird beim Start von EOS ermittelt.'],
        DISABLED: ['Automatische Übernahme ausgeschaltet', 'Die automatische Übernahme ist in den EOS-Einstellungen deaktiviert.'],
        LICENSE_REQUIRED: ['Systemfreigabe erforderlich', 'Für die automatische Übernahme fehlt eine gültige zentrale EOS-Systemfreigabe.'],
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
        EOS_MIGRATION_LICENSE_REQUIRED: 'Die Bestandsübernahme wurde ohne gültige Systemfreigabe noch nicht geprüft. Zuerst die zentrale EOS-Lizenz aktivieren; anschließend EOS neu starten, damit die vollständige Übernahmeprüfung vor dem Betrieb ausgeführt wird.',
        EOS_MIGRATION_RESTART_REQUIRED: 'Die Systemfreigabe ist jetzt gültig. Bitte die EOS-Adapterinstanz neu starten, damit die Bestandsübernahme vollständig geprüft wird. Bisherige Adapter nicht löschen und keine leeren Einstellungen über den Bestand speichern.',
        EOS_MIGRATION_PROTECTED_FIELDS_UNAVAILABLE: 'ioBroker gibt geschützte Zugangsdaten oder Schlüssel eines Altadapters nicht frei. Für eine vollständige Übernahme ist eine freigegebene Übergabe dieser Daten erforderlich; leere Ersatzwerte werden nicht eingesetzt.',
        EOS_MIGRATION_SOURCE_VERSION: 'Mindestens eine Altadapter-Version ist für die automatische Übernahme noch nicht geprüft.',
        EOS_MIGRATION_DESTINATION_MISSING: 'Ein bereits übernommener Einstellungsbestand fehlt. Vor dem Start muss die vollständige Sicherung der gemeinsamen Konfiguration wiederhergestellt werden.',
        EOS_MIGRATION_DESTINATION_BINDING: 'Die gespeicherten Moduleinstellungen passen nicht zum bestätigten Übernahmestand. Bitte die Sicherung und Zuordnung der bisherigen Instanzen prüfen.',
        EOS_MIGRATION_DISABLED_UI_REVIEW: 'Die bisherige EOS-Oberfläche ist deaktiviert. Ihr bisheriger Betriebszustand muss vor einer gemeinsamen Aktivierung geprüft werden.',
        EOS_MIGRATION_DESTINATION_CONFIGURED: 'Im gemeinsamen EOS sind bereits Einstellungen für ein betroffenes Modul gespeichert. Diese werden nicht überschrieben.',
        EOS_MIGRATION_DESTINATION_STATES: 'Im gemeinsamen EOS bestehen bereits Datenpunkte für diesen Bereich. Eine automatische Zusammenführung wird nicht vorgenommen.',
        EOS_MIGRATION_AMBIGUOUS: 'Es wurden mehrere Instanzen desselben Altadapters gefunden. Vor der Übernahme muss die gewünschte Zuordnung geklärt werden.',
        EOS_MIGRATION_SOURCE_HOST: 'Die Hostzuordnung oder Erreichbarkeit eines bisherigen Adapters konnte nicht bestätigt werden.',
        EOS_MIGRATION_MODULE_LICENSE_REQUIRED: 'Die zentrale Lizenz gibt mindestens ein zu übernehmendes Modul noch nicht frei.',
        EOS_MIGRATION_SOURCE_UNAVAILABLE: 'Eine bisherige Instanz konnte nicht vollständig gelesen werden.',
        EOS_MIGRATION_SOURCE_CHANGED: 'Ein bisheriger Adapter wurde während der Übergabe verändert. Bitte die aktuelle Konfiguration und Hostzuordnung prüfen.',
        EOS_MIGRATION_STOP_UNCONFIRMED: 'Die vollständige Beendigung einer bisherigen Instanz wurde nicht bestätigt.',
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
    let busy = false;
    function render(value) {
        const phase = typeof value?.phase === 'string' && Object.hasOwn(phases, value.phase) ? value.phase : 'NOT_AVAILABLE';
        const code = typeof value?.code === 'string' && /^[A-Z][A-Z0-9_]{0,79}$/.test(value.code) ? value.code : '';
        const [heading, description] = phase === 'LICENSE_REQUIRED' && code === 'EOS_MIGRATION_RESTART_REQUIRED'
            ? ['Übernahmeprüfung nach Neustart erforderlich', 'Die zentrale Systemfreigabe ist gültig. Die Bestandsprüfung wurde in diesem Adapterlauf noch nicht ausgeführt.']
            : phases[phase];
        element('status-heading').textContent = heading;
        element('phase-description').textContent = description;
        element('status-code').textContent = code || 'Keine zusätzliche Meldung';
        element('reason-description').textContent = code ? (reasons[code] || 'Die Übernahmeprüfung meldet den oben angegebenen Grund. Bitte diese Meldung bei der Prüfung der Anlage berücksichtigen.') : '';
        const time = Number.isSafeInteger(value?.updatedAt) && value.updatedAt > 0 && value.updatedAt <= 8640000000000000 ? value.updatedAt : null;
        element('updated-at').textContent = time ? new Date(time).toLocaleString('de-DE') : 'Noch nicht gespeichert';
        const unchanged = value?.existingAdaptersUnchanged === true && ['BLOCKED', 'DISABLED', 'LICENSE_REQUIRED', 'NOT_NEEDED'].includes(phase);
        element('unchanged-notice').hidden = !unchanged;
        element('unchanged-notice').textContent = unchanged ? 'Die automatische Übernahme hat keine bisherigen Adapter angehalten oder deren Einstellungen verändert.' : '';
        const list = element('sources'); list.replaceChildren();
        let count = 0;
        for (const source of (Array.isArray(value?.sources) ? value.sources.slice(0, 256) : [])) {
            if (!source || typeof source.id !== 'string' || !Object.hasOwn(sourceNames, source.id) || typeof source.source !== 'string' ||
                !new RegExp(`^${sourceNames[source.id]}\\.\\d{1,8}$`).test(source.source)) continue;
            const row = document.createElement('p');
            const name = document.createElement('strong'); name.textContent = `${labels[source.id]}: `;
            const id = document.createElement('code'); id.textContent = source.source;
            const note = document.createElement('span');
            note.textContent = source.namespacePreserved === true ? ' · bisherige Datenpunktnamen beibehalten' : ' · bisherige Instanz erfasst';
            row.append(name, id, note); list.append(row); count++;
        }
        if (!count) { const empty = document.createElement('p'); empty.textContent = 'Für diesen Status sind keine Instanzen erfasst.'; list.append(empty); }
    }
    async function refresh() {
        if (busy) return;
        busy = true; element('refresh').disabled = true;
        const message = element('request-message'); message.textContent = 'Status wird geladen …'; message.className = 'eos-message';
        try {
            const response = await fetch('/api/eos/migration', { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(10000) });
            if (response.status === 401) throw new Error('Bitte erneut bei EOS anmelden, um den Übernahmestatus zu sehen.');
            if (response.status === 403) throw new Error('Der Übernahmestatus ist nur für die EOS-Administration freigegeben.');
            if (!response.ok) throw new Error('Der Übernahmestatus ist vorübergehend nicht verfügbar.');
            render(await response.json()); message.textContent = 'Status aktualisiert. Es wurden keine Einstellungen verändert.';
        } catch (error) {
            message.textContent = error instanceof Error ? error.message : 'Status konnte nicht geladen werden.';
            message.className = 'eos-message is-error';
        } finally { busy = false; element('refresh').disabled = false; }
    }
    element('refresh').addEventListener('click', () => void refresh());
    void refresh();
})();
