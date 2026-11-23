'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { Writable, Readable } = require('node:stream');
const { gzipSync } = require('node:zlib');
const { rootCertificates } = require('node:tls');
const { performance } = require('node:perf_hooks');
const { HttpDriver } = require('../lib/drivers/http');
const { TaCmiDriver, validateCmiResponse } = require('../lib/drivers/taCmi');
const { BoundedDeviceHttp, MAX_RESPONSE_BYTES, MAX_REQUEST_BYTES, validateResponse } = require('../lib/drivers/boundedHttp');

const adapter = () => ({ log: { warn() {}, info() {}, debug() {} }, async getStateAsync() { return null; } });
const dp = (id = 'power', path = '/status') => ({ id, type: 'number', rw: 'ro', source: { kind: 'http', path, jsonPath: 'power' } });
const driver = (extra = {}) => new HttpDriver(adapter(), { id: 'test-device', connection: { baseUrl: 'https://device.invalid/api', ...extra } });

// Feed the real Axios HTTP adapter through a local Node transport, without sockets.
// Limits, decompression, request destruction and Axios error handling remain real.
function wire(client, bodies, headers = {}) {
  const requests = [];
  client.defaults.transport = {
    request(options, onResponse) {
      const index = requests.length;
      const request = new Writable({
        write(_chunk, _encoding, done) { done(); },
        final(done) {
          done();
          queueMicrotask(() => {
            const body = typeof bodies === 'function' ? bodies(index) : bodies[index];
            if (body === null || body === undefined || request.destroyed) return;
            const response = Readable.from([body]);
            response.statusCode = 200;
            response.headers = headers;
            response.req = request;
            request.response = response;
            onResponse(response);
          });
        },
      });
      request.options = options;
      request.setTimeout = () => request;
      requests.push(request);
      return request;
    },
  };
  return requests;
}

function cmiRuntime() {
  const registered = [];
  return {
    baseId: 'devices.cmi', registered,
    async registerDynamicDatapoint(def) { registered.push(def.id); return def; },
    _getDpById(id) { return { id }; },
    relStateId(item) { return item.id; },
    async _setStateCached() {}, async _updateAliases() {},
  };
}

function cmiResponse() {
  return { Header: { Version: 8, Device: '87', Timestamp: 1 }, Data: { Inputs: [{ Number: 1, AD: 'A', Value: { Value: 12.3, Unit: 1 } }] }, Status: 'OK', 'Status code': 0 };
}

test('TLS verification cannot be disabled; public CA preserves chain and hostname verification', async () => {
  for (const config of [{ insecureTls: true }, { insecureTLS: true }, { allowInsecureTls: true }, { rejectUnauthorized: false }]) {
    assert.throws(() => driver(config), { code: 'E_HTTP_TLS_VERIFICATION_REQUIRED' });
  }
  assert.throws(() => driver({ trustedCaPem: 'not a certificate' }), { code: 'E_HTTP_CA_INVALID' });
  const d = driver({ trustedCaPem: rootCertificates[0] });
  assert.equal(d.http.defaults.httpsAgent.options.rejectUnauthorized, true);
  assert.equal(d.http.defaults.httpsAgent.options.checkServerIdentity, undefined, 'retain Node default hostname verification');
  assert.deepEqual(d.http.defaults.httpsAgent.options.ca, [rootCertificates[0]]);
  assert.equal(d.http.defaults.httpsAgent.options.minVersion, 'TLSv1.2');
  await d.disconnect();
});

test('real Axios transport reads a grouped response once and stays on configured origin', async () => {
  const d = driver();
  const requests = wire(d.http, ['{"power":123}']);
  assert.deepEqual(await d.readDatapoints([dp(), dp('copy')]), { power: 123, copy: 123 });
  assert.equal(requests.length, 1);
  assert.equal(requests[0].options.path, '/api/status');
  assert.equal(requests[0].options.hostname, 'device.invalid');
  for (const path of ['https://other.invalid/value', '//other.invalid/value', 'file:///tmp/data', 'https://user:pass@device.invalid/value']) {
    await assert.rejects(d.readDatapoints([dp('bad', path)]));
  }
  assert.equal(requests.length, 1, 'rejected targets never reach the transport');
  assert.equal(d.http.defaults.maxRedirects, 0);
  await d.disconnect();
});

test('response cap applies to the decompressed body before parsing', async () => {
  const d = driver();
  const compressed = gzipSync(Buffer.alloc(MAX_RESPONSE_BYTES + 1024, 'x'));
  const requests = wire(d.http, [compressed], { 'content-encoding': 'gzip', 'content-type': 'application/json' });
  await assert.rejects(d.readDatapoints([dp()]), { code: 'ERR_BAD_RESPONSE' });
  assert.equal(requests.length, 1);
  await d.disconnect();
});

