'use strict';
/** A real local HTTP stream behind an explicit HTTPS fixture mapping; not a provider TLS proof. */
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { getEventListeners } = require('node:events');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const root = process.env.EOS_AUDIT_SOURCE_ROOT || path.resolve(__dirname, '..');
async function fixture(t) {
    let calls = 0, activeResponses = 0;
    const server = http.createServer((req, res) => {
        calls++; activeResponses++; res.once('close', () => activeResponses--);
        if (req.url === '/wait') { res.writeHead(200, { 'content-type': 'application/json' }); res.write('['); }
        else res.end(JSON.stringify([{ startsAt: new Date().toISOString(), price: -0.05 }]));
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
    const module = { exports: {} };
    const file = path.join(root, 'ui/src-ts/runtime-executables/ems/services/tariff-provider-registry.ts');
    vm.runInNewContext(fs.readFileSync(file, 'utf8'), { module, exports: module.exports, require: createRequire(file),
        Buffer, URL, URLSearchParams, AbortController, setTimeout, clearTimeout,
        fetch(url, options) {
            assert.equal(url.protocol, 'https:'); assert.equal(url.hostname, 'tariff-fixture.invalid');
            assert.equal(options.redirect, 'error');
            return fetch(`http://127.0.0.1:${server.address().port}${url.pathname}`, options);
        },
    }, { filename: file });
    const config = suffix => ({ providerId: 'custom-rest', customRest: { url: `https://tariff-fixture.invalid/${suffix}`, pricePath: 'price' } });
    return { registry: module.exports, calls: () => calls, active: () => activeResponses, config };
}
async function until(predicate) {
    const deadline = performance.now() + 1000;
    while (!predicate() && performance.now() < deadline) await new Promise(resolve => setTimeout(resolve, 5));
    assert.ok(predicate());
}
test('921-HIS-002 repeated lifecycle aborts cancel the actual response body and remove parent listeners', async t => {
    const x = await fixture(t);
    for (let cycle = 1; cycle <= 8; cycle++) {
        const abort = new AbortController();
        const result = x.registry.fetchProvider(x.config('wait'), abort.signal);
        const observed = assert.rejects(result, /^Error: provider_cancelled$/);
        await until(() => x.calls() === cycle);
        const started = performance.now(); abort.abort(); await observed;
        assert.ok(performance.now() - started < 500);
        await until(() => x.active() === 0);
        assert.equal(getEventListeners(abort.signal, 'abort').length, 0);
    }
    const abort = new AbortController();
    const response = await x.registry.fetchProvider(x.config('ok'), abort.signal);
    assert.equal(response.intervals[0].total, -0.05);
    assert.equal(getEventListeners(abort.signal, 'abort').length, 0);
});
test('921-HIS-002 an already revoked generation cannot start network access and does not retain its listener', async t => {
    const x = await fixture(t); const abort = new AbortController(); abort.abort();
    await assert.rejects(x.registry.fetchProvider(x.config('ok'), abort.signal), /^Error: provider_cancelled$/);
    assert.equal(x.calls(), 0); assert.equal(getEventListeners(abort.signal, 'abort').length, 0);
});
