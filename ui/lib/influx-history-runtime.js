/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
/**
 * AUTO-GENERATED RUNTIME FILE - NICHT MANUELL BEARBEITEN.
 *
 * Quelle: src-ts/runtime-executables/lib/influx-history-runtime.ts
 * Quell-Hash: sha256:69439306eafe8fca4aa96f13ffd0fc24db8c528ea4b9bdb495636509b041741d
 * Erzeugung: npm run sync:ts-runtime-executables
 *
 * Zweck:
 * Diese JavaScript-Datei ist das ausführbare Build-Artefakt für lib/influx-history-runtime.js.
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
exports.InfluxHistoryRuntime = void 0;
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Historisiert ausschließlich ausdrücklich registrierte EOS-Zeitreihen über den direkten InfluxDB-2-Transport.
 * Daten und Wirkung: Übernimmt bestätigte State-Schreibvorgänge mit Originalzeit; begrenzt Warteschlangen, Leseparallelität und Laufzeiten ohne die EMS-Regelung auf Netzwerkantworten warten zu lassen.
 * Zusammenhang: Die Hauptlaufzeit konfiguriert den Dienst, registriert Export-States und führt ihn beim Abschalten begrenzt zu Ende.
 * Bei Änderungen: Betriebsartwechsel, Schlüsselverlust, verzögerte Antworten, Überlauf, Abbruch und getrennte Lese-/Schreibfehler prüfen; keine Lücken mit Nullwerten füllen.
 */
