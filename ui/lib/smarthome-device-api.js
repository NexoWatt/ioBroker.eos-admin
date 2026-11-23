/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
/**
 * AUTO-GENERATED RUNTIME FILE - NICHT MANUELL BEARBEITEN.
 *
 * Quelle: src-ts/runtime-executables/lib/smarthome-device-api.ts
 * Quell-Hash: sha256:9f73e71fc18b1af544aa5c8e29a3ff87b62aa0e6ae26bb573381d2cba20c4816
 * Erzeugung: npm run sync:ts-runtime-executables
 *
 * Zweck:
 * Diese JavaScript-Datei ist das ausführbare Build-Artefakt für lib/smarthome-device-api.js.
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
exports.buildDeviceControls = void 0;
exports.registerSmartHomeDeviceApi = registerSmartHomeDeviceApi;
exports.createDeviceSnapshotReader = createDeviceSnapshotReader;
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Verbindet vollständige Gerätebedienung und begrenzte Verläufe mit den geschützten EOS-APIs.
 * Daten und Wirkung: Verwendet ausschließlich gespeicherte Zuordnungen und prüft Sitzung, Lizenz und Konfiguration erneut vor jedem Schreiben.
 * Bei Änderungen: Direkte HTTP-Aufrufe, entzogene Rechte, Zuordnungswechsel, Zeitlimits und parallele Stoppbefehle gemeinsam prüfen.
 */
