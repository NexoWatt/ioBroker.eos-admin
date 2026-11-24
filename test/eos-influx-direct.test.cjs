'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const https = require('node:https');
const dns = require('node:dns');
const path = require('node:path');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');
const { InfluxDirectClient, validateInfluxDirectConfig, buildInfluxHistoryQuery, parseInfluxCsv, influxLineProtocol, influxFluxString } =
    require('tsx/cjs/api').require(path.resolve(__dirname, '../ui/src-ts/runtime-executables/lib/influx-direct.ts'), __filename);
const token = 'test-only-synthetic-token';
const csv = '#datatype,string,long,dateTime:RFC3339,double\n,result,table,_time,_value\n,,0,2026-11-24T18:00:00Z,-0.05\n,,0,2026-11-24T18:15:00Z,0\n';
async function fixture(t, handler, tls) {
    const requests = [];
    const listener = async (req, res) => {
        let body = ''; for await (const chunk of req) body += chunk;
        requests.push({ method: req.method, path: req.url, headers: req.headers, body });
        handler(req, res, body);
    };
    const server = tls ? https.createServer(tls, listener) : http.createServer(listener);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const config = { url: `${tls ? 'https' : 'http'}://127.0.0.1:${server.address().port}`, organization: 'Nexo Watt', bucket: 'history', token };
    t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
    return { requests, server, config };
}

