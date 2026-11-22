'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { parseArguments, resolveController, requests, decodeOutput, createCliReader, collectDiagnostics } = require('../tools/eos-access-diagnostics.cjs');

test('CLI accepts only explicit directory and numeric instance options', () => {
    assert.deepEqual(parseArguments(['--iobroker-dir', '/opt/iobroker']), { directory: '/opt/iobroker', instance: '0' });
    assert.deepEqual(parseArguments(['--instance', '12', '--iobroker-dir', '/opt/iobroker']), { directory: '/opt/iobroker', instance: '12' });
    for (const args of [[], ['--iobroker-dir', 'relative'], ['--iobroker-dir', '/tmp/x', '--exec', '/bin/sh'], ['--iobroker-dir', '/tmp/x', '--instance', '0; rm -rf /'], ['--iobroker-dir', '/tmp/x', '--instance', '-1'], ['--iobroker-dir', '/tmp/x', '--instance', '10000']]) {
        assert.throws(() => parseArguments(args), /ARGUMENTS_INVALID/);
    }
});

test('controller lookup verifies exact package identity and fixed CLI path', t => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eos-diagnostics-'));
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    const controller = path.join(dir, 'node_modules', 'iobroker.js-controller');
    fs.mkdirSync(controller, { recursive: true });
    fs.writeFileSync(path.join(controller, 'package.json'), JSON.stringify({ name: 'iobroker.js-controller', version: '7.2.5', bin: { iobroker: '/bin/sh' } }));
    fs.writeFileSync(path.join(controller, 'iobroker.js'), '// test fixture only\n');
    const target = resolveController(dir);
    assert.equal(target.cli, path.join(controller, 'iobroker.js'));
    fs.writeFileSync(path.join(controller, 'package.json'), JSON.stringify({ name: 'not-controller', version: '7.2.5' }));
    assert.throws(() => resolveController(dir), /CONTROLLER_IDENTITY_INVALID/);
});

test('all diagnostic controller commands are fixed allowlisted reads', () => {
    const list = requests('7');
    assert.equal(list.length, 25);
    for (const request of list) {
        assert.ok((request.args[0] === 'object' && request.args[1] === 'get') || (request.args[0] === 'state' && request.args[1] === 'getValue'));
        assert.ok(['system.adapter.eos-admin.7', 'system.adapter.admin.0', 'system.user.admin', 'system.certificates', 'system.adapter.eos-admin.7.alive', 'system.adapter.admin.0.alive'].includes(request.args[2]));
        assert.equal(request.args.includes('extend'), false);
        assert.equal(request.args.includes('start'), false);
    }
    assert.throws(() => requests('0;echo injected'), /ARGUMENTS_INVALID/);
});

test('password presence output never contains the stored value', async () => {
    const fakeHash = 'test-only-pbkdf2-hash-that-must-not-be-disclosed';
    const report = await collectDiagnostics(async request => {
        const values = { boolean: 'true\n', port: '8188\n', bind: '127.0.0.1\n', origin: 'https://192.168.10.192\n', passwordPresence: fakeHash + '\n', certificateName: 'defaultPublic\n', certificateInventory: '{"defaultPublic":"PUBLIC-TEST","defaultPrivate":"PRIVATE-TEST"}' };
        return decodeOutput(request.type, values[request.type]);
    }, '0', '7.2.5');
    assert.equal(report.adminAccount.passwordPresent, true);
    assert.equal(JSON.stringify(report).includes(fakeHash), false);
    assert.equal(JSON.stringify(report).includes('PRIVATE-TEST'), false);
    assert.equal(Object.hasOwn(report.adminAccount, 'password'), false);
    assert.equal(report.readOnly, true);
    assert.equal(report.readErrors.length, 0);
});

test('CLI reader rejects writes, appended arguments and decoder swaps without spawning', async () => {
    const read = createCliReader({ directory: '/tmp', cli: '/tmp/iobroker.js' }, () => assert.fail('invalid request spawned'));
    const allowed = requests('0')[0];
    for (const request of [
        { ...allowed, args: ['object', 'set', allowed.args[2], 'common.enabled=false'] },
        { ...allowed, args: [...allowed.args, '--exec=/bin/sh'] },
        { ...allowed, type: 'passwordPresence' },
        { field: 'anything', args: ['start', 'admin.0'], type: 'boolean' },
    ]) assert.deepEqual(await read(request), { value: null, error: 'REQUEST_NOT_ALLOWED' });
});