const smarthome_custom_contract_1 = require("./smarthome-custom-contract");
const smarthome_device_aliases_1 = require("./smarthome-device-aliases");
const smarthome_device_controls_1 = require("./smarthome-device-controls");
Object.defineProperty(exports, "buildDeviceControls", { enumerable: true, get: function () { return smarthome_device_controls_1.buildDeviceControls; } });
function row(value) { return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : {}; }
function failure(code) { throw new smarthome_device_controls_1.DeviceControlError(code); }
function idFrom(value) {
    if (typeof value !== 'string' || !value || value.length > 160 || /[\u0000-\u001f]/.test(value))
        return failure('EOS_CONTROL_DEVICE_INVALID');
    return value;
}
function configured(host, id) {
    const device = row(host.device(id));
    if (device.id !== id)
        return failure('EOS_CONTROL_DEVICE_UNKNOWN');
    const controls = (0, smarthome_device_controls_1.normalizeDeviceControls)(row(device.io).deviceControls);
    if (!controls)
        return failure('EOS_CONTROL_CONFIG_MISSING');
    const behavior = row(device.behavior);
    const readOnly = behavior.readOnly === true;
    const staleAfterMs = typeof behavior.staleAfterSec === 'number' && Number.isFinite(behavior.staleAfterSec)
        ? Math.max(0, Math.min(604800, behavior.staleAfterSec)) * 1000 : 0;
    return { controls, readOnly, staleAfterMs, signature: JSON.stringify({ controls, readOnly, staleAfterMs }) };
}
async function authorize(host, req) {
    if (!host.canOperate())
        return failure('EOS_CONTROL_UNAVAILABLE');
    if (!await host.authorize(req))
        return failure('EOS_CONTROL_FORBIDDEN');
    if (!host.canOperate())
        return failure('EOS_CONTROL_UNAVAILABLE');
}
function replyError(res, error) {
    const code = error instanceof smarthome_device_controls_1.DeviceControlError ? error.code : 'EOS_CONTROL_FAILED';
    const status = /FORBIDDEN|READ_ONLY/.test(code) ? 403 : /UNKNOWN/.test(code) ? 404
        : /CHANGED|BUSY/.test(code) ? 409 : /TIMEOUT|UNAVAILABLE|UNCERTAIN/.test(code) ? 503 : 400;
    return res.status(status).json({ ok: false, error: code });
}
function noStore(res) { res.setHeader('Cache-Control', 'no-store'); }
async function boundedRead(operation) {
    let timer;
    try {
        return await Promise.race([Promise.resolve().then(operation),
            new Promise((_resolve, reject) => { timer = setTimeout(() => reject(new smarthome_device_controls_1.DeviceControlError('EOS_CONTROL_HISTORY_TIMEOUT')), 5000); })]);
    }
    finally {
        if (timer !== undefined)
            clearTimeout(timer);
    }
}
/** Registrierung erfolgt innerhalb der bestehenden authentifizierten CSRF-Grenze; keine freien DP-IDs in Kundenanfragen. */
function registerSmartHomeDeviceApi(app, host, guard, discoveryGuard) {
    let activeCommands = 0;
    let activeStops = 0;
    let activeHistory = 0;
    const activeDevices = new Set();
    app.get('/api/smarthome/control-profiles', discoveryGuard, (_req, res) => {
        noStore(res);
        return res.json({ ok: true, profiles: (0, smarthome_device_controls_1.getControlProfiles)().filter(profile => profile.id !== 'chart'), customViews: (0, smarthome_custom_contract_1.getCustomViewCatalog)() });
    });
    app.post('/api/smarthome/aliases', discoveryGuard, async (req, res) => {
        noStore(res);
        try {
            const body = row(req.body);
            if (Object.keys(body).length !== 1 || !Array.isArray(body.devices))
                failure('EOS_ALIAS_REQUEST_INVALID');
            if (!host.authorizeMapping || !host.createObjectIfAbsent)
                failure('EOS_ALIAS_UNAVAILABLE');
            if (!await host.authorizeMapping(req))
                failure('EOS_ALIAS_FORBIDDEN');
            const expires = Date.now() + 30000;
            const result = await (0, smarthome_device_aliases_1.createDeviceAliases)(body.devices, {
                readObject: id => host.readObject(id),
                createObjectIfAbsent: async (id, object) => {
                    if (!host.authorizeMapping || !await host.authorizeMapping(req))
                        throw new smarthome_device_aliases_1.DeviceAliasError('EOS_ALIAS_FORBIDDEN');
                    if (Date.now() >= expires)
                        throw new smarthome_device_aliases_1.DeviceAliasError('EOS_ALIAS_TIMEOUT');
                    if (!host.createObjectIfAbsent)
                        throw new smarthome_device_aliases_1.DeviceAliasError('EOS_ALIAS_UNAVAILABLE');
                    return host.createObjectIfAbsent(id, object);
                },
            });
            let stillAllowed = false;
            try {
                stillAllowed = await host.authorizeMapping(req);
            }
            catch {
                stillAllowed = false;
            }
            if (!stillAllowed)
                throw new smarthome_device_aliases_1.DeviceAliasError('EOS_ALIAS_FORBIDDEN', result.created, result.reused);
            return res.json({ ok: true, ...result });
        }
        catch (error) {
            if (error instanceof smarthome_device_aliases_1.DeviceAliasError) {
                const status = /FORBIDDEN/.test(error.code) ? 403 : /TIMEOUT|UNAVAILABLE/.test(error.code) ? 503
                    : /COLLISION|BUSY/.test(error.code) ? 409 : 400;
                return res.status(status).json({ ok: false, error: error.code,
                    created: error.created, reused: error.reused, uncertain: error.uncertain });
            }
            return replyError(res, error);
        }
    });
    app.post('/api/smarthome/control', guard, async (req, res) => {
        noStore(res);
        let reserved = false;
        let stop = false;
        let id = '';
        try {
            const body = row(req.body);
            id = idFrom(body.id);
            if (Object.keys(body).some(key => !['id', 'key', 'value', 'confirmed', 'values'].includes(key)))
                failure('EOS_CONTROL_REQUEST_INVALID');
            const batch = body.values;
            if (batch !== undefined && (body.key !== undefined || body.value !== undefined || body.confirmed !== undefined))
                failure('EOS_CONTROL_REQUEST_INVALID');
            stop = batch === undefined && (body.key === 'STOP' || body.key === 'TILT_STOP');
            if (stop ? activeStops >= 16 : activeCommands >= 48 || activeDevices.has(id))
                failure('EOS_CONTROL_BUSY');
            if (stop)
                activeStops++;
            else {
                activeCommands++;
                activeDevices.add(id);
            }
            reserved = true;
            await authorize(host, req);
            const initial = configured(host, id);
            const expires = Date.now() + 5000;
            const writeHost = {
                readObject: (stateId) => host.readObject(stateId), readState: (stateId) => host.readState(stateId),
                writeState: async (stateId, value) => {
                    await authorize(host, req);
                    if (Date.now() >= expires)
                        failure('EOS_CONTROL_TIMEOUT');
                    if (configured(host, id).signature !== initial.signature)
                        failure('EOS_CONTROL_CONFIG_CHANGED');
                    return host.writeState(stateId, value);
                },
            };
            if (batch !== undefined) {
                if (!Array.isArray(batch) || batch.length < 1 || batch.length > 4)
                    failure('EOS_CONTROL_REQUEST_INVALID');
                const commands = batch.map((item) => {
                    const command = row(item);
                    if (Object.keys(command).length !== 2 || typeof command.key !== 'string' || !Object.hasOwn(command, 'value'))
                        failure('EOS_CONTROL_REQUEST_INVALID');
                    return { key: command.key, value: command.value };
                });
                await (0, smarthome_device_controls_1.executeDeviceControlBatch)(initial.controls, commands, writeHost, initial.readOnly, { staleAfterMs: initial.staleAfterMs });
            }
            else {
                if (typeof body.key !== 'string' || !Object.hasOwn(body, 'value') || (body.confirmed !== undefined && typeof body.confirmed !== 'boolean'))
                    failure('EOS_CONTROL_REQUEST_INVALID');
                await (0, smarthome_device_controls_1.executeDeviceControl)(initial.controls, { key: body.key, value: body.value, confirmed: body.confirmed === true }, writeHost, initial.readOnly, { staleAfterMs: initial.staleAfterMs });
            }
            // Übergabe an den Adapter bestätigt keine physische Ausführung am Gerät.
            return res.json({ ok: true, accepted: true });
        }
        catch (error) {
            return replyError(res, error);
        }
        finally {
            if (reserved) {
                if (stop)
                    activeStops--;
                else {
                    activeCommands--;
                    activeDevices.delete(id);
                }
            }
        }
    });
    app.get('/api/smarthome/control-history', guard, async (req, res) => {
        noStore(res);
        let reserved = false;
        try {
            if (activeHistory >= 4)
                failure('EOS_CONTROL_HISTORY_BUSY');
            activeHistory++;
            reserved = true;
            const query = row(req.query);
            const id = idFrom(query.id);
            if (Object.keys(query).some(key => !['id', 'key', 'from', 'to', 'maxPoints'].includes(key)))
                failure('EOS_CONTROL_REQUEST_INVALID');
            if (typeof query.key !== 'string')
                failure('EOS_CONTROL_REQUEST_INVALID');
            await authorize(host, req);
            const initial = configured(host, id);
            const mapping = initial.controls.fields.find(field => field.key === query.key);
            if (!mapping?.readId)
                failure('EOS_CONTROL_FIELD_UNKNOWN');
            const metadata = await (0, smarthome_device_controls_1.validateDeviceControlRead)(initial.controls, query.key, host);
            if (!['number', 'boolean'].includes(metadata.type))
                failure('EOS_CONTROL_HISTORY_TYPE');
            const now = Date.now();
            const end = query.to === undefined ? now : Number(query.to);
            const start = query.from === undefined ? end - 86400000 : Number(query.from);
            const count = query.maxPoints === undefined ? 240 : Number(query.maxPoints);
            if (![end, start, count].every(Number.isFinite) || start < 0 || end <= start || end > now + 60000
                || end - start > 366 * 86400000 || !Number.isInteger(count) || count < 2 || count > 1000)
                failure('EOS_CONTROL_HISTORY_RANGE');
            const raw = await boundedRead(() => host.history(mapping.readId || '', { start, end, count, aggregate: 'minmax' }));
            await authorize(host, req);
            if (configured(host, id).signature !== initial.signature)
                failure('EOS_CONTROL_CONFIG_CHANGED');
            const envelope = row(raw);
            if (envelope.error)
                failure('EOS_CONTROL_HISTORY_UNAVAILABLE');
            const rows = Array.isArray(raw) ? raw : Array.isArray(envelope.result) ? envelope.result : [];
            const points = [];
            // Lesearbeit und Antwort sind auch bei fehlerhaften History-Adaptern begrenzt.
            for (const entry of rows.slice(0, 10000)) {
                const point = row(entry);
                const ts = point.ts;
                const value = point.val;
                if (typeof ts !== 'number' || !Number.isFinite(ts) || ts < start || ts > end || (point.q !== undefined && point.q !== 0))
                    continue;
                if (typeof value !== 'boolean' && (typeof value !== 'number' || !Number.isFinite(value)))
                    continue;
                points.push({ ts, value });
            }
            points.sort((a, b) => a.ts - b.ts);
            const sampled = points.length <= count ? points : Array.from({ length: count }, (_, index) => points[Math.round(index * (points.length - 1) / (count - 1))]);
            return res.json({ ok: true, key: query.key, points: sampled, from: start, to: end, truncated: points.length > count || rows.length > 10000 });
        }
        catch (error) {
            return replyError(res, error);
        }
        finally {
            if (reserved)
                activeHistory--;
        }
    });
}
/** Nur pro Snapshot zwischenspeichern: kein zweiter dauerhafter Objekt-/State-Gesamtbestand im Arbeitsspeicher. */
function createDeviceSnapshotReader(host) {
    const objects = new Map();
    const states = new Map();
    const expires = Date.now() + 5000;
    const read = (cache, id, fetch) => {
        if (Date.now() >= expires)
            return Promise.reject(new smarthome_device_controls_1.DeviceControlError('EOS_CONTROL_TIMEOUT'));
        const found = cache.get(id);
        if (found)
            return found;
        const pending = fetch();
        if (cache.size < 8192)
            cache.set(id, pending);
        return pending;
    };
    return { readObject: id => read(objects, id, () => host.readObject(id)), readState: id => read(states, id, () => host.readState(id)) };
}