const influx_direct_1 = require("./influx-direct");
const node_perf_hooks_1 = require("node:perf_hooks");
const MAX_TARGETS = 2000;
const MAX_POINTS = 2000;
const MAX_BYTES = 4 * 1024 * 1024;
const MAX_BATCH_BYTES = 256 * 1024;
const safeCode = (error) => {
    const code = error && typeof error === 'object' && 'code' in error ? error.code : '';
    return typeof code === 'string' && /^EOS_INFLUX_[A-Z_]{1,64}$/.test(code) ? code : 'EOS_INFLUX_REQUEST_FAILED';
};
class InfluxHistoryRuntime {
    constructor(namespace, factory = config => new influx_direct_1.InfluxDirectClient(config)) {
        this.namespace = namespace;
        this.factory = factory;
        this.registrations = new Map();
        this.client = null;
        this.generation = 0;
        this.signature = '';
        this.queue = [];
        this.queuedBytes = 0;
        this.busy = false;
        this.activePoints = 0;
        this.activeBytes = 0;
        this.reads = [];
        this.activeReads = 0;
        this.timer = null;
        this.provider = 'adapter';
        this.closed = false;
        this.closing = false;
        this.drainDeadline = 0;
        this.drainTimer = null;
        this.drainPromise = null;
        this.finishDrain = null;
        this.droppedPoints = 0;
        this.lastWriteAt = null;
        this.lastReadAt = null;
        this.configError = '';
        this.readError = '';
        this.writeError = '';
        this.legacyRecordings = new Set();
    }
    configure(history) {
        const provider = history?.provider === 'influxdb2' ? 'influxdb2' : 'adapter';
        const signature = JSON.stringify([provider, provider === 'influxdb2' ? history?.influxdb2 : null, history?.credentialError]);
        if (!this.closed && signature === this.signature)
            return;
        this.stopGeneration();
        this.closed = false;
        this.closing = false;
        this.provider = provider;
        this.signature = signature;
        this.lastWriteAt = null;
        this.lastReadAt = null;
        this.configError = '';
        this.readError = '';
        this.writeError = '';
        for (const registration of this.registrations.values())
            delete registration.last;
        if (provider === 'influxdb2') {
            try {
                if (history?.credentialError)
                    throw Object.assign(new Error(), { code: history.credentialError });
                if (!history?.influxdb2)
                    throw Object.assign(new Error(), { code: 'EOS_INFLUX_CONFIG_INVALID' });
                this.client = this.factory(history.influxdb2);
            }
            catch (error) {
                this.configError = safeCode(error);
            }
        }
    }
    register(localId, changesOnly = false) {
        if (typeof localId !== 'string' || !localId || /[\u0000-\u001f\u007f*]/u.test(localId))
            return false;
        const id = localId.startsWith(`${this.namespace}.`) ? localId : `${this.namespace}.${localId}`;
        if (id.length > 512 || id.trim() !== id)
            return false;
        const existing = this.registrations.get(id);
        if (existing) {
            existing.changesOnly = changesOnly;
            return true;
        }
        if (this.registrations.size >= MAX_TARGETS)
            return false;
        this.registrations.set(id, { changesOnly });
        return true;
    }
    legacyRecording(localId, active) {
        const id = localId.startsWith(`${this.namespace}.`) ? localId : `${this.namespace}.${localId}`;
        if (!this.registrations.has(id))
            return;
        if (active)
            this.legacyRecordings.add(id);
        else
            this.legacyRecordings.delete(id);
    }
    /** Capture before the ioBroker write; commit only after that write succeeds. */
    capture(localId, state, ack) {
        if (this.closed || this.closing || !this.client || typeof localId !== 'string')
            return null;
        const id = localId.startsWith(`${this.namespace}.`) ? localId : `${this.namespace}.${localId}`;
        if (!this.registrations.has(id))
            return null;
        const object = state && typeof state === 'object' && 'val' in state ? state : null;
        const val = object ? object.val : state;
        const acknowledged = object && 'ack' in object ? object.ack : ack;
        const quality = object && 'q' in object ? object.q : undefined;
        const ts = object && 'ts' in object ? object.ts : Date.now();
        if (acknowledged !== true || (quality !== undefined && quality !== 0) ||
            typeof ts !== 'number' || !Number.isSafeInteger(ts) || ts < 0 || ts > Date.now() + 1000 ||
            !(['number', 'boolean', 'string'].includes(typeof val)) ||
            (typeof val === 'number' && !Number.isFinite(val)) || (typeof val === 'string' && (val.length > 16384 || /[\r\n\u0000]/u.test(val))))
            return null;
        return { generation: this.generation, point: { id, ts, val: val } };
    }
    commit(captured) {
        if (!captured || this.closed || this.closing || !this.client || captured.generation !== this.generation)
            return;
        const registration = this.registrations.get(captured.point.id);
        if (!registration || (registration.changesOnly && registration.last === captured.point.val))
            return;
        const bytes = Buffer.byteLength(JSON.stringify(captured.point), 'utf8');
        if (this.queue.length + this.activePoints >= MAX_POINTS || this.queuedBytes + this.activeBytes + bytes > MAX_BYTES) {
            this.droppedPoints++;
            this.writeError = 'EOS_INFLUX_QUEUE_FULL';
            return;
        }
        registration.last = captured.point.val;
        this.queue.push({ point: captured.point, bytes });
        this.queuedBytes += bytes;
        this.schedule();
    }
    query(id, options) {
        if (!this.client || this.closed || this.closing)
            return Promise.reject(Object.assign(new Error('EOS_INFLUX_NOT_CONFIGURED'), { code: 'EOS_INFLUX_NOT_CONFIGURED' }));
        if (this.reads.length >= 64)
            return Promise.reject(Object.assign(new Error('EOS_INFLUX_BUSY'), { code: 'EOS_INFLUX_BUSY' }));
        return new Promise((resolve, reject) => {
            const job = { id, options, deadline: node_perf_hooks_1.performance.now() + 5000, resolve, reject, timer: setTimeout(() => {
                    const index = this.reads.indexOf(job);
                    if (index >= 0)
                        this.reads.splice(index, 1);
                    reject(Object.assign(new Error('EOS_INFLUX_TIMEOUT'), { code: 'EOS_INFLUX_TIMEOUT' }));
                }, 5000) };
            job.timer.unref();
            this.reads.push(job);
            this.drainReads();
        });
    }
    status() {
        const lastError = this.configError || this.writeError || this.readError;
        const legacyRecordingCount = this.provider === 'influxdb2' ? this.legacyRecordings.size : 0;
        return { provider: this.provider, state: this.closed ? 'closed' : this.provider !== 'influxdb2' ? 'disabled' : lastError ? 'error' : 'ready', queueDepth: this.queue.length + this.activePoints, droppedPoints: this.droppedPoints, lastWriteAt: this.lastWriteAt, lastReadAt: this.lastReadAt, lastError, readError: this.readError, writeError: this.writeError, writeVerified: this.lastWriteAt !== null, legacyRecordingCount, warnings: legacyRecordingCount ? ['EOS_INFLUX_LEGACY_RECORDING_ACTIVE'] : [] };
    }
    close() { this.closed = true; this.stopGeneration(); }
    /** Normal unload has a shorter bound than the hosted runtime's four-second stop. */
    drainAndClose(timeoutMs = 3000) {
        if (this.closed)
            return Promise.resolve();
        if (this.drainPromise)
            return this.drainPromise;
        this.closing = true;
        this.cancelQueuedReads();
        this.drainDeadline = node_perf_hooks_1.performance.now() + Math.max(1, Math.min(3000, timeoutMs));
        this.drainPromise = new Promise(resolve => { this.finishDrain = resolve; });
        const result = this.drainPromise;
        this.drainTimer = setTimeout(() => this.close(), Math.max(1, this.drainDeadline - node_perf_hooks_1.performance.now()));
        if (!this.busy && !this.queue.length)
            this.close();
        else
            this.schedule();
        return result;
    }
    cancelQueuedReads() {
        for (const job of this.reads) {
            clearTimeout(job.timer);
            job.reject(Object.assign(new Error('EOS_INFLUX_CLOSED'), { code: 'EOS_INFLUX_CLOSED' }));
        }
        this.reads = [];
    }
    stopGeneration() {
        this.generation++;
        this.client?.close();
        this.client = null;
        if (this.timer)
            clearTimeout(this.timer);
        this.timer = null;
        this.droppedPoints += this.queue.length + this.activePoints;
        this.queue = [];
        this.queuedBytes = 0;
        this.busy = false;
        this.activePoints = 0;
        this.activeBytes = 0;
        this.cancelQueuedReads();
        this.activeReads = 0;
        if (this.drainTimer)
            clearTimeout(this.drainTimer);
        this.drainTimer = null;
        this.finishDrain?.();
        this.finishDrain = null;
        this.drainPromise = null;
    }
    drainReads() {
        while (this.activeReads < 6 && this.reads.length && !this.closed && !this.closing && this.client) {
            const job = this.reads.shift();
            if (!job)
                return;
            clearTimeout(job.timer);
            const remaining = job.deadline - node_perf_hooks_1.performance.now();
            if (remaining < 1) {
                job.reject(Object.assign(new Error('EOS_INFLUX_TIMEOUT'), { code: 'EOS_INFLUX_TIMEOUT' }));
                continue;
            }
            const generation = this.generation;
            const client = this.client;
            this.activeReads++;
            void client.query(job.id, job.options, remaining).then(result => {
                if (generation !== this.generation || this.closed)
                    throw Object.assign(new Error(), { code: 'EOS_INFLUX_CLOSED' });
                this.lastReadAt = Date.now();
                this.readError = '';
                job.resolve(result);
            }).catch((error) => {
                const code = safeCode(error);
                if (generation === this.generation && !this.closed)
                    this.readError = code;
                job.reject(Object.assign(new Error(code), { code }));
            }).finally(() => {
                if (generation === this.generation) {
                    this.activeReads--;
                    this.drainReads();
                }
            });
        }
    }
    schedule() {
        if (this.timer || this.busy || this.closed || !this.client || !this.queue.length)
            return;
        this.timer = setTimeout(() => { this.timer = null; void this.flush(); }, 0);
        this.timer.unref();
    }
    async flush() {
        const client = this.client;
        const generation = this.generation;
        if (!client || this.closed || this.busy)
            return;
        const batch = [];
        let bytes = 0;
        while (this.queue.length && batch.length < 100) {
            const next = this.queue.at(0);
            if (!next || bytes + next.bytes > MAX_BATCH_BYTES)
                break;
            this.queue.shift();
            this.queuedBytes -= next.bytes;
            bytes += next.bytes;
            batch.push(next.point);
        }
        if (!batch.length)
            return;
        this.busy = true;
        this.activePoints = batch.length;
        this.activeBytes = bytes;
        let failure = '';
        try {
            await client.write(batch, this.closing ? Math.max(1, this.drainDeadline - node_perf_hooks_1.performance.now()) : 5000);
        }
        catch (error) {
            failure = safeCode(error);
        }
        if (this.closed || generation !== this.generation)
            return;
        this.busy = false;
        this.activePoints = 0;
        this.activeBytes = 0;
        if (failure) {
            this.writeError = failure;
            this.droppedPoints += batch.length;
            for (const point of batch) {
                const registration = this.registrations.get(point.id);
                if (registration && registration.last === point.val)
                    delete registration.last;
            }
        }
        else {
            this.lastWriteAt = Date.now();
            this.writeError = '';
        }
        if (this.closing && !this.queue.length)
            this.close();
        else
            this.schedule();
    }
}
exports.InfluxHistoryRuntime = InfluxHistoryRuntime;