test('direct v2 check validates actual org/bucket authentication, query preserves negative and zero prices', async t => {
    const f = await fixture(t, (req, res, body) => {
        assert.equal(req.headers.authorization, `Token ${token}`);
        res.end(req.url === '/health' ? JSON.stringify({ status: 'pass' }) : JSON.parse(body).query.includes('map(fn:') ? csv.split('\n').slice(0, 3).join('\n') : csv);
    });
    const client = new InfluxDirectClient(f.config); t.after(() => client.close());
    assert.deepEqual(await client.check(), { reachable: true, readable: true, writeVerified: false });
    const probe = JSON.parse(f.requests.at(-1).body).query;
    assert.match(probe, /keep\(columns: \["_time"\]\).*group\(columns: \[\]\).*limit\(n: 1\).*map\(fn:/);
    assert.ok(f.requests.every(request => !request.path.includes('/orgs') && !request.path.includes('/buckets')));
    const values = await client.query('eos-admin.0.historie.tariff.price', { start: Date.UTC(2026, 10, 24), end: Date.UTC(2026, 10, 25), step: 900000, aggregate: 'average' });
    assert.deepEqual(values.result.map(row => row.val), [-0.05, 0]);
    assert.equal(new URL(f.requests.at(-1).path, f.config.url).searchParams.get('org'), 'Nexo Watt');
    const query = JSON.parse(f.requests.at(-1).body).query;
    assert.match(query, /_measurement == "eos-admin\.0\.historie\.tariff\.price"/);
    assert.match(query, /aggregateWindow\(every: 900000ms, fn: mean, createEmpty: false, timeSrc: "_start"\)/);
    assert.doesNotMatch(query, /fill\(/);
});

test('reachable health port alone is insufficient and server error bodies never expose credentials', async t => {
    const f = await fixture(t, (req, res) => {
        if (req.url === '/health') res.end('{"status":"pass"}');
        else { res.statusCode = 401; res.end(`Unauthorized ${token}`); }
    });
    const client = new InfluxDirectClient(f.config); t.after(() => client.close());
    await assert.rejects(client.check(), error => error.code === 'EOS_INFLUX_AUTHORIZATION_FAILED' && !String(error).includes(token));
});

test('direct writes use v2 line protocol, explicit milliseconds and real204 success', async t => {
    let success = true;
    const f = await fixture(t, (_req, res) => { res.statusCode = success ? 204 : 200; res.end(); });
    const client = new InfluxDirectClient(f.config); t.after(() => client.close());
    const points = [{ id: 'eos-admin.0.historie.power', val: 0, ts: 1795543200000 }, { id: 'eos-admin.0.historie.price', val: -0.05, ts: 1795543200000 }];
    await client.write(points);
    assert.equal(f.requests[0].body, 'eos-admin.0.historie.power value=0 1795543200000\neos-admin.0.historie.price value=-0.05 1795543200000');
    const params = new URL(f.requests[0].path, f.config.url).searchParams;
    assert.equal(params.get('precision'), 'ms'); assert.equal(params.get('bucket'), 'history'); assert.equal(params.get('org'), 'Nexo Watt');
    success = false; await assert.rejects(client.write(points), /EOS_INFLUX_REQUEST_FAILED/);
});

test('redirects are never followed with the token and HTTP429 is bounded', async t => {
    let status = 302;
    const f = await fixture(t, (_req, res) => { res.statusCode = status; res.setHeader('location', 'http://127.0.0.1:1/other'); res.end(token); });
    const client = new InfluxDirectClient(f.config); t.after(() => client.close());
    await assert.rejects(client.check(), /EOS_INFLUX_REDIRECT_REJECTED/); assert.equal(f.requests.length, 1);
    status = 429; await assert.rejects(client.check(), /EOS_INFLUX_RATE_LIMITED/); assert.equal(f.requests.length, 2);
});

test('configuration rejects URL credentials, fragments, API paths and malformed trust without weakening TLS', () => {
    const base = { url: 'http://127.0.0.1:8086', organization: 'org', bucket: 'bucket', token };
    assert.equal(validateInfluxDirectConfig(base).url, 'http://127.0.0.1:8086/');
    for (const input of [null, false, [], {}, { ...base, bucket: 42 }, Object.create(base)]) {
        assert.throws(() => validateInfluxDirectConfig(input), /EOS_INFLUX_CONFIG_INVALID/);
    }
    for (const url of ['file:///tmp/foo', 'http://user:pass@localhost:8086', 'http://localhost:8086?token=secret', 'http://localhost:8086#x', 'http://localhost:8086/api/v2/query']) {
        assert.throws(() => validateInfluxDirectConfig({ ...base, url }), /EOS_INFLUX_URL_INVALID/);
    }
    assert.throws(() => validateInfluxDirectConfig({ ...base, token: 'x\r\nheader:value' }), /CONFIG_INVALID/);
    assert.throws(() => validateInfluxDirectConfig({ ...base, caCertificate: 'bad' }), /CA_INVALID/);
});

test('Flux interpolation, names and line protocol cannot inject statements or rows', () => {
    const attack = '${die(msg: "bad")}\\quoted';
    assert.equal(influxFluxString(attack), '"\\${die(msg: \\"bad\\")}\\\\quoted"');
    const query = buildInfluxHistoryQuery('bucket', attack, { start: 1, end: 1000, aggregate: 'none', count: 1, returnNewestEntries: true });
    assert.ok(query.includes(influxFluxString(attack))); assert.match(query, /desc: true/); assert.match(query, /limit\(n: 1\)/);
    assert.throws(() => buildInfluxHistoryQuery('bucket', 'state\n|> die()', { start: 1, end: 1000 }), /CONFIG_INVALID/);
    assert.throws(() => buildInfluxHistoryQuery('bucket', 'state', { start: 1, end: 1000, aggregate: 'mean) |> die()' }), /AGGREGATE_UNSUPPORTED/);
    assert.throws(() => influxLineProtocol([{ id: 'state', val: null, ts: 1 }]), /VALUE_INVALID/);
    assert.throws(() => influxLineProtocol([{ id: 'state', val: Infinity, ts: 1 }]), /VALUE_INVALID/);
    assert.throws(() => influxLineProtocol([{ id: 'state', val: 'text\nnewrow', ts: 1 }]), /VALUE_INVALID/);
    assert.equal(influxLineProtocol([{ id: 'a b,c', val: 'x"y\\z', ts: 1 }]), 'a\\ b\\,c value="x\\"y\\\\z" 1');
});

test('CSV parser preserves missing samples, string snapshots and repeated annotated tables', () => {
    assert.deepEqual(parseInfluxCsv(csv + ',,0,2026-11-24T18:30:00Z,\n').map(row => row.val), [-0.05, 0]);
    const strings = '#datatype,string,long,dateTime:RFC3339,string\n,result,table,_time,_value\n,,0,2026-11-24T18:30:00Z,"a,b"\n';
    assert.deepEqual(parseInfluxCsv(csv + strings).map(row => row.val), [-0.05, 0, 'a,b']);
    assert.throws(() => parseInfluxCsv('error,reference\n"token-containing error",x\n'), /QUERY_FAILED/);
    assert.throws(() => parseInfluxCsv(csv.replace('-0.05', 'NaN')), /RESPONSE_INVALID/);
    assert.throws(() => parseInfluxCsv(csv, 1), /RESPONSE_LIMIT/);
    assert.throws(() => parseInfluxCsv(',,"unterminated'), /RESPONSE_INVALID/);
    assert.deepEqual(parseInfluxCsv(strings.replace('"a,b"', '""')).map(row => row.val), ['']);
    for (const bad of [csv.replace('2026-11-24T18:00:00Z', '1'), csv.replace('2026-11-24T18:00:00Z', '2026-02-30T18:00:00Z'),
        csv.replace('double', 'evil'), csv.replace('dateTime:RFC3339', 'string'), csv.replace('table,_time', '_time,_time'),
        csv.replace('double', 'unsignedLong').replace('-0.05', '9007199254740993'), csv.replace('double', 'unsignedLong'),
        csv.replace('2026-11-24T18:00:00Z', '2026-11-24T25:00:00Z')]) {
        assert.throws(() => parseInfluxCsv(bad), /RESPONSE_INVALID/);
    }
    assert.throws(() => influxLineProtocol([{ id: '#hidden', val: 1, ts: 1 }]), /VALUE_INVALID/);
});

test('server cannot exceed requested row limit or return an oversized body', async t => {
    let large = false;
    const f = await fixture(t, (_req, res) => res.end(large ? 'x'.repeat(8 * 1024 * 1024 + 1) : csv));
    const client = new InfluxDirectClient(f.config); t.after(() => client.close());
    await assert.rejects(client.query('state', { start: 1, end: 1000, count: 1 }), /RESPONSE_LIMIT/);
    large = true;
    await assert.rejects(client.query('state', { start: 1, end: 1000 }), /RESPONSE_LIMIT/);
});

test('real unresponsive connection is aborted within the total5s check budget', async t => {
    const f = await fixture(t, () => {});
    const client = new InfluxDirectClient(f.config); t.after(() => client.close());
    const start = performance.now();
    await assert.rejects(client.check(), /EOS_INFLUX_TIMEOUT/);
    assert.ok(performance.now() - start < 6000);
});

test('successful slow health and stalled query share one total5s connection-check deadline', async t => {
    const f = await fixture(t, (req, res) => {
        if (req.url === '/health') setTimeout(() => res.end('{"status":"pass"}'), 1500);
    });
    const client = new InfluxDirectClient(f.config); t.after(() => client.close());
    const start = performance.now();
    await assert.rejects(client.check(), /EOS_INFLUX_TIMEOUT/);
    assert.equal(f.requests.length, 2);
    assert.ok(performance.now() - start < 6000, 'query must not receive a fresh5s budget after slow health');
});

test('history rejects out-of-range rows while accepting the first partial aggregate window', async t => {
    const sampleTime = Date.UTC(2026, 10, 24, 18);
    let response = csv.split('\n').slice(0, 3).join('\n');
    const f = await fixture(t, (_req, res) => res.end(response));
    const client = new InfluxDirectClient(f.config); t.after(() => client.close());
    const options = { start: sampleTime + 500, end: sampleTime + 10000 };
    await assert.rejects(client.query('state', options), /EOS_INFLUX_RESPONSE_INVALID/);
    assert.equal((await client.query('state', { ...options, aggregate: 'average', step: 1000 })).result.length, 1);
    await assert.rejects(client.query('state', { ...options, aggregate: 'average', step: 500 }), /EOS_INFLUX_RESPONSE_INVALID/);
    response = response.replace('2026-11-24T18:00:00Z', '2026-11-24T18:00:10Z');
    await assert.rejects(client.query('state', { ...options, aggregate: 'average', step: 1000 }), /EOS_INFLUX_RESPONSE_INVALID/);
});

test('SmartHome minmax keeps server-selected extrema and boolean values with original times', async t => {
    const start = Date.UTC(2026, 10, 24, 18);
    let data = [{ val: 10, ts: start }, { val: -100, ts: start + 2000 },
        { val: 300, ts: start + 3000 }, { val: 15, ts: start + 7000 }];
    let kind = 'double';
    const f = await fixture(t, (_req, res) => res.end(
        `#datatype,string,long,dateTime:RFC3339,${kind}\n,result,table,_time,_value\n` +
        data.map(point => `,,0,${new Date(point.ts).toISOString()},${point.val}`).join('\n')));
    const client = new InfluxDirectClient(f.config); t.after(() => client.close());
    const options = { start, end: start + 8000, count: 4, limit: 1000, aggregate: 'minmax' };
    assert.deepEqual((await client.query('eos-admin.0.device.temperature', options)).result, data);
    const query = JSON.parse(f.requests.at(-1).body).query;
    assert.doesNotMatch(query, /aggregateWindow|mean\(|min\(|max\(/);
    assert.match(query, /window\(every: 8000ms, offset: 0ms, createEmpty: false\)/);
    assert.match(query, /nwValues = nwData \|> sort\(columns: \["_value", "_time"\]\)/);
    assert.match(query, /union\(tables: \[nwMin, nwMax, nwFirst, nwLast\]\)/);
    assert.match(query, /unique\(column: "_time"\).*limit\(n: 4\)/, 'count remains effective when dispatcher also supplies a larger limit');
    kind = 'boolean'; data = [{ ts: start, val: false }, { ts: start + 3000, val: true }, { ts: start + 7000, val: false }];
    assert.deepEqual((await client.query('eos-admin.0.device.switch', options)).result, data);
    data = [{ ts: start - 1, val: true }];
    await assert.rejects(client.query('eos-admin.0.device.switch', options), /EOS_INFLUX_RESPONSE_INVALID/);
});

test('minmax requests complete time windows for dense histories and rejects excess response rows', async t => {
    const start = Date.UTC(2026, 10, 24) + 123;
    const query = buildInfluxHistoryQuery('history', 'state', { start, end: start + 86400000, count: 240, aggregate: 'minmax' });
    assert.match(query, /window\(every: 1440000ms, offset: 123ms, createEmpty: false\)/);
    assert.match(query, /limit\(n: 240\)/);
    assert.equal(query.match(/limit\(/g).length, 1, 'limit is after selectors, never on a raw prefix');
    const smallQuery = buildInfluxHistoryQuery('history', 'state', { start, end: start + 1000, count: 2, aggregate: 'minmax' });
    assert.match(smallQuery, /union\(tables: \[nwMin, nwMax\]\)/);
    assert.throws(() => buildInfluxHistoryQuery('history', 'state', { start, end: start + 1000, count: 2, aggregate: 'minmax', step: 1 }), /EOS_INFLUX_QUERY_LIMIT/);
    const body = '#datatype,string,long,dateTime:RFC3339,double\n,result,table,_time,_value\n' +
        Array.from({ length: 5 }, (_, index) => `,,0,${new Date(start + index).toISOString()},${index}`).join('\n');
    const f = await fixture(t, (_req, res) => res.end(body));
    const client = new InfluxDirectClient(f.config); t.after(() => client.close());
    await assert.rejects(client.query('state', { start, end: start + 60000, count: 4, limit: 1000, aggregate: 'minmax' }), /EOS_INFLUX_RESPONSE_LIMIT/);
});

test('query bounds reject unbounded history and invalid sampling options before IO', () => {
    assert.match(buildInfluxHistoryQuery('b', 's', { start: 0, end: 1000, count: 60000 }), /limit\(n: 60000\)/);
    assert.deepEqual(parseInfluxCsv('', 60000), []);
    assert.throws(() => parseInfluxCsv('', 60001), /EOS_INFLUX_RESPONSE_LIMIT/);
    for (const options of [{ start: null, end: 1000 }, { start: 1000, end: 1 }, { start: 0, end: 3661 * 86400000 },
        { start: 0, end: 1000, count: 0 }, { start: 0, end: 1000, count: 60001 }, { start: 0, end: 100000, aggregate: 'average', step: 1 }]) {
        assert.throws(() => buildInfluxHistoryQuery('b', 's', options), /EOS_INFLUX_QUERY_/);
    }
});

test('closing aborts outstanding queries and bounds concurrent requests', async t => {
    const f = await fixture(t, () => {});
    const client = new InfluxDirectClient(f.config);
    const requests = Array.from({ length: 8 }, () => client.query('state', { start: 1, end: 1000 }));
    const observed = Promise.allSettled(requests);
    await assert.rejects(client.query('state', { start: 1, end: 1000 }), /EOS_INFLUX_BUSY/);
    client.close();
    assert.ok((await observed).every(result => result.status === 'rejected' && result.reason.code === 'EOS_INFLUX_CANCELLED'));
    await assert.rejects(client.check(), /EOS_INFLUX_CANCELLED/);
});

test('each DNS connection uses vetted answers and rejects rebinding before credentials leave', async t => {
    const f = await fixture(t, (_req, res) => { res.statusCode = 204; res.end(); });
    const url = new URL(f.config.url); url.hostname = 'influx-fixture.invalid';
    let address = '127.0.0.1'; let lookups = 0;
    t.mock.method(dns, 'lookup', (host, options, callback) => {
        assert.equal(host, 'influx-fixture.invalid'); assert.equal(options.all, true); lookups++;
        queueMicrotask(() => callback(null, [{ address, family: 4 }]));
    });
    const client = new InfluxDirectClient({ ...f.config, url: url.href }); t.after(() => client.close());
    const points = [{ id: 'eos-admin.0.historie.power', val: 1, ts: 1000 }];
    await client.write(points); assert.equal(f.requests.length, 1);
    address = '169.254.169.254';
    await assert.rejects(client.write(points), /EOS_INFLUX_ADDRESS_FORBIDDEN/);
    address = '8.8.8.8';
    await assert.rejects(client.write(points), /EOS_INFLUX_HTTP_REQUIRES_LOCAL_ADDRESS/);
    assert.equal(lookups, 3); assert.equal(f.requests.length, 1);
});

test('caller remaining budget includes unresolved DNS and still reserves all concurrency slots', async t => {
    const f = await fixture(t, () => {}); const url = new URL(f.config.url); url.hostname = 'influx-slow.invalid';
    const callbacks = [];
    t.mock.method(dns, 'lookup', (_host, _options, callback) => { callbacks.push(callback); });
    const client = new InfluxDirectClient({ ...f.config, url: url.href }); t.after(() => client.close());
    const started = performance.now();
    const requests = Array.from({ length: 8 }, () => client.query('state', { start: 1, end: 1000 }, 30));
    const observed = Promise.allSettled(requests);
    await assert.rejects(client.query('state', { start: 1, end: 1000 }, 30), /EOS_INFLUX_BUSY/);
    assert.ok((await observed).every(result => result.status === 'rejected' && result.reason.code === 'EOS_INFLUX_TIMEOUT'));
    assert.ok(performance.now() - started < 1000);
    for (const callback of callbacks) callback(null, [{ address: '127.0.0.1', family: 4 }]);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(f.requests.length, 0, 'late DNS completion cannot open a timed-out request');
    await assert.rejects(client.query('state', { start: 1, end: 1000 }, 0), /EOS_INFLUX_TIMEOUT/);
});

test('HTTPS rejects untrusted certificates and accepts only explicitly supplied matching CA', async t => {
    const forge = createRequire(require.resolve('@iobroker/js-controller-common-db'))('node-forge');
    const pair = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    const key = pair.privateKey.export({ format: 'pem', type: 'pkcs1' });
    const certificate = forge.pki.createCertificate();
    certificate.publicKey = forge.pki.publicKeyFromPem(pair.publicKey.export({ format: 'pem', type: 'spki' }));
    certificate.serialNumber = `01${crypto.randomBytes(15).toString('hex')}`;
    certificate.validity.notBefore = new Date(Date.now() - 60000);
    certificate.validity.notAfter = new Date(Date.now() + 3600000);
    const subject = [{ name: 'commonName', value: 'localhost' }];
    certificate.setSubject(subject); certificate.setIssuer(subject);
    certificate.setExtensions([{ name: 'basicConstraints', cA: true }, { name: 'subjectAltName', altNames: [{ type: 7, ip: '127.0.0.1' }] }]);
    certificate.sign(forge.pki.privateKeyFromPem(key), forge.md.sha256.create());
    const cert = forge.pki.certificateToPem(certificate);
    const f = await fixture(t, (req, res) => res.end(req.url === '/health' ? '{"status":"pass"}' : ''), { key, cert });
    const untrusted = new InfluxDirectClient(f.config); t.after(() => untrusted.close());
    await assert.rejects(untrusted.check(), /EOS_INFLUX_TLS_FAILED/);
    const trusted = new InfluxDirectClient({ ...f.config, caCertificate: cert }); t.after(() => trusted.close());
    assert.equal((await trusted.check()).readable, true);
});
