#!/usr/bin/env node
/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Prüft den strikten Partner-Lifecycle einschließlich echter lokaler Persistenz und negativer Datenprojektion.
 * Daten und Wirkung: Erstellt isolierte temporäre Verzeichnisse; keine externen Ziele oder Gerätezugriffe.
 * Bei Änderungen: Neue erfolgreiche Fälle und verbindliche negative Grenzen gleichzeitig ergänzen.
 * Verknüpfungen: partner-runtime.ts, tsconfig.partner-runtime.json.
 */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const root = path.resolve(__dirname, '..');
let count = 0;
async function main() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'nexowatt-partner-runtime-'));
  try {
    const build = path.join(dir, 'build');
    const compiled = spawnSync(process.execPath, [path.join(root, 'node_modules/typescript/bin/tsc'), '-p', path.join(root, 'tsconfig.partner-runtime.json'), '--noEmit', 'false', '--outDir', build], { cwd: root, encoding: 'utf8' });
    assert.equal(compiled.status, 0, compiled.stdout + compiled.stderr);
    await fs.symlink(path.join(root, 'node_modules'), path.join(dir, 'node_modules'), 'dir');
    const { PartnerJournalStore, PartnerRuntime, readPartnerProvisioning, readPartnerProjection } = require(path.join(build, 'lib/partner-runtime.js'));
    const { defaultPartnerConfig } = require(path.join(build, 'lib/partner-contracts.js'));
    async function check(name, operation) { await operation(); count++; process.stdout.write(`PASS partner runtime: ${name}\n`); }
    async function dataDirectory(name) { const target = path.join(dir, name); await fs.mkdir(target, { mode: 0o700 }); return target; }
    let now = 1800000000000;
    const config = () => ({ ...defaultPartnerConfig(), configVersion: 2, enabled: true, partnerId: 'partner-test', endpoint: 'wss://example.org/dispatch', credentialRef: 'NEXOWATT_PARTNER_TEST', grants: [{ appId: 'arbitrage', resourceId: 'single', permissions: ['telemetry.read', 'capabilities.read', 'storage.charge.request', 'storage.discharge.request', 'dispatch.status.read', 'dispatch.cancel'] }], arbitrage: { profile: 'tradingOnly', maxCommandSeconds: 60, resources: [{ id: 'single', maxChargeW: 5000, maxDischargeW: 5000, maxImportW: 7000, maxExportW: 7000, allowGridCharge: true, allowGridExport: true, commissioned: true, minSocPct: 10, maxSocPct: 90 }] } });
    const provisioning = () => ({ partnerId: 'partner-test', allowedEndpoint: { hostname: 'example.org', port: 443, path: '/dispatch' }, credentials: { expiresAtMs: now + 3600000, bearerToken: randomBytes(32).toString('hex') } });
    const environment = () => ({ NEXOWATT_PARTNER_TEST: JSON.stringify(provisioning()) });
    const dispatch = (id, version = 2) => JSON.stringify({ protocol: 'nexowatt.partner.v1', id, type: 'storage.dispatch', appId: 'arbitrage', resourceId: 'single', action: 'charge', powerW: 1000, issuedAt: now, expiresAt: now + 30000, configVersion: version });
    await check('first journal initializes 0700/0600 and durable marker', async () => {
      const data = await dataDirectory('journal'); const store = new PartnerJournalStore(data);
      assert.deepEqual(await store.load(), []); assert.equal(await store.revokedVersion(), 0);
      assert.equal((await fs.stat(path.join(data, 'partner-runtime'))).mode & 0o777, 0o700);
      assert.equal((await fs.stat(path.join(data, 'partner-runtime/journal.json'))).mode & 0o777, 0o600);
      assert.equal((await fs.stat(path.join(data, 'partner-runtime.initialized'))).mode & 0o777, 0o600);
      await store.persist([]); assert.deepEqual(await new PartnerJournalStore(data).load(), []);
    });
    await check('missing journal after initialization blocks', async () => {
      const data = await dataDirectory('missing-journal'); const store = new PartnerJournalStore(data); await store.load();
      await fs.unlink(path.join(data, 'partner-runtime/journal.json')); await assert.rejects(new PartnerJournalStore(data).load());
    });
    await check('missing entire journal directory with marker blocks', async () => {
      const data = await dataDirectory('missing-directory'); const store = new PartnerJournalStore(data); await store.load();
      await fs.rm(path.join(data, 'partner-runtime'), { recursive: true }); await assert.rejects(new PartnerJournalStore(data).load());
    });
    await check('missing and corrupt marker block', async () => {
      const data = await dataDirectory('missing-marker'); await new PartnerJournalStore(data).load();
      await fs.unlink(path.join(data, 'partner-runtime.initialized')); await assert.rejects(new PartnerJournalStore(data).load());
      await fs.writeFile(path.join(data, 'partner-runtime.initialized'), 'corrupt', { mode: 0o600 }); await assert.rejects(new PartnerJournalStore(data).load());
    });
    await check('missing revoke fence blocks restart', async () => {
      const data = await dataDirectory('missing-fence'); await new PartnerJournalStore(data).load();
      await fs.unlink(path.join(data, 'partner-runtime/revocation.json')); await assert.rejects(new PartnerJournalStore(data).load());
    });
    await check('symlink journal and overly broad file permissions block', async () => {
      const data = await dataDirectory('journal-mode'); await new PartnerJournalStore(data).load();
      await fs.chmod(path.join(data, 'partner-runtime/journal.json'), 0o644); await assert.rejects(new PartnerJournalStore(data).load());
      await fs.unlink(path.join(data, 'partner-runtime/journal.json')); await fs.symlink(path.join(data, 'partner-runtime/revocation.json'), path.join(data, 'partner-runtime/journal.json')); await assert.rejects(new PartnerJournalStore(data).load());
    });
    await check('symlink parent and group-writable parent block', async () => {
      const data = await dataDirectory('parent'); const linked = path.join(dir, 'linked-parent'); await fs.symlink(data, linked, 'dir');
      await assert.rejects(new PartnerJournalStore(linked).load());
      const broad = await dataDirectory('broad-parent'); await fs.chmod(broad, 0o770); await assert.rejects(new PartnerJournalStore(broad).load());
    });
    await check('persist/load ordering survives hot-refresh overlap', async () => {
      const data = await dataDirectory('ordered'); const store = new PartnerJournalStore(data); await store.load();
      const entries = [{ id: 'one', marker: 'test' }];
      const writing = store.persist(entries); const reading = store.load(); await writing; assert.deepEqual(await reading, entries);
      await store.revoke(4); await store.revoke(2); assert.equal(await store.revokedVersion(), 4);
    });
    await check('credential references reject missing, malformed, overlarge and mismatched identity', async () => {
      assert.throws(() => readPartnerProvisioning(config(), {}));
      assert.throws(() => readPartnerProvisioning(config(), { NEXOWATT_PARTNER_TEST: '{}' }));
      assert.throws(() => readPartnerProvisioning(config(), { NEXOWATT_PARTNER_TEST: 'x'.repeat(65537) }));
      const p = provisioning(); p.partnerId = 'different'; assert.throws(() => readPartnerProvisioning(config(), { NEXOWATT_PARTNER_TEST: JSON.stringify(p) }));
      const c = config(); c.credentialRef = '../../secret'; assert.throws(() => readPartnerProvisioning(c, environment()));
      assert.equal(readPartnerProvisioning(config(), environment()).allowedEndpoint.path, '/dispatch');
    });
    await check('numeric telemetry projects only exact fresh resource values', async () => {
      const raw = { resourceId: 'single', valid: true, socPct: 50, powerW: -1000, gridPowerW: 300, socTs: now, powerTs: now, gridTs: now, privateDpId: 'must-not-leak' };
      const result = readPartnerProjection(config(), () => null, 'arbitrage', 'single', 'telemetry', now, raw);
      assert.deepEqual(result, { socPct: 50, powerW: -1000, gridPowerW: 300, updatedAtMs: now, available: true });
      for (const variant of [{ socTs: now - 15001 }, { powerTs: now + 1001 }, { socPct: '50' }, { powerW: null }, { resourceId: 'other' }, { valid: false }, { powerTs: now - 6000 }]) assert.deepEqual(readPartnerProjection(config(), () => null, 'arbitrage', 'single', 'telemetry', now, { ...raw, ...variant }), { available: false });
      assert.throws(() => readPartnerProjection(config(), () => null, 'arbitrage', 'unknown', 'telemetry', now, raw));
    });
    await check('balance is complete, recent, numeric and strips private metadata', async () => {
      const row = { startTs: now - 900000, endTs: now - 1000, quality: { status: 'complete' }, evcs: { totalKwh: 6, sourceBreakdown: { pvDirectKwh: 1, otherRenewableDirectKwh: 1, storedPvKwh: 1, storedOtherRenewableKwh: 1, gridDirectKwh: 1, storedGridKwh: 1 } }, privateAccount: 'must-not-leak' };
      const read = () => ({ value: JSON.stringify(row), ts: now });
      const result = readPartnerProjection(config(), read, 'energyLedger', 'site', 'balance', now);
      assert.equal(result.completeIntervalCount, 1); assert.equal(result.unknownKwh, 0); assert.equal(result.privateAccount, undefined);
      row.quality.status = 'partial'; assert.throws(() => readPartnerProjection(config(), read, 'energyLedger', 'site', 'balance', now));
      row.quality.status = 'complete'; row.evcs.totalKwh = '6'; assert.throws(() => readPartnerProjection(config(), read, 'energyLedger', 'site', 'balance', now));
      assert.throws(() => readPartnerProjection(config(), read, 'energyLedger', 'unapproved', 'balance', now));
    });
    await check('direct marketing absent measurements stay unavailable; no curtailment claim', async () => {
      assert.deepEqual(readPartnerProjection(config(), () => null, 'directMarketing', 'site', 'telemetry', now), { available: false });
      assert.deepEqual(readPartnerProjection(config(), () => null, 'directMarketing', 'site', 'capabilities', now), { curtailmentSupported: false, maxCurtailmentW: 0 });
    });
    async function fixture(name, suppliedData) {
      const data = suppliedData || await dataDirectory(name); let rootConfig = { partnerIntegrations: config() }; let active = true; let socketHooks = null; const sent = []; let starts = 0; let stops = 0;
      const provision = environment();
      const runtime = new PartnerRuntime({ dataDirectory: data, getRoot: () => rootConfig, isAppActive: () => active, controlAvailable: () => true, isResourceAvailable: id => id === 'single', readState: () => null, readTelemetry: () => null, now: () => now, environment: provision, createTransport: (_config, hooks) => { socketHooks = hooks; return { start() { starts++; hooks.onState('open', 'connected'); }, stop() { stops++; } }; } });
      await runtime.refresh();
      return { runtime, data, sent, get socketHooks() { return socketHooks; }, get starts() { return starts; }, get stops() { return stops; }, setActive: value => { active = value; }, setConfig: value => { rootConfig = { partnerIntegrations: value }; }, async message(text, current = () => true) { const controller = new AbortController(); await socketHooks.onMessage('partner-test', text, { isCurrent: current, signal: controller.signal, send: response => { sent.push(JSON.parse(response)); return true; } }); return sent.at(-1); } };
    }
    await check('standalone trading-only command accepted and survives only as replay journal', async () => {
      const f = await fixture('standalone'); assert.equal(f.starts, 1);
      assert.equal((await f.message(dispatch('command-one'))).code, 'ACCEPTED'); assert.equal(f.runtime.getCurrentRequest('single').powerW, 1000);
      f.runtime.stop(); const restarted = await fixture('unused', f.data);
      assert.equal(restarted.runtime.getCurrentRequest('single'), null); assert.equal((await restarted.message(dispatch('command-one'))).code, 'DUPLICATE'); restarted.runtime.stop();
    });
    await check('connection loss clears current request and duplicate never reapplies', async () => {
      const f = await fixture('disconnect'); await f.message(dispatch('command-two')); f.socketHooks.onState('backoff', 'network_error');
      assert.equal(f.runtime.getCurrentRequest('single'), null); f.socketHooks.onState('open', 'connected'); assert.equal((await f.message(dispatch('command-two'))).code, 'DUPLICATE'); assert.equal(f.runtime.getCurrentRequest('single'), null); f.runtime.stop();
    });
    await check('revocation survives failed config commit, refresh and restart', async () => {
      const f = await fixture('revoke'); await f.message(dispatch('command-three')); await f.runtime.invalidate('REVOKED');
      assert.equal(f.runtime.getCurrentRequest('single'), null); await f.runtime.refresh(); assert.equal(f.runtime.snapshot().connection, 'blocked'); assert.equal(f.starts, 1);
      f.runtime.stop(); const restarted = await fixture('unused2', f.data); assert.equal(restarted.starts, 0); assert.equal(restarted.runtime.snapshot().connection, 'blocked');
      const newer = config(); newer.configVersion = 3; restarted.setConfig(newer); await restarted.runtime.refresh(); assert.equal(restarted.starts, 1); now++; assert.equal((await restarted.message(dispatch('new-authority', 3))).code, 'ACCEPTED'); restarted.runtime.stop();
    });
    await check('app loss invalidates commands; toggling without explicit refresh cannot revive', async () => {
      const f = await fixture('app-disabled'); await f.message(dispatch('command-four')); f.setActive(false); assert.equal(f.runtime.getCurrentRequest('single'), null); f.setActive(true); assert.equal(f.runtime.getCurrentRequest('single'), null); f.runtime.stop();
    });
    await check('config change is checked at getter before any refresh', async () => {
      const f = await fixture('config-change'); await f.message(dispatch('command-five')); const changed = config(); changed.configVersion = 3; f.setConfig(changed); assert.equal(f.runtime.getCurrentRequest('single'), null); f.setConfig(config()); assert.equal(f.runtime.getCurrentRequest('single'), null); f.runtime.stop();
    });
    await check('credential expiry immediately blocks current request', async () => {
      const f = await fixture('expiry'); await f.message(dispatch('command-six')); const before = now; now += 3600001; assert.equal(f.runtime.getCurrentRequest('single'), null); now = before; assert.equal(f.runtime.getCurrentRequest('single'), null); f.runtime.stop();
    });
    await check('pending persistence completes before hot refresh reads; old generation cannot acknowledge', async () => {
      const f = await fixture('pending-refresh');
      const store = f.runtime.journal;
      const original = store.atomicWrite.bind(store);
      let release; let entered;
      const waiting = new Promise(resolve => { release = resolve; });
      const started = new Promise(resolve => { entered = resolve; });
      let once = true;
      store.atomicWrite = async (file, text) => { if (file.endsWith('journal.json') && once) { once = false; entered(); await waiting; } await original(file, text); };
      const pending = f.message(dispatch('pending-command'));
      await started;
      const refreshing = f.runtime.refresh();
      assert.equal(f.runtime.getCurrentRequest('single'), null);
      release(); await pending; await refreshing;
      assert.equal(f.sent.length, 0); assert.equal(f.starts, 2);
      assert.equal((await f.message(dispatch('pending-command'))).code, 'DUPLICATE'); assert.equal(f.runtime.getCurrentRequest('single'), null);
      f.runtime.stop();
    });
    await check('stale socket context cannot send or accept', async () => {
      const f = await fixture('stale-socket'); await f.message(dispatch('command-seven'), () => false); assert.equal(f.sent.length, 0); assert.equal(f.runtime.getCurrentRequest('single'), null); f.runtime.stop();
    });
    process.stdout.write(`PASS partner runtime total: ${count}; strict TypeScript; temporary filesystem cleaned.\n`);
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
}
main().catch(error => { process.stderr.write('FAIL partner runtime verification; assertions or strict compile failed.\n' + String(error.stack || '').split('\n').filter(line => line.trim().startsWith('at ')).slice(0, 4).join('\n') + '\n'); process.exitCode = 1; });
