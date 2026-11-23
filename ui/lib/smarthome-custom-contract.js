/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
/**
 * AUTO-GENERATED RUNTIME FILE - NICHT MANUELL BEARBEITEN.
 *
 * Quelle: src-ts/runtime-executables/lib/smarthome-custom-contract.ts
 * Quell-Hash: sha256:b7e56a8abc4a27815f3b962b0f360af1b9f1edd38f02885999751b92a51b27b6
 * Erzeugung: npm run sync:ts-runtime-executables
 *
 * Zweck:
 * Diese JavaScript-Datei ist das ausführbare Build-Artefakt für lib/smarthome-custom-contract.js.
 * Die fachliche Bearbeitung erfolgt ab 0.7.131 in der TypeScript-Quelle.
 * Ab 0.7.132 sind doppelte Legacy-JS-Bäume wie .nwcore entfernt.
 *
 * Pflege-Regel:
 * 1. Änderung zuerst in src-ts/runtime-executables/ vornehmen.
 * 2. npm run sync:ts-runtime-executables ausführen.
 * 3. npm run test:runtime-executables prüfen.
 */
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomViewError = void 0;
exports.getCustomProfileId = getCustomProfileId;
exports.normalizeCustomView = normalizeCustomView;
exports.getCustomControlProfiles = getCustomControlProfiles;
exports.getCustomViewCatalog = getCustomViewCatalog;
exports.assertCustomViewBindings = assertCustomViewBindings;
class CustomViewError extends Error {
    constructor(code) {
        super(code);
        this.code = code;
        this.name = 'CustomViewError';
    }
}
exports.CustomViewError = CustomViewError;
const KINDS = ['clock', 'gauge', 'wind', 'presence', 'markdown', 'iframe', 'universal', 'energyFlow', 'weather', 'newline'];
const LABELS = Object.freeze({
    clock: 'Uhr', gauge: 'Messinstrument', wind: 'Wind', presence: 'Anwesenheit', markdown: 'Notiz',
    iframe: 'Webansicht', universal: 'Universelle Ansicht', energyFlow: 'Energiefluss', weather: 'Wetter', newline: 'Zeilenumbruch',
});
const ALL_TYPES = ['boolean', 'number', 'string'];
const COMMON_KEYS = ['title', 'color', 'widgetIcon'];
const KEYS = new Map([
    ['clock', ['style', 'showDate', 'showDow', 'showSeconds', 'showSun', 'latitude', 'longitude', 'timeZone']],
    ['gauge', ['minValue', 'maxValue', 'gaugeUnit', 'gaugeName', 'colorLevels', 'usePercentage', 'smoothGradient', 'decimals']],
    ['wind', []], ['presence', ['invert', 'absentMode']],
    ['markdown', ['text', 'markdown', 'fontSize', 'align']],
    ['iframe', ['url', 'refreshInterval', 'appendTimestamp', 'clickAction']],
    ['universal', ['secondaryName', 'digits', 'widgetIconActive', 'opacityFalse', 'opacityTrue', 'colorLevels', 'icons',
            'actionType', 'actionValue', 'actionConfirm', 'actionConfirmScope', 'actionConfirmText', 'quickChart', 'quickChartInterval']],
    ['energyFlow', ['producers', 'consumers', 'batteryName', 'batteryColor', 'batteryIcon']],
    ['weather', ['weatherSource', 'cityName', 'forecastDays']], ['newline', []],
]);
function fail(code = 'EOS_CUSTOM_CONFIG_INVALID') { throw new CustomViewError(code); }
function row(value) {
    if (value === null || typeof value !== 'object' || Array.isArray(value))
        return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}
