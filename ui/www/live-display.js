/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
/**
 * AUTO-GENERATED RUNTIME FILE - NICHT MANUELL BEARBEITEN.
 *
 * Quelle: src-ts/runtime-executables/www/live-display.ts
 * Quell-Hash: sha256:076081f5b636a8be967f074d8dbe4360e6e762c520d640f373895335bbc58d9d
 * Erzeugung: npm run sync:ts-runtime-executables
 *
 * Zweck:
 * Diese JavaScript-Datei ist das ausführbare Build-Artefakt für www/live-display.js.
 * Die fachliche Bearbeitung erfolgt ab 0.7.131 in der TypeScript-Quelle.
 * Ab 0.7.132 sind doppelte Legacy-JS-Bäume wie .nwcore entfernt.
 *
 * Pflege-Regel:
 * 1. Änderung zuerst in src-ts/runtime-executables/ vornehmen.
 * 2. npm run sync:ts-runtime-executables ausführen.
 * 3. npm run test:runtime-executables prüfen.
 */
"use strict";
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Validiert ausschließlich sichtbare LIVE-Messwerte und Betriebsstatus.
 * Daten und Wirkung: Liest lokale Snapshot-Werte ohne API-/Schreibwirkung. Fehlend,
 * veraltet und offline bleiben unbekannt; die echte Zahl 0 bleibt eine Messung.
 * Bei Änderungen: Null, konstant bestätigte Werte, Zukunftszeit und Ausfälle prüfen.
 */
(() => {
    const record = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
    function entry(snapshot, key) {
        if (!record(snapshot) || !Object.hasOwn(snapshot, key))
            return null;
        const value = Reflect.get(snapshot, key);
        return record(value) ? value : null;
    }
    function number(value) {
        if (typeof value === 'number')
            return Number.isFinite(value) ? value : null;
        if (typeof value !== 'string' || value.length > 64 || !value.trim())
            return null;
        const text = value.trim().replace(',', '.');
        // Begrenzte lineare Dezimalprüfung ohne Regex-Backtracking, Exponent oder Hex.
        let digits = 0, separators = 0;
        for (let index = 0; index < text.length; index++) {
            const char = text.charAt(index);
            if (index === 0 && (char === '+' || char === '-'))
                continue;
            if (char >= '0' && char <= '9') {
                digits++;
                continue;
            }
            if (char === '.' && separators === 0) {
                separators++;
                continue;
            }
            return null;
        }
        if (digits === 0)
            return null;
        const parsed = Number(text);
        return Number.isFinite(parsed) ? parsed : null;
    }
    function current(row, now, maxAge, online) {
        const ts = row ? number(row.ts) : null;
        const quality = row?.q;
        return online && (quality === undefined || quality === 0) && ts !== null && ts > 0 && ts <= now + 5000 && now - ts <= maxAge;
    }
    function read(snapshot, key, now, maxAge, online) {
        const row = entry(snapshot, key);
        return current(row, now, maxAge, online) ? number(row?.value) : null;
    }
    function farm(snapshot, now, online) {
        const row = entry(snapshot, 'storageFarm.overviewJson');
        if (!row)
            return null; // Legacy snapshots have no atomic overview.
        const missing = { charge: null, discharge: null, soc: null };
        if (!current(row, now, 30000, online) || typeof row.value !== 'string' || row.value.length > 16384)
            return missing;
        try {
            const parsed = JSON.parse(row.value);
            if (!record(parsed) || parsed.v !== 1 || !record(parsed.members) || !record(parsed.battery) || !record(parsed.soc))
                return missing;
            const updatedAt = number(parsed.updatedAt), total = number(parsed.members.total);
            if (updatedAt === null || updatedAt <= 0 || updatedAt > now + 5000 || now - updatedAt > 30000 || total === null || !Number.isInteger(total) || total <= 0 || total > 128)
                return missing;
            const battery = parsed.battery, soc = parsed.soc;
            const complete = battery.complete === true && battery.valid === total && battery.total === total;
            const charge = number(battery.chargeW), discharge = number(battery.dischargeW), mean = number(soc.meanPct);
            const socComplete = soc.complete === true && soc.valid === total && soc.total === total;
            return { charge: complete && charge !== null && charge >= 0 ? charge : null,
                discharge: complete && discharge !== null && discharge >= 0 ? discharge : null,
                soc: socComplete && mean !== null && mean >= 0 && mean <= 100 ? mean : null };
        }
        catch {
            return missing;
        }
    }
    function status(snapshot, online, now) {
        if (!online)
            return { ems: 'Verbindung unterbrochen', grid: 'Messstatus unbekannt', summary: 'Verbindung unterbrochen' };
        const alive = entry(snapshot, 'ems.core.schedulerAlive');
        const heartbeat = read(snapshot, 'ems.core.schedulerHeartbeatAt', now, 30000, true);
        const running = alive?.value === true && heartbeat !== null && heartbeat > 0 && heartbeat <= now + 5000 && now - heartbeat <= 30000;
        const stopped = current(alive, now, 30000, true) && alive?.value === false;
        const nvp = entry(snapshot, 'ems.gridMeasurementFresh');
        const gridKnown = current(nvp, now, 30000, true) && typeof nvp?.value === 'boolean';
        const gridFresh = gridKnown && nvp?.value === true;
        return { ems: running ? 'Aktiv' : stopped ? 'Gestoppt' : 'Status unbekannt',
            grid: gridFresh ? 'Messung aktuell' : gridKnown ? 'Messung fehlt / veraltet' : 'Messstatus unbekannt',
            summary: running && gridFresh ? 'EMS aktiv · NVP-Messung aktuell' : stopped ? 'EMS gestoppt' : 'Betriebsstatus prüfen' };
    }
    const host = window;
    host.NexoWattLiveDisplay = Object.freeze({ read, farm, status });
})();
