'use strict';
// Privacy regression: exercise the test fixture, never an external endpoint.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const { isInstalledAdapter, installLoopbackEgress, loopback } = require('./fixtures/loopback-egress.cjs');

function fixture() {
    const calls = [];
    const transport = name => ({
        request(...args) { calls.push([name, 'request', ...args]); },
        get(...args) { calls.push([name, 'get', ...args]); },
    });
    const http = transport('http'), https = transport('https');
    class Socket { connect(...args) { calls.push(['socket', ...args]); } }
    const net = { Socket };
    const tls = { connect(...args) { calls.push(['tls', ...args]); } };
    const dns = { lookup(...args) { calls.push(['dns', ...args]); } };
    const target = { fetch(...args) { calls.push(['fetch', ...args]); return Promise.resolve(); } };
    installLoopbackEgress({ http, https, net, tls, dns, target });
    return { http, https, net, tls, dns, target, calls };
}
const rejectsEgress = error => error?.code === 'EOS_TEST_EGRESS_BLOCKED' && error.message === 'EOS_TEST_EGRESS_BLOCKED';

test('egress fixture scopes exactly to installed EOS entrypoint, not npm/setup or test runner', () => {
    const cwd = path.join('/tmp', 'isolated-controller', 'node_modules', 'iobroker.eos-admin');
    assert.equal(isInstalledAdapter(['node', path.join(cwd, 'build', 'main.js')], cwd), true);
    assert.equal(isInstalledAdapter(['node', 'build/main.js', '--console'], cwd), true);
    for (const entry of ['/usr/bin/npm', 'node_modules/npm/bin/npm-cli.js', 'iobroker.js', 'test/integration-unified.cjs', '../another/build/main.js']) {
        assert.equal(isInstalledAdapter(['node', entry], cwd), false);
    }
    assert.equal(isInstalledAdapter(['node', 'build/main.js'], '/tmp/project'), false);
});

test('rating URL and proxy absolute targets are blocked before any HTTP dispatch', () => {
    const f = fixture();
    for (const transport of [f.http, f.https]) {
        for (const name of ['request', 'get']) {
            assert.throws(() => transport[name]('https://rating.iobroker.net/rating?uuid=synthetic-fixture'), rejectsEgress);
            assert.throws(() => transport[name]({ hostname: 'rating.iobroker.net', path: '/rating?uuid=synthetic-fixture' }), rejectsEgress);
            assert.throws(() => transport[name]({ hostname: '127.0.0.1', path: 'https://rating.iobroker.net/rating?uuid=synthetic-fixture' }), rejectsEgress);
            assert.throws(() => transport[name]({ hostname: '127.0.0.1', method: 'CONNECT', path: 'rating.iobroker.net:443' }), rejectsEgress);
            assert.throws(() => transport[name]({ hostname: '127.0.0.1', socketPath: '/run/proxy.sock' }), rejectsEgress);
        }
    }
    assert.deepEqual(f.calls, [], 'No blocked request reaches the underlying transport');
});

test('nonloopback raw socket, TLS, DNS and fetch fail without transport or identifier exposure', async () => {
    const f = fixture();
    for (const host of ['rating.iobroker.net', '0.0.0.0', '::', '192.168.10.153', '8.8.8.8', '127.0.0.1.example', '::ffff:192.168.1.2']) {
        assert.throws(() => new f.net.Socket().connect({ host, port: 443 }), rejectsEgress);
        assert.throws(() => new f.net.Socket().connect(443, host), rejectsEgress);
        assert.throws(() => f.tls.connect({ host, port: 443 }), rejectsEgress);
    }
    for (const host of ['rating.iobroker.net', '127.0.0.1.example']) assert.throws(() => f.dns.lookup(host, () => {}), rejectsEgress);
    await assert.rejects(f.target.fetch('https://rating.iobroker.net/rating?uuid=synthetic-fixture'), rejectsEgress);
    await assert.rejects(f.target.fetch({ url: 'https://rating.iobroker.net/rating?uuid=synthetic-fixture' }), rejectsEgress);
    assert.deepEqual(f.calls, []);
});

