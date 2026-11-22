#!/usr/bin/env node
/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
'use strict';
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Reproduziert Mesh-Handshake-Replays, DNS-Zielwechsel und sichere SMTP-Persistenz.
 * Daten und Wirkung: Ausschließlich synthetische Knoten, temporäre Dateien und Loopback-HTTP;
 * DNS und SMTP werden lokal nachgebildet. Keine Anlagen, Mailkonten oder Tailnets.
 * Bei Änderungen: Positive Verbindung, Wiederanlauf, negative Zustandsfreiheit und
 * bestehende Mesh-/Mail-Regression gemeinsam prüfen. --source prüft kanonische Quellen
 * vor dem Gesamtbuild; ohne Option werden die ausgelieferten JS-Artefakte ausgeführt.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const https = require('node:https');
const dns = require('node:dns');
const crypto = require('node:crypto');
const Module = require('node:module');
const root = path.resolve(__dirname, '..');
const names = ['mesh-coordinator-contract', 'mesh-coordinator-protocol', 'mesh-coordinator', 'notification-mail'];
const originalLoader = Module._extensions['.js'];
if (process.argv.includes('--source')) {
  Module._extensions['.js'] = (mod, filename) => {
    const name = names.find(item => filename === path.join(root, 'lib', `${item}.js`));
    if (!name) return originalLoader(mod, filename);
    return mod._compile(fs.readFileSync(path.join(root, 'src-ts/runtime-executables/lib', `${name}.ts`), 'utf8'), filename);
  };
}
const C = require('../lib/mesh-coordinator-contract');
const { MeshMasterProtocol, MeshSlaveLease } = require('../lib/mesh-coordinator-protocol');
const { MeshCoordinator, exchangeHttp, tailnetLookup } = require('../lib/mesh-coordinator');
const { NotificationMail, normalizeConfig } = require('../lib/notification-mail');
Module._extensions['.js'] = originalLoader;
let count = 0;
async function test(name, fn) { await fn(); count++; console.log(`OK ${name}`); }
const sample = () => ({ quality: 'ok', ageMs: 0, gridW: 0, phaseA: [0, 0, 0], devicesHealthy: true, controlledW: { ...C.ZERO } });
function fixture() {
  let now = 0;
  const maximum = { ...C.ZERO, importW: 1000, exportW: 1000, l1A: 10, l2A: 10, l3A: 10 };
  const c = C.defaultConfig();
  Object.assign(c, { role: 'master', mode: 'active', siteId: 'test-site', nodeId: 'master', masterId: 'master' });
  c.nodes = [{ id: 'house', max: maximum, fallback: { ...C.ZERO }, weight: 1, commissioned: true, watchdogVerified: true }];
  c.site.limit = { importW: 500, exportW: 500, l1A: 5, l2A: 5, l3A: 5 };
  const config = C.validateConfig(c);
  const master = new MeshMasterProtocol(config, () => now);
  const slaveConfig = C.validateConfig({ ...config, role: 'slave', nodeId: 'house', local: config.nodes[0], feedback: {}, masterUrl: 'http://127.0.0.1' });
  const slave = new MeshSlaveLease(slaveConfig, () => now);
  const hello = slave.hello(); slave.acceptHello(master.hello(hello));
  const round = () => { const request = slave.request(sample(), slave.command?.commandSeq || 0, 1); slave.accept(master.exchange(request, sample())); now += 1000; return request; };
  return { master, slave, config, slaveConfig, hello, round, clock: () => now, advance: ms => { now += ms; } };
}
async function protocolTests() {
  await test('NET-01: v2-Anlauf, signierter Verkehr, Hello-Replay verändert keinen aktiven Regelzustand', () => {
    const f = fixture(); for (let i = 0; i < 20; i++) f.round();
    assert.equal(f.master.state, 'NORMAL');
    const before = JSON.stringify(f.master.status());
    const key = crypto.randomBytes(32).toString('base64url');
    for (let i = 0; i < 20; i++) assert.throws(() => f.master.hello(C.sign(f.hello, key).payload), /replayed_handshake/);
    assert.equal(JSON.stringify(f.master.status()), before);
    f.round(); assert.equal(f.master.state, 'NORMAL');
  });
  await test('NET-02: Reconnect nach gleichem Boot und echter Slave-Neustart erholen sich kontrolliert', () => {
    const f = fixture(); for (let i = 0; i < 20; i++) f.round();
    const oldRequest = f.round();
    f.slave.acceptHello(f.master.hello(f.slave.hello())); f.round();
    assert.equal(f.master.state, 'SITE_DEGRADED');
    assert.throws(() => f.master.exchange(oldRequest, sample()), /handshake|replay/);
    for (let i = 0; i < 20; i++) f.round(); assert.equal(f.master.state, 'NORMAL');
    const rebooted = new MeshSlaveLease(f.slaveConfig, f.clock);
    rebooted.acceptHello(f.master.hello(rebooted.hello()));
    rebooted.accept(f.master.exchange(rebooted.request(sample(), 0, 1), sample()));
    assert(f.master.records.get('house').retiredBoots.has(f.slave.bootId));
    assert.throws(() => f.master.hello(f.hello), /retired_boot/);
    assert.equal(rebooted.current().limits.importW, 0);
  });
  await test('NET-03: Master-Neustart, altes Hello und alter Exchange können keine Sitzung vorwegnehmen', () => {
    const f = fixture(); const oldExchange = f.round();
    const restarted = new MeshMasterProtocol(f.config, f.clock);
    const before = JSON.stringify(restarted.status());
    restarted.hello(f.hello);
    assert.equal(JSON.stringify(restarted.status()), before);
    assert.equal(restarted.records.get('house').bootId, '');
    assert.throws(() => restarted.exchange(oldExchange, sample()), /replay/);
    f.slave.acceptHello(restarted.hello(f.slave.hello()));
    f.slave.accept(restarted.exchange(f.slave.request(sample(), 0, 1), sample()));
    assert.equal(restarted.records.get('house').bootId, f.slave.bootId);
    assert.equal(f.slave.current().limits.importW, 0);
  });
  await test('NET-04: Abgelaufene, manipulierte und fremde Challenges; vertauschte/alte Antworten abgewiesen', () => {
    const f = fixture(); const expired = f.slave.request(sample(), 0, 1); f.advance(f.config.leaseMs + 1);
    assert.throws(() => f.master.exchange(expired, sample()), /stale/);
    assert.equal(f.master.records.get('house').bootId, '');
    f.slave.acceptHello(f.master.hello(f.slave.hello()));
    const request = f.slave.request(sample(), 0, 1);
    assert.throws(() => f.master.exchange({ ...request, challenge: '0'.repeat(32) }, sample()), /replay/);
    assert.throws(() => f.master.exchange({ ...request, challengeIssuedAt: request.challengeIssuedAt + 1 }, sample()), /replay/);
    const response = f.master.exchange(request, sample());
    assert.throws(() => f.master.exchange(request, sample()), /replay/);
    assert.throws(() => f.slave.accept({ ...response, requestId: '0'.repeat(32) }), /invalid/);
    f.round(); const valid = f.slave.request(sample(), 0, 1); const late = f.master.exchange(valid, sample());
    f.advance(f.config.requestTimeoutMs + 1); assert.throws(() => f.slave.accept(late), /invalid/);
  });
  await test('NET-05: V1-Peers werden ausdrücklich abgewiesen; ungültige HMACs erreichen keine Sitzung', () => {
    const f = fixture(); assert.equal(C.SCHEMA, 'nexowatt.mesh-coordinator.v2');
    assert.throws(() => f.master.hello({ ...f.hello, schema: 'nexowatt.mesh-coordinator.v1' }), /incompatible_peer_schema/);
    const hello = f.slave.hello(); const response = f.master.hello(hello);
    assert.throws(() => f.slave.acceptHello({ ...response, schema: 'nexowatt.mesh-coordinator.v1' }), /incompatible_peer_schema/);
    const service = new MeshCoordinator({ _nwHasCentralLicenseGrant:()=>true, config: { emsApps: { apps: { meshMicrogrid: { installed: true, enabled: true } } } } });
    service.config = f.config; service.master = f.master; service.siteSample = sample;
    service.keys.house = crypto.randomBytes(32).toString('base64url');
    const packet = C.sign(hello, service.keys.house); packet.payload.helloSequence++;
    assert.throws(() => service.receive(packet), /authentication_failed/);
    const validHello = f.slave.hello(); const signed = C.sign(validHello, service.keys.house);
    const accepted = service.receive(signed); assert(C.verify(accepted, service.keys.house));
    for (let i = 0; i < 20; i++) assert.throws(() => service.receive(signed), /request_replayed/);
    assert.equal(service.rates.get('house').length, 1);
    f.slave.acceptHello(accepted.payload);
    assert(C.verify(service.receive(C.sign(f.slave.request(sample(), 0, 1), service.keys.house)), service.keys.house));
    service.stop();
  });
}
async function networkTests() {
  await test('NET-06: Tatsächliche IPv4/IPv6-Tailnet-/Loopbackadressen geprüft; Fremdnetze abgewiesen', async () => {
    for (const ip of ['127.0.0.1', '100.64.0.1', '100.127.255.254', '::1', 'fd7a:115c:a1e0::abcd']) assert.equal(C.privateMeshAddress(ip), true, ip);
    for (const ip of ['100.63.255.255', '100.128.0.1', '203.0.113.2', '10.0.0.1', '::ffff:203.0.113.2', 'fd7a:115c:a1e1::1']) assert.equal(C.privateMeshAddress(ip), false, ip);
    const call = (rows, all = false) => new Promise((resolve, reject) => tailnetLookup('master.test.ts.net', { all }, (e, a, family) => e ? reject(e) : resolve([a, family]), (_h, _o, cb) => cb(null, rows)));
    assert.deepEqual(await call([{ address: '100.64.1.2', family: 4 }]), ['100.64.1.2', 4]);
    assert.deepEqual((await call([{ address: '::1', family: 6 }], true))[0], [{ address: '::1', family: 6 }]);
    await assert.rejects(call([{ address: '100.64.1.2', family: 4 }, { address: '203.0.113.2', family: 4 }]), /outside_tailnet/);
    await assert.rejects(call([]), /outside_tailnet/);
  });
  let mode = 'ok', hits = 0;
  const server = http.createServer((req, res) => {
    hits++; req.resume();
    if (mode === 'timeout') return;
    if (mode === 'large') return res.end(JSON.stringify({ data: 'x'.repeat(66000) }));
    if (mode === 'incompatible') { res.statusCode = 409; return res.end(JSON.stringify({ error: 'incompatible_peer_schema' })); }
    res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ ok: true }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port, pending = new Set();
  const agents = { 'http:': new http.Agent({ keepAlive: false }), 'https:': new https.Agent({ keepAlive: false }) };
  const send = origin => exchangeHttp(origin, { fixture: true }, 100, agents, pending);
  const lookup = dns.lookup;
  try {
    await test('NET-07: Echter Loopback-HTTP-Kanal; DNS-Rebinding blockiert vor Socket/Datensendung', async () => {
      assert.deepEqual(await send(`http://127.0.0.1:${port}`), { ok: true });
      dns.lookup = (_host, _options, cb) => cb(null, [{ address: '127.0.0.1', family: 4 }]);
      assert.deepEqual(await send(`http://master.test.ts.net:${port}`), { ok: true });
      const before = hits; dns.lookup = (_host, _options, cb) => cb(null, [{ address: '203.0.113.2', family: 4 }]);
      await assert.rejects(send(`http://master.test.ts.net:${port}`), /outside_tailnet/);
      assert.equal(hits, before); assert.equal(pending.size, 0); dns.lookup = lookup;
    });
    await test('NET-08: Antwort-/Anfragelimit, Deadline, fremder Endpoint und Protokollfehler', async () => {
      mode = 'large'; await assert.rejects(send(`http://127.0.0.1:${port}`), /response_too_large/);
      mode = 'timeout'; await assert.rejects(send(`http://127.0.0.1:${port}`), /master_timeout/);
      mode = 'incompatible'; await assert.rejects(send(`http://127.0.0.1:${port}`), /incompatible_peer_schema/);
      await assert.rejects(exchangeHttp(`http://127.0.0.1:${port}`, { data: 'x'.repeat(66000) }, 100, agents, pending), /request_too_large/);
      await assert.rejects(exchangeHttp(`http://127.0.0.1:${port}`, {}, 100, agents, pending, 'https://example.test/'), /invalid_mesh_endpoint/);
      assert.equal(pending.size, 0);
    });
    await test('NET-09: HTTPS verlangt explizit TLS >=1.2 und Gegenstellenprüfung (Optionsprüfung)', async () => {
      const request = https.request;
      try {
        https.request = (_url, opts) => { assert.equal(opts.minVersion, 'TLSv1.2'); assert.equal(opts.rejectUnauthorized, true); throw new Error('test_options_verified'); };
        await assert.rejects(send('https://master.example.test'), /test_options_verified/);
      } finally { https.request = request; }
    });
  } finally {
    dns.lookup = lookup; for (const agent of Object.values(agents)) agent.destroy(); server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
}
async function mailTests() {
  const directory = await fsp.mkdtemp(path.join(os.tmpdir(), 'nw-cra-mail-'));
  const mail = new NotificationMail({ namespace: 'test.0' }); mail.directory = directory;
  try {
    await test('NET-10: SMTP-Ledger exklusiv/0600/atomar; vorbereiteter alter Temp-Symlink bleibt wirkungslos', async () => {
      const victim = path.join(directory, 'fixture.txt'); await fsp.writeFile(victim, 'unchanged');
      const legacyTemporary = path.join(directory, `notification-ledger.json.${process.pid}.tmp`);
      if (process.platform === 'win32') await fsp.writeFile(legacyTemporary, 'unchanged');
      else await fsp.symlink(victim, legacyTemporary);
      await mail.atomic('notification-ledger.json', { quota: 1 });
      assert.equal(await fsp.readFile(victim, 'utf8'), 'unchanged');
      assert.equal(await fsp.readFile(legacyTemporary, 'utf8'), 'unchanged');
      assert.deepEqual(JSON.parse(await fsp.readFile(path.join(directory, 'notification-ledger.json'), 'utf8')), { quota: 1 });
      if (process.platform !== 'win32') assert.equal((await fsp.stat(path.join(directory, 'notification-ledger.json'))).mode & 0o777, 0o600);
    });
    await test('NET-11: Fehler vor Rename erhält vorhandenes Ledger und räumt neue Tempdatei auf', async () => {
      const open = fsp.open;
      try {
        fsp.open = async (file, flags, mode) => {
          const handle = await open(file, flags, mode);
          if (String(file).endsWith('.tmp')) { assert.equal(flags, 'wx'); handle.sync = async () => { throw new Error('test_disk_sync_failed'); }; }
          return handle;
        };
        await assert.rejects(mail.atomic('notification-ledger.json', { quota: 2 }), /test_disk_sync_failed/);
      } finally { fsp.open = open; }
      assert.equal(JSON.parse(await fsp.readFile(path.join(directory, 'notification-ledger.json'), 'utf8')).quota, 1);
      assert.equal((await fsp.readdir(directory)).filter(name => name.endsWith('.tmp')).length, 1, 'only precreated old symlink remains');
    });
    await test('NET-12: SMTP erfordert TLS, keine URL-/Dateizugriffe, keine Rohfehler oder Secrets', async () => {
      let options; let messages = 0;
      const configured = new NotificationMail({}, { createTransport: opts => { options = opts; return { sendMail: async () => { messages++; throw Object.assign(new Error('fixture confidential password'), { code: 'EAUTH' }); } }; } });
      configured.config = normalizeConfig({ enabled: true, host: 'smtp.example.test', user: 'fixture-user', password: crypto.randomBytes(32).toString('base64url'), tlsMode: 'starttls' });
      const rejected = await configured.send('invalid\r\nBcc: injected@example.test', 'Fixture', 'Fixture'); assert.equal(rejected.ok, false); assert.equal(messages, 0);
      const result = await configured.send('customer@example.test', 'Fixture', 'Fixture');
      assert.equal(options.requireTLS, true); assert.equal(options.tls.rejectUnauthorized, true); assert.equal(options.tls.minVersion, 'TLSv1.2');
      assert.equal(options.disableFileAccess, true); assert.equal(options.disableUrlAccess, true); assert.equal(result.ok, false);
      assert(!result.error.includes('confidential')); assert(!result.error.includes(configured.config.password));
    });
  } finally { await fsp.rm(directory, { recursive: true, force: true }); }
}
(async () => {
  console.log(`CRA network verification ${new Date().toISOString()} | ${process.version} | ${process.platform} | ${process.argv.includes('--source') ? 'canonical source' : 'generated runtime'}`);
  for (const name of names) {
    const file = path.join(root, process.argv.includes('--source') ? 'src-ts/runtime-executables/lib' : 'lib', name + (process.argv.includes('--source') ? '.ts' : '.js'));
    console.log(`SHA256 ${path.relative(root, file)} ${crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}`);
  }
  await protocolTests(); await networkTests(); await mailTests();
  console.log(`PASS ${count} network/security groups; no hardware/Tailnet/real SMTP test`);
})().catch(error => { console.error(error); process.exitCode = 1; });