/** Reject getters and dangerous keys before any property value is inspected. */
function safeGraph(value) {
    const seen = new Set();
    let budget = 2048;
    let characters = 0;
    function visit(current, depth) {
        if (--budget < 0 || depth > 12)
            fail();
        if (current === null || typeof current === 'boolean')
            return;
        if (typeof current === 'number') {
            if (!Number.isFinite(current))
                fail();
            return;
        }
        if (typeof current === 'string') {
            characters += current.length;
            if (current.length > 32768 || characters > 131072)
                fail();
            return;
        }
        if (typeof current !== 'object' || (!row(current) && !Array.isArray(current)) || seen.has(current))
            fail();
        seen.add(current);
        if (Array.isArray(current) && current.length > 128)
            fail();
        const descriptors = Object.getOwnPropertyDescriptors(current);
        for (const [key, descriptor] of Object.entries(descriptors)) {
            if (key === '__proto__' || key === 'constructor' || key === 'prototype' || descriptor.get || descriptor.set)
                fail();
            if (Array.isArray(current) && key === 'length')
                continue;
            const item = descriptor.value;
            visit(item, depth + 1);
        }
        seen.delete(current);
    }
    visit(value, 0);
}
function keysOnly(value, allowed) {
    if (Object.keys(value).some(key => !allowed.includes(key)))
        fail();
}
function text(value, fallback, max = 160, multiline = false) {
    if (value === undefined)
        return fallback;
    if (typeof value !== 'string' || value.length > max || (multiline ? /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/ : /[\u0000-\u001f\u007f]/).test(value))
        fail();
    return value;
}
function bool(value, fallback) {
    if (value === undefined)
        return fallback;
    if (typeof value !== 'boolean')
        fail();
    return value;
}
function number(value, fallback, min, max, integer = false) {
    if (value === undefined)
        return fallback;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value)))
        fail();
    return value;
}
function choice(value, choices, fallback) {
    if (value === undefined)
        return fallback;
    const selected = choices.find(item => item === value);
    if (selected === undefined)
        fail();
    return selected;
}
function color(value, fallback = '') {
    const result = text(value, fallback, 7);
    if (result && !/^#[a-f\d]{6}$/i.test(result))
        fail();
    return result.toLowerCase();
}
function icon(value) {
    const result = text(value, '', 48);
    if (result && !/^[a-zA-Z0-9_-]+$/.test(result))
        fail();
    return result;
}
function levels(value) {
    if (value === undefined)
        return [];
    if (!Array.isArray(value) || value.length > 32)
        fail();
    const result = [];
    for (const item of value) {
        if (!row(item))
            fail();
        keysOnly(item, ['value', 'color']);
        if (item.value === undefined || item.color === undefined)
            fail();
        const threshold = number(item.value, 0, -1e12, 1e12);
        if (result.some(entry => entry.value === threshold))
            fail();
        result.push({ value: threshold, color: color(item.color) });
    }
    return result.sort((a, b) => a.value - b.value);
}
function energyEntries(value) {
    if (value === undefined)
        return [];
    if (!Array.isArray(value) || value.length > 31)
        fail();
    const result = [];
    for (const [offset, item] of value.entries()) {
        if (!row(item))
            fail();
        keysOnly(item, ['index', 'name', 'color', 'icon', 'unit', 'deviceType']);
        const index = number(item.index, offset + 1, 1, 31, true);
        if (result.some(entry => entry.index === index))
            fail();
        result.push({ index, name: text(item.name, '', 120), color: color(item.color), icon: icon(item.icon),
            unit: text(item.unit, '', 32), deviceType: text(item.deviceType, '', 48) });
    }
    return result;
}
function icons(value) {
    if (value === undefined)
        return [];
    if (!Array.isArray(value) || value.length > 3)
        fail();
    const result = [];
    for (const item of value) {
        if (!row(item))
            fail();
        keysOnly(item, ['slot', 'name', 'icon', 'color', 'invert']);
        const slot = choice(item.slot, ['ICON1', 'ICON2', 'ICON3'], 'ICON1');
        if (result.some(entry => entry.slot === slot))
            fail();
        result.push({ slot, name: text(item.name, '', 80), icon: icon(item.icon), color: color(item.color), invert: bool(item.invert, false) });
    }
    return result;
}
/** A browser navigation/embedding address, never a server-side fetch target. */
function browserUrl(value) {
    const result = text(value, '', 2048).trim();
    if (!result)
        return '';
    if (/[\\\u0000-\u0020\u007f]/.test(result) || result.startsWith('//'))
        fail('EOS_CUSTOM_URL_INVALID');
    try {
        const parsed = new URL(result, 'https://eos.invalid');
        if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password
            || (!result.startsWith('/') && !/^https?:\/\//i.test(result)))
            fail('EOS_CUSTOM_URL_INVALID');
    }
    catch {
        fail('EOS_CUSTOM_URL_INVALID');
    }
    return result;
}
function getCustomProfileId(kind) { return `custom_${kind}`; }
/** Null means no custom view. Invalid supplied configuration is never silently downgraded to another kind. */
function normalizeCustomView(value) {
    if (value === undefined || value === null)
        return null;
    safeGraph(value);
    if (!row(value))
        fail();
    keysOnly(value, ['kind', 'settings']);
    const kind = KINDS.find(item => item === value.kind);
    if (!kind)
        fail('EOS_CUSTOM_KIND_INVALID');
    const input = value.settings ?? {};
    if (!row(input))
        fail();
    keysOnly(input, [...COMMON_KEYS, ...(KEYS.get(kind) ?? [])]);
    const settings = {};
    if (input.title !== undefined)
        settings.title = text(input.title, '', 160);
    if (input.color !== undefined)
        settings.color = color(input.color);
    if (input.widgetIcon !== undefined)
        settings.widgetIcon = icon(input.widgetIcon);
    switch (kind) {
        case 'clock': {
            settings.style = choice(input.style, ['digital', 'analog'], 'digital');
            settings.showDate = bool(input.showDate, true);
            settings.showDow = bool(input.showDow, true);
            settings.showSeconds = bool(input.showSeconds, true);
            settings.showSun = bool(input.showSun, false);
            if (input.latitude !== undefined)
                settings.latitude = number(input.latitude, 0, -90, 90);
            if (input.longitude !== undefined)
                settings.longitude = number(input.longitude, 0, -180, 180);
            if (input.timeZone !== undefined) {
                const zone = text(input.timeZone, '', 80);
                if (zone) {
                    try {
                        new Intl.DateTimeFormat('de', { timeZone: zone }).format(0);
                    }
                    catch {
                        fail('EOS_CUSTOM_TIMEZONE_INVALID');
                    }
                }
                settings.timeZone = zone;
            }
            break;
        }
        case 'gauge':
            settings.minValue = number(input.minValue, 0, -1e12, 1e12);
            settings.maxValue = number(input.maxValue, 100, -1e12, 1e12);
            if (settings.maxValue <= settings.minValue)
                fail('EOS_CUSTOM_RANGE_INVALID');
            settings.gaugeUnit = text(input.gaugeUnit, '', 32);
            settings.gaugeName = text(input.gaugeName, '', 120);
            settings.colorLevels = levels(input.colorLevels);
            settings.usePercentage = bool(input.usePercentage, false);
            settings.smoothGradient = bool(input.smoothGradient, false);
            settings.decimals = number(input.decimals, 1, 0, 6, true);
            break;
        case 'presence':
            settings.invert = bool(input.invert, false);
            settings.absentMode = choice(input.absentMode, ['hide', 'dim'], 'dim');
            break;
        case 'markdown':
            if (input.text !== undefined && input.markdown !== undefined && input.text !== input.markdown)
                fail();
            settings.text = text(input.text ?? input.markdown, '', 32768, true);
            settings.fontSize = choice(input.fontSize, ['s', 'm', 'l', 'xl'], 'm');
            settings.align = choice(input.align, ['left', 'center'], 'left');
            break;
        case 'iframe':
            settings.url = browserUrl(input.url);
            settings.refreshInterval = number(input.refreshInterval, 0, 0, 3600, true);
            settings.appendTimestamp = bool(input.appendTimestamp, false);
            settings.clickAction = choice(input.clickAction, ['dialog', 'newTab', 'sameTab'], 'dialog');
            break;
        case 'universal': {
            settings.secondaryName = text(input.secondaryName, '', 120);
            settings.digits = number(input.digits, 1, 0, 6, true);
            settings.widgetIconActive = icon(input.widgetIconActive);
            settings.opacityFalse = number(input.opacityFalse, 0, 0, 1);
            settings.opacityTrue = number(input.opacityTrue, 1, 0, 1);
            settings.colorLevels = levels(input.colorLevels);
            settings.icons = icons(input.icons);
            settings.actionType = choice(input.actionType, ['value', 'toggle'], 'value');
            const actionValue = input.actionValue === undefined ? true : input.actionValue;
            if (!['string', 'number', 'boolean'].includes(typeof actionValue) || (typeof actionValue === 'string' && actionValue.length > 8192))
                fail();
            settings.actionValue = actionValue;
            settings.actionConfirm = choice(input.actionConfirm, ['none', 'dialog'], 'none');
            settings.actionConfirmScope = choice(input.actionConfirmScope, ['on', 'off', 'both'], 'both');
            settings.actionConfirmText = text(input.actionConfirmText, '', 500);
            settings.quickChart = bool(input.quickChart, false);
            settings.quickChartInterval = number(input.quickChartInterval, 300, 10, 86400, true);
            break;
        }
        case 'energyFlow':
            settings.producers = energyEntries(input.producers);
            settings.consumers = energyEntries(input.consumers);
            settings.batteryName = text(input.batteryName, '', 120);
            settings.batteryColor = color(input.batteryColor);
            settings.batteryIcon = icon(input.batteryIcon);
            break;
        case 'weather':
            settings.weatherSource = choice(input.weatherSource, ['adapter'], 'adapter');
            settings.cityName = text(input.cityName, '', 120);
            settings.forecastDays = number(input.forecastDays, 7, 0, 7, true);
            break;
        case 'wind':
        case 'newline': break;
    }
    return { kind, settings };
}
function field(key, label, types = ['number'], unit = '', write = false) {
    return { key, label, type: types.length === 1 ? types[0] ?? 'mixed' : 'mixed', types: [...types], read: true, write,
        kind: write ? 'text' : 'readout', unit, indicator: false, required: false };
}
function fieldsFor(kind) {
    switch (kind) {
        case 'gauge': return [field('VALUE', 'Messwert'), field('SECOND', 'Zweiter Messwert')];
        case 'wind': return [field('WIND_DIRECTION', 'Windrichtung', ['number', 'string'], '°'), field('WIND_SPEED', 'Windgeschwindigkeit'), field('WIND_GUST', 'Böen')];
        case 'presence': return [field('PRESENCE', 'Anwesenheit', ['boolean'])];
        case 'universal': return [field('VALUE', 'Hauptwert', ALL_TYPES), field('SECOND', 'Zusatzwert', ALL_TYPES),
            field('OPACITY', 'Sichtbarkeit', ALL_TYPES), field('ICON1', 'Indikator 1', ALL_TYPES), field('ICON2', 'Indikator 2', ALL_TYPES),
            field('ICON3', 'Indikator 3', ALL_TYPES), field('ACTION', 'Bedienaktion', ALL_TYPES, '', true)];
        case 'energyFlow': {
            const fields = [];
            for (let index = 1; index <= 31; index++) {
                fields.push(field(`PRODUCER${index}`, `Erzeuger ${index}`, ['number'], 'W'), field(`PRODUCER${index}_TODAY`, `Erzeuger ${index} heute`, ['number'], 'kWh'));
                fields.push(field(`CONSUMER${index}`, `Verbraucher ${index}`, ['number'], 'W'), field(`CONSUMER${index}_TODAY`, `Verbraucher ${index} heute`, ['number'], 'kWh'));
            }
            fields.push(field('BATTERY_SOC', 'Batterieladung', ['number'], '%'), field('BATTERY_VOLTAGE', 'Batteriespannung', ['number'], 'V'), field('BATTERY_CURRENT', 'Batteriestrom', ['number'], 'A'), field('BATTERY_POWER', 'Batterieleistung', ['number'], 'W'));
            return fields;
        }
        case 'weather': {
            const fields = [field('ACTUAL', 'Temperatur', ['number'], '°C'), field('ICON', 'Wettersymbol', ['string', 'number']),
                field('WEATHER', 'Wetterbeschreibung', ['string']), field('HUMIDITY', 'Luftfeuchtigkeit', ['number'], '%'),
                field('WIND_SPEED', 'Windgeschwindigkeit'), field('WIND_DIRECTION', 'Windrichtung', ['number', 'string']),
                field('PRESSURE', 'Luftdruck'), field('PRECIPITATION_CHANCE', 'Niederschlagswahrscheinlichkeit', ['number'], '%'),
                field('REAL_FEEL_TEMPERATURE', 'Gefühlte Temperatur', ['number'], '°C'), field('UV', 'UV-Index'),
                field('TEMP_MIN', 'Tiefsttemperatur', ['number'], '°C'), field('TEMP_MAX', 'Höchsttemperatur', ['number'], '°C'),
                field('TEMP', 'Tagestemperatur', ['number'], '°C'), field('DOW', 'Wochentag', ['string', 'number']),
                field('STATE', 'Tagesbeschreibung', ['string']), field('LOCATION', 'Ort', ['string'])];
            for (let index = 1; index <= 7; index++)
                fields.push(field(`ICON${index}`, `Wettersymbol ${index}`, ['string', 'number']), field(`TEMP_MIN${index}`, `Tiefsttemperatur ${index}`, ['number'], '°C'), field(`TEMP_MAX${index}`, `Höchsttemperatur ${index}`, ['number'], '°C'), field(`DOW${index}`, `Wochentag ${index}`, ['string', 'number']), field(`STATE${index}`, `Wetterbeschreibung ${index}`, ['string']), field(`PRECIPITATION_CHANCE${index}`, `Niederschlagswahrscheinlichkeit ${index}`, ['number'], '%'));
            return fields;
        }
        case 'clock':
        case 'markdown':
        case 'iframe':
        case 'newline': return [];
    }
}
/** Fresh catalog copies; fixed keys and one writable ACTION, no arbitrary-key fallback. */
function getCustomControlProfiles() {
    return KINDS.map(kind => ({ id: getCustomProfileId(kind), label: LABELS[kind], fields: fieldsFor(kind) }));
}
function settingDescriptors(kind) {
    const defaults = new Map(Object.entries(normalizeCustomView({ kind, settings: {} })?.settings ?? {}));
    const labels = new Map([
        ['title', 'Titel'], ['color', 'Akzentfarbe'], ['widgetIcon', 'Symbol'], ['style', 'Uhrdarstellung'],
        ['showDate', 'Datum anzeigen'], ['showDow', 'Wochentag anzeigen'], ['showSeconds', 'Sekunden anzeigen'], ['showSun', 'Sonnenzeiten anzeigen'],
        ['latitude', 'Breitengrad'], ['longitude', 'Längengrad'], ['timeZone', 'Zeitzone (leer: Endgerät)'],
        ['minValue', 'Unterer Messbereich'], ['maxValue', 'Oberer Messbereich'], ['gaugeUnit', 'Einheit'], ['gaugeName', 'Messwertname'],
        ['colorLevels', 'Farbschwellen'], ['usePercentage', 'Prozentanzeige'], ['smoothGradient', 'Farbverlauf'], ['decimals', 'Nachkommastellen'],
        ['invert', 'Anwesenheit invertieren'], ['absentMode', 'Darstellung bei Abwesenheit'], ['text', 'Notiztext'],
        ['fontSize', 'Schriftgröße'], ['align', 'Ausrichtung'], ['url', 'Webadresse'], ['refreshInterval', 'Aktualisierung in Sekunden (0: aus)'],
        ['appendTimestamp', 'Zeitstempel an URL anhängen'], ['clickAction', 'Beim Öffnen'], ['secondaryName', 'Zusatzwertname'], ['digits', 'Nachkommastellen'],
        ['widgetIconActive', 'Aktives Symbol'], ['opacityFalse', 'Deckkraft bei inaktiv'], ['opacityTrue', 'Deckkraft bei aktiv'], ['icons', 'Statussymbole'],
        ['actionType', 'Bedienaktion'], ['actionValue', 'Zu sendender Wert'], ['actionConfirm', 'Bestätigung'], ['actionConfirmScope', 'Bestätigung für'],
        ['actionConfirmText', 'Bestätigungstext'], ['quickChart', 'Lokaler Kurzverlauf'], ['quickChartInterval', 'Sichtbarer Kurzverlauf in Sekunden'],
        ['producers', 'Erzeuger'], ['consumers', 'Verbraucher'], ['batteryName', 'Batteriename'], ['batteryColor', 'Batteriefarbe'], ['batteryIcon', 'Batteriesymbol'],
        ['weatherSource', 'Wetterdatenquelle'], ['cityName', 'Ortsname'], ['forecastDays', 'Vorhersagetage'],
    ]);
    const selections = new Map([
        ['style', [['digital', 'Digital'], ['analog', 'Analog']]], ['absentMode', [['hide', 'Ausblenden'], ['dim', 'Abdimmen']]],
        ['fontSize', [['s', 'Klein'], ['m', 'Mittel'], ['l', 'Groß'], ['xl', 'Sehr groß']]], ['align', [['left', 'Linksbündig'], ['center', 'Zentriert']]],
        ['clickAction', [['dialog', 'In EOS öffnen'], ['newTab', 'Neuer Tab'], ['sameTab', 'Im selben Tab']]],
        ['actionType', [['value', 'Festgelegten Wert senden'], ['toggle', 'Gemeldeten Zustand umschalten']]],
        ['actionConfirm', [['none', 'Ohne Zusatzdialog'], ['dialog', 'Bestätigungsdialog']]],
        ['actionConfirmScope', [['on', 'Einschalten'], ['off', 'Ausschalten'], ['both', 'Jede Aktion']]],
        ['weatherSource', [['adapter', 'Zugeordnete lokale Datenpunkte']]],
    ]);
    const ranges = new Map([
        ['latitude', [-90, 90, 0.000001]], ['longitude', [-180, 180, 0.000001]],
        ['minValue', [-1e12, 1e12, 0.001]], ['maxValue', [-1e12, 1e12, 0.001]], ['decimals', [0, 6, 1]], ['digits', [0, 6, 1]],
        ['opacityFalse', [0, 1, 0.01]], ['opacityTrue', [0, 1, 0.01]], ['refreshInterval', [0, 3600, 1]],
        ['quickChartInterval', [10, 86400, 1]], ['forecastDays', [0, 7, 1]],
    ]);
    return [...COMMON_KEYS, ...(KEYS.get(kind) ?? [])].filter(key => key !== 'markdown').map(key => {
        const value = defaults.get(key);
        const options = selections.get(key);
        const bounds = ranges.get(key);
        let type = typeof value === 'boolean' ? 'boolean' : bounds ? 'number' : 'string';
        if (options)
            type = 'select';
        else if (key === 'color' || key === 'batteryColor')
            type = 'color';
        else if (key === 'url')
            type = 'url';
        else if (key === 'text')
            type = 'markdown';
        else if (key === 'actionValue')
            type = 'scalar';
        else if (key === 'colorLevels')
            type = 'colorLevels';
        else if (key === 'icons')
            type = 'icons';
        else if (key === 'producers' || key === 'consumers')
            type = 'energyEntries';
        const result = { key, label: labels.get(key) ?? key, type };
        if (value !== undefined)
            result.default = value;
        else if (COMMON_KEYS.includes(key))
            result.default = '';
        if (options)
            result.options = options.map(([option, label]) => ({ value: option, label }));
        if (bounds) {
            result.min = bounds[0];
            result.max = bounds[1];
            result.step = bounds[2];
        }
        if (type === 'string')
            result.maxLength = key.includes('Icon') || key === 'widgetIcon' ? 48 : key === 'timeZone' ? 80
                : key === 'actionConfirmText' ? 500 : key === 'gaugeUnit' ? 32
                    : ['gaugeName', 'secondaryName', 'batteryName', 'cityName'].includes(key) ? 120 : 160;
        if (type === 'markdown')
            result.maxLength = 32768;
        if (type === 'url')
            result.maxLength = 2048;
        if (type === 'scalar')
            result.maxLength = 8192;
        if (type === 'colorLevels')
            result.maxItems = 32;
        if (type === 'energyEntries')
            result.maxItems = 31;
        if (type === 'icons')
            result.maxItems = 3;
        return result;
    });
}
function getCustomViewCatalog() {
    return KINDS.map(kind => ({ kind, label: LABELS[kind], profile: getCustomProfileId(kind),
        settingKeys: [...COMMON_KEYS, ...(KEYS.get(kind) ?? [])], settings: settingDescriptors(kind), fields: fieldsFor(kind) }));
}
/** Checks the relation only; generic normalization must still validate every actual DP ID/object permission. */
function assertCustomViewBindings(customInput, controlsInput) {
    const custom = normalizeCustomView(customInput);
    if (!custom)
        return;
    safeGraph(controlsInput);
    if (!row(controlsInput) || controlsInput.profile !== getCustomProfileId(custom.kind) || !Array.isArray(controlsInput.fields)
        || controlsInput.fields.length > 128)
        fail('EOS_CUSTOM_BINDING_INVALID');
    keysOnly(controlsInput, ['profile', 'fields']);
    const specs = fieldsFor(custom.kind);
    const mapped = new Set();
    const seen = new Set();
    for (const raw of controlsInput.fields) {
        if (!row(raw) || typeof raw.key !== 'string')
            fail('EOS_CUSTOM_BINDING_INVALID');
        keysOnly(raw, ['key', 'readId', 'writeId']);
        const spec = specs.find(candidate => candidate.key === raw.key);
        if (!spec || seen.has(raw.key))
            fail('EOS_CUSTOM_BINDING_INVALID');
        seen.add(raw.key);
        if (raw.writeId && !spec.write)
            fail('EOS_CUSTOM_BINDING_INVALID');
        if (raw.readId !== undefined && typeof raw.readId !== 'string')
            fail('EOS_CUSTOM_BINDING_INVALID');
        if (raw.writeId !== undefined && typeof raw.writeId !== 'string')
            fail('EOS_CUSTOM_BINDING_INVALID');
        if ((typeof raw.readId === 'string' && raw.readId) || (typeof raw.writeId === 'string' && raw.writeId))
            mapped.add(raw.key);
    }
    for (const [prefix, items] of [['PRODUCER', custom.settings.producers], ['CONSUMER', custom.settings.consumers]]) {
        for (const item of items ?? [])
            if (!mapped.has(`${prefix}${item.index}`))
                fail('EOS_CUSTOM_BINDING_MISSING');
    }
    for (const item of custom.settings.icons ?? [])
        if (!mapped.has(item.slot))
            fail('EOS_CUSTOM_BINDING_MISSING');
}
