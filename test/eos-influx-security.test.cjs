'use strict';
// Exercises the actual typed boundary, a synthetic authenticated failure fixture
// and the actual unchanged ioBroker crypto functions with synthetic keys.
// No production ioBroker secret, token or remote database is used.
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const path = require('node:path');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { createRequire } = require('node:module');
const load = file => require('tsx/cjs/api').require(path.resolve(__dirname, '../ui/src-ts/runtime-executables/lib/', file), __filename);
const { prepareInfluxHistoryChange, protectInfluxHistoryConfig, restoreInfluxHistoryConfig, redactInfluxHistoryConfig } = load('influx-config.ts');
const { validateInfluxUrl, assertInfluxAddressAllowed } = load('influx-network-policy.ts');
const token = 'synthetic-influx-secret-never-return-to-browser';
const oldHistory = () => ({ provider: 'influxdb2', instance: 'influxdb.0', datapoints: { power: 'alias.0.power' },
    influxdb2: { url: 'https://db.example:8086/', organization: 'NexoWatt', bucket: 'anlage', token } });
function codec(key = crypto.randomBytes(32)) {
    return {
        encrypt(text) { const iv = crypto.randomBytes(12); const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
            return Buffer.concat([iv, cipher.update(text), cipher.final(), cipher.getAuthTag()]).toString('base64'); },
        decrypt(text) { const bytes = Buffer.from(text, 'base64'); const decipher = crypto.createDecipheriv('aes-256-gcm', key, bytes.subarray(0, 12));
            decipher.setAuthTag(bytes.subarray(-16)); return Buffer.concat([decipher.update(bytes.subarray(12, -16)), decipher.final()]).toString(); },
    };
}
test('dedicated history change preserves unrelated settings and token on same origin', () => {
    const previous = oldHistory(); const snapshot = structuredClone(previous);
    const next = prepareInfluxHistoryChange(previous, { provider: 'influxdb2', influxdb2: { token: '', bucket: 'neu', url: 'https://DB.example:8086/prefix' } });
    assert.equal(next.influxdb2.token, token); assert.equal(next.influxdb2.bucket, 'neu');
    assert.deepEqual(next.datapoints, previous.datapoints); assert.deepEqual(previous, snapshot);
    const disabled = prepareInfluxHistoryChange(next, { provider: 'adapter', instance: 'sql.1' });
    assert.equal(disabled.provider, 'adapter'); assert.equal(disabled.instance, 'sql.1'); assert.equal(disabled.influxdb2.token, token);
    assert.equal(prepareInfluxHistoryChange({}, { provider: 'adapter' }).provider, 'adapter');
});
test('stored token cannot travel to another origin without an explicit replacement', () => {
    for (const url of ['https://other.example:8086/', 'https://db.example:443/', 'http://db.example:8086/']) {
        assert.throws(() => prepareInfluxHistoryChange(oldHistory(), { influxdb2: { url, token: '' } }), /NEW_DESTINATION_REQUIRES_TOKEN/);
    }
    const next = prepareInfluxHistoryChange(oldHistory(), { influxdb2: { url: 'https://other.example', token: 'new-synthetic-token' } });
    assert.equal(next.influxdb2.token, 'new-synthetic-token');
});
test('strict request rejects invalid provider, fields, instance, injected envelope and secret types', () => {
    for (const incoming of [null, [], { provider: null }, { provider: 'unknown' }, { retention: 'delete' }, { instance: 'system.config' },
        { instance: 'history.0\n' }, { influxdb2: { tokenEncrypted: { v: 1, encrypted: 'attacker' } } },
        { influxdb2: { token: null } }, { influxdb2: { url: null } }, { influxdb2: { organization: null } },
        { influxdb2: { token: 'abc\ndef' } }, { influxdb2: { caCertificate: true } },
        { influxdb2: { clearCaCertificate: 'true' } }, JSON.parse('{"__proto__":{}}')]) {
        assert.throws(() => prepareInfluxHistoryChange(oldHistory(), incoming), error => /^EOS_INFLUX_/.test(error.code) && !String(error).includes(token));
    }
});
test('custom HTTPS CA is validated and blank preserves it until explicit clear', () => {
    const forge = createRequire(require.resolve('@iobroker/js-controller-common-db'))('node-forge');
    const pair = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    const certificate = forge.pki.createCertificate();
    certificate.publicKey = forge.pki.publicKeyFromPem(pair.publicKey.export({ format: 'pem', type: 'spki' }));
    certificate.serialNumber = '0123456789'; certificate.validity.notBefore = new Date(Date.now() - 60000);
    certificate.validity.notAfter = new Date(Date.now() + 3600000);
    certificate.setSubject([{ name: 'commonName', value: 'synthetic-test-ca' }]);
    certificate.setIssuer(certificate.subject.attributes); certificate.setExtensions([{ name: 'basicConstraints', cA: true }]);
    certificate.sign(forge.pki.privateKeyFromPem(pair.privateKey.export({ format: 'pem', type: 'pkcs1' })), forge.md.sha256.create());
    const pem = forge.pki.certificateToPem(certificate);
    const previous = oldHistory(); previous.influxdb2.caCertificate = pem;
    assert.equal(prepareInfluxHistoryChange(previous, { influxdb2: { caCertificate: '' } }).influxdb2.caCertificate, pem);
    assert.equal(prepareInfluxHistoryChange(previous, { influxdb2: { clearCaCertificate: true } }).influxdb2.caCertificate, undefined);
    assert.throws(() => prepareInfluxHistoryChange(previous, { influxdb2: { caCertificate: 'not a certificate' } }), /CA_INVALID/);
});
test('plaintext token is encrypted in installer state and backup, while exact customer data survives', () => {
    const c = codec(); const root = { history: oldHistory(), devices: [{ id: 'ess1' }], storageFarm: { target: 1234 } };
    const original = structuredClone(root); const stored = protectInfluxHistoryConfig(root, c);
    assert.equal(stored.history.influxdb2.token, undefined); assert.equal(stored.history.influxdb2.tokenEncrypted.v, 1);
    assert.ok(!JSON.stringify(stored).includes(token)); assert.deepEqual(root, original);
    assert.deepEqual(restoreInfluxHistoryConfig(stored, c), root);
    assert.deepEqual(stored.devices, root.devices); assert.deepEqual(stored.storageFarm, root.storageFarm);
});
test('regular GET never returns plaintext, encrypted token or CA and never mutates config', () => {
    const root = { history: oldHistory() }; root.history.influxdb2.caCertificate = 'synthetic-ca-public-material';
    const original = structuredClone(root);
    const view = redactInfluxHistoryConfig(root);
    assert.equal(view.history.influxdb2.hasToken, true); assert.equal(view.history.influxdb2.hasCaCertificate, true);
    assert.equal(view.history.influxdb2.token, undefined); assert.equal(view.history.influxdb2.caCertificate, undefined);
    assert.ok(!JSON.stringify(view).includes(token)); assert.deepEqual(root, original);
    const stored = protectInfluxHistoryConfig(root, codec()); const hidden = redactInfluxHistoryConfig(stored);
    assert.equal(hidden.history.influxdb2.tokenEncrypted, undefined); assert.equal(hidden.history.influxdb2.hasToken, true);
});
test('crypto absence, failure and identity output fail closed with no plaintext fallback', () => {
    for (const broken of [{}, { encrypt: () => { throw Error(token); } }, { encrypt: value => value }, { encrypt: () => token }, { encrypt: () => '' }]) {
        assert.throws(() => protectInfluxHistoryConfig({ history: oldHistory() }, broken), error => error.code === 'EOS_INFLUX_TOKEN_ENCRYPTION_FAILED' && !String(error).includes(token));
    }
    assert.deepEqual(protectInfluxHistoryConfig({ untouched: true }, {}), { untouched: true });
});
test('foreign host key quarantines only history and keeps recoverable ciphertext and EMS/device configuration', () => {
    const c = codec(); const saved = protectInfluxHistoryConfig({ history: oldHistory(), devices: ['ess1'], datapoints: { nvp: 'alias.0.nvp' } }, c);
    const failed = restoreInfluxHistoryConfig(saved, codec());
    assert.equal(failed.history.credentialError, 'EOS_INFLUX_TOKEN_DECRYPTION_FAILED');
    assert.equal(failed.history.influxdb2.token, undefined); assert.deepEqual(failed.history.influxdb2.tokenEncrypted, saved.history.influxdb2.tokenEncrypted);
    assert.deepEqual(failed.devices, saved.devices); assert.deepEqual(failed.datapoints, saved.datapoints);
    assert.ok(!JSON.stringify(failed).includes(token));
    const backedUp = protectInfluxHistoryConfig(failed, {});
    assert.deepEqual(backedUp.history.influxdb2.tokenEncrypted, saved.history.influxdb2.tokenEncrypted);
    const repaired = restoreInfluxHistoryConfig(backedUp, c);
    assert.equal(repaired.history.credentialError, undefined); assert.equal(repaired.history.influxdb2.token, token);
    const replacement = prepareInfluxHistoryChange(failed.history, { influxdb2: { token: 'new-local-secret' } });
    assert.equal(replacement.credentialError, undefined); assert.equal(replacement.influxdb2.token, 'new-local-secret');
    assert.equal(replacement.influxdb2.tokenEncrypted, undefined);
});
test('malformed or purpose-confused ciphertext is quarantined, never interpreted as a token', () => {
    const c = codec();
    for (const envelope of ['string', {}, { v: 2, encrypted: 'x' }, { v: 1, encrypted: 'x'.repeat(32769) },
        { v: 1, encrypted: c.encrypt(JSON.stringify({ purpose: 'another-secret', token })) }]) {
        const root = { history: { ...oldHistory(), influxdb2: { ...oldHistory().influxdb2, tokenEncrypted: envelope } }, storage: { enabled: true } };
        const restored = restoreInfluxHistoryConfig(root, c);
        assert.equal(restored.history.credentialError, 'EOS_INFLUX_TOKEN_DECRYPTION_FAILED');
        assert.equal(restored.history.influxdb2.token, undefined); assert.deepEqual(restored.storage, root.storage);
    }
});
test('encrypted backup envelope cannot be redirected to a different origin to reveal its token', () => {
    const c = codec(); const stored = protectInfluxHistoryConfig({ history: oldHistory(), devices: ['ess1'] }, c);
    stored.history.influxdb2.url = 'https://attacker.example/';
    const restored = restoreInfluxHistoryConfig(stored, c);
    assert.equal(restored.history.credentialError, 'EOS_INFLUX_TOKEN_DECRYPTION_FAILED');
    assert.equal(restored.history.influxdb2.token, undefined);
    assert.deepEqual(restored.history.influxdb2.tokenEncrypted, stored.history.influxdb2.tokenEncrypted);
    assert.deepEqual(restored.devices, ['ess1']);
});
test('imported plaintext credentials with an invalid destination are isolated without losing EMS data', () => {
    const root = { history: oldHistory(), storage: { enabled: true } };
    root.history.influxdb2.url = 'http://169.254.169.254';
    const result = restoreInfluxHistoryConfig(root, codec());
    assert.equal(result.history.credentialError, 'EOS_INFLUX_CONFIG_INVALID');
    assert.equal(result.history.influxdb2.token, undefined); assert.deepEqual(result.storage, root.storage);
});
test('network policy allows private LAN and loopback IPv4/IPv6, HTTPS public, rejects public plaintext', () => {
    for (const address of ['127.0.0.1', '10.20.30.40', '172.16.0.1', '172.31.255.255', '192.168.10.153', '::1', 'fd12::a', 'fc00::1', '::ffff:127.0.0.1', '::ffff:c0a8:0999']) {
        assert.doesNotThrow(() => assertInfluxAddressAllowed(address, 'http:'));
    }
    for (const address of ['8.8.8.8', '172.32.0.1', '100.64.0.1', '2001:4860:4860::8888']) {
        assert.throws(() => assertInfluxAddressAllowed(address, 'http:'), /HTTP_REQUIRES_LOCAL_ADDRESS/);
        assert.doesNotThrow(() => assertInfluxAddressAllowed(address, 'https:'));
    }
});
test('metadata, link-local, multicast, unspecified and IPv4 mapped bypasses reject before any request', () => {
    for (const address of ['169.254.169.254', '100.100.100.200', '0.0.0.0', '0.1.2.3', '224.0.0.1', '255.255.255.255', '::', 'fe80::1', 'febf::1', 'ff02::1',
        'fd00:ec2::254', 'fd00:0ec2:0000:0000:0000:0000:0000:0254', 'fd20:ce::254', 'fd20:00ce:0:0:0:0:0:0254',
        '::ffff:169.254.169.254', '::ffff:a9fe:a9fe', '::ffff:0:0', '::192.168.1.1', 'fe80::1%eth0', 'not-an-address']) {
        for (const protocol of ['http:', 'https:']) assert.throws(() => assertInfluxAddressAllowed(address, protocol), /ADDRESS_FORBIDDEN/);
    }
    for (const url of ['http://2852039166/', 'http://0xa9fea9fe/', 'http://169.254.169.254/', 'https://metadata.google.internal/', 'https://instance-data.ec2.internal./']) {
        assert.throws(() => validateInfluxUrl(url), /ADDRESS_FORBIDDEN/);
    }
});
test('URL validation forbids secret-bearing URL parts and unsafe schemes while preserving LAN discovery names', () => {
    for (const url of ['file:///etc/passwd', 'ftp://127.0.0.1', 'http://u:password@localhost/', 'http://localhost/?token=secret', 'http://localhost/#secret', 'http://localhost/api/v2/write', 'http://local\nhost/']) {
        assert.throws(() => validateInfluxUrl(url), /URL_INVALID/);
    }
    assert.equal(validateInfluxUrl('http://nexowatt.local:8086').href, 'http://nexowatt.local:8086/');
    assert.equal(validateInfluxUrl('http://127.1:8086').href, 'http://127.0.0.1:8086/');
    assert.equal(validateInfluxUrl('http://[::1]:8086').href, 'http://[::1]:8086/');
});


