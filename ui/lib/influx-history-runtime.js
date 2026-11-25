/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
/**
 * AUTO-GENERATED RUNTIME FILE - NICHT MANUELL BEARBEITEN.
 *
 * Quelle: src-ts/runtime-executables/lib/influx-history-runtime.ts
 * Quell-Hash: sha256:53f3b1263393815f932b1237228c54d4997e402c131d8bdcf9b9aefaac0ee301
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
 * Aufgabe: Historisiert ausschließlich ausdrücklich registrierte EOS-Zeitreihen über direkte InfluxDB-2- oder geschützte PostgreSQL-Verbindungen.
 * Daten und Wirkung: Übernimmt bestätigte State-Schreibvorgänge mit Originalzeit; begrenzt Warteschlangen, Leseparallelität und Laufzeiten ohne die EMS-Regelung auf Netzwerkantworten warten zu lassen.
 * Zusammenhang: Die Hauptlaufzeit konfiguriert den Dienst, registriert Export-States und führt ihn beim Abschalten begrenzt zu Ende.
 * Bei Änderungen: Betriebsartwechsel, Schlüsselverlust, verzögerte Antworten, Überlauf, Abbruch und getrennte Lese-/Schreibfehler prüfen; keine Lücken mit Nullwerten füllen.
 */
