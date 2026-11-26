/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
/**
 * AUTO-GENERATED RUNTIME FILE - NICHT MANUELL BEARBEITEN.
 *
 * Quelle: src-ts/runtime-executables/lib/ephemeral-cache.ts
 * Quell-Hash: sha256:726b8b689a45fd0422ce656823bf117ea83097c7fb136cf955953f82d90e4887
 * Erzeugung: npm run sync:ts-runtime-executables
 *
 * Zweck:
 * Diese JavaScript-Datei ist das ausführbare Build-Artefakt für lib/ephemeral-cache.js.
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
exports.ExpiringSnapshot = exports.EphemeralMap = void 0;
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Begrenzt kurzlebige UI-Lesecaches und gibt abgelaufene Inhalte auch ohne nächsten HTTP-Aufruf frei.
 * Daten und Wirkung: Hält ausschließlich lesende Antworten und Objekt-Snapshots; Messwerte, Regelzyklen und persistierte Einstellungen bleiben unberührt.
 * Bei Änderungen: Monotone Fristen, begrenzte Einträge, parallele Abrufe und Bereinigung nach Stop mit den Cache-Lebenszyklustests prüfen.
 */
const node_perf_hooks_1 = require("node:perf_hooks");
const clock = {
    now: () => node_perf_hooks_1.performance.now(),
    schedule: (callback, delayMs) => { const timer = setTimeout(callback, delayMs); timer.unref(); return timer; },
    cancel: timer => clearTimeout(timer),
};
/** A bounded Map with real idle expiry; reads never prolong the freshness window. */
class EphemeralMap extends Map {
    constructor(ttlMs, maxEntries, time = clock) {
        super();
        this.ttlMs = ttlMs;
        this.maxEntries = maxEntries;
        this.time = time;
        this.expiry = new Map();
        if (!Number.isFinite(ttlMs) || ttlMs < 1 || !Number.isSafeInteger(maxEntries) || maxEntries < 1) {
            throw new Error('EOS_CACHE_CONFIGURATION');
        }
    }
    set(key, value) {
        this.delete(key);
        while (this.size >= this.maxEntries) {
            const oldest = super.keys().next();
            if (oldest.done)
                break;
            this.delete(oldest.value);
        }
        super.set(key, value);
        const timer = this.time.schedule(() => this.delete(key), this.ttlMs);
        this.expiry.set(key, { at: this.time.now() + this.ttlMs, timer });
        return this;
    }
    has(key) {
        const item = this.expiry.get(key);
        if (item && this.time.now() >= item.at)
            this.delete(key);
        return super.has(key);
    }
    get(key) {
        return this.has(key) ? super.get(key) : undefined;
    }
    delete(key) {
        const item = this.expiry.get(key);
        if (item)
            this.time.cancel(item.timer);
        this.expiry.delete(key);
        return super.delete(key);
    }
    clear() {
        for (const item of this.expiry.values())
            this.time.cancel(item.timer);
        this.expiry.clear();
        super.clear();
    }
}
exports.EphemeralMap = EphemeralMap;
/** One full discovery snapshot at a time, including simultaneous forced refreshes. */
class ExpiringSnapshot {
    constructor(load, ttlMs, time = clock) {
        this.load = load;
        this.time = time;
        this.pending = null;
        this.closed = false;
        this.cache = new EphemeralMap(ttlMs, 1, time);
    }
    get retained() { return this.cache.has('snapshot'); }
    get loading() { return this.pending !== null; }
    get(force = false, maxAgeMs) {
        if (this.closed)
            return Promise.reject(new Error('EOS_UI_STOPPING'));
        // A refresh already in progress is newer than the previously cached snapshot.
        if (this.pending)
            return this.pending;
        const cached = !force ? this.cache.get('snapshot') : undefined;
        if (cached && (maxAgeMs === undefined || this.time.now() - cached.startedAt <= maxAgeMs)) {
            return Promise.resolve(cached.value);
        }
        this.cache.clear();
        const startedAt = this.time.now();
        const request = Promise.resolve().then(this.load).then(value => {
            if (this.closed)
                throw new Error('EOS_UI_STOPPING');
            this.cache.set('snapshot', { value, startedAt });
            return value;
        });
        this.pending = request;
        const settled = () => { if (this.pending === request)
            this.pending = null; };
        void request.then(settled, settled);
        return request;
    }
    close() {
        this.closed = true;
        this.cache.clear();
        // An IO operation already running may finish, but cannot repopulate the cache.
        this.pending = null;
    }
}
exports.ExpiringSnapshot = ExpiringSnapshot;