test('loopback options remain available and literal server bind addresses require no DNS egress', async () => {
    const f = fixture();
    for (const host of ['127.0.0.1', '127.1.2.3', '::1', '[::1]', '::ffff:127.0.0.1', 'localhost']) assert.equal(loopback(host), true);
    f.http.get('http://127.0.0.1:9001/');
    f.https.request({ hostname: '127.0.0.1', port: 8188, servername: 'nexowatt', path: '/api/auth/status', headers: { host: 'nexowatt' } });
    new f.net.Socket().connect({ host: '127.0.0.1', port: 9001 });
    new f.net.Socket().connect([{ host: '127.0.0.1', port: 9001 }, () => {}]);
    f.tls.connect({ host: '127.0.0.1', servername: 'nexowatt', port: 8188 });
    f.dns.lookup('localhost', () => {});
    f.dns.lookup('0.0.0.0', () => {});
    await f.target.fetch('http://127.0.0.1:8188/');
    assert.equal(f.calls.length, 8);
    assert.equal(f.calls.find(call => call[0] === 'dns')[1], '127.0.0.1');
});

test('fixture permits an actual wildcard listener and HTTP exchange on loopback in an isolated child', () => {
    const source = `
        const http = require('node:http');
        require(${JSON.stringify(path.resolve(__dirname, 'fixtures/loopback-egress.cjs'))}).installLoopbackEgress({
            http, https: require('node:https'), net: require('node:net'), tls: require('node:tls'), dns: require('node:dns')
        });
        const server = http.createServer((_req, res) => res.end('loopback-only'));
        server.listen(0, '0.0.0.0', () => {
            http.get({ hostname: '127.0.0.1', port: server.address().port, path: '/' }, res => {
                let text = ''; res.on('data', chunk => { text += chunk; });
                res.on('end', () => { server.close(); if(text !== 'loopback-only') process.exitCode = 1; else process.stdout.write('LOOPBACK_OK'); });
            }).on('error', () => { server.close(); process.exitCode = 1; });
        });
    `;
    const result = spawnSync(process.execPath, ['-e', source], { encoding: 'utf8', timeout: 10000 });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /LOOPBACK_OK/);
});

test('NODE_OPTIONS preload automatically blocks installed adapter but leaves npm role unmodified', t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'eos-egress-role-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const cwd = path.join(root, 'node_modules', 'iobroker.eos-admin');
    fs.mkdirSync(path.join(cwd, 'build'), { recursive: true });
    // A spy preload is deliberately first: even a broken privacy fixture cannot
    // send this regression test to an external endpoint.
    const spy = path.join(root, 'spy.cjs');
    fs.writeFileSync(spy, `require('node:https').request = () => { throw Object.assign(new Error('SPY_TRANSPORT'), {code:'SPY_TRANSPORT'}); };`);
    const main = expected => `
        require('node:assert/strict').throws(
            () => require('node:https').request('https://rating.iobroker.net/rating?uuid=synthetic-fixture'),
            error => error.code === ${JSON.stringify(expected)}
        );
        process.stdout.write('ROLE_OK');
    `;
    fs.writeFileSync(path.join(cwd, 'build', 'main.js'), main('EOS_TEST_EGRESS_BLOCKED'));
    fs.writeFileSync(path.join(cwd, 'npm-cli.js'), main('SPY_TRANSPORT'));
    for (const entry of ['build/main.js', 'npm-cli.js']) {
        const result = spawnSync(process.execPath, [entry], {
            cwd, encoding: 'utf8', timeout: 10000,
            env: { ...process.env, EOS_TEST_NETWORK_FIXTURE: 'loopback',
                NODE_OPTIONS: `--require=${spy} --require=${path.resolve(__dirname, 'fixtures/loopback-network.cjs')}` },
        });
        assert.equal(result.status, 0, result.stderr);
        assert.match(result.stdout, /ROLE_OK/);
    }
});