test('certificate inventory emits names/presence only, never PEMs, keys or unexpected names', () => {
    const output = decodeOutput('certificateInventory', JSON.stringify({ defaultPublic: '-----BEGIN CERTIFICATE-----\nPUBLIC\n-----END CERTIFICATE-----', defaultPrivate: '-----BEGIN PRIVATE KEY-----\nTOPSECRET\n-----END PRIVATE KEY-----', empty: '', 'private key secret data': 'unused' }));
    assert.deepEqual(output, { value: { names: ['defaultPrivate', 'defaultPublic'], defaultPublic: true, defaultPrivate: true, omittedNames: 2 } });
    assert.equal(JSON.stringify(output).includes('TOPSECRET'), false);
    assert.equal(JSON.stringify(output).includes('PRIVATE KEY'), false);
    assert.deepEqual(decodeOutput('certificateInventory', 'private PEM, not JSON'), { value: null, error: 'VALUE_INVALID' });
    assert.deepEqual(decodeOutput('certificateName', '-----BEGIN PRIVATE KEY-----'), { value: null, error: 'VALUE_INVALID' });
});

test('direct all-interface HTTPS is reported without claiming a live listener or valid certificate', async () => {
    const report = await collectDiagnostics(async request => {
        const values = { boolean: 'true', port: '8188', bind: '0.0.0.0', origin: '', passwordPresence: 'test-only-hash', certificateName: '', certificateInventory: '{"defaultPublic":"public","defaultPrivate":"private"}' };
        return decodeOutput(request.type, values[request.type]);
    }, '0', '7.2.5');
    assert.ok(report.findings.some(row => row.code === 'EOS_DIRECT_HTTPS_PROFILE'));
    assert.ok(report.findings.some(row => row.code === 'EOS_TLS_NAMES_MISSING'));
    assert.equal(report.certificates.inventory.defaultPublic, true);
    assert.equal(report.certificates.inventory.defaultPrivate, true);
});

test('missing, unknown and malformed password statuses are distinguished', () => {
    assert.deepEqual(decodeOutput('passwordPresence', '\n'), { value: false });
    assert.deepEqual(decodeOutput('passwordPresence', 'undefined\n'), { value: false });
    assert.deepEqual(decodeOutput('passwordPresence', 'hash\nUnexpected log\n'), { value: null, error: 'VALUE_INVALID' });
    assert.deepEqual(decodeOutput('passwordPresence', 'x'.repeat(16385)), { value: null, error: 'OUTPUT_LIMIT' });
});

test('private or malformed values in allowlisted fields are not printed', () => {
    for (const [type, value] of [['bind', 'unexpected-secret-value'], ['boolean', '{"password":"hidden"}'], ['port', '65536'], ['origin', 'https://user:secret@example.com'], ['origin', 'https://example.com/?token=secret']]) {
        const result = decodeOutput(type, value);
        assert.equal(result.value, null);
        assert.equal(result.error, 'VALUE_INVALID');
        assert.equal(JSON.stringify(result).includes('secret'), false);
    }
});

test('child CLI uses Node, fixed argv, no shell, strict bounds and sanitized error handling', async () => {
    const target = { directory: '/tmp/name;echo-injection', cli: '/tmp/name;echo-injection/node_modules/iobroker.js-controller/iobroker.js' };
    const run = createCliReader(target, (command, args, options, callback) => {
        assert.equal(command, process.execPath);
        assert.equal(args[0], target.cli);
        assert.deepEqual(args.slice(1), ['object', 'get', 'system.user.admin', 'common.password']);
        assert.equal(options.shell, false);
        assert.equal(options.cwd, target.directory);
        assert.equal(options.maxBuffer, 16384);
        assert.ok(options.timeout > 0 && options.timeout <= 3000);
        assert.equal(options.env.NODE_OPTIONS, undefined);
        callback(Object.assign(new Error('raw-secret-value'), { stdout: 'raw-secret-value', stderr: 'raw-secret-value', killed: true }), 'raw-secret-value');
    });
    const result = await run(requests('0').find(row => row.field === 'adminAccount.passwordPresent'));
    assert.deepEqual(result, { value: null, error: 'TIMEOUT' });
    assert.equal(JSON.stringify(result).includes('raw-secret-value'), false);
});

test('partial failures report only field/error codes and diagnose alpha access pattern', async () => {
    const report = await collectDiagnostics(async request => {
        if (request.field === 'adminAccount.passwordPresent') throw new Error('private raw output');
        if (request.field === 'legacyAdmin.enabled') return { value: false };
        if (request.type === 'boolean') return { value: true };
        if (request.type === 'port') return { value: 8188 };
        if (request.type === 'bind') return { value: '127.0.0.1' };
        return { value: 'https://192.168.10.192' };
    }, '0', '7.2.5');
    assert.equal(report.adminAccount.passwordPresent, null);
    assert.ok(report.findings.some(row => row.code === 'LEGACY_ADMIN_DISABLED'));
    assert.ok(report.findings.some(row => row.code === 'LEGACY_LOCK_ACTIVE'));
    assert.ok(report.findings.some(row => row.code === 'ADMIN_PASSWORD_UNKNOWN'));
    assert.equal(JSON.stringify(report).includes('private raw output'), false);
});
