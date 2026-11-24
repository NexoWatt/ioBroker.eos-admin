/* Copyright (c) 2026 NexoWatt. Confidential and proprietary. */
// @ts-check
'use strict';
/**
 * Device commissioning UI: presentation only. The authenticated server validates
 * intent, resolves actual alias objects and owns all configuration changes.
 */
(() => {
    /** @typedef {{mode: string, scope?: string, flowSlot?: number, group?: string}} Intent */
    /** @typedef {{deviceId?: string, devId?: string, status?: string, code?: string, target?: string, missing?: unknown[], optionalMissing?: unknown[]}} Row */
    /** @type {Readonly<Record<string, string>>} */
    const labels = Object.freeze({
        auto: 'Automatisch nach Geräteprofil', monitor: 'Nur Messwerte · verwaltete Steuereinträge deaktivieren',
        manual: 'Manuell im App-Center zuordnen', singleStorage: 'Einzelspeicher', storageFarm: 'Speicherfarm-Mitglied',
        gridMeter: 'Netzanschlusszähler', generationMeter: 'Erzeugungszähler', consumptionMeter: 'Verbrauchszähler',
        pvInverter: 'PV-Wechselrichter / Erzeugungsanlage',
    });
    /** @type {Readonly<Record<string, string>>} */
    const messages = Object.freeze({
        COMMISSIONING_REQUIRED: 'Zugeordnet · Betriebsfreigabe im App-Center prüfen.',
        MAPPED: 'Zuordnung gespeichert. Bestehende Betriebsfreigabe im App-Center prüfen.',
        MEASUREMENT_MAPPED: 'Messdatenpunkte zugeordnet; vorhandene App-Freigaben bleiben unverändert.',
        MAPPING_INCOMPLETE: 'Teilweise zugeordnet · erforderliche Datenpunkte im App-Center ergänzen.',
        NEEDS_SELECTION: 'Funktion und Ziel im Gerätefenster auswählen.',
        MANUAL_TOPOLOGY_REQUIRED: 'Zuordnung für diese Anlagentopologie im App-Center prüfen.',
        MISSING_ALIASES: 'Erforderliche Geräte-Datenpunkte fehlen noch.',
        ALIASES_PENDING: 'Geräte-Datenpunkte werden vorbereitet.',
        ALIASES_UNAVAILABLE: 'Geräte-Datenpunkte sind noch nicht verfügbar.',
        DEVICE_DISABLED: 'Gerät deaktiviert · automatisch verwaltete Steuereinträge deaktiviert; Zuordnungen und Grenzen bleiben erhalten.',
        DEVICE_REMOVED: 'Gerät entfernt · automatisch verwaltete Steuereinträge deaktiviert; manuelle Einträge im App-Center prüfen.',
        MANUAL_MAPPING_PRESERVED: 'Ziel bereits belegt · vorhandene Zuordnung bleibt erhalten. Im App-Center abgleichen.',
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
        powerId: 'Leistungsmesswert', 'r.power': 'Leistungsmesswert',
        'setCurrentAId|setPowerWId': 'Strom- oder Leistungssollwert',
        'onlineId|heartbeatId': 'Verbindungsstatus', socId: 'Ladezustand', socObjectId: 'Ladezustand',
        signedPowerId: 'Speicherleistung', batteryPowerObjectId: 'Speicherleistung',
        storageControl: 'Speichersollwert', scope: 'Messpunkt M0/M1', flowSlot: 'Ziel im Energiefluss',
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
            const base = field.replace(/(?:ObjectId|Id)$/, '');
            const label = Object.hasOwn(missingLabels, field) ? missingLabels[field]
                : Object.hasOwn(profileLabels, field) ? profileLabels[field]
                    : Object.hasOwn(profileLabels, base) ? profileLabels[base] : '';
            if (typeof label === 'string' && label) result.add(label); else other++;
        }
        if (other) result.add(`${other} weitere ${optional ? 'profilabhängige' : 'erforderliche'} Datenpunkt-Zuordnung(en)`);
        return [...result];
    }
    /** @type {Map<string, Row>} */
    const rows = new Map();
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
        return ['auto', ...specific, 'monitor', 'manual'].map(value => ({ value, label: labels[value] || value }));
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
        return result;
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
        if (mode === 'gridMeter') return 'Messpunkt bewusst auswählen: M0 = Hauptanschluss, M1 = Unteranlage. EOS ergänzt die zugehörigen Messdatenpunkte; die App bleibt in ihrem bisherigen Aktivierungszustand.';
        if (['generationMeter', 'pvInverter'].includes(mode)) return 'Eine Erzeugungsanlage auswählen. Zähler und Wechselrichter derselben Anlage nicht doppelt als Erzeugung zählen; belegte Ziele werden nicht überschrieben.';
        if (mode === 'consumptionMeter') return 'Verbraucher im Energiefluss auswählen. EOS ordnet die vorhandenen Messwerte zu; ein Zähler allein ist kein steuerbarer Verbraucher.';
        if (mode === 'monitor') return 'Nach dem Übernehmen deaktiviert EOS die für dieses Gerät automatisch verwalteten Wallbox-/Speicher-Steuereinträge. Zuordnungen und Grenzen bleiben gespeichert; eine spätere Betriebsfreigabe erfolgt manuell. Andere manuelle Einträge bleiben unverändert und müssen im App-Center geprüft werden.';
        if (mode === 'manual') return 'Die Datenpunkte werden im App-Center manuell zugeordnet. Bestehende Zuordnungen und Betriebsfreigaben bleiben unverändert; diese Auswahl beendet keine bestehende Regelung.';
        if (['EVCS', 'EVSE'].includes(category)) return 'Unterstützte Wallboxen erscheinen nach dem Speichern automatisch unter Ladepunkte. Mess- und Steuerdatenpunkte werden aus dem Geräteprofil zugeordnet; Betriebsfreigabe und Anlagenlimits anschließend prüfen.';
        if (['ESS', 'BATTERY', 'BATTERY_INVERTER'].includes(category)) return 'Bitte Einzelspeicher oder Speicherfarm-Mitglied auswählen. EOS entscheidet nicht selbst über die Regelzuständigkeit.';
        return 'EOS übernimmt nur eindeutige Zuordnungen aus unterstützten Geräteprofilen. Fehlende Funktionen oder eine offene Anlagenzuordnung werden angezeigt.';
    }
    /** @param {unknown} id @param {unknown} settings @param {unknown} enabled */
    function describe(id, settings, enabled) {
        const row = typeof id === 'string' ? rows.get(id) : undefined;
        const mode = intent(settings).mode;
        if (enabled === false) return { status: 'disabled', label: 'Gerät inaktiv', detail: 'Beim Übernehmen werden automatisch verwaltete Steuereinträge deaktiviert. Zuordnungen und Grenzen bleiben erhalten; manuelle Einträge prüfen.' };
        if (!row) return { status: 'pending', label: labels[mode] || 'Automatisch nach Geräteprofil', detail: 'Status nach dem Speichern verfügbar.' };
        const state = row.code === 'MAPPING_INCOMPLETE' ? 'pending'
            : ['mapped', 'manual', 'disabled', 'conflict', 'pending'].includes(row.status || '') ? row.status : 'pending';
        /** @type {Readonly<Record<string, string>>} */
        const names = { mapped: 'Zugeordnet', manual: 'Manuell prüfen', disabled: 'Inaktiv', conflict: 'Zuordnungskonflikt', pending: 'Zuordnung offen' };
        const detail = typeof row.code === 'string' && Object.hasOwn(messages, row.code) ? messages[row.code]
            : state === 'mapped' ? 'Zuordnung gespeichert. Betriebsfreigabe im App-Center prüfen.'
            : state === 'conflict' ? 'Vorhandene Zuordnung bleibt erhalten. Ziel im App-Center prüfen.'
            : state === 'manual' ? 'Manuelle Einrichtung im App-Center erforderlich.'
            : state === 'disabled' ? 'Bestehende Zuordnung bleibt erhalten.' : 'Geräteverbindung und erforderliche Alias-Datenpunkte prüfen.';
        const missing = fieldLabels(row.missing, false);
        const optional = fieldLabels(row.optionalMissing, true);
        return { status: state || 'pending', label: row.code === 'MAPPING_INCOMPLETE' ? 'Teilweise zugeordnet' : names[state || 'pending'] || 'Zuordnung offen',
            detail: (detail || 'Zuordnung im App-Center prüfen.') + (missing.length ? ` Fehlt: ${missing.join(', ')}.` : '')
                + (optional.length ? ` Optional nicht verfügbar: ${optional.join(', ')}.` : '') };
    }
    /** @param {unknown} value */
    function render(value) {
        const data = record(value) ? value : {};
        rows.clear();
        if (Array.isArray(data.statuses)) {
            for (const candidate of data.statuses.slice(0, 128)) {
                if (!record(candidate)) continue;
                const id = typeof candidate.deviceId === 'string' ? candidate.deviceId : candidate.devId;
                if (typeof id !== 'string' || id.length > 80) continue;
                rows.set(id, {
                    deviceId: id,
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
        }
        const summary = document.getElementById('eosEmsStatus');
        if (summary) {
            const mapped = [...rows.values()].filter(row => row.status === 'mapped' && row.code !== 'MAPPING_INCOMPLETE').length;
            const incomplete = [...rows.values()].filter(row => row.code === 'MAPPING_INCOMPLETE').length;
            const conflict = [...rows.values()].filter(row => row.status === 'conflict').length;
            summary.textContent = data.state === 'error' ? 'Geräte gespeichert. EMS-Zuordnung noch nicht abgeschlossen; vorhandene Zuordnungen bleiben erhalten.'
                : data.state === 'stopped' ? 'EMS-Zuordnung pausiert. Gespeicherte Einstellungen bleiben erhalten.'
                : data.state === 'ready' ? `${mapped} Gerät(e) zugeordnet${incomplete ? ` · ${incomplete} unvollständig` : ''}${conflict ? ` · ${conflict} Zuordnungskonflikt(e)` : ''}. Betriebsfreigaben im App-Center prüfen.`
                : 'Automatische EMS-Zuordnung wird nach dem Speichern und Bereitstellen der Geräte-Datenpunkte geprüft.';
            summary.dataset.state = data.state === 'error' || conflict > 0 ? 'conflict' : incomplete > 0 ? 'pending' : data.state === 'ready' ? 'mapped' : 'pending';
        }
    }
    window.EosDeviceEms = Object.freeze({ modes, intent, targets, help, describe, render });
})();