function platformCodec(key) {
    const toolsFile = path.join(path.dirname(require.resolve('@iobroker/js-controller-common-db')), 'lib/common/tools.js');
    const source = fs.readFileSync(toolsFile, 'utf8');
    const ast = ts.createSourceFile(toolsFile, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const names = ['encryptLegacy', 'decryptLegacy', 'encrypt', 'decrypt'];
    const definitions = names.map(name => {
        const node = ast.statements.find(item => ts.isFunctionDeclaration(item) && item.name?.text === name);
        assert.ok(node, `actual platform utility ${name} is available`);
        return node.getText(ast);
    });
    // Execute exact shipped crypto utility bodies with Node's crypto. This avoids
    // unrelated module-level controller-directory discovery, not crypto behavior.
    const api = vm.runInNewContext(definitions.join('\n') + '\n({encrypt, decrypt})', {
        import_node_crypto: { default: crypto }, Buffer,
    });
    return { encrypt: value => api.encrypt(key, value), decrypt: value => api.decrypt(key, value) };
}
test('actual ioBroker standard-key AES-192-CBC roundtrip, wrong-key isolation and encrypted backup recovery', () => {
    const c = platformCodec(crypto.randomBytes(24).toString('hex'));
    const root = { history: oldHistory(), devices: [{ id: 'ess2', enabled: true }], datapoints: { nvp: 'alias.0.grid' },
        storageFarm: { mode: 'pool', minSocPct: 10 }, smartHome: { rooms: ['Wohnzimmer'] } };
    const stored = protectInfluxHistoryConfig(root, c);
    assert.match(stored.history.influxdb2.tokenEncrypted.encrypted, /^\$\/aes-192-cbc:[a-f0-9]{32}:[a-f0-9]+$/);
    assert.ok(!JSON.stringify(stored).includes(token));
    assert.deepEqual(restoreInfluxHistoryConfig(stored, c), root);
    const failed = restoreInfluxHistoryConfig(stored, platformCodec(crypto.randomBytes(24).toString('hex')));
    assert.equal(failed.history.credentialError, 'EOS_INFLUX_TOKEN_DECRYPTION_FAILED');
    for (const key of ['devices', 'datapoints', 'storageFarm', 'smartHome']) assert.deepEqual(failed[key], root[key]);
    const recovered = restoreInfluxHistoryConfig(protectInfluxHistoryConfig(failed, {}), c);
    assert.deepEqual(recovered, root);
});
test('quarantined history never overwrites recovery envelope with a token left by an old deep merge', () => {
    const c = codec();
    const saved = protectInfluxHistoryConfig({ history: oldHistory(), devices: ['ess2'] }, c);
    const failed = restoreInfluxHistoryConfig(saved, codec());
    failed.history.influxdb2.token = 'stale-token-from-previous-runtime';
    const protectedAgain = protectInfluxHistoryConfig(failed, {});
    assert.equal(protectedAgain.history.influxdb2.token, undefined);
    assert.deepEqual(protectedAgain.history.influxdb2.tokenEncrypted, saved.history.influxdb2.tokenEncrypted);
    assert.equal(protectedAgain.history.credentialError, 'EOS_INFLUX_TOKEN_DECRYPTION_FAILED');
    assert.deepEqual(protectedAgain.devices, ['ess2']);
});
