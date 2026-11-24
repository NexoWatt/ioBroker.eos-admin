'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { loadEosSocketSecret } = require('../src/lib/eosSocketSecret');
function fixture(t) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'eos-socket-secret-'));
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    return directory;
}
test('EOS socket secret persists per instance and does not create shared platform files', t => {
    const a = fixture(t),
        b = fixture(t),
        secret = loadEosSocketSecret(a);
    assert.match(secret, /^[a-f0-9]{64}$/);
    assert.equal(loadEosSocketSecret(a), secret);
    assert.notEqual(loadEosSocketSecret(b), secret);
    assert.deepEqual(fs.readdirSync(a), ['security']);
    assert.deepEqual(fs.readdirSync(path.join(a, 'security')), ['socket-secret']);
    if (process.platform !== 'win32') {
        assert.equal(fs.statSync(path.join(a, 'security')).mode & 0o777, 0o700);
        assert.equal(fs.statSync(path.join(a, 'security/socket-secret')).mode & 0o777, 0o600);
    }
});
test('damaged existing key is rejected and preserved instead of rotated', t => {
    const dir = fixture(t);
    loadEosSocketSecret(dir);
    const key = path.join(dir, 'security/socket-secret');
    fs.writeFileSync(key, 'damaged');
    assert.throws(() => loadEosSocketSecret(dir), /EOS_SOCKET_SECRET_UNAVAILABLE/);
    assert.equal(fs.readFileSync(key, 'utf8'), 'damaged');
});
test('symlink, hardlink and insecure permission targets fail closed', t => {
    const dir = fixture(t),
        other = fixture(t);
    loadEosSocketSecret(dir);
    const key = path.join(dir, 'security/socket-secret');
    fs.linkSync(key, path.join(other, 'alias'));
    assert.throws(() => loadEosSocketSecret(dir), /EOS_SOCKET_SECRET_UNAVAILABLE/);
    fs.unlinkSync(path.join(other, 'alias'));
    if (process.platform !== 'win32') {
        fs.chmodSync(key, 0o644);
        assert.throws(() => loadEosSocketSecret(dir), /EOS_SOCKET_SECRET_UNAVAILABLE/);
        fs.chmodSync(key, 0o600);
        const original = fs.readFileSync(key);
        fs.unlinkSync(key);
        fs.writeFileSync(path.join(other, 'foreign'), original);
        fs.symlinkSync(path.join(other, 'foreign'), key);
        assert.throws(() => loadEosSocketSecret(dir), /EOS_SOCKET_SECRET_UNAVAILABLE/);
        assert.deepEqual(fs.readFileSync(path.join(other, 'foreign')), original);
    }
});
test('concurrent initializer winning atomic publication is preserved', t => {
    const dir = fixture(t),
        winner = Buffer.alloc(32, 0x5c),
        realLink = fs.linkSync;
    fs.linkSync = function (from, to) {
        fs.writeFileSync(to, winner, { flag: 'wx', mode: 0o600 });
        throw Object.assign(new Error('concurrent initializer'), { code: 'EEXIST' });
    };
    try {
        assert.equal(loadEosSocketSecret(dir), winner.toString('hex'));
    } finally {
        fs.linkSync = realLink;
    }
    assert.deepEqual(fs.readdirSync(path.join(dir, 'security')), ['socket-secret']);
});
test('EOS bootstrap neither reads nor initializes the platform encryption secret', () => {
    const main = fs.readFileSync(path.join(__dirname, '../src/main.ts'), 'utf8');
    assert.match(main, /this\.secret = loadEosSocketSecret\(getAbsoluteInstanceDataDir\(this\)\)/);
    assert.doesNotMatch(main, /systemConfig\.native\.secret/);
    assert.doesNotMatch(main, /extendForeignObjectAsync\('system\.config'/);
    assert.match(main, /oauth2Only: true/);
    assert.match(main, /const prefix = `\$\{this\.namespace\}\.info\.platformVersions`/);
    assert.doesNotMatch(main, /const prefix = `system\.host\.\$\{this\.host\}\.versions`/);
});
