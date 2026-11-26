/* Copyright (c) 2026 NexoWatt. Confidential and proprietary. */
// @ts-check
'use strict';
/**
 * Device commissioning UI: presentation only. The authenticated server validates
 * intent, resolves actual alias objects and owns all configuration changes.
 */
(() => {
    /** @typedef {{requested: boolean, requestId?: string, limits?: Record<string, string | number>}} Activation */
    /** @typedef {{mode: string, scope?: string, flowSlot?: number, group?: string, activation?: Activation}} Intent */
    /** @typedef {{deviceId?: string, devId?: string, status?: string, code?: string, target?: string, missing?: unknown[], optionalMissing?: unknown[], corrections?: unknown[], activationApplied?: boolean, activationRequestId?: string}} Row */
    /** @type {Readonly<Record<string, string>>} */
    const labels = Object.freeze({
        auto: 'Automatisch nach Geräteprofil', monitor: 'Nur Messwerte · verwaltete Steuereinträge deaktivieren',
        manual: 'Manuell im App-Center zuordnen', singleStorage: 'Einzelspeicher', storageFarm: 'Speicherfarm-Mitglied',
        gridMeter: 'Regelpunkt NVP · Netzanschlusszähler', generationMeter: 'Erzeugungszähler', consumptionMeter: 'Verbrauchszähler',
        pvInverter: 'PV-Wechselrichter / Erzeugungsanlage',
    });
    /** @type {Readonly<Record<string, string>>} */
    const messages = Object.freeze({
        COMMISSIONING_REQUIRED: 'Zugeordnet · im Gerätefenster EMS-Verwendung und Grenzen festlegen und gemeinsam übernehmen.',
        ACTIVATION_APPLIED: 'EMS-Einrichtung übernommen und App freigegeben. Die Regelung wartet auf gültige Messwerte und bestehende Schutzfreigaben.',
        ACTIVATION_PENDING: 'Zuordnung vorbereitet · fehlende Einrichtung im Gerätefenster ergänzen.',
        ACTIVATION_DISABLED: 'EMS-Verwendung deaktiviert. Zuordnungen und Grenzen bleiben gespeichert.',
        APP_DISABLED: 'App wurde deaktiviert. Bestehende Freigabe wird nicht automatisch wiederholt.',
        ACTIVATION_REQUEST_CHANGED: 'Einrichtungsauftrag verändert. Gerät erneut prüfen und ausdrücklich übernehmen.',
        ACTIVATION_PROFILE_CHANGED: 'Geräteprofil geändert · bisherige verwaltete Regelung bleibt inaktiv. Im Gerätefenster erneut ausdrücklich übernehmen.',
        MAPPED: 'Zuordnung gespeichert. Die bestehende Betriebsfreigabe bleibt erhalten.',
        MEASUREMENT_MAPPED: 'Messdatenpunkte zugeordnet; vorhandene App-Freigaben bleiben unverändert.',
        MAPPING_INCOMPLETE: 'Teilweise zugeordnet · die unten genannten Gerätefunktionen oder Einstellungen fehlen.',
        MIRA_METER_PENDING: 'Für die Regelung ein eindeutiges Wärmepumpenmodul mit elektrischer Leistung zuordnen. Kaskaden können als einzelne Verbraucher angezeigt werden.',
        MIRA_FLOW_FULL: 'Alle zehn sichtbaren Verbraucherplätze sind belegt. Eine bestehende Zuordnung im App-Center prüfen.',
        MIRA_METER_ADDRESS: 'Busadresse des Wärmepumpenmoduls fehlt oder ist mehrfach eingerichtet.',
        MIRA_MAPPING_REMOVED: 'Die frühere MIRA-Zuordnung wurde im App-Center geändert. Vorhandene Zuordnung prüfen.',
        NEEDS_SELECTION: 'Funktion und Ziel im Gerätefenster auswählen.',
        MANUAL_TOPOLOGY_REQUIRED: 'Zuordnung für diese Anlagentopologie im App-Center prüfen.',
        MISSING_ALIASES: 'Erforderliche Geräte-Datenpunkte fehlen noch.',
        ALIASES_PENDING: 'Geräte-Datenpunkte werden vorbereitet.',
        ALIASES_UNAVAILABLE: 'Geräte-Datenpunkte sind noch nicht verfügbar.',
        DEVICE_DISABLED: 'Gerät deaktiviert · automatisch verwaltete Steuereinträge deaktiviert; Zuordnungen und Grenzen bleiben erhalten.',
        DEVICE_REMOVED: 'Gerät entfernt · automatisch verwaltete Steuereinträge deaktiviert; manuelle Einträge im App-Center prüfen.',
        MANUAL_MAPPING_PRESERVED: 'Ziel bereits belegt · vorhandene Zuordnung bleibt erhalten. Im App-Center abgleichen.',
        MAPPING_REMOVED: 'Ladepunkt wurde im App-Center entfernt. Für eine erneute Zuordnung im Gerätefenster die EMS-Einrichtung ausdrücklich neu übernehmen.',
        MAPPING_CONFLICT: 'Ziel bereits belegt · Zuordnung im App-Center prüfen.',
        DUPLICATE_CONTROL_TARGET: 'Steuerziel bereits zugeordnet · Konflikt prüfen.',
        CONTROL_TARGET_ALREADY_ASSIGNED: 'Steuerziel bereits zugeordnet · vorhandene Regelzuständigkeit prüfen.',
        STORAGE_CONTROLLER_ALREADY_ASSIGNED: 'Speicher bereits einer anderen Regelung zugeordnet · Einzelregelung und Farm abgleichen.',
        DUPLICATE_DEVICE_MAPPING: 'Gerät mehrfach zugeordnet · vorhandene Einträge im App-Center prüfen.',
        MIXED_MANUAL_MAPPING: 'Vorhandene manuelle Zuordnung bleibt erhalten · Datenpunkte im App-Center abgleichen.',
        MEASUREMENT_ALREADY_ASSIGNED: 'Messwert bereits im Energiefluss zugeordnet · Doppelzählung vermeiden.',
        LICENSE_LIMIT: 'Grenze der Systemlizenz erreicht · Lizenzumfang und vorhandene Einträge prüfen.',
        MANUAL_MAPPING: 'Datenpunkte im App-Center manuell zuordnen. Bestehende Betriebsfreigaben bleiben unverändert.',
        MONITOR_ONLY: 'Nur Messwerte · automatisch verwaltete Steuereinträge deaktiviert; Zuordnungen und Grenzen bleiben erhalten. Manuelle Einträge prüfen.',
        DEVICE_ROLE_MISMATCH: 'Gewählte EMS-Funktion passt nicht zum Geräteprofil · Auswahl prüfen.',
        UNSUPPORTED_DEVICE: 'Für dieses Profil bitte im App-Center zuordnen.',
        EMS_UI_PENDING: 'EMS startet · automatische Zuordnung folgt.',
    });
    /** @type {Readonly<Record<string, string>>} */
    const missingLabels = Object.freeze({
        miraSources: 'Bestätigung der Quellenwahl am MIRA-Hydraulikmodul', powerId: 'Leistungsmesswert', 'r.power': 'Leistungsmesswert',
        'setCurrentAId|setPowerWId': 'Strom- oder Leistungssollwert',
        'onlineId|heartbeatId': 'Verbindungsstatus', socId: 'Ladezustand', socObjectId: 'Ladezustand',
        signedPowerId: 'Speicherleistung', batteryPowerObjectId: 'Speicherleistung',
        gridPointPower: 'Leistungsmesswert am gewählten Netzanschluss', otherUncommissionedController: 'Inbetriebnahme weiterer Einträge derselben App; eine gemeinsame App-Freigabe würde diese ebenfalls starten', otherStorageController: 'eindeutige Regelzuständigkeit für diesen Speicher', deviceRow: 'Gerätezuordnung im EMS', storageControl: 'Speichersollwert', scope: 'Messpunkt M0/M1', maxChargeW: 'maximale Ladeleistung (W)', maxDischargeW: 'maximale Entladeleistung (W)', capacityKWh: 'Speicherkapazität (kWh)', coupling: 'Speicher-Anbindung AC/DC', chargerType: 'Ladeart AC/DC', phases: 'Phasenanzahl', minCurrentA: 'minimaler Ladestrom (A)', maxCurrentA: 'maximaler Ladestrom (A)', minPowerW: 'minimale Ladeleistung (W)', maxPowerW: 'maximale Ladeleistung (W)', flowSlot: 'Ziel im Energiefluss',
    });
    /** @type {Readonly<Record<string, string>>} */
    const profileLabels = Object.freeze({
        feneconActualSetpoint: 'Rückmeldung des tatsächlich angewendeten Sollwerts',
        actualSetpoint: 'Rückmeldung des tatsächlich angewendeten Sollwerts',
        feneconEssActualPower: 'Speicher-Istleistung', feneconNvpPower: 'Netzanschlussleistung',
        feneconConsumptionTotal: 'Gesamtverbrauch', feneconMinPower: 'untere Leistungsgrenze des Geräts',
        feneconMaxPower: 'obere Leistungsgrenze des Geräts', feneconPvDc: 'PV-Leistung DC',
        feneconPvAc: 'PV-Leistung AC', feneconPvTotal: 'PV-Gesamtleistung',
        feneconGridSetpoint: 'netzbezogener Sollwert', dcPvPower: 'PV-Leistung DC', acPvPower: 'PV-Leistung AC',
        pvPower: 'PV-/WR-Messleistung', targetPower: 'Leistungssollwert',
        'r.pvPowerDc': 'PV-Leistung DC', 'r.pvPowerAc': 'PV-Leistung AC', 'r.pvPowerTotal': 'PV-Gesamtleistung',
        'r.soc': 'Ladezustand', 'r.online': 'Verbindungsstatus', 'ctrl.powerSetpointW': 'Leistungssollwert',
        'vendorProfile:fenecon-openems': 'passendes Speicher-Regelprofil',
    });
    /** Fehlende Profilfelder sind herstellerunabhängig verständlich; unbekannte
     * optionale Felder werden gezählt und nicht fälschlich als vollständig ausgegeben.
     * @param {unknown[] | undefined} fields @param {boolean} optional @returns {string[]} */
    function fieldLabels(fields, optional) {
        /** @type {Set<string>} */
        const result = new Set();
        let other = 0;
        for (const field of (Array.isArray(fields) ? fields.slice(0, 12) : [])) {
            if (typeof field !== 'string') continue;
            if (field.startsWith('invalid:')) { result.add('ungültige Datenpunkt-Zuordnung: Eine Zahl ersetzt keinen Datenpunkt'); continue; }
            if (field === 'review:feneconGridSetpointId' || field === 'review:feneconGridSetpointObjectId') {
                result.add('Regelungsart vor Zuordnung des Netz-Sollwerts im App-Center ausdrücklich prüfen; bisherige Direktregelung bleibt erhalten'); continue;
            }
            if (field.startsWith('license:')) { result.add('passende App-Freigabe der Systemlizenz'); continue; }
            const readable = field.replace(/^(?:activation(?:\.limits)?|limits|limit|reference)[.:]/, '');
            if (Object.hasOwn(missingLabels, readable)) { result.add(Reflect.get(missingLabels, readable)); continue; }
            const base = readable.replace(/(?:ObjectId|Id)$/, '');
            const label = Object.hasOwn(missingLabels, readable) ? Reflect.get(missingLabels, readable)
                : Object.hasOwn(profileLabels, readable) ? Reflect.get(profileLabels, readable)
                    : Object.hasOwn(profileLabels, base) ? Reflect.get(profileLabels, base) : '';
            if (typeof label === 'string' && label) result.add(label); else other++;
        }
        if (other) result.add(`${other} weitere ${optional ? 'profilabhängige' : 'erforderliche'} Datenpunkt-Zuordnung(en)`);
        return [...result];
    }
    /** @type {Map<string, Row>} */
    const rows = new Map();
    /** @type {Set<string>} */
    const expected = new Set();
    /** @type {Map<string, string>} */
    const expectedRequests = new Map();
    /** @type {Map<unknown, {signature: string, requestId: string}>} */
    const preparedRequests = new Map();
    /** @type {Set<string>} */
    const renewals = new Set();
    let serviceState = 'unknown';
    let serviceCode = '';
    const serviceMessages = new Map([
        ['EOS_EMS_CONFIGURATION_PENDING', 'EMS-Zuordnung wird vorbereitet.'],
        ['EOS_EMS_RUNTIME_STARTING', 'EMS startet noch; Zuordnung wird automatisch fortgesetzt.'],
        ['EOS_EMS_BRIDGE_UNAVAILABLE', 'EMS-Verbindung nicht verfügbar. EOS-Protokoll prüfen; gespeicherte Geräte bleiben erhalten.'],
        ['EOS_EMS_BINDING_MISSING', 'EMS-Verbindung fehlt. EOS-Protokoll prüfen; gespeicherte Geräte bleiben erhalten.'],
        ['EOS_EMS_RUNTIME_UNAVAILABLE', 'EMS ist derzeit nicht erreichbar. EOS-Protokoll prüfen.'],
    ]);
    /** @param {unknown} value @returns {value is Record<string, unknown>} */
    const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
    /** @param {unknown} category */
    function modes(category) {
        const key = typeof category === 'string' ? category.toUpperCase() : '';
        /** @type {string[]} */
        let specific = [];
        if (['ESS', 'BATTERY', 'BATTERY_INVERTER', 'STORAGE', 'STORAGE_SYSTEM'].includes(key)) specific = ['singleStorage', 'storageFarm'];
        else if (['METER', 'GRID_METER', 'POWER_METER'].includes(key)) specific = ['gridMeter', 'generationMeter', 'consumptionMeter'];
        else if (key === 'PV_INVERTER') specific = ['pvInverter'];
        return ['auto', ...specific, 'monitor', 'manual'].map(value => ({ value, label: Reflect.get(labels, value) || value }));
    }
    /** @param {unknown} value @returns {Intent} */
    function intent(value) {
        const input = record(value) ? value : {};
        const mode = typeof input.mode === 'string' && Object.hasOwn(labels, input.mode) ? input.mode : 'auto';
        /** @type {Intent} */
        const result = { mode };
        if (input.scope === 'M0' || input.scope === 'M1') result.scope = input.scope;
        if (typeof input.flowSlot === 'number' && Number.isInteger(input.flowSlot)) result.flowSlot = input.flowSlot;
        if (typeof input.group === 'string') result.group = input.group;
        if (record(input.activation) && typeof input.activation.requested === 'boolean') {
            result.activation = { requested: input.activation.requested };
            if (typeof input.activation.requestId === 'string') result.activation.requestId = input.activation.requestId;
            if (record(input.activation.limits)) result.activation.limits = /** @type {Record<string, string | number>} */ ({ ...input.activation.limits });
        }
        return result;
    }
    /** Ein ausdrückliches Übernehmen erzeugt genau einen Auftrag je geänderter
     * EMS-Einrichtung. Unberührte, bereits verbrauchte Aufträge werden nie erneuert.
     * @param {unknown} devices @param {unknown} originals @returns {unknown[]} */
    function prepareSave(devices, originals) {
        if (!Array.isArray(devices)) return [];
        const previous = new Map((Array.isArray(originals) ? originals : []).filter(record).map(device => [device.id, device]));
        return devices.map(candidate => {
            if (!record(candidate)) return candidate;
            const device = { ...candidate };
            const value = intent(candidate.ems);
            if (!record(candidate.ems)) return device;
            const isRole = ['singleStorage', 'storageFarm', 'gridMeter', 'generationMeter', 'consumptionMeter', 'pvInverter'].includes(value.mode)
                || (value.mode === 'auto' && candidate.templateId === 'heat.ovum.mira.hsm' && !!value.activation)
                || (value.mode === 'auto' && ['EVCS', 'EVSE'].includes(String(candidate.category || '').toUpperCase()));
            if (!isRole || candidate.enabled === false) return device;
            const old = previous.get(candidate.id);
            const oldIntent = intent(old?.ems);
            const comparable = (/** @type {Intent} */ item) => JSON.stringify({ mode: item.mode, scope: item.scope, flowSlot: item.flowSlot,
                group: item.group, requested: item.activation?.requested, limits: item.activation?.limits || {} });
            const bindingChanged = value.activation?.requested !== false && (candidate.templateId !== old?.templateId || candidate.category !== old?.category);
            const changed = !value.activation?.requestId || comparable(value) !== comparable(oldIntent) || bindingChanged || renewals.has(String(candidate.id));
            if (changed) {
                const signature = JSON.stringify({ intent: comparable(value), templateId: candidate.templateId, category: candidate.category });
                const cached = preparedRequests.get(candidate.id);
                const requestId = cached?.signature === signature ? cached.requestId : crypto.randomUUID();
                preparedRequests.set(candidate.id, { signature, requestId });
                value.activation = { requested: value.activation?.requested !== false, requestId, limits: value.activation?.limits || {} };
            }
            device.ems = value;
            return device;
        });
    }
    /** Nur eine echte Nutzereingabe darf eine verbrauchte Freigabe erneuern. @param {string} id */
    function requestRenewal(id) { renewals.add(id); preparedRequests.delete(id); }
    /** @param {unknown} devices */
    function setDevices(devices) {
        expected.clear();
        expectedRequests.clear();
        preparedRequests.clear();
        renewals.clear();
        if (Array.isArray(devices)) for (const item of devices) {
            if (record(item) && typeof item.id === 'string') {
                expected.add(item.id);
                const request = intent(item.ems).activation?.requestId;
                if (request && item.enabled !== false && !['monitor', 'manual'].includes(intent(item.ems).mode)) expectedRequests.set(item.id, request);
            }
        }
    }
    /** @param {string} id */
    function staleSuccess(id) {
        const row = rows.get(id);
        return expectedRequests.has(id) && row?.activationRequestId !== expectedRequests.get(id)
            && ['ACTIVATION_APPLIED', 'MAPPED', 'MEASUREMENT_MAPPED', 'COMMISSIONING_REQUIRED'].includes(row?.code || '');
    }
    function needsPolling() {
        return serviceState === 'unknown' || serviceState === 'pending' || (serviceState === 'ready' && [...expected].some(id => !rows.has(id) || staleSuccess(id)));
    }
    /** Ausschließlich explizite Rollen und Zugriffsdeskriptoren des geladenen Profils.
     * Kein Geräteklassen-Raten und keine Aussage über Hardwarefreigabe oder Alias-Verfügbarkeit.
     * @param {unknown} template @returns {string[]} */
    function capabilities(template) {
        if (!record(template) || !Array.isArray(template.datapoints)) return [];
        const found = new Set();
        for (const dp of template.datapoints.slice(0, 4096)) {
            if (!record(dp) || !record(dp.source) || typeof dp.source.kind !== 'string') continue;
            const read = ['ro', 'rw'].includes(String(dp.rw));
            const write = ['wo', 'rw'].includes(String(dp.rw));
            if (read && dp.type === 'number') {
                if (dp.role === 'value.power') found.add('Leistungsmessung');
                if (dp.role === 'value.battery' && dp.unit === '%') found.add('Ladezustand');
                if (['value.energy', 'value.energy.consumed', 'value.energy.produced'].includes(String(dp.role))) found.add('Energiemessung');
                if (dp.role === 'value.temperature') found.add('Temperatur');
            }
            if (read && ['indicator.connected', 'indicator.status', 'info.status'].includes(String(dp.role))) found.add('Gerätestatus');
            if (write && dp.type === 'number' && record(dp.source.write)) {
                if (dp.role === 'level.power') found.add('Leistungsvorgabe');
                if (dp.role === 'level.current') found.add('Stromvorgabe');
            }
            if (write) found.add('Schreibdatenpunkte');
        }
        return [...found];
    }
    /** @param {string} mode */
    function targets(mode) {
        if (mode === 'consumptionMeter') return Array.from({ length: 10 }, (_, index) => ({ value: index + 1, label: `Verbraucher ${index + 1}` }));
        if (['generationMeter', 'pvInverter'].includes(mode)) return Array.from({ length: 6 }, (_, index) => ({ value: index, label: index === 0 ? 'PV-Hauptanlage' : `Weitere Erzeugungsanlage ${index}` }));
        return [];
    }
    /** @param {string} category @param {string} mode @param {string} scope */
    function help(category, mode, scope) {
        if (scope === 'M1' && ['singleStorage', 'storageFarm'].includes(mode)) return 'M1-Speicher: Die Regelung muss im App-Center für die Anlagentopologie geprüft werden; hier erfolgt keine automatische Steuerfreigabe.';
        if (mode === 'singleStorage') return 'Einzelspeicher: Passende Mess- und Steuerdatenpunkte werden vorbelegt. Bestehende Zuordnungen und Leistungsgrenzen bleiben erhalten.';
        if (mode === 'storageFarm') return 'Zuordnung zur vorhandenen Speicherfarm. Der Speicher darf nicht gleichzeitig durch die Einzelregelung gesteuert werden.';
        if (mode === 'gridMeter') return 'Messpunkt bewusst auswählen: M0 = Hauptanschluss, M1 = Unteranlage. EOS ergänzt die zugehörigen Messdatenpunkte; mit EMS-Verwendung wird der gewählte Regelpunkt eingerichtet. M0 ist der zentrale NVP der Anlage.';
        if (['generationMeter', 'pvInverter'].includes(mode)) return 'Eine Erzeugungsanlage auswählen. Zähler und Wechselrichter derselben Anlage nicht doppelt als Erzeugung zählen; belegte Ziele werden nicht überschrieben.';
        if (mode === 'consumptionMeter') return 'Verbraucher im Energiefluss auswählen. EOS ordnet die vorhandenen Messwerte zu; ein Zähler allein ist kein steuerbarer Verbraucher.';
        if (mode === 'monitor') return 'Nach dem Übernehmen deaktiviert EOS die für dieses Gerät automatisch verwalteten Wallbox-/Speicher-Steuereinträge. Zuordnungen und Grenzen bleiben gespeichert; eine spätere Betriebsfreigabe erfolgt durch ausdrückliche EMS-Verwendung. Andere manuelle Einträge bleiben unverändert und müssen im App-Center geprüft werden.';
        if (mode === 'manual') return 'Die Datenpunkte werden im App-Center manuell zugeordnet. Bestehende Zuordnungen und Betriebsfreigaben bleiben unverändert; diese Auswahl beendet keine bestehende Regelung.';
        if (['EVCS', 'EVSE'].includes(category)) return 'Unterstützte Wallboxen erscheinen nach dem Speichern automatisch unter Ladepunkte. Mess- und Steuerdatenpunkte werden aus dem Geräteprofil zugeordnet; Ladeart und Grenzen hier eintragen und gemeinsam übernehmen.';
        if (['ESS', 'BATTERY', 'BATTERY_INVERTER'].includes(category)) return 'Bitte Einzelspeicher oder Speicherfarm-Mitglied auswählen. EOS entscheidet nicht selbst über die Regelzuständigkeit.';
        return 'EOS übernimmt nur eindeutige Zuordnungen aus unterstützten Geräteprofilen. Fehlende Funktionen oder eine offene Anlagenzuordnung werden angezeigt.';
    }
    /** @param {unknown} id @param {unknown} settings @param {unknown} enabled */
    function describe(id, settings, enabled) {
        const row = typeof id === 'string' ? rows.get(id) : undefined;
        intent(settings);
        const requestPending = staleSuccess(String(id));
        if (row && requestPending && ['pending', 'ready'].includes(serviceState)) return { status: 'pending', label: 'Übernahme wird geprüft', detail: 'Für die zuletzt gespeicherte EMS-Einrichtung fehlt noch die Bestätigung. Die bisherige Rückmeldung gilt nicht als neue Freigabe.' };
        if (enabled === false) return { status: 'disabled', label: 'Gerät inaktiv', detail: 'Beim Übernehmen werden automatisch verwaltete Steuereinträge deaktiviert. Zuordnungen und Grenzen bleiben erhalten; manuelle Einträge prüfen.' };
        if (!row) return { status: serviceState === 'error' ? 'conflict' : 'pending', label: serviceState === 'error' ? 'EMS-Zuordnung fehlgeschlagen' : 'Zuordnung wird geprüft',
            detail: !expected.has(String(id)) ? 'Noch nicht übernommen. Mit „Speichern und übernehmen“ Gerät und EMS-Einrichtung gemeinsam speichern.'
                : serviceMessages.get(serviceCode) || (serviceState === 'error' ? 'EMS konnte die Zuordnung nicht abschließen. EOS-Protokoll prüfen; Einstellungen bleiben erhalten.'
                    : serviceState === 'stopped' ? 'EMS-Zuordnung pausiert. Gespeicherte Einstellungen bleiben erhalten.'
                    : serviceState === 'ready' ? 'Für dieses gespeicherte Gerät fehlt die EMS-Rückmeldung. Status wird erneut abgefragt.'
                    : 'EMS-Rückmeldung wird geladen; gespeicherte Geräte bleiben erhalten.') };
        const state = serviceState === 'error' && !Object.hasOwn(messages, row.code || '') ? 'conflict' : ['MAPPING_INCOMPLETE', 'ACTIVATION_PENDING'].includes(row.code || '') ? 'pending'
            : ['mapped', 'manual', 'disabled', 'conflict', 'pending'].includes(row.status || '') ? row.status : 'pending';
        /** @type {Readonly<Record<string, string>>} */
        const names = { mapped: 'Zugeordnet', manual: 'Manuell prüfen', disabled: 'Inaktiv', conflict: 'Zuordnungskonflikt', pending: 'Zuordnung offen' };
        const detail = serviceMessages.has(row.code || '') ? serviceMessages.get(row.code || '') : typeof row.code === 'string' && Object.hasOwn(messages, row.code) ? Reflect.get(messages, row.code)
            : state === 'mapped' ? 'Zuordnung gespeichert. Bestehende Freigaben bleiben erhalten.'
            : state === 'conflict' ? 'Vorhandene Zuordnung bleibt erhalten. Ziel im App-Center prüfen.'
            : state === 'manual' ? 'Manuelle Einrichtung im App-Center erforderlich.'
            : state === 'disabled' ? 'Bestehende Zuordnung bleibt erhalten.' : 'Geräteverbindung und erforderliche Alias-Datenpunkte prüfen.';
        const missing = fieldLabels(row.missing, false);
        const optional = fieldLabels(row.optionalMissing, true);
        const correctionLabels = new Map([['LEGACY_ROW_ADOPTED', 'bestehender Eintrag übernommen'], ['FENECON_DIRECT_ESS_SELECTED', 'Direktregelung für den Speicher eingerichtet'], ['FENECON_NATIVE_TARGET_CORRECTED', 'profilbestätigter Sollwert korrigiert'], ['FENECON_ACTOR_FEEDBACK_CORRECTED', 'Speicher-Istleistung berichtigt'], ['PV_POWER_REFERENCE_CORRECTED', 'PV-Messwert berichtigt'], ['EV_FLOW_BOOLEAN_OVERRIDE_REMOVED', 'Ladepunkt-Energiefluss berichtigt'], ['NVP_TRANSPORT_STATUS_SELECTED', 'direkter Verbindungsstatus des NVP-Zählers zugeordnet']]);
        const corrections = (row.corrections || []).filter(item => typeof item === 'string').map(item => correctionLabels.get(String(item))).filter(Boolean);
        return { status: state || 'pending', label: row.code === 'ACTIVATION_PENDING' ? 'Einrichtung offen' : row.code === 'ACTIVATION_APPLIED' && row.activationApplied === true ? 'EMS eingerichtet' : row.code === 'MAPPING_INCOMPLETE' ? 'Teilweise zugeordnet' : names[state || 'pending'] || 'Zuordnung offen',
            detail: (detail || 'Zuordnung im App-Center prüfen.') + (missing.length ? ` Fehlt: ${missing.join(', ')}.` : '')
                + (corrections.length ? ` Angepasst: ${corrections.join(', ')}.` : ''),
            optionalDetail: optional.length ? `Optional nicht verfügbar: ${optional.join(', ')}.` : '' };
    }
    /** @param {unknown} value */
    function render(value) {
        const data = record(value) ? value : {};
        serviceState = typeof data.state === 'string' ? data.state : 'unknown';
        serviceCode = typeof data.code === 'string' ? data.code : '';
        rows.clear();
        if (Array.isArray(data.statuses)) {
            for (const candidate of data.statuses.slice(0, 128)) {
                if (!record(candidate)) continue;
                const id = typeof candidate.deviceId === 'string' ? candidate.deviceId : candidate.devId;
                if (typeof id !== 'string' || id.length > 160) continue;
                rows.set(id, {
                    deviceId: id,
                    activationApplied: candidate.activationApplied === true,
                    activationRequestId: typeof candidate.activationRequestId === 'string' ? candidate.activationRequestId.slice(0, 128) : '',
                    corrections: Array.isArray(candidate.corrections) ? candidate.corrections.slice(0, 8).filter(item => typeof item === 'string') : [],
                    status: typeof candidate.status === 'string' ? candidate.status : 'pending',
                    code: typeof candidate.code === 'string' ? candidate.code : '',
                    target: typeof candidate.target === 'string' ? candidate.target.slice(0, 160) : '',
                    missing: Array.isArray(candidate.missing) ? candidate.missing.slice(0, 12).filter(item => typeof item === 'string') : [],
                    optionalMissing: Array.isArray(candidate.optionalMissing) ? candidate.optionalMissing.slice(0, 12).filter(item => typeof item === 'string') : [],
                });
            }
        }
        for (const element of document.querySelectorAll('[data-eos-ems-id]')) {
            if (!(element instanceof HTMLElement)) continue;
            const status = describe(element.dataset.eosEmsId, { mode: element.dataset.eosEmsMode }, element.dataset.eosEmsEnabled !== 'false');
            element.dataset.state = status.status;
            element.textContent = `${status.label} · ${status.detail}`;
            const notes = element.parentElement?.querySelector('.nexo-ems-notes');
            if (notes instanceof HTMLElement) {
                notes.hidden = !status.optionalDetail;
                const content = notes.querySelector('p');
                if (content) content.textContent = status.optionalDetail || '';
            }
        }
        const summary = document.getElementById('eosEmsStatus');
        if (summary) {
            const mapped = [...rows.values()].filter(row => row.status === 'mapped' && !['MAPPING_INCOMPLETE', 'ACTIVATION_PENDING'].includes(row.code || '')).length;
            const incomplete = [...rows.values()].filter(row => ['MAPPING_INCOMPLETE', 'ACTIVATION_PENDING'].includes(row.code || '')).length;
            const conflict = [...rows.values()].filter(row => row.status === 'conflict').length;
            const missing = [...expected].filter(id => !rows.has(id) || staleSuccess(id)).length;
            summary.textContent = data.state === 'error' ? `Geräte gespeichert. EMS-Zuordnung fehlgeschlagen. ${serviceMessages.get(serviceCode) || 'EOS-Protokoll prüfen; vorhandene Zuordnungen bleiben erhalten.'}`
                : data.state === 'stopped' ? 'EMS-Zuordnung pausiert. Gespeicherte Einstellungen bleiben erhalten.'
                : missing > 0 ? `${missing} gespeicherte(s) Gerät(e) ohne EMS-Rückmeldung. Status wird abgefragt; Einstellungen bleiben erhalten.`
                : data.state === 'ready' ? `${mapped} Gerät(e) zugeordnet${incomplete ? ` · ${incomplete} unvollständig` : ''}${conflict ? ` · ${conflict} Zuordnungskonflikt(e)` : ''}. Einzelnen Gerätestatus beachten.`
                : serviceMessages.get(serviceCode) || 'EMS-Rückmeldung wird geladen; gespeicherte Einstellungen bleiben erhalten.';
            summary.dataset.state = data.state === 'error' || conflict > 0 ? 'conflict' : incomplete > 0 || missing > 0 ? 'pending' : data.state === 'ready' ? 'mapped' : 'pending';
        }
    }
    /** Der Modulstatus belegt nur den Laufzeitstart; aktuelle Gerätewerte werden getrennt benannt.
     * @param {unknown} value
     * @returns {{state: string, text: string, monitor: boolean, starting: boolean}}
     */
    function runtimeStatus(value) {
        const data = record(value) ? value : {};
        const details = record(data.details) ? data.details : {};
        const enabled = data.enabled === true;
        const reason = typeof data.reason === 'string' ? data.reason : '';
        const state = typeof details.state === 'string' ? details.state : '';
        if (['START_FAILED_RESTART_REQUIRED', 'START_FAILED', 'EOS_MODULE_START_FAILED'].includes(reason) || state === 'error') {
            return { state: 'error', monitor: enabled, starting: false, text: 'Gerätemodul konnte nicht starten. Gespeicherte Geräte bleiben erhalten. EOS-Protokoll auf die Startursache prüfen; gegebenenfalls das Modul nach deren Behebung neu starten.' };
        }
        if (reason === 'STOP_FAILED_RESTART_REQUIRED') return { state: 'error', monitor: enabled, starting: false, text: 'Der Stopp des Gerätemoduls ist nicht bestätigt. Kein weiterer Gerätestart; EOS-Protokoll prüfen und EOS kontrolliert neu starten.' };
        if (data.active === true && state === 'running') {
            const available = details.connected === true;
            return { state: available ? 'running' : 'waiting', monitor: true, starting: false,
                text: available ? 'Gerätemodul läuft. Mindestens ein Gerät meldet eine Verbindung; Messwertfrische je Gerät prüfen.'
                    : 'Gerätemodul läuft. Noch keine aktuellen Gerätedaten bestätigt; Verbindung und Gerätestatus prüfen.' };
        }
        if (['READY', 'STARTING'].includes(reason) || state === 'starting') return { state: 'starting', monitor: enabled, starting: enabled, text: 'Gerätestart wird vorbereitet. Die Startfreigabe bestätigt noch keine laufende Gerätekommunikation.' };
        if (!enabled && reason === 'DISABLED') return { state: 'disabled', monitor: false, starting: false, text: 'Gerätemodul ist deaktiviert. Gespeicherte Geräte bleiben erhalten.' };
        if (['LICENSE_REQUIRED', 'LICENSE_BLOCKED', 'LICENSE_INVALID'].includes(reason)) return { state: 'blocked', monitor: enabled, starting: false, text: 'Gerätestart wartet auf die zentrale EOS-Systemfreigabe. Lizenzstatus prüfen.' };
        if (['LEGACY_RUNNING', 'LEGACY_CONFLICT', 'OWNERSHIP_REQUIRED', 'EOS_OWNERSHIP_REQUIRED', 'OWNERSHIP_BLOCKED', 'OWNERSHIP_UNAVAILABLE', 'MIGRATION_BLOCKED'].includes(reason)) return { state: 'blocked', monitor: enabled, starting: false, text: 'Gerätestart ist noch gesperrt. Status der Bestandsübernahme und Systemzuständigkeit prüfen.' };
        return { state: 'unknown', monitor: enabled, starting: false, text: 'Laufstatus des Gerätemoduls ist noch nicht bestätigt. Status aktualisieren oder EOS-Protokoll prüfen.' };
    }
    window.EosDeviceEms = Object.freeze({ modes, intent, prepareSave, requestRenewal, setDevices, needsPolling, capabilities, targets, help, describe, render, runtimeStatus });
})();