test('oversized outbound writes are rejected before any request', async () => {
  const d = driver();
  const requests = wire(d.http, ['']);
  await assert.rejects(d.writeDatapoint({ source: { path: '/write', bodyType: 'text' } }, 'x'.repeat(MAX_REQUEST_BYTES + 1)), { code: 'E_HTTP_REQUEST_TOO_LARGE' });
  assert.equal(requests.length, 0);
  await d.disconnect();
});

test('disconnect destroys the actual Axios request and no next group is dispatched', async () => {
  const d = driver();
  const requests = wire(d.http, [null]);
  const reading = d.readDatapoints([dp(), dp('next', '/next')]);
  const rejection = assert.rejects(reading, { code: 'E_HTTP_STOPPED' });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(requests.length, 1);
  await d.disconnect();
  await rejection;
  assert.equal(requests[0].destroyed, true);
  assert.equal(requests.length, 1);
  assert.equal(d.transport.pending.size, 0);
});

test('wall deadline destroys a response-less request and is capped at five seconds', async () => {
  const d = driver({ timeoutMs: 100 });
  const requests = wire(d.http, [null]);
  await assert.rejects(d.readDatapoints([dp()]), { code: 'E_HTTP_DEADLINE' });
  assert.equal(requests[0].destroyed, true);
  assert.equal(d.transport.pending.size, 0);
  await d.disconnect();
  const capped = driver({ timeoutMs: 60000 });
  assert.equal(capped.transport.budgetMs, 5000);
  await capped.disconnect();
});

test('all poll groups share one deadline and late completions cannot survive disconnect/reconnect', async t => {
  const d = driver({ timeoutMs: 100 });
  let calls = 0;
  const signals = [];
  const budgets = [];
  let clock = 1000;
  t.mock.method(performance, 'now', () => clock);
  d.http.request = async config => {
    calls++;
    signals.push(config.signal);
    budgets.push(config.timeout);
    clock += calls === 1 ? 65 : 40;
    return { data: { power: calls } };
  };
  await assert.rejects(d.readDatapoints([dp(), dp('next', '/next'), dp('third', '/third')]), { code: 'E_HTTP_DEADLINE' });
  assert.equal(calls, 2);
  assert.deepEqual(budgets, [100, 35], 'second endpoint receives only the unspent poll budget');
  t.mock.restoreAll();
  let complete;
  d.http.request = config => new Promise(resolve => { complete = () => resolve({ data: { power: 999 } }); signals.push(config.signal); });
  const stale = d.readDatapoints([dp()]);
  const rejected = assert.rejects(stale, { code: 'E_HTTP_STOPPED' });
  await new Promise(resolve => setImmediate(resolve));
  await d.disconnect();
  await d.connect();
  complete();
  await rejected;
  await d.disconnect();
});

test('revoked module permission blocks subsequent groups and taCmi bridge callbacks', async () => {
  let allowed = true;
  const d = driver();
  d.canOperate = () => allowed;
  let calls = 0;
  d.http.request = async () => { calls++; allowed = false; return { data: { power: 123 } }; };
  await assert.rejects(d.readDatapoints([dp(), dp('next', '/next')]), { code: 'EOS_MODULE_DISABLED' });
  assert.equal(calls, 1);
  await d.disconnect();
  const cmi = new TaCmiDriver(adapter(), { connection: { baseUrl: 'http://cmi.invalid', bridgeEnabled: false } }, {}, {}, cmiRuntime());
  cmi.canOperate = () => false;
  assert.throws(() => cmi._getHolding(0), { code: 'EOS_MODULE_DISABLED' });
  assert.throws(() => cmi._getCoil(0), { code: 'EOS_MODULE_DISABLED' });
  await assert.rejects(cmi._onCmiRegisterWrite(100, 1), { code: 'EOS_MODULE_DISABLED' });
  await assert.rejects(cmi._onCmiCoilWrite(100, true), { code: 'EOS_MODULE_DISABLED' });
  await cmi.disconnect();
});

test('taCmi validates every row before creating node objects or exposing values', async () => {
  assert.doesNotThrow(() => validateCmiResponse(cmiResponse()));
  for (const alter of [
    response => { response.Data.Inputs.push({ Number: 2, AD: 'D', Value: { Value: 'invalid' } }); },
    response => { response.Data.Inputs[0].Value.Value = null; },
    response => { delete response['Status code']; },
    response => { response.Data.Inputs[0].Value.State = 22; },
  ]) {
    const invalid = cmiResponse(); alter(invalid);
    const runtime = cmiRuntime();
    const cmi = new TaCmiDriver(adapter(), { connection: { baseUrl: 'http://cmi.invalid', bridgeEnabled: false, nodes: '1' } }, {}, {}, runtime);
    wire(cmi.http, [JSON.stringify(invalid)]);
    await assert.rejects(cmi.readDatapoints(), { code: 'E_TA_CMI_RESPONSE_INVALID' });
    assert.equal(runtime.registered.filter(id => id.startsWith('nodes.')).length, 0);
    await cmi.disconnect();
  }
});

