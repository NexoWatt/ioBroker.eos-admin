/* NexoWatt EOS Backup – same-origin session and CSRF guarded module API. */
'use strict';
(() => {
    const api = '/api/eos/modules/backup';
    /** @typedef {Record<string, unknown>} Config */
    /** @typedef {{id:string,section:string,title:string,description:string,flag?:string,match?:RegExp}} Group */
    /** @typedef {{complete:boolean,required:string[],missing:string[],externalTargetConfigured:boolean}} Coverage */
    /** @typedef {{name:string,size:number,kind?:string}} BackupFile */
    /** @typedef {{provider:string,kind?:string,entries:BackupFile[]}} Remote */
    /** @typedef {{id:string,startedAt:string,state:string,error?:string,remote?:Remote,files?:BackupFile[],moreFiles?:boolean}} Job */
    /** @typedef {{config?:Config,configurationRevision?:string,csrfToken?:string,status?:{active?:boolean,reason?:string,details?:{current?:unknown,coverage?:Coverage,history?:Job[]}}}} View */
    /** @type {Config} */ let config = {};
    /** @type {Config} */ let savedConfig = {};
    /** @type {Config|null} */ let dialogDraft = null;
    /** @type {Group|null} */ let dialogGroup = null;
    /** @type {HTMLElement|null} */ let dialogOpener = null;
    /** @type {ReturnType<typeof setTimeout>|undefined} */ let poll;
    /** @type {Coverage|null} */ let lastCoverage = null;
    let loaded = false, configurationRevision = '', csrf = '', busy = false;
    /** @param {string} id @returns {HTMLElement} */
    const byId = id => { const node = document.getElementById(id); if (!node) throw new Error('EOS_BACKUP_UI_ELEMENT'); return node; };
    /** @param {string} id @returns {HTMLInputElement} */
    const inputById = id => /** @type {HTMLInputElement} */ (byId(id));
    /** @param {string} id @returns {HTMLButtonElement} */
    const buttonById = id => /** @type {HTMLButtonElement} */ (byId(id));
    /** @returns {HTMLDialogElement} */
    const dialog = () => /** @type {HTMLDialogElement} */ (byId('settingsDialog'));
    /** @param {unknown} error */
    const errorText = error => error instanceof Error ? error.message : 'Anfrage fehlgeschlagen.';
    /** @param {string} text @param {boolean} [error] */
    function message(text, error = false) {
        byId('message').textContent = text;
        byId('message').classList.toggle('error', error);
    }
    /** @template T @param {string} path @param {string} [method] @param {unknown} [body] @returns {Promise<T>} */
    async function request(path, method = 'GET', body) {
        const r = await fetch(api + path, {
            method,
            credentials: 'same-origin',
            headers: { 'content-type': 'application/json', ...(method === 'GET' ? {} : { 'x-nw-csrf': csrf }) },
            ...(body ? { body: JSON.stringify(body) } : {}),
        });
        /** @type {unknown} */ let v;
        try {
            v = await r.json();
        } catch {
            throw new Error('EOS antwortet derzeit nicht. Bitte Status erneut laden.');
        }
        if (!r.ok) {
            const failure = /** @type {{error?:string}} */ (v && typeof v === 'object' ? v : {});
            if (failure.error === 'EOS_MODULE_CONFIG_CONFLICT') throw new Error('Die Sicherungseinstellungen wurden inzwischen geändert. Deine Eingaben bleiben erhalten. Seite neu laden und Änderungen mit dem gespeicherten Stand abgleichen.');
            if (r.status === 401)
                throw new Error(
                    'Sitzung abgelaufen. Bitte erneut bei EOS anmelden; ungespeicherte Eingaben bleiben hier erhalten.',
                );
            if (failure.error === 'AUTH_CSRF')
                throw new Error('Sicherheitstoken erneuern: Status aktualisieren und erneut speichern.');
            /** @type {Record<string,string>} */ const errors = {
                EOS_BACKUP_SOURCE_PATH: 'Bitte die Pfade der aktivierten Sicherungsquellen und Speicherziele prüfen: Es wird ein absoluter lokaler Pfad benötigt (z. B. /mnt/eos-backup). NAS und SD-Karte müssen bereits eingebunden sein. Deine Eingaben bleiben erhalten.',
                EOS_BACKUP_PREMOUNT_REQUIRED: 'Für dieses NAS-Ziel den bereits eingebundenen absoluten Zielordner angeben. EOS bindet Datenträger hier nicht selbst ein.',
                EOS_BACKUP_FTPS_REQUIRED: 'Für FTPS müssen TLS und die Zertifikatsprüfung aktiviert sein.',
                EOS_BACKUP_TLS_REQUIRED: 'Bitte eine verschlüsselte Verbindung mit gültiger Zertifikatsprüfung konfigurieren.',
                EOS_BACKUP_COVERAGE_INCOMPLETE: 'Die Gesamtsicherung ist noch nicht vollständig eingerichtet. Den angezeigten Sicherungsumfang prüfen.',
                EOS_RUNTIME_BUSY: 'Eine Prozessaktion läuft noch. Bitte ihren Abschluss abwarten; deine Eingaben bleiben erhalten.',
            };
            throw new Error(errors[failure.error || ''] || failure.error || 'Anfrage fehlgeschlagen.');
        }
        return /** @type {T} */ (v);
    }
    /** @template [T=unknown] @param {string} name @param {Config} [payload] @returns {Promise<T>} */
    async function command(name, payload = {}) {
        return request('/command', 'POST', { command: name, payload });
    }
    /** @param {string} name @param {string} content */
    function download(name, content) {
        const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    const SECRET = '__EOS_SECRET_UNCHANGED__';
    /** @type {Record<string,string>} */ const channelPrefixes = { Telegram: 'telegram', WhatsApp: 'whatsapp', Gotify: 'gotify', Signal: 'signal',
        Matrix: 'matrix', Discord: 'discord', Pushover: 'pushover', 'E-Mail': 'email', Email: 'email' };
    /** @type {Array<[string,string,string]>} */ const sections = [
        ['system', 'System und Zeitpläne', 'Die manuelle Systemsicherung enthält immer das ioBroker-Archiv. Die Zeitpläne lassen sich getrennt aktivieren.'],
        ['databases', 'Datenbanken', 'Zusätzliche Datenbanken einzeln auswählen. Die aktive EOS-PostgreSQL-Historie wird unabhängig davon automatisch in die Gesamtsicherung einbezogen.'],
        ['applications', 'Anwendungen und Geräte', 'Zusätzliche Inhalte der Systemsicherung. EOS-Geräteeinstellungen gehören zum EOS-Profil.'],
        ['destinations', 'Zusätzliche Speicherziele', 'Die lokale EOS-Ablage bleibt bestehen. Diese Ziele erhalten zusätzliche Kopien; sie wählen keine Datenquelle aus.'],
        ['service', 'Benachrichtigungen und Betrieb', 'Meldungen, Laufzeitgrenzen und übernommene Betriebseinstellungen.'],
    ];
    /** @type {Group[]} */ const groups = [
        { id: 'system', section: 'system', title: 'Automatische Systemsicherung', flag: 'minimalEnabled', match: /^(minimal|iobrokerCron)/,
            description: 'Steuert den automatischen Zeitplan. „Jetzt sichern“ bleibt unabhängig davon möglich.' },
        { id: 'eos', section: 'system', title: 'EOS-Profil', flag: 'eosProfileEnabled', match: /^eos/,
            description: 'EOS-Einstellungen und Geräteidentitäten. Für eine vollständige EOS-Gesamtsicherung erforderlich.' },
        { id: 'ccu', section: 'system', title: 'Automatische CCU-Sicherung', flag: 'ccuEnabled', match: /^ccu/,
            description: 'Eigener CCU-Zeitplan und CCU-Zugang. „CCU sichern“ bleibt unabhängig vom Zeitplan möglich.' },
        { id: 'influx', section: 'databases', title: 'InfluxDB', flag: 'influxDBEnabled', match: /^influxDB/,
            description: 'InfluxDB-Datenbank oder Bucket einschließlich Zugang und Aufbewahrung.' },
        { id: 'mysql', section: 'databases', title: 'MySQL / MariaDB', flag: 'mySqlEnabled', match: /^(mySql|mysql)/,
            description: 'Zusätzliche MySQL- oder MariaDB-Datenbanken sichern.' },
        { id: 'postgres', section: 'databases', title: 'Zusätzliche PostgreSQL-Datenbank', flag: 'pgSqlEnabled', match: /^pgSql/,
            description: 'Weitere PostgreSQL-Datenbanken. Die automatische EOS-Historiensicherung wird hiermit nicht ausgeschaltet.' },
        { id: 'sqlite', section: 'databases', title: 'SQLite', flag: 'sqliteEnabled', match: /^sqlite/,
            description: 'Eine zusätzliche lokale SQLite-Datenbank sichern.' },
        { id: 'redis', section: 'databases', title: 'Redis', flag: 'redisEnabled', match: /^redis/,
            description: 'Zusätzliche Redis-Sicherung und lokale oder entfernte Quelle.' },
        ...[['history', 'Dateihistorie'], ['zigbee', 'Zigbee'], ['zigbee2mqtt', 'Zigbee2MQTT'], ['nodered', 'Node-RED'],
            ['yahka', 'Yahka'], ['jarvis', 'Jarvis'], ['esphome', 'ESPHome'], ['grafana', 'Grafana']].map(([id = '', title = '']) => ({
            id, title, section: 'applications', flag: `${id}Enabled`, match: new RegExp(`^${id}${id === 'zigbee' ? '(?!2mqtt)' : ''}`),
            description: `Zusätzliche ${title}-Daten in die Systemsicherung aufnehmen.` })),
        { id: 'local', section: 'destinations', title: 'Lokaler Ordner / NAS / SD-Karte', flag: 'cifsEnabled',
            match: /^(cifs|sdCard|connectType$|mountedBackupPath$|cacheLoose$|expertMount$|noserverino$|smbType$|sudoMount$)/,
            description: 'EOS verwendet bereits eingebundene Datenträger. Einbinden und Rechtevergabe erfolgen bei der Geräteeinrichtung.' },
        ...[['ftp', 'FTPS'], ['webdav', 'WebDAV'], ['dropbox', 'Dropbox'], ['googledrive', 'Google Drive'], ['onedrive', 'OneDrive']].map(([id = '', title = '']) => ({
            id, title, section: 'destinations', flag: `${id}Enabled`, match: new RegExp(`^${id}`),
            description: `Zusätzliche verschlüsselte Sicherungskopien auf ${title} ablegen.` })),
        { id: 'wake', section: 'destinations', title: 'Speicherziel aufwecken', flag: 'wakeOnLAN', match: /^(wakeOnLAN$|macAd$|wol)/,
            description: 'Wake-on-LAN vor dem Sichern. MAC-Adresse und Wartezeit für das Speicherziel.' },
        { id: 'notifications', section: 'service', title: 'Benachrichtigungen', flag: 'notificationEnabled',
            match: /^(notification|telegram|whatsapp|gotify|signal|matrix|discord|pushover|email)/,
            description: 'Ein Benachrichtigungskanal für Sicherungsläufe. Die Einstellungen anderer Kanäle bleiben gespeichert.' },
        { id: 'limits', section: 'service', title: 'Aufbewahrung und Laufzeit',
            match: /^(jobTimeoutMinutes|maxArchiveGiB|advancedDelete|deleteOldDataBase|debugLevel|ignoreErrors|fileSizeError|fileSizeWarning)$/,
            description: 'Übergreifende Grenzwerte und Protokollierung. Die Aufbewahrung pro Sicherungsteil steht im jeweiligen Dialog.' },
        { id: 'compatibility', section: 'service', title: 'Übernommene Betriebsoptionen',
            match: /^(hostType|slaveInstance|slaveNameSuffix|stopSlaveAfter|restoreSource|restoreTab|startAllRestore|javascriptsEnabled)$/,
            description: 'Bisherige Betriebs- und Wiederherstellungsoptionen. JavaScript-Objekte bleiben immer im ioBroker-Archiv enthalten.' },
        { id: 'other', section: 'service', title: 'Weitere Bestandsoptionen',
            description: 'Zusätzliche gespeicherte Felder bleiben unverändert erhalten und lassen sich hier bei Bedarf bearbeiten.' },
    ];
    /** @type {Record<string,Config>} */ const optional = {
        limits: { jobTimeoutMinutes: 30, maxArchiveGiB: 10 }, local: { mountedBackupPath: '' },
        influx: { influxDBBucketId: '', influxDBOrganization: '', influxDBOrganizationId: '' },
        zigbee2mqtt: { zigbee2mqttProtocol: 'mqtt' }, dropbox: { dropboxAccessTokens: '' }, googledrive: { googledriveAccessJson: '' },
    };
    /** @type {Record<string,string>} */ const names = {
        enabled: 'Backupmodul aktivieren', minimalTime: 'Uhrzeit', minimalEveryXDays: 'Alle … Tage', minimalDeleteAfter: 'Systemsicherungen behalten (Anzahl, 0 = unbegrenzt)',
        minimalNameSuffix: 'Zusatz im Archivnamen', iobrokerCron: 'Eigenen Zeitplan verwenden', iobrokerCronJob: 'Zeitplan als Cron-Ausdruck',
        ccuTime: 'Uhrzeit', ccuEveryXDays: 'Alle … Tage', ccuCron: 'Eigenen CCU-Zeitplan verwenden', ccuCronJob: 'CCU-Zeitplan als Cron-Ausdruck',
        ccuUsehttps: 'HTTPS verwenden', eosIncludeVendorFile: 'Herstellerdatei einschließen', eosIncludeVendorSecret: 'Herstellergeheimnis einschließen',
        jobTimeoutMinutes: 'Maximale Laufzeit (Minuten)', maxArchiveGiB: 'Maximale Archivgröße (GiB)',
        connectType: 'Art des eingebundenen Ziels', mountedBackupPath: 'Absoluter eingebundener Zielordner',
        sdCardMountPath: 'SD-Karte: absoluter Einhängepunkt', sdCardBackupSubDir: 'SD-Karte: Unterordner', sdCardInfluxRetention: 'InfluxDB-Sicherungen auf SD-Karte behalten',
        influxDBName: 'Datenbank / Bucket', influxDBBucketId: 'Bucket-ID (optional)', influxDBOrganization: 'Organisation', influxDBOrganizationId: 'Organisations-ID (optional)',
        influxDBVersion: 'InfluxDB-Version', influxDBType: 'Sicherungsart', redisAOFactive: 'Redis AOF verwenden',
        redisMinimalEnabled: 'Übernommene Redis-Systemoption', mysqlMinimalEnabled: 'Übernommene MySQL-Systemoption',
        mysqlQuick: 'MySQL: Datensätze direkt exportieren', mysqlSingleTransaction: 'MySQL: einzelne Transaktion', mysqlSkipSSL: 'MySQL: SSL auslassen (Betriebsprüfung erforderlich)',
        historyEntriesNumber: 'Einträge im Sicherungsverlauf', notificationEnabled: 'Benachrichtigungen aktivieren', notificationsType: 'Benachrichtigungskanal',
        telegramUser: 'Empfänger / Telegram-Nutzer', emailReceiver: 'Empfängeradresse', emailSender: 'Absenderadresse', discordTarget: 'Nutzer-ID oder Server-ID/Kanal-ID',
        pushoverDeviceID: 'Pushover-Gerät', zigbee2mqttBaseTopic: 'MQTT-Basistopic', zigbee2mqttAuth: 'MQTT-Anmeldung verwenden',
        wakeOnLAN: 'Wake-on-LAN aktivieren', macAd: 'MAC-Adresse des Speicherziels', wolPort: 'Wake-on-LAN-Port', wolWait: 'Wartezeit nach Aufwecken (Sekunden)', wolExtra: 'Zusätzliches Wake-on-LAN',
        advancedDelete: 'Erweiterte Löschregel', deleteOldDataBase: 'Übernommene Datenbank-Löschregel', debugLevel: 'Ausführliches Protokoll', ignoreErrors: 'Fehler ignorieren (Betriebsprüfung erforderlich)',
        fileSizeError: 'Fehlergrenze für Dateigröße', fileSizeWarning: 'Warngrenze für Dateigröße', hostType: 'Bisherige Host-Betriebsart',
        slaveInstance: 'Bisherige Nebeninstanz', slaveNameSuffix: 'Namenszusatz der Nebeninstanz', stopSlaveAfter: 'Nebeninstanz nach Sicherung stoppen',
        restoreSource: 'Bisherige Wiederherstellungsquelle', restoreTab: 'Wiederherstellung anzeigen', startAllRestore: 'Bisherige Gesamtwiederherstellung',
        javascriptsEnabled: 'JavaScript-Bestandsoption (Objekte bleiben im Systemarchiv)', cacheLoose: 'Übernommene Mount-Cacheoption',
        expertMount: 'Übernommener Einbindebefehl', noserverino: 'Übernommene SMB-Inodeoption', smbType: 'Übernommene SMB-Version', sudoMount: 'Übernommene sudo-Mountoption',
    };
    /** @type {Record<string,string>} */ const suffixNames = { Enabled: 'Aktivieren', Host: 'Server / Host', Port: 'Port', User: 'Benutzername', Username: 'Benutzername', Password: 'Kennwort',
        Path: 'Absoluter Quellpfad', DumpExe: 'Exportprogramm (optional)', Name: 'Datenbankname', NameSuffix: 'Zusatz im Archivnamen', DeleteAfter: 'Sicherungen behalten (Anzahl)',
        Multi: 'Mehrere Quellen verwenden', Events: 'Weitere Quellen (JSON-Liste)', Protocol: 'Protokoll', Type: 'Quelltyp', Token: 'Zugriffstoken',
        ApiKey: 'API-Schlüssel', SignedCertificates: 'Zertifikat prüfen', URL: 'HTTPS-Adresse', Secure: 'TLS verwenden', Dir: 'Zielordner', MinimalDir: 'Zielordner für Systemsicherung',
        CcuDir: 'Zielordner für CCU', OwnDir: 'Getrennte Zielordner pro Sicherungstyp', DeleteOldBackup: 'Alte Sicherungen im Ziel entfernen',
        AccessJson: 'Zugangsangaben (JSON)', AccessToken: 'Zugriffstoken', AccessTokens: 'OAuth-Tokens (JSON)', CodeChallenge: 'OAuth Code Challenge',
        TokenType: 'Token-Verfahren', LastTokenRenew: 'Letzte Tokenerneuerung', Instance: 'Adapterinstanz', NoticeType: 'Umfang der Nachricht',
        OnlyError: 'Nur Fehler melden', WaitToSend: 'Verzögerung (Sekunden)', SilentNotice: 'Lautlose Benachrichtigung', Domain: 'Domäne', Mount: 'Übernommener Einhängepunkt' };
    /** @type {Record<string,Array<string|[string,string]>>} */ const choices = {
        connectType: [['Copy', 'Eingebundener Ordner / NAS'], ['SDCard', 'Eingebundene SD-Karte'], ['CIFS', 'Vorab eingebundenes CIFS'], ['NFS', 'Vorab eingebundenes NFS']],
        influxDBVersion: ['1.x', '2.x'], influxDBProtocol: ['http', 'https'], grafanaProtocol: ['http', 'https'],
        redisType: ['local', 'remote'], zigbee2mqttType: ['local', 'remote'], zigbee2mqttProtocol: ['mqtt', 'mqtts'],
        notificationsType: ['Telegram', 'WhatsApp', 'Gotify', 'Signal', 'Matrix', 'Discord', 'Pushover', 'E-Mail'],
    };
    /** @type {Record<string,[number,number]>} */ const numericRanges = {
        minimalEveryXDays: [1, 365], ccuEveryXDays: [1, 365], minimalDeleteAfter: [0, 3650],
        ccuDeleteAfter: [0, 3650], historyEntriesNumber: [0, 3650], jobTimeoutMinutes: [1, 120], maxArchiveGiB: [1, 100],
    };
    /** @param {string} key @returns {Group} */
    function groupFor(key) { return groups.find(group => group.match?.test(key)) || /** @type {Group} */ (groups.find(group => group.id === 'other')); }
    /** @param {string} key @param {Group} group @returns {string} */
    function fieldName(key, group) {
        if (names[key]) return names[key];
        const prefix = Object.values(channelPrefixes).find(value => key.startsWith(value)) ||
            ['zigbee2mqtt', 'googledrive', 'influxDB', 'dropbox', 'onedrive', 'webdav', 'history', 'grafana', 'mySql', 'mysql', 'pgSql', 'sqlite', 'redis', 'cifs', 'ccu', 'ftp', 'eos'].find(value => key.startsWith(value));
        const suffix = prefix ? key.slice(prefix.length) : key;
        return suffixNames[suffix] || (key === group.flag ? `${group.title} aktivieren` : key);
    }
    /** @param {Group} group @param {Config} value */
    function keysFor(group, value) {
        return [...new Set([...Object.keys(value).filter(key => key !== 'enabled' && groupFor(key).id === group.id), ...Object.keys(optional[group.id] || {})])];
    }
    /** @type {Record<string,string[]>} */ const fieldOrder = {
        system: ['minimalEnabled', 'minimalTime', 'minimalEveryXDays', 'minimalDeleteAfter', 'minimalNameSuffix', 'iobrokerCron', 'iobrokerCronJob'],
        ccu: ['ccuEnabled', 'ccuHost', 'ccuUsehttps', 'ccuSignedCertificates', 'ccuUser', 'ccuPassword', 'ccuTime', 'ccuEveryXDays',
            'ccuDeleteAfter', 'ccuNameSuffix', 'ccuMulti', 'ccuEvents', 'ccuCron', 'ccuCronJob'],
        local: ['cifsEnabled', 'connectType', 'mountedBackupPath', 'sdCardMountPath', 'sdCardBackupSubDir', 'sdCardInfluxRetention',
            'cifsOwnDir', 'cifsMinimalDir', 'cifsCcuDir', 'cifsDir', 'cifsDeleteOldBackup', 'cifsUser', 'cifsPassword', 'cifsDomain',
            'cifsMount', 'smbType', 'noserverino', 'cacheLoose', 'sudoMount', 'expertMount'],
    };
    /** @param {string} key @param {Group} group */
    function fieldPriority(key, group) {
        const ordered = fieldOrder[group.id]?.indexOf(key) ?? -1;
        if (ordered >= 0) return ordered;
        if (key === group.flag) return 0;
        if (key === 'notificationsType') return 1;
        if (/(?:Type|Version|Protocol)$/.test(key)) return 2;
        if (/(?:Host|URL|Instance)$/.test(key)) return 3;
        if (/Port$/.test(key)) return 4;
        if (/(?:Name|BucketId|Organization|OrganizationId|Path|Dir)$/.test(key)) return 5;
        if (/(?:User|Username)$/.test(key)) return 6;
        if (/(?:Password|Token|Tokens|AccessJson|ApiKey)$/.test(key)) return 7;
        if (/(?:DeleteAfter|DeleteOldBackup)$/.test(key)) return 9;
        if (/(?:Multi|Events|DumpExe)$/.test(key)) return 10;
        return 8;
    }
    function changed() { return JSON.stringify(config) !== JSON.stringify(savedConfig); }
    function draftStatus() {
        byId('draft-status').textContent = !loaded ? 'Einstellungen werden geladen …' : changed() ? 'Noch nicht gespeichert – Änderungen gelten erst nach dem Speichern.' : 'Gespeicherte Einstellungen';
        byId('draft-status').classList.toggle('is-dirty', changed());
        buttonById('saveSettings').disabled = busy || !loaded || !!dialogGroup;
        inputById('enabled').disabled = busy || !loaded;
        byId('backup-sections').querySelectorAll('button').forEach(node => { node.disabled = busy || !loaded; });
    }
    function renderSettings() {
        const root = byId('backup-sections'); root.replaceChildren();
        for (const [section, title, description] of sections) {
            const block = document.createElement('section'); block.className = 'backup-setting-section';
            const heading = document.createElement('h3'); heading.textContent = title;
            const help = document.createElement('p'); help.className = 'backup-setting-help'; help.textContent = description;
            const cards = document.createElement('div'); cards.className = 'backup-cards';
            for (const group of groups.filter(item => item.section === section)) {
                if (!keysFor(group, config).length) continue;
                const card = document.createElement('article'); card.className = 'backup-card'; card.dataset.group = group.id;
                const open = document.createElement('button'); open.type = 'button'; open.className = 'backup-card-title';
                open.id = `backup-open-${group.id}`; open.textContent = group.title;
                open.setAttribute('aria-haspopup', 'dialog'); open.addEventListener('click', () => openSettings(group, open));
                const note = document.createElement('p'); note.textContent = group.description;
                const dirty = document.createElement('span'); dirty.className = 'backup-card-draft'; dirty.textContent = 'Noch nicht gespeichert';
                const updateDraft = () => { dirty.hidden = !keysFor(group, config).some(key => JSON.stringify(config[key]) !== JSON.stringify(savedConfig[key])); };
                updateDraft();
                const actions = document.createElement('div'); actions.className = 'backup-card-actions';
                const flag = group.flag;
                if (flag && Object.hasOwn(config, flag)) {
                    const toggle = document.createElement('button'); toggle.type = 'button'; toggle.className = 'backup-toggle';
                    toggle.dataset.toggle = flag; toggle.textContent = config[flag] === true ? 'An' : 'Aus';
                    toggle.setAttribute('aria-label', `${group.title}: ${toggle.textContent}`);
                    toggle.setAttribute('aria-pressed', String(config[flag] === true)); toggle.disabled = busy;
                    toggle.addEventListener('click', () => {
                        if (busy) return;
                        config[flag] = config[flag] !== true;
                        toggle.textContent = config[flag] ? 'An' : 'Aus';
                        toggle.setAttribute('aria-pressed', String(config[flag]));
                        toggle.setAttribute('aria-label', `${group.title}: ${toggle.textContent}`); updateDraft(); draftStatus();
                    }); actions.append(toggle);
                }
                const edit = document.createElement('button'); edit.type = 'button'; edit.textContent = 'Einstellungen';
                edit.setAttribute('aria-label', `${group.title}: Einstellungen`); edit.setAttribute('aria-haspopup', 'dialog');
                edit.addEventListener('click', () => openSettings(group, edit)); actions.append(edit);
                card.append(open, note, actions, dirty); cards.append(card);
            }
            if (cards.children.length) { block.append(heading, help, cards); root.append(block); }
        }
        inputById('enabled').checked = config.enabled === true; draftStatus();
    }
    /** @returns {Config} */
    function readDialogFields() {
        if (!dialogDraft || !dialogGroup) throw new Error('Kein Einstellungsdialog geöffnet.');
        const next = structuredClone(dialogDraft);
        for (const node of byId('dialog-fields').querySelectorAll('[data-config]')) {
            const input = /** @type {HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement} */ (node);
            const key = input.dataset.config; if (!key) continue;
            let value;
            if (input.dataset.secret === 'true' && !input.value && input.dataset.clearSecret !== 'true') value = SECRET;
            else if (input.dataset.json === 'true') {
                try { value = JSON.parse(input.value); } catch { throw new Error(`${fieldName(key, dialogGroup)}: Bitte gültiges JSON eingeben.`); }
            } else if (input instanceof HTMLInputElement && input.type === 'checkbox') value = input.checked;
            else if (input.dataset.number === 'true') {
                if (input.value.trim() === '' || !Number.isFinite(Number(input.value))) throw new Error(`${fieldName(key, dialogGroup)}: Bitte eine Zahl eingeben.`);
                value = Number(input.value);
            } else value = input.value;
            if (input.dataset.present !== 'false' || JSON.stringify(value) !== input.dataset.original) next[key] = value;
        }
        return next;
    }
    function dialogFields() {
        if (!dialogGroup || !dialogDraft) return;
        const root = byId('dialog-fields'); root.replaceChildren();
        const group = dialogGroup;
        let keys = keysFor(group, dialogDraft).sort((a, b) => fieldPriority(a, group) - fieldPriority(b, group));
        if (group.id === 'notifications') {
            const channel = channelPrefixes[String(dialogDraft.notificationsType)];
            keys = keys.filter(key => key === 'notificationEnabled' || key === 'notificationsType' || (channel && key.startsWith(channel)));
        }
        for (const key of keys) {
            const value = (Object.hasOwn(dialogDraft, key) ? dialogDraft[key] : optional[group.id]?.[key]) ?? null;
            const label = document.createElement('label'); label.textContent = fieldName(key, group);
            let input;
            const optionsForKey = choices[key];
            if (optionsForKey) {
                input = document.createElement('select');
                const options = optionsForKey.map(item => Array.isArray(item) ? item : /** @type {[string,string]} */ ([item, item]));
                if (!options.some(([item]) => item === value)) options.push([String(value ?? ''), String(value ?? '')]);
                for (const [item, text] of options) { const option = document.createElement('option'); option.value = item; option.textContent = text; input.append(option); }
                input.value = String(value ?? '');
            } else if (typeof value === 'boolean') {
                input = document.createElement('input'); input.type = 'checkbox'; input.checked = value;
            } else if (typeof value === 'object') {
                input = document.createElement('textarea'); input.rows = 5; input.value = JSON.stringify(value, null, 2); input.dataset.json = 'true'; label.className = 'backup-wide';
            } else {
                input = document.createElement('input');
                input.type = typeof value === 'number' ? 'number' : value === SECRET || /password|token|secret|accessjson|apikey/i.test(key) ? 'password' : /^(minimalTime|ccuTime)$/.test(key) ? 'time' : 'text';
                input.value = value === SECRET ? '' : String(value ?? ''); input.autocomplete = 'off';
                if (typeof value === 'number') input.dataset.number = 'true';
                const range = numericRanges[key];
                if (range && input.type === 'number') { input.min = String(range[0]); input.max = String(range[1]); input.step = '1'; input.required = true; }
                if (value === SECRET) { input.dataset.secret = 'true'; input.placeholder = 'Gespeichert – leer lassen zum Beibehalten'; }
            }
            input.id = `field-${key}`; input.dataset.config = key; input.dataset.present = String(Object.hasOwn(dialogDraft, key));
            input.dataset.original = JSON.stringify(value); label.htmlFor = input.id; label.append(input);
            if (value === SECRET) {
                const clear = document.createElement('button'); clear.type = 'button'; clear.textContent = 'Gespeicherten Wert löschen';
                clear.className = 'backup-secret-clear'; clear.addEventListener('click', () => { input.value = ''; input.dataset.clearSecret = 'true'; if ('placeholder' in input) input.placeholder = 'Wird beim Speichern gelöscht'; clear.disabled = true; }); label.append(clear);
            }
            if (key === 'sdCardMountPath') {
                const list = document.createElement('datalist'); list.id = 'sdTargets'; input.setAttribute('list', list.id);
                const scan = document.createElement('button'); scan.type = 'button'; scan.id = 'scanSd'; scan.textContent = 'SD-Karten suchen';
                scan.addEventListener('click', scanSd); label.append(list, scan);
            }
            if (key === 'notificationsType') input.addEventListener('change', () => {
                try { dialogDraft = readDialogFields(); dialogFields(); byId('field-notificationsType').focus(); }
                catch (error) { byId('dialog-message').textContent = errorText(error); }
            });
            root.append(label);
        }
    }
    /** @param {Group} group @param {HTMLElement} opener */
    function openSettings(group, opener) {
        if (busy || !loaded || dialogGroup) return;
        dialogDraft = structuredClone(config); dialogGroup = group; dialogOpener = opener;
        byId('dialog-title').textContent = group.title; byId('dialog-description').textContent = `${group.description} „In Entwurf übernehmen“ speichert noch nicht auf dem Gerät.`;
        byId('dialog-message').textContent = ''; dialogFields(); dialog().showModal(); draftStatus();
    }
    function closeSettings() { dialog().close(); }
    async function scanSd() {
        const group = dialogGroup, button = buttonById('scanSd');
        if (button.disabled) return; button.disabled = true;
        try {
            /** @type {Array<{mountPoint:string,label:string}>} */ const values = await command('getSdCardTargets');
            if (dialogGroup !== group || !dialog().open || !document.getElementById('sdTargets')) return;
            const list = byId('sdTargets'); list.replaceChildren();
            for (const value of values) { const option = document.createElement('option'); option.value = value.mountPoint; option.textContent = value.label; list.append(option); }
            byId('dialog-message').textContent = values.length ? 'Gefundene Einhängepunkte stehen im SD-Kartenfeld zur Auswahl.' : 'Keine passende eingebundene SD-Karte gefunden.';
        } catch (error) { if (dialogGroup === group) byId('dialog-message').textContent = errorText(error); }
        finally { button.disabled = false; }
    }
    /** @param {Remote} remote */
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
    /** @param {View} view */
    function render(view) {
        byId('status').textContent =
            (view.status?.active ? 'Backupmodul läuft' : view.status?.reason || 'Backupmodul nicht aktiv') +
            (view.status?.details?.current ? ' · Sicherung läuft' : '');
        const coverage = view.status?.details?.coverage || lastCoverage;
        if (coverage) lastCoverage = coverage;
        /** @type {Record<string,string>} */ const coverageLabels = {
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
        if (latestRemote?.remote) {
            renderEntries(latestRemote.remote);
            if ((latestRemote.remote.entries || []).length === 50) {
                const all = document.createElement('button');
                all.textContent = 'Alle gefundenen Sicherungen anzeigen';
                all.addEventListener('click', () =>
                    task(async () => {
                        /** @type {{job:Job}} */ const { job } = await command('list', { jobId: latestRemote.id });
                        if (job.remote) renderEntries(job.remote);
                    }),
                );
                byId('remoteEntries').append(all);
            }
        }
        clearTimeout(poll);
        if (view.status?.details?.current)
            poll = setTimeout(() => {
                void load(false).catch(e => message(errorText(e), true));
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
                        /** @type {{message:string,command:string[]}} */ const plan = await command('restorePlan', { name: file.name });
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
                        /** @type {{job:Job}} */ const full = await command('list', { jobId: job.id });
                        render({ status: { active: true, details: { history: [full.job] } } });
                    }),
                );
                div.append(all);
            }
            root.append(div);
        }
    }
    async function load(replace = false) {
        /** @type {View} */ const v = await request('');
        csrf = v.csrfToken || csrf;
        if (replace) {
            config = structuredClone(v.config || {});
            savedConfig = structuredClone(config); loaded = true;
            configurationRevision = typeof v.configurationRevision === 'string' ? v.configurationRevision : '';
            renderSettings();
        }
        render(v);
    }
    /** @param {()=>Promise<unknown>} fn */
    async function task(fn) {
        if (busy) return;
        busy = true; draftStatus();
        try {
            await fn();
        } catch (e) {
            message(errorText(e), true);
        } finally {
            busy = false; draftStatus();
        }
    }
    async function save() {
        if (!loaded || dialogGroup) return;
        const next = structuredClone(config);
        /** @type {View} */ const v = await request('', 'PUT', { config: next, expectedConfigurationRevision: configurationRevision });
        config = structuredClone(v.config || next); savedConfig = structuredClone(config);
        configurationRevision = typeof v.configurationRevision === 'string' ? v.configurationRevision : configurationRevision;
        csrf = v.csrfToken || csrf; renderSettings(); render(v); message('Einstellungen gespeichert.');
    }
    byId('settings').addEventListener('submit', e => { e.preventDefault(); void task(save); });
    inputById('enabled').addEventListener('change', () => { if (!busy && loaded) { config.enabled = inputById('enabled').checked; draftStatus(); } });
    byId('dialog-form').addEventListener('submit', e => {
        e.preventDefault();
        try { config = readDialogFields(); closeSettings(); renderSettings(); }
        catch (error) { byId('dialog-message').textContent = errorText(error); }
    });
    byId('dialog-cancel').addEventListener('click', closeSettings);
    byId('dialog-close').addEventListener('click', closeSettings);
    byId('settingsDialog').addEventListener('close', () => {
        const focus = dialogOpener; const groupId = dialogGroup?.id;
        dialogDraft = null; dialogGroup = null; dialogOpener = null; byId('dialog-fields').replaceChildren(); draftStatus();
        if (focus?.isConnected) focus.focus();
        else if (groupId) document.getElementById(`backup-open-${groupId}`)?.focus();
    });
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
            const provider = (/** @type {HTMLSelectElement} */ (byId('remoteProvider'))).value;
            await command(provider === 'legacy' ? 'legacyList' : 'remoteList', {
                provider,
                kind: (/** @type {HTMLSelectElement} */ (byId('remoteKind'))).value,
            });
            message('Sicherungen werden gesucht.');
            await load(false);
        }),
    );
    byId('key').addEventListener('click', () =>
        task(async () => {
            /** @type {{filename:string,content:string}} */ const v = await command('exportRecoveryKey', { confirm: true });
            download(v.filename, v.content);
            message('Wiederherstellungsschlüssel heruntergeladen. Getrennt und geschützt aufbewahren.');
        }),
    );
    window.addEventListener('pagehide', () => clearTimeout(poll));
    void task(() => load(true));
})();
