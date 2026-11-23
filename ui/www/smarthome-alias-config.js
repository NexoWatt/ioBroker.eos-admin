/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
/**
 * AUTO-GENERATED RUNTIME FILE - NICHT MANUELL BEARBEITEN.
 *
 * Quelle: src-ts/runtime-executables/www/smarthome-alias-config.ts
 * Quell-Hash: sha256:c6c5a42108349e9a2803c10c27cde0016cc7abc44bcfaa03280adb83215c0675
 * Erzeugung: npm run sync:ts-runtime-executables
 *
 * Zweck:
 * Diese JavaScript-Datei ist das ausführbare Build-Artefakt für www/smarthome-alias-config.js.
 * Die fachliche Bearbeitung erfolgt ab 0.7.131 in der TypeScript-Quelle.
 * Ab 0.7.132 sind doppelte Legacy-JS-Bäume wie .nwcore entfernt.
 *
 * Pflege-Regel:
 * 1. Änderung zuerst in src-ts/runtime-executables/ vornehmen.
 * 2. npm run sync:ts-runtime-executables ausführen.
 * 3. npm run test:runtime-executables prüfen.
 */
(function () {
    'use strict';
    const host = window;
    if (host.NW_SH_ALIAS_CONFIG)
        return;
    const requestLimit = 4 * 1024 * 1024;
    const responseLimit = 5 * 1024 * 1024;
    let busy = false;
    function record(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
    function inspect(value, depth = 0, budget = { value: 100000 }) {
        if (--budget.value < 0 || depth > 16)
            throw new Error('Alias-Auswahl ist zu groß oder zu tief verschachtelt.');
        if (value === undefined || value === null || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value)))
            return;
        if (typeof value === 'string' && value.length <= 32768)
            return;
        if (Array.isArray(value) && value.length <= 8192) {
            value.forEach(item => inspect(item, depth + 1, budget));
            return;
        }
        if (record(value) && Object.keys(value).length <= 2048) {
            for (const [key, child] of Object.entries(value)) {
                if (['__proto__', 'constructor', 'prototype'].includes(key))
                    throw new Error('Ungültiger Schlüssel in Alias-Auswahl.');
                inspect(child, depth + 1, budget);
            }
            return;
        }
        throw new Error('Ungültige Alias-Auswahl.');
    }
    function clone(value) { inspect(value); const parsed = JSON.parse(JSON.stringify(value)); return parsed; }
    function canCreate() { return host.NW_AUTH?.hasCapability('mapping.edit') === true; }
    function validateDevices(value) {
        if (!Array.isArray(value) || value.length === 0 || value.length > 100)
            throw new Error('Für die Alias-Anlage 1 bis 100 Geräte auswählen.');
        const ids = new Set();
        let slots = 0;
        return value.map((item) => {
            const copy = clone(item);
            if (!record(copy) || typeof copy.id !== 'string' || !copy.id || copy.id.length > 80 || ids.has(copy.id))
                throw new Error('Geräte-IDs der Alias-Auswahl fehlen oder sind doppelt.');
            const io = copy.io;
            if (!record(io) || !record(io.deviceControls) || !Array.isArray(io.deviceControls.fields))
                throw new Error('Für die Alias-Anlage zuerst ein vollständiges Bedienprofil zuordnen.');
            slots += io.deviceControls.fields.length;
            if (slots > 2000)
                throw new Error('Eine Alias-Auswahl darf höchstens 2000 Profilfunktionen enthalten.');
            ids.add(copy.id);
            return copy;
        });
    }
    function ids(value) {
        if (!Array.isArray(value) || value.length > 8192 || value.some(id => typeof id !== 'string' || id.length > 512))
            throw new Error('Ungültige Alias-Antwort. Der Entwurf bleibt unverändert.');
        return value;
    }
    function failure(status, payload) {
        const partial = record(payload) ? payload : {};
        const created = Array.isArray(partial.created) ? partial.created.length : 0;
        const reused = Array.isArray(partial.reused) ? partial.reused.length : 0;
        const uncertain = Array.isArray(partial.uncertain) ? partial.uncertain.length : 0;
        const reason = status === 401 ? 'Sitzung abgelaufen. Bitte erneut bei EOS anmelden.' : status === 403 ? 'Berechtigung mapping.edit für die Alias-Anlage fehlt.' : 'Alias-Anlage konnte nicht vollständig bestätigt werden.';
        return new Error(`${reason} Der Geräteentwurf bleibt unverändert.${created || reused || uncertain ? ` Rückmeldung: ${created} angelegt, ${reused} wiederverwendet, ${uncertain} unbestätigt.` : ''} Bereits angelegte Alias-Objekte können bestehen bleiben; es erfolgt keine automatische Wiederholung.`);
    }
    async function create(input) {
        if (!canCreate())
            throw new Error('Berechtigung mapping.edit für die Alias-Anlage fehlt.');
        if (busy)
            throw new Error('Eine Alias-Anlage läuft bereits. Bitte deren Ergebnis abwarten.');
        const originals = validateDevices(input);
        const body = JSON.stringify({ devices: originals });
        if (new TextEncoder().encode(body).byteLength > requestLimit)
            throw new Error('Alias-Auswahl ist zu groß. Bitte weniger Geräte auswählen.');
        busy = true;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 30000);
        try {
            const response = await fetch('/api/smarthome/aliases', { method: 'POST', credentials: 'same-origin', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body, signal: controller.signal });
            if (!response.body)
                throw failure(response.status, null);
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let text = '';
            let bytes = 0;
            try {
                for (;;) {
                    const part = await reader.read();
                    if (part.done)
                        break;
                    bytes += part.value.byteLength;
                    if (bytes > responseLimit) {
                        controller.abort();
                        throw new Error('Alias-Antwort überschreitet die erlaubte Größe.');
                    }
                    text += decoder.decode(part.value, { stream: true });
                }
                text += decoder.decode();
            }
            finally {
                reader.releaseLock();
            }
            const payload = JSON.parse(text);
            inspect(payload);
            if (!response.ok || !record(payload) || payload.ok !== true)
                throw failure(response.status, payload);
            const returned = validateDevices(payload.devices);
            if (returned.length !== originals.length)
                throw new Error('Unvollständige Alias-Antwort. Der Entwurf bleibt unverändert.');
            const mapped = new Map(returned.map(device => [device.id, device]));
            const devices = originals.map(original => {
                const responseDevice = mapped.get(original.id);
                if (!responseDevice || !record(responseDevice.io))
                    throw new Error('Alias-Antwort passt nicht zur Geräteauswahl. Der Entwurf bleibt unverändert.');
                const next = { ...original, io: responseDevice.io };
                if (responseDevice.importProvenance !== undefined)
                    next.importProvenance = responseDevice.importProvenance;
                else if (original.importProvenance !== undefined)
                    throw new Error('Quellenbasis fehlt in der Alias-Antwort. Der Entwurf bleibt unverändert.');
                return next;
            });
            return { devices, created: ids(payload.created), reused: ids(payload.reused) };
        }
        catch (error) {
            if (controller.signal.aborted)
                throw new Error('Alias-Anlage nach 30 Sekunden oder wegen einer zu großen Antwort nicht bestätigt. Bereits angelegte Alias-Objekte können vorhanden sein; der Entwurf bleibt unverändert. Bitte vor einer bewussten Wiederholung prüfen.');
            if (error instanceof Error && error.name !== 'TypeError' && error.name !== 'SyntaxError')
                throw error;
            throw new Error('Keine vollständige Antwort auf die Alias-Anlage. Bereits angelegte Alias-Objekte können vorhanden sein; der Entwurf bleibt unverändert. Es erfolgt keine automatische Wiederholung.');
        }
        finally {
            clearTimeout(timer);
            busy = false;
        }
    }
    host.NW_SH_ALIAS_CONFIG = Object.freeze({ canCreate, create });
})();