test('taCmi disconnect interrupts HTTP and prevents a still-pending initialization from restarting', async () => {
  const runtime = cmiRuntime();
  const cmi = new TaCmiDriver(adapter(), { connection: { baseUrl: 'http://cmi.invalid', bridgeEnabled: false, nodes: '1' } }, {}, {}, runtime);
  const requests = wire(cmi.http, [null]);
  const reading = cmi.readDatapoints();
  const rejection = assert.rejects(reading, { code: 'E_HTTP_STOPPED' });
  await new Promise(resolve => setImmediate(resolve));
  await cmi.disconnect();
  await rejection;
  assert.equal(requests[0].destroyed, true);
  assert.equal(runtime.registered.filter(id => id.startsWith('nodes.')).length, 0);

  let release;
  const a = adapter();
  a.getStateAsync = () => new Promise(resolve => { release = resolve; });
  const initializing = new TaCmiDriver(a, { connection: { baseUrl: 'http://cmi.invalid', bridgeEnabled: false } }, {}, {}, cmiRuntime());
  const connecting = initializing.connect();
  const initRejected = assert.rejects(connecting, { code: 'E_HTTP_STOPPED' });
  await initializing.disconnect();
  release(null);
  await initRejected;
  assert.equal(initializing._connected, false);
  assert.equal(initializing.server, null);
});

test('bounded pending requests reject runaway work', async () => {
  const transport = new BoundedDeviceHttp({ baseUrl: 'http://device.invalid' });
  const client = { request: () => new Promise(() => {}) };
  const pending = Array.from({ length: 4 }, () => transport.request(client, { url: '/' }, transport.begin()));
  const rejected = pending.map(promise => assert.rejects(promise, { code: 'E_HTTP_STOPPED' }));
  await assert.rejects(transport.request(client, { url: '/' }, transport.begin()), { code: 'E_HTTP_BUSY' });
  transport.disconnect();
  await Promise.all(rejected);
  assert.equal(transport.pending.size, 0);
});


test('parsed response structure and datapoint types are checked before values leave the driver', async () => {
  let tree = { value: 1 };
  for (let n = 0; n < 35; n++) tree = { nested: tree };
  assert.throws(() => validateResponse(tree), { code: 'E_HTTP_RESPONSE_STRUCTURE' });
  assert.throws(() => validateResponse(JSON.parse('{"__proto__":{"polluted":true}}')), { code: 'E_HTTP_RESPONSE_STRUCTURE' });
  assert.throws(() => validateResponse({ value: Infinity }), { code: 'E_HTTP_RESPONSE_STRUCTURE' });
  assert.equal({}.polluted, undefined);
  for (const invalid of [{ power: {} }, { power: 'not a number' }, { power: 123, enabled: 'perhaps' }]) {
    const d = driver();
    wire(d.http, [JSON.stringify(invalid)]);
    const readings = [dp(), { ...dp('enabled'), type: 'boolean', source: { kind: 'http', path: '/status', jsonPath: 'enabled' } }];
    await assert.rejects(d.readDatapoints(readings), { code: 'E_HTTP_DATAPOINT_TYPE' });
    await d.disconnect();
  }
});

test('partial endpoint failures retain valid readings while diagnostics never include request secrets', async () => {
  const d = driver();
  const warnings = [];
  d.adapter.log.warn = text => warnings.push(text);
  d.http.request = async config => {
    if (config.url.endsWith('/api/status')) return { data: { power: 42 } };
    throw Object.assign(new Error('transport failed with private query contents'), { code: 'ECONNRESET' });
  };
  assert.deepEqual(await d.readDatapoints([dp(), dp('missing', '/missing')]), { power: 42 });
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /ECONNRESET/);
  assert.doesNotMatch(warnings[0], /query|missing|private/);
  await assert.rejects(d.readDatapoints([dp('missing', '/missing')]), error => error.code === 'ECONNRESET' && error.message === 'ECONNRESET');
  await d.disconnect();
});

test('a transport rejection after cancellation remains observed', async () => {
  const d = driver();
  let lateReject;
  d.http.request = () => new Promise((_, reject) => { lateReject = reject; });
  const reading = d.readDatapoints([dp()]);
  const rejection = assert.rejects(reading, { code: 'E_HTTP_STOPPED' });
  await new Promise(resolve => setImmediate(resolve));
  await d.disconnect();
  await rejection;
  lateReject(new Error('late network failure'));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(d.transport.pending.size, 0);
});


test('a deadline cancellation remains terminal even if the timer precedes the clock rounding boundary', async () => {
  const d = driver();
  let calls = 0;
  d.http.request = async () => {
    calls++;
    if (calls === 1) return { data: { power: 7 } };
    throw Object.assign(new Error('E_HTTP_DEADLINE'), { code: 'E_HTTP_DEADLINE' });
  };
  await assert.rejects(d.readDatapoints([dp(), dp('next', '/next'), dp('third', '/third')]), { code: 'E_HTTP_DEADLINE' });
  assert.equal(calls, 2);
  await d.disconnect();
});
