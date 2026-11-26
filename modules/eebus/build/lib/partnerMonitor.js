"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PartnerMonitor = void 0;
exports.emptyReport = emptyReport;
const node_crypto_1 = require("node:crypto");
const objectId = 'pairing.monitoredPartners';
const startupGraceMs = 120_000;
const pinValue = (v) => typeof v === 'string' && /^[a-f0-9]{64}$/i.test(v.replace(/:/g, '')) ? v.replace(/:/g, '').toUpperCase() : '';
function friendlyName(value) {
    return typeof value === 'string' && value === value.trim() && value.length <= 64 &&
        /\p{L}/u.test(value) && /^[\p{L}\p{M}\p{N} _()-]+$/u.test(value) &&
        !/[a-f\d]{16,}|(?:[a-f\d]{2}-){5}[a-f\d]{2}/i.test(value) && !/\d{9,}/.test(value);
}
const safeId = (v) => typeof v === 'string' && /^[a-f\d]{40}$/i.test(v);
const key = (id) => (0, node_crypto_1.createHash)('sha256').update('eebus:' + id.toLowerCase()).digest('hex');
function emptyReport(known) {
    return { state: known ? 'ok' : 'unknown', offline: [], totalOffline: 0,
        tracked: [], complete: known };
}
/** Names are local installer input. Discovery metadata, peer addresses and certificates never feed the customer report. */
class PartnerMonitor {
    store;
    live;
    now;
    partners = new Map();
    confirmed = new Set();
    suppressed = new Set();
    known = false;
    startedAt = 0;
    pending = Promise.resolve();
    constructor(store, live, now = () => performance.now()) {
        this.store = store;
        this.live = live;
        this.now = now;
    }
    async load() {
        this.startedAt = this.now();
        try {
            const state = await this.store.getStateAsync(objectId);
            if (state?.ack === false)
                throw Error();
            const rows = state?.val == null ? [] : JSON.parse(String(state.val));
            if (!Array.isArray(rows) || rows.length > 128)
                throw Error();
            const restored = new Map();
            for (const item of rows) {
                if (!item || !safeId(item.id) || !friendlyName(item.name) || !pinValue(item.pin) || typeof item.paused !== 'boolean' || restored.has(item.id))
                    throw Error();
                const row = { id: item.id.toUpperCase(), key: key(item.id), name: item.name, pin: pinValue(item.pin), paused: item.paused };
                if (restored.has(row.id))
                    throw Error();
                restored.set(row.id, row);
            }
            // Verify locally approved pairing on restart even when the peer is currently absent.
            const monitored = Array.from(restored.values()).filter(row => !row.paused);
            let changed = false;
            for (let start = 0; start < monitored.length; start += 8) {
                await Promise.all(monitored.slice(start, start + 8).map(async (row) => {
                    if (await this.trustedPin(row.id) !== row.pin) {
                        row.paused = true;
                        changed = true;
                    }
                }));
            }
            if (changed)
                await this.save(restored);
            else
                this.partners = restored;
            this.known = true;
        }
        catch {
            this.known = false;
        }
    }
    async trustedPin(id) {
        const [trust, pin] = await Promise.all(['trusted', 'pinnedFingerprint'].map(field => this.store.getStateAsync('devices.' + id + '.pairing.' + field)));
        return trust?.val === true && trust.ack !== false && pin?.ack !== false ? pinValue(pin?.val) : '';
    }
    change(write) {
        const op = this.pending.then(write);
        this.pending = op.catch(() => { });
        return op;
    }
    async save(next) {
        await this.store.setStateAsync(objectId, { val: JSON.stringify(Array.from(next.values(), ({ id, name, pin, paused }) => ({ id, name, pin, paused }))), ack: true });
        this.partners = next;
    }
    async configure(id, name, enabled) {
        if (!safeId(id))
            throw new Error('EEBUS_MONITOR_DEVICE');
        id = id.toUpperCase();
        return this.change(async () => {
            if (!this.known)
                throw new Error('EEBUS_MONITOR_STORAGE_UNAVAILABLE');
            const next = new Map(this.partners);
            if (enabled) {
                if (!friendlyName(name))
                    throw new Error('EEBUS_MONITOR_LOCAL_NAME');
                const pin = this.live(id) ? await this.trustedPin(id) : '';
                if (!pin || !this.live(id))
                    throw new Error('EEBUS_MONITOR_PAIRED_SESSION_REQUIRED');
                if (!next.has(id) && next.size >= 128)
                    throw new Error('EEBUS_MONITOR_CAPACITY');
                next.set(id, { id, key: key(id), name, pin, paused: false });
            }
            else {
                next.delete(id);
            }
            await this.save(next);
            if (enabled)
                this.confirmed.add(id);
            else
                this.confirmed.delete(id);
            this.suppressed.delete(id);
        });
    }
    pinChanged(id, value) {
        const row = this.partners.get(id.toUpperCase());
        return row && !row.paused && row.pin !== pinValue(value) ? this.pause(id) : Promise.resolve();
    }
    pause(id) {
        id = id.toUpperCase();
        this.suppressed.add(id);
        return this.change(async () => {
            const row = this.partners.get(id);
            if (row && !row.paused) {
                const next = new Map(this.partners);
                next.set(id, { ...row, paused: true });
                await this.save(next);
            }
            this.suppressed.delete(id);
        });
    }
    observed(id) { if (this.partners.has(id.toUpperCase()) && this.live(id))
        this.confirmed.add(id.toUpperCase()); }
    list() { return Array.from(this.partners.values(), ({ id, name, paused }) => ({ id, name, paused })); }
    report() {
        const report = emptyReport(this.known);
        if (!this.known)
            return report;
        for (const row of this.partners.values()) {
            const active = this.live(row.id);
            const state = row.paused || this.suppressed.has(row.id) ? 'disabled' : active ? 'online' :
                this.confirmed.has(row.id) || this.now() - this.startedAt >= startupGraceMs ? 'offline' : 'unknown';
            if (state === 'online')
                this.confirmed.add(row.id);
            report.tracked.push({ key: row.key, name: row.name, state });
            if (state === 'unknown' && report.state === 'ok')
                report.state = 'unknown';
            if (state === 'offline') {
                report.state = 'fault';
                report.totalOffline++;
                if (report.offline.length < 12)
                    report.offline.push({ name: row.name });
            }
        }
        return report;
    }
}
exports.PartnerMonitor = PartnerMonitor;
