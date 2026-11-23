/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
/**
 * AUTO-GENERATED RUNTIME FILE - NICHT MANUELL BEARBEITEN.
 *
 * Quelle: src-ts/runtime-executables/www/smarthome-device-categories.ts
 * Quell-Hash: sha256:08041f0f46d0b49282f19e5117427dfa4622f91f72196328b74ef02b2a80db09
 * Erzeugung: npm run sync:ts-runtime-executables
 *
 * Zweck:
 * Diese JavaScript-Datei ist das ausführbare Build-Artefakt für www/smarthome-device-categories.js.
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
 * Aufgabe: Ordnet geprüfte Gerätefelder in eigenständige Bedienflächen je Kategorie.
 * Daten und Wirkung: Verwendet ausschließlich vom Haupt-Renderer gelieferte Feld-DOM-
 * Elemente. Keine eigenen Befehle, Datenpunkt-IDs, Netzabfragen oder Berechtigungen.
 * Bei Änderungen: Alle 51 Referenzkategorien, eindeutige Feldabdeckung, getrennte
 * STOP-/Lamellen-/Schlossaktionen und den Erhalt zusätzlicher Funktionen prüfen.
 */
(function () {
    'use strict';
    const host = window;
    if (host.NW_SH_DEVICE_CATEGORIES)
        return;
    const definitions = new Map();
    const expanded = new Set();
    const accents = { emerald: '#00d7a0', blue: '#58a6ff', cyan: '#35d4ee', amber: '#ffbe5c', purple: '#b99aff', coral: '#ff8e95' };
    function group(id, label, layout, ...keys) { return { id, label, layout, keys }; }
    const powerMetrics = group('energy', 'Energie', 'metrics', 'ELECTRIC_POWER', 'CURRENT', 'VOLTAGE', 'CONSUMPTION', 'FREQUENCY');
    const diagnostics = group('diagnostics', 'Gerätestatus', 'status', 'WORKING', 'UNREACH', 'LOWBAT', 'MAINTAIN', 'ERROR', 'BATTERY', 'RSSI', 'CONNECTED');
    const coverSafety = group('cover-safety', 'Schutz & Status', 'status', 'LOCKED', 'WIND_ALARM', 'RAIN_ALARM', 'FROST_ALARM', 'DIRECTION', 'DIRECTION_ENUM');
    function define(ids, title, icon, accent, primary, secondary = []) {
        for (const id of ids)
            definitions.set(id, { title, icon, accent, primary, secondary: [...secondary, powerMetrics, diagnostics] });
    }
    define(['socket'], 'Steckdose', 'power', accents.emerald, [group('switch', 'Schalten', 'controls', 'SET', 'ACTUAL')], [group('timer', 'Einschaltdauer', 'controls', 'ON_TIME')]);
    define(['light'], 'Licht', 'light', accents.amber, [group('light', 'Licht', 'controls', 'SET', 'ON_ACTUAL')], [group('light-options', 'Lichtfunktionen', 'controls', 'EFFECT', 'ON_TIME')]);
    define(['dimmer'], 'Dimmer', 'light', accents.amber, [group('switch', 'Licht', 'actions', 'ON_SET', 'ON_ACTUAL'), group('brightness', 'Helligkeit', 'controls', 'ACTUAL', 'SET')], [group('light-options', 'Lichtfunktionen', 'controls', 'EFFECT', 'TRANSITION_TIME', 'ON_TIME')]);
    for (const [profile, keys] of [['rgbSingle', ['RGB']], ['rgbwSingle', ['RGBW']], ['rgb', ['RED', 'GREEN', 'BLUE', 'WHITE']], ['hue', ['HUE', 'SATURATION']], ['cie', ['CIE']], ['ct', ['TEMPERATURE']]]) {
        define([profile], profile === 'ct' ? 'Weißton' : 'Farblicht', 'color', accents.purple, [group('switch', 'Licht', 'actions', 'ON', 'ON_ACTUAL'), group('brightness', 'Helligkeit', 'controls', 'DIMMER', 'BRIGHTNESS'), ...(profile === 'ct' ? [group('white', 'Farbtemperatur', 'controls', 'TEMPERATURE')] : [])], [group('color-values', 'Farbwerte', 'controls', ...keys, 'TEMPERATURE'), group('light-options', 'Lichtfunktionen', 'controls', 'EFFECT', 'TRANSITION_TIME', 'ON_TIME')]);
    }
    for (const profile of ['blind', 'blindButtons'])
        define([profile], profile === 'blind' ? 'Beschattung' : 'Beschattungstaster', 'cover', accents.blue, [group('movement', 'Fahrt', 'actions', 'OPEN', 'STOP', 'CLOSE'), group('position', 'Position', 'controls', 'ACTUAL', 'SET')], [group('slats', 'Lamellen', 'controls', 'TILT_ACTUAL', 'TILT_SET'), group('slat-actions', 'Lamellenfahrt', 'actions', 'TILT_OPEN', 'TILT_STOP', 'TILT_CLOSE'), coverSafety]);
    define(['gate'], 'Tor', 'gate', accents.blue, [group('position', 'Torstatus', 'readings', 'ACTUAL', 'OPENED', 'CLOSED'), group('movement', 'Torbedienung', 'actions', 'SET', 'STOP')], [coverSafety]);
    define(['lock'], 'Schloss', 'lock', accents.purple, [group('lock-state', 'Schloss & Tür', 'readings', 'ACTUAL', 'DOOR_STATE'), group('lock', 'Verriegelung', 'controls', 'SET'), group('latch', 'Türfalle', 'actions', 'OPEN')], [group('lock-direction', 'Bewegung', 'status', 'DIRECTION', 'DIRECTION_ENUM')]);
    define(['thermostat'], 'Raumklima', 'temperature', accents.coral, [group('climate', 'Raumklima', 'readings', 'ACTUAL', 'HUMIDITY'), group('temperature', 'Solltemperatur', 'controls', 'SET'), group('dual-zone', 'Heizen & Kühlen', 'controls', 'SET_HEATING', 'SET_COOLING'), group('mode', 'Betrieb', 'controls', 'POWER', 'MODE')], [group('climate-options', 'Klimafunktionen', 'controls', 'BOOST', 'PARTY', 'VALVE', 'WORKING_MODE', 'WINDOW')]);
    define(['airCondition'], 'Klimaanlage', 'temperature', accents.cyan, [group('climate', 'Raumklima', 'readings', 'ACTUAL', 'HUMIDITY'), group('temperature', 'Solltemperatur', 'controls', 'SET'), group('dual-zone', 'Heizen & Kühlen', 'controls', 'SET_HEATING', 'SET_COOLING'), group('mode', 'Betrieb', 'controls', 'POWER', 'MODE')], [group('ventilation', 'Luftstrom', 'controls', 'SPEED', 'SPEED_LEVEL', 'SWING', 'AIRFLOW_DIRECTION', 'BOOST', 'WORKING_MODE'), group('filter', 'Filter', 'status', 'FILTER_CONDITION', 'FILTER_CONDITION_CARBON', 'FILTER_CHANGE')]);
    for (const profile of ['fan', 'airPurifier'])
        define([profile], profile === 'fan' ? 'Ventilator' : 'Luftreiniger', 'fan', accents.cyan, [group('fan', 'Luftstrom', 'controls', 'POWER', 'SPEED', 'SPEED_LEVEL'), group('direction', 'Ausrichtung', 'controls', 'SWING', 'AIRFLOW_DIRECTION')], [group('filter', 'Filter', 'status', 'FILTER_CONDITION', 'FILTER_CONDITION_CARBON', 'FILTER_CHANGE'), group('timer', 'Laufzeit', 'controls', 'ON_TIME')]);
    define(['pump'], 'Pumpe', 'water', accents.blue, [group('pump', 'Pumpenleistung', 'controls', 'POWER', 'LEVEL'), group('flow', 'Betriebswerte', 'readings', 'FLOW', 'PRESSURE', 'TEMPERATURE')]);
    define(['vacuumCleaner'], 'Saugroboter', 'vacuum', accents.purple, [group('cleaner-state', 'Reinigung', 'readings', 'STATE', 'PROGRESS', 'PHASE', 'BATTERY'), group('cleaner-actions', 'Bedienung', 'actions', 'POWER', 'PAUSE', 'HOME'), group('cleaner-mode', 'Modus', 'controls', 'MODE', 'WORK_MODE', 'RUN_MODE')], [group('cleaner-map', 'Karte', 'metrics', 'MAP_BASE64', 'MAP_URL'), group('cleaner-tanks', 'Behälter', 'status', 'WATER', 'WASTE', 'WATER_ALARM', 'WASTE_ALARM'), group('cleaner-service', 'Wartung', 'status', 'FILTER', 'BRUSH', 'SENSORS', 'SIDE_BRUSH')]);
    define(['media'], 'Musik & Medien', 'media', accents.purple, [group('now-playing', 'Aktuelle Wiedergabe', 'readings', 'TITLE', 'ARTIST', 'ALBUM'), group('volume', 'Lautstärke', 'controls', 'VOLUME_ACTUAL', 'VOLUME'), group('timeline', 'Wiedergabeposition', 'controls', 'ELAPSED', 'DURATION', 'SEEK')], [group('transport', 'Wiedergabe', 'actions', 'STATE', 'PLAY', 'PAUSE', 'STOP', 'PREV', 'NEXT', 'MUTE', 'SHUFFLE', 'REPEAT'), group('media-details', 'Medieninformationen', 'metrics', 'TRACK', 'EPISODE', 'SEASON', 'COVER', 'PLAYER_NAME', 'PLAYER_TYPE', 'IGNORE')]);
    define(['tv'], 'TV & Fernbedienung', 'tv', accents.purple, [group('tv-power', 'Fernseher', 'controls', 'POWER'), group('tv-source', 'Quelle', 'controls', 'INPUT', 'APP', 'ART_MODE'), group('volume', 'Lautstärke', 'controls', 'VOLUME_ACTUAL', 'VOLUME')], [group('remote', 'Fernbedienung', 'controls', 'KEY'), group('transport', 'Wiedergabe', 'actions', 'STATE', 'PLAY', 'PAUSE', 'STOP', 'PREV', 'NEXT', 'MUTE')]);
    define(['volume', 'volumeGroup'], 'Lautstärke', 'volume', accents.purple, [group('volume', 'Lautstärke', 'controls', 'ACTUAL', 'SET')], [group('mute', 'Stummschaltung', 'actions', 'MUTE')]);
    define(['button'], 'Taster', 'button', accents.emerald, [group('trigger', 'Auslösen', 'actions', 'SET')]);
    define(['buttonSensor'], 'Tastermeldung', 'button', accents.emerald, [group('button-events', 'Tastendrücke', 'readings', 'PRESS', 'PRESS_LONG')]);
    define(['slider', 'percentage'], 'Stellwert', 'slider', accents.emerald, [group('level', 'Stellwert', 'controls', 'ACTUAL', 'SET'), group('power', 'Schalten', 'controls', 'ON', 'ON_ACTUAL')]);
    const sensors = [
        ['temperature', 'Temperatur', 'temperature', accents.coral, ['ACTUAL', 'SECOND']], ['humidity', 'Luftfeuchte', 'water', accents.cyan, ['ACTUAL']],
        ['illuminance', 'Helligkeit', 'light', accents.amber, ['ACTUAL']], ['pressure', 'Druck', 'gauge', accents.blue, ['PRESSURE']], ['flow', 'Durchfluss', 'water', accents.blue, ['FLOW']],
        ['fillLevel', 'Füllstand', 'gauge', accents.cyan, ['ACTUAL']], ['motion', 'Bewegung', 'motion', accents.emerald, ['ACTUAL', 'SECOND']],
        ['contact', 'Kontakt', 'contact', accents.emerald, ['ACTUAL']], ['door', 'Tür', 'door', accents.blue, ['ACTUAL']], ['window', 'Fenster', 'window', accents.blue, ['ACTUAL']], ['windowTilt', 'Fensterposition', 'window', accents.blue, ['ACTUAL']],
        ['info', 'Information', 'info', accents.cyan, ['ACTUAL']],
    ];
    for (const [profile, title, icon, accent, keys] of sensors)
        define([profile], title, icon, accent, [group('measurement', title, 'readings', ...keys)]);
    for (const [profile, title] of [['fireAlarm', 'Rauchmelder'], ['coAlarm', 'CO-Melder'], ['floodAlarm', 'Wassermelder']])
        define([profile], title, 'alarm', accents.coral, [group('alarm', 'Alarmstatus', 'readings', 'ACTUAL', 'SEVERITY', 'CO'), group('alarm-actions', 'Melderfunktionen', 'controls', 'MUTED', 'TEST')]);
    define(['electricity'], 'Elektrizität', 'energy', accents.amber, [group('power', 'Elektrische Werte', 'readings', 'ELECTRIC_POWER', 'CONSUMPTION'), group('measurements', 'Netzwerte', 'metrics', 'CURRENT', 'VOLTAGE', 'FREQUENCY')]);
    define(['airQuality'], 'Luftqualität', 'air', accents.cyan, [group('air-quality', 'Luftqualität', 'readings', 'AQI', 'CO2', 'TVOC', 'PM25'), group('indoor-climate', 'Raumklima', 'metrics', 'ACTUAL', 'HUMIDITY', 'PRESSURE'), group('power', 'Betrieb', 'controls', 'POWER')], [group('air-pollutants', 'Luftbestandteile', 'metrics', 'CO2_LEVEL', 'TVOC_LEVEL', 'PM1', 'PM1_LEVEL', 'PM25_LEVEL', 'PM10', 'PM10_LEVEL', 'CO', 'CO_LEVEL', 'NO2', 'NO2_LEVEL', 'O3', 'O3_LEVEL', 'CH2O', 'CH2O_LEVEL', 'RN', 'RN_LEVEL', 'SO2', 'SO2_LEVEL')]);
    define(['warning'], 'Warnmeldung', 'alarm', accents.coral, [group('warning', 'Warnmeldung', 'readings', 'LEVEL', 'TITLE', 'INFO', 'DESC'), group('validity', 'Zeitraum', 'metrics', 'START', 'END')], [group('warning-symbol', 'Symbol', 'metrics', 'ICON')]);
    define(['camera'], 'Kamera', 'camera', accents.blue, [group('camera-controls', 'Kamerasteuerung', 'controls', 'PTZ', 'NIGHTMODE', 'BRIGHTNESS')], [group('camera-picture', 'Bild', 'controls', 'AUTOFOCUS', 'AUTOWHITEBALANCE', 'URL')]);
    define(['image'], 'Bild', 'image', accents.blue, [group('image', 'Bildquelle', 'metrics', 'URL')]);
    for (const profile of ['location', 'locationOne'])
        define([profile], 'Standort', 'location', accents.blue, [group('position', 'Koordinaten', 'readings', 'GPS', 'LATITUDE', 'LONGITUDE'), group('precision', 'Positionsdaten', 'metrics', 'ELEVATION', 'RADIUS', 'ACCURACY')]);
    define(['weatherCurrent'], 'Wetter', 'weather', accents.cyan, [group('weather', 'Aktuelles Wetter', 'readings', 'ACTUAL', 'WEATHER', 'REAL_FEEL_TEMPERATURE'), group('wind', 'Wind', 'metrics', 'WIND_SPEED', 'WIND_GUST', 'WIND_DIRECTION'), group('rain', 'Niederschlag', 'metrics', 'PRECIPITATION_CHANCE', 'PRECIPITATION_TYPE')], [group('weather-details', 'Wetterdaten', 'metrics', 'HUMIDITY', 'PRESSURE', 'PRESSURE_TENDENCY', 'UV', 'ICON')]);
    const forecastKeys = ['ICON', 'TEMP_MIN', 'TEMP_MAX', 'TEMP', 'DATE', 'DOW', 'STATE', 'PRESSURE', 'HUMIDITY', 'HUMIDITY_MAX', 'PRECIPITATION_CHANCE', 'PRECIPITATION', 'WIND_SPEED', 'WIND_DIRECTION', 'WIND_DIRECTION_STR', 'WIND_ICON', 'TIME_SUNRISE', 'TIME_SUNSET'];
    define(['weatherForecast'], 'Wettervorhersage', 'weather', accents.cyan, [group('today', 'Heute', 'readings', 'TEMP_MIN', 'TEMP_MAX', 'TEMP', 'STATE', 'PRECIPITATION_CHANCE', 'LOCATION')], [group('weather-data', 'Wetterdaten', 'metrics', ...forecastKeys, 'WIND_CHILL', 'FEELS_LIKE', 'HISTORY_CHART', 'FORECAST_CHART'), ...Array.from({ length: 7 }, (_, i) => group('day' + (i + 1), 'Tag ' + (i + 1), 'metrics', ...forecastKeys.map(key => key + (i + 1))))]);
    function record(value) { return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : {}; }
    function plan(profile, keys) {
        const entry = definitions.get(profile);
        if (!entry)
            return null;
        const remaining = new Set(keys.slice(0, 512).filter(key => typeof key === 'string' && key.length > 0 && key.length <= 256));
        function assign(groups) { return groups.flatMap(item => { const selected = item.keys.filter(key => remaining.delete(key)); return selected.length ? [{ id: item.id, label: item.label, layout: item.layout, keys: selected }] : []; }); }
        const primary = assign(entry.primary);
        const secondary = assign(entry.secondary);
        if (remaining.size)
            secondary.push(group('additional', 'Weitere Funktionen', 'controls', ...remaining));
        return { profile, title: entry.title, icon: entry.icon, accent: entry.accent, primary, secondary };
    }
    function element(tag, cls, text = '') { const node = document.createElement(tag); node.className = cls; node.textContent = text; return node; }
    function render(container, raw, renderField, compact) {
        const device = record(raw);
        const controls = record(device.deviceControls);
        if (typeof controls.profile !== 'string' || !Array.isArray(controls.fields))
            return false;
        const fields = controls.fields.slice(0, 512).map(record);
        const layout = plan(controls.profile, fields.flatMap(field => typeof field.key === 'string' ? [field.key] : []));
        if (!layout)
            return false;
        const root = element('div', 'nw-sh-category');
        root.dataset.category = layout.profile;
        root.dataset.compact = String(compact);
        root.dataset.icon = layout.icon;
        root.style.setProperty('--sh-category-accent', layout.accent);
        root.setAttribute('aria-label', layout.title);
        const criticalKeys = new Set(['LOCKED', 'WIND_ALARM', 'RAIN_ALARM', 'FROST_ALARM', 'UNREACH', 'LOWBAT', 'MAINTAIN', 'ERROR']);
        const active = fields.flatMap(field => typeof field.key === 'string' && criticalKeys.has(field.key) && field.valid === true && field.readable === true && field.ack !== false && (field.value === true || (typeof field.value === 'number' && Number.isFinite(field.value) && field.value > 0)) ? [field.key] : []);
        if (compact && active.length) {
            const selected = new Set(active);
            layout.primary.unshift(group('active-status', 'Aktiver Gerätestatus', 'status', ...selected));
            layout.secondary = layout.secondary.flatMap(g => { const keys = g.keys.filter(key => !selected.has(key)); return keys.length ? [{ ...g, keys }] : []; });
        }
        const rendered = new Set();
        function section(g) {
            const section = element('section', 'nw-sh-category-group');
            section.dataset.group = g.id;
            section.dataset.layout = g.layout;
            section.append(element('h4', 'nw-sh-category-title', g.label));
            const grid = element('div', 'nw-sh-category-fields');
            section.append(grid);
            for (const key of g.keys) {
                if (rendered.has(key))
                    continue;
                const node = renderField(key);
                rendered.add(key);
                if (node)
                    grid.append(node);
            }
            return section;
        }
        for (const g of layout.primary)
            root.append(section(g));
        // Configuration/status fields stay reachable in every profile; no fixed four-field cutoff.
        if (compact && layout.secondary.length) {
            const cacheKey = typeof device.id === 'string' ? device.id.slice(0, 512) + ':' + layout.profile : layout.profile;
            const details = element('details', 'nw-sh-category-more');
            const count = layout.secondary.reduce((sum, g) => sum + g.keys.length, 0);
            details.append(element('summary', '', `Weitere Funktionen (${count})`));
            let mounted = false;
            const fill = () => { if (mounted)
                return; mounted = true; for (const g of layout.secondary)
                details.append(section(g)); };
            details.open = expanded.has(cacheKey);
            if (details.open)
                fill();
            details.addEventListener('toggle', () => { if (details.open) {
                fill();
                expanded.delete(cacheKey);
                expanded.add(cacheKey);
                if (expanded.size > 128) {
                    const oldest = expanded.keys().next();
                    if (!oldest.done)
                        expanded.delete(oldest.value);
                }
            }
            else
                expanded.delete(cacheKey); });
            root.append(details);
        }
        else
            for (const g of layout.secondary)
                root.append(section(g));
        container.append(root);
        return true;
    }
    window.addEventListener('pagehide', () => expanded.clear());
    host.NW_SH_DEVICE_CATEGORIES = Object.freeze({ profiles: () => [...definitions.keys()], plan, render });
})();