const influx_direct_1 = require("./influx-direct");
const postgres_history_1 = require("./postgres-history");
const node_perf_hooks_1 = require("node:perf_hooks");
const MAX_TARGETS = 2000;
const MAX_POINTS = 2000;
const MAX_BYTES = 4 * 1024 * 1024;
const MAX_BATCH_BYTES = 256 * 1024;
const safeCode = (error, fallback = 'EOS_INFLUX_REQUEST_FAILED') => {
    const code = error && typeof error === 'object' && 'code' in error ? error.code : '';
    return typeof code === 'string' && /^EOS_(?:INFLUX|POSTGRES)_[A-Z_]{1,64}$/.test(code) ? code : fallback;
};
class InfluxHistoryRuntime {
    constructor(namespace, factory = config => new influx_direct_1.InfluxDirectClient(config), postgresFactory = namespace => new postgres_history_1.PostgresHistoryClient(namespace), ownerNamespace = namespace) {
        this.namespace = namespace;
        this.factory = factory;
        this.postgresFactory = postgresFactory;
        this.ownerNamespace = ownerNamespace;
        this.registrations = new Map();
        this.client = null;
        this.generation = 0;
        this.signature = '';
        this.queue = [];
        this.retriedPoints = 0;
        this.retryDelayMs = 0;
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
    code(suffix) { return `EOS_${this.provider === 'postgresql' ? 'POSTGRES' : 'INFLUX'}_${suffix}`; }
    isProvisioned() { return this.client?.provisioned === true; }
    configure(history) {
        const provider = history?.provider === 'influxdb2' ? 'influxdb2' : history?.provider === 'postgresql' ? 'postgresql' : 'adapter';
        const signature = JSON.stringify([provider, provider === 'influxdb2' ? history?.influxdb2 : null, history?.credentialError, history?.postgresql]);
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
        if (provider === 'postgresql') {
            try {
                this.client = this.postgresFactory(this.ownerNamespace);
                const client = this.client;
                const generation = this.generation;
                if (client.check)
                    void client.check().then(() => {
                        if (generation === this.generation && !this.closed && this.lastReadAt === null && !this.readError) {
                            this.lastReadAt = Date.now();
                        }
                    }).catch((error) => {
                        if (generation === this.generation && !this.closed && this.lastReadAt === null && !this.readError)
                            this.readError = safeCode(error, this.code('REQUEST_FAILED'));
                    });
            }
            catch (error) {
                this.configError = safeCode(error, this.code('REQUEST_FAILED'));
            }
        }
        else if (provider === 'influxdb2') {
            try {
                if (history?.credentialError)
                    throw Object.assign(new Error(), { code: history.credentialError });
                if (!history?.influxdb2)
                    throw Object.assign(new Error(), { code: 'EOS_INFLUX_CONFIG_INVALID' });
                this.client = this.factory(history.influxdb2);
            }
            catch (error) {
                this.configError = safeCode(error, this.code('REQUEST_FAILED'));
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
            this.writeError = this.code('QUEUE_FULL');
            return;
        }
        registration.last = captured.point.val;
        this.queue.push({ point: captured.point, bytes, retries: 0 });
        this.queuedBytes += bytes;
        this.schedule();
    }
    query(id, options) {
        if (!this.client || this.closed || this.closing)
            return Promise.reject(Object.assign(new Error(this.code('NOT_CONFIGURED')), { code: this.code('NOT_CONFIGURED') }));
        if (this.reads.length >= 64)
            return Promise.reject(Object.assign(new Error(this.code('BUSY')), { code: this.code('BUSY') }));
        return new Promise((resolve, reject) => {
            const job = { id, options, deadline: node_perf_hooks_1.performance.now() + 5000, resolve, reject, timer: setTimeout(() => {
                    const index = this.reads.indexOf(job);
                    if (index >= 0)
                        this.reads.splice(index, 1);
                    reject(Object.assign(new Error(this.code('TIMEOUT')), { code: this.code('TIMEOUT') }));
                }, 5000) };
            job.timer.unref();
            this.reads.push(job);
            this.drainReads();
        });
    }
    status() {
        const lastError = this.configError || this.writeError || this.readError || this.client?.lastError || '';
        const legacyRecordingCount = this.provider !== 'adapter' ? this.legacyRecordings.size : 0;
        return { provider: this.provider, state: this.closed ? 'closed' : this.provider === 'adapter' ? 'disabled' : lastError ? 'error' : 'ready', queueDepth: this.queue.length + this.activePoints, droppedPoints: this.droppedPoints, lastWriteAt: this.lastWriteAt, lastReadAt: this.lastReadAt, lastError, readError: this.readError, writeError: this.writeError, writeVerified: this.lastWriteAt !== null, retriedPoints: this.retriedPoints, legacyRecordingCount, warnings: legacyRecordingCount ? ['EOS_INFLUX_LEGACY_RECORDING_ACTIVE'] : [] };
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
            job.reject(Object.assign(new Error(this.code('CLOSED')), { code: this.code('CLOSED') }));
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
        this.retryDelayMs = 0;
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
        while (this.activeReads < (this.provider === 'postgresql' ? 3 : 6) && this.reads.length && !this.closed && !this.closing && this.client) {
            const job = this.reads.shift();
            if (!job)
                return;
            clearTimeout(job.timer);
            const remaining = job.deadline - node_perf_hooks_1.performance.now();
            if (remaining < 1) {
                job.reject(Object.assign(new Error(this.code('TIMEOUT')), { code: this.code('TIMEOUT') }));
                continue;
            }
            const generation = this.generation;
            const client = this.client;
            this.activeReads++;
            void client.query(job.id, job.options, remaining).then(result => {
                if (generation !== this.generation || this.closed)
                    throw Object.assign(new Error(), { code: this.code('CLOSED') });
                this.lastReadAt = Date.now();
                this.readError = '';
                job.resolve(result);
            }).catch((error) => {
                const code = safeCode(error, this.code('REQUEST_FAILED'));
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
        this.timer = setTimeout(() => { this.timer = null; void this.flush(); }, this.closing ? 0 : this.retryDelayMs);
        this.timer.unref();
    }
    async flush() {
        const client = this.client;
        const generation = this.generation;
        if (!client || this.closed || this.busy)
            return;
        const batch = [];
        const items = [];
        let bytes = 0;
        while (this.queue.length && batch.length < 100) {
            const next = this.queue.at(0);
            if (!next || bytes + next.bytes > MAX_BATCH_BYTES)
                break;
            this.queue.shift();
            this.queuedBytes -= next.bytes;
            bytes += next.bytes;
            batch.push(next.point);
            items.push(next);
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
            failure = safeCode(error, this.code('REQUEST_FAILED'));
        }
        if (this.closed || generation !== this.generation)
            return;
        this.busy = false;
        this.activePoints = 0;
        this.activeBytes = 0;
        if (failure) {
            this.writeError = failure;
            const retryable = this.provider === 'postgresql' && !this.closing && ['EOS_POSTGRES_CONNECTION_FAILED', 'EOS_POSTGRES_TIMEOUT', 'EOS_POSTGRES_BUSY'].includes(failure) && items.every(item => item.retries < 2);
            if (retryable) {
                for (const item of items)
                    item.retries++;
                this.queue.unshift(...items);
                this.queuedBytes += bytes;
                this.retriedPoints += items.length;
                this.retryDelayMs = 1000 * (items[0]?.retries || 1);
                this.schedule();
                return;
            }
            this.droppedPoints += batch.length;
            this.retryDelayMs = 0;
            for (const point of batch) {
                const registration = this.registrations.get(point.id);
                if (registration && registration.last === point.val)
                    delete registration.last;
            }
        }
        else {
            this.lastWriteAt = Date.now();
            this.writeError = '';
            this.retryDelayMs = 0;
        }
        if (this.closing && !this.queue.length)
            this.close();
        else
            this.schedule();
    }
}
exports.InfluxHistoryRuntime = InfluxHistoryRuntime;
