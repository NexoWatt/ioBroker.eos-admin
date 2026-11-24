/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
'use strict';
// Unabhängige Dateisystem-Negativprüfungen. Kein npm-Upload, keine Kundendaten.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { preparePublish } = require('../tools/eos-prepare-publish.cjs');
const sourceRoot = path.resolve(__dirname, '..');
const sealName = 'release-manifests/unified/files.json';
const inventoryName = 'release-manifests/unified/obsolete-admin-assets.json';
const currentName = 'adminWww/assets/Current-abcdef12.js';
const oldName = 'adminWww/assets/Legacy-01234567.js';
const sha = data => crypto.createHash('sha256').update(data).digest('hex');
function fixture(t) {
    const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'eos-publish-security-'));
    const root = path.join(parent, 'repo'); fs.mkdirSync(root);
    t.after(() => fs.rmSync(parent, { recursive: true, force: true }));
    const write = (rel, data) => { fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true }); fs.writeFileSync(path.join(root, rel), data); };
    write('package.json', JSON.stringify({ name: 'iobroker.eos-admin', version: '9.0.13' }));
    write('tools/eos-release-manifest.cjs', fs.readFileSync(path.join(sourceRoot, 'tools/eos-release-manifest.cjs')));
    write('tools/eos-prepare-publish.cjs', fs.readFileSync(path.join(sourceRoot, 'tools/eos-prepare-publish.cjs')));
    write('adminWww/index.html', '<script src="assets/Current-abcdef12.js"></script>');
    write(currentName, 'window.currentRelease = true;\n');
    const oldBytes = Buffer.from('window.knownOldBuild = true;\n');
    const inventory = { schema: 1, algorithm: 'SHA-256', files: { [oldName]: [sha(oldBytes)] } };
    const manifest = require(path.join(root, 'tools/eos-release-manifest.cjs'));
    const seal = () => { write(inventoryName, JSON.stringify(inventory)); write(sealName, JSON.stringify({ schema: 1, version: '9.0.13', algorithm: 'SHA-256', files: manifest.snapshot() })); };
    seal();
    const originalSeal = () => fs.readFileSync(path.join(root, sealName));
    const siblings = () => fs.readdirSync(parent).filter(name => name !== 'repo');
    const prepare = () => preparePublish({ root });
    return { parent, root, write, oldBytes, inventory, seal, originalSeal, siblings, prepare };
}
function refusesWithoutMutation(f, action) {
    const sealBefore = f.originalSeal(); const before = f.siblings();
    assert.throws(action);
    assert.deepEqual(f.originalSeal(), sealBefore, 'a failed preparation must not reseal files');
    assert.deepEqual(f.siblings(), before, 'preflight failure must not create a backup or move files');
}

test('control fixture preserves current bytes and backs up a verified obsolete asset outside the package', t => {
    const f = fixture(t); const sealed = f.originalSeal(); f.write(oldName, f.oldBytes);
    const result = f.prepare();
    assert.deepEqual(result.quarantined, [oldName]);
    assert.equal(path.dirname(result.backupDir), f.parent);
    assert.equal(fs.existsSync(path.join(f.root, oldName)), false);
    assert.deepEqual(fs.readFileSync(path.join(result.backupDir, oldName)), f.oldBytes);
    assert.deepEqual(f.originalSeal(), sealed);
    assert.equal(JSON.parse(fs.readFileSync(path.join(result.backupDir, 'restore.json'), 'utf8')).state, 'complete');
    if (process.platform !== 'win32') {
        assert.equal(fs.statSync(result.backupDir).mode & 0o777, 0o700);
        assert.equal(fs.statSync(path.join(result.backupDir, oldName)).mode & 0o777, 0o600);
    }
    assert.equal(f.prepare().backupDir, null, 'preparing the resulting clean tree is idempotent');
});

test('modified current bytes block cleanup of simultaneously present known old assets', t => {
    const f = fixture(t); f.write(oldName, f.oldBytes); f.write(currentName, 'modified current build');
    refusesWithoutMutation(f, f.prepare);
    assert.deepEqual(fs.readFileSync(path.join(f.root, oldName)), f.oldBytes);
});

test('missing current file blocks cleanup before a backup is created', t => {
    const f = fixture(t); f.write(oldName, f.oldBytes); fs.unlinkSync(path.join(f.root, currentName));
    refusesWithoutMutation(f, f.prepare);
    assert.deepEqual(fs.readFileSync(path.join(f.root, oldName)), f.oldBytes);
});

test('a known obsolete filename with unknown bytes remains untouched and blocks preparation', t => {
    const f = fixture(t); f.write(oldName, 'unreviewed replacement');
    refusesWithoutMutation(f, f.prepare);
    assert.equal(fs.readFileSync(path.join(f.root, oldName), 'utf8'), 'unreviewed replacement');
});

test('unknown extra files are not silently removed along with known old assets', t => {
    const f = fixture(t); f.write(oldName, f.oldBytes); f.write('adminWww/assets/Customer-13572468.js', 'customer data');
    refusesWithoutMutation(f, f.prepare);
    assert.deepEqual(fs.readFileSync(path.join(f.root, oldName)), f.oldBytes);
    assert.equal(fs.readFileSync(path.join(f.root, 'adminWww/assets/Customer-13572468.js'), 'utf8'), 'customer data');
});

test('edited obsolete inventory does not become an authorization to move arbitrary files', t => {
    const f = fixture(t); f.write(oldName, f.oldBytes);
    f.inventory.files['adminWww/assets/Customer-13572468.js'] = [sha('customer data')];
    f.write(inventoryName, JSON.stringify(f.inventory)); f.write('adminWww/assets/Customer-13572468.js', 'customer data');
    refusesWithoutMutation(f, f.prepare);
});

for (const invalid of ['../outside.js', '/absolute.js', 'adminWww/assets/../outside.js', 'adminWww/assets/a\\b.js', 'adminWww/assets/a.js:stream', 'adminWww/assets/CON.js']) {
    test('invalid inventory path fails closed without changing anything: ' + invalid, t => {
        const f = fixture(t); f.inventory.files[invalid] = [sha(f.oldBytes)]; f.seal(); f.write(oldName, f.oldBytes);
        refusesWithoutMutation(f, f.prepare);
        assert.deepEqual(fs.readFileSync(path.join(f.root, oldName)), f.oldBytes);
    });
}

for (const outsideScope of ['ui/admin/react/local-settings.json', 'ui/src-admin-tab/src/customer.js', 'ui/admin/react/assets-other/file.js', 'admin/custom/assets/customer.js']) {
    test('extending installer support does not authorize other catalogue paths: ' + outsideScope, t => {
        const f = fixture(t); f.inventory.files[outsideScope] = [sha('custom data')]; f.seal();
        f.write(oldName, f.oldBytes); f.write(outsideScope, 'custom data');
        refusesWithoutMutation(f, f.prepare);
        assert.deepEqual(fs.readFileSync(path.join(f.root, oldName)), f.oldBytes);
        assert.equal(fs.readFileSync(path.join(f.root, outsideScope), 'utf8'), 'custom data');
    });
}

test('dangling installer symlinks are rejected before a known old admin file is moved', t => {
    const f = fixture(t); f.write(oldName, f.oldBytes);
    fs.mkdirSync(path.join(f.root, 'ui/admin/react/assets'), { recursive: true });
    const link = path.join(f.root, 'ui/admin/react/assets/unlisted.js');
    try { fs.symlinkSync(path.join(f.parent, 'absent-target'), link); } catch (error) { if (error.code === 'EPERM') { t.skip('symlink creation not permitted on this platform'); return; } throw error; }
    refusesWithoutMutation(f, f.prepare);
    assert.equal(fs.lstatSync(link).isSymbolicLink(), true);
    assert.deepEqual(fs.readFileSync(path.join(f.root, oldName)), f.oldBytes);
});

test('an installer parent link cannot hide behind an absent compiled build directory', t => {
    const f = fixture(t); f.write(oldName, f.oldBytes);
    const external = path.join(f.parent, 'external-ui'); fs.mkdirSync(external);
    try { fs.symlinkSync(external, path.join(f.root, 'ui'), 'junction'); } catch (error) { if (error.code === 'EPERM') { t.skip('directory symlink creation not permitted on this platform'); return; } throw error; }
    const before = f.siblings();
    refusesWithoutMutation(f, f.prepare);
    assert.deepEqual(f.siblings(), before);
    assert.deepEqual(fs.readFileSync(path.join(f.root, oldName)), f.oldBytes);
});

test('known installer hardlinks are rejected without moving any admin files', t => {
    const f = fixture(t); const installerName = 'ui/admin/react/assets/index-Bm4__n5R.js';
    f.inventory.files[installerName] = [sha(f.oldBytes)]; f.seal();
    f.write(oldName, f.oldBytes); f.write(installerName, f.oldBytes);
    const other = path.join(f.parent, 'external-installer.js'); fs.linkSync(path.join(f.root, installerName), other);
    refusesWithoutMutation(f, f.prepare);
    assert.deepEqual(fs.readFileSync(path.join(f.root, oldName)), f.oldBytes);
    assert.deepEqual(fs.readFileSync(other), f.oldBytes);
});

test('dangling obsolete symlink is rejected instead of becoming an invisible extra', t => {
    const f = fixture(t); const file = path.join(f.root, oldName);
    try { fs.symlinkSync(path.join(f.parent, 'absent-target'), file); } catch (error) { if (error.code === 'EPERM') { t.skip('symlink creation not permitted on this platform'); return; } throw error; }
    refusesWithoutMutation(f, f.prepare); assert.equal(fs.lstatSync(file).isSymbolicLink(), true);
});

test('a symlinked assets directory cannot redirect preparation outside the package', t => {
    const f = fixture(t); f.write(oldName, f.oldBytes); const actual = path.join(f.parent, 'outside-assets');
    fs.renameSync(path.join(f.root, 'adminWww/assets'), actual);
    try { fs.symlinkSync(actual, path.join(f.root, 'adminWww/assets'), 'junction'); } catch (error) { if (error.code === 'EPERM') { t.skip('directory symlink creation not permitted on this platform'); return; } throw error; }
    refusesWithoutMutation(f, f.prepare);
    assert.deepEqual(fs.readFileSync(path.join(actual, path.basename(oldName))), f.oldBytes);
});

test('hardlinked obsolete files are rejected while the external link remains unchanged', t => {
    const f = fixture(t); f.write(oldName, f.oldBytes); const other = path.join(f.parent, 'outside-hardlink.js');
    fs.linkSync(path.join(f.root, oldName), other);
    refusesWithoutMutation(f, f.prepare); assert.deepEqual(fs.readFileSync(other), f.oldBytes);
});

test('casefold collision with a current sealed asset is never treated as removable old data', t => {
    if (process.platform === 'win32') { t.skip('case-sensitive collision fixture uses POSIX filesystem; Windows publication is checked separately'); return; }
    const f = fixture(t); const conflicting = currentName.toLowerCase();
    f.inventory.files[conflicting] = [sha(f.oldBytes)]; f.seal(); f.write(conflicting, f.oldBytes);
    refusesWithoutMutation(f, f.prepare);
    assert.equal(fs.readFileSync(path.join(f.root, currentName), 'utf8'), 'window.currentRelease = true;\n');
});

test('current page references prevent removing an otherwise known obsolete asset', t => {
    const f = fixture(t); f.write('adminWww/index.html', '<script src="assets/Legacy-01234567.js"></script>'); f.seal(); f.write(oldName, f.oldBytes);
    refusesWithoutMutation(f, f.prepare);
    assert.deepEqual(fs.readFileSync(path.join(f.root, oldName)), f.oldBytes);
});

function twoOldFiles(t) {
    const f = fixture(t); const secondName = 'adminWww/assets/Legacy-z9876543.js';
    const secondBytes = Buffer.from('window.anotherOldBuild = true;\n');
    f.inventory.files[secondName] = [sha(secondBytes)]; f.seal();
    f.write(oldName, f.oldBytes); f.write(secondName, secondBytes);
    return { ...f, secondName, secondBytes };
}

test('failure after the first unlink restores original files and retains a recoverable backup', t => {
    const f = twoOldFiles(t); const sealed = f.originalSeal(); const unlink = fs.unlinkSync;
    fs.unlinkSync = function(target) {
        if (String(target) === path.join(f.root, f.secondName)) throw Object.assign(new Error('injected I/O failure'), { code: 'EIO' });
        return unlink.apply(this, arguments);
    };
    try { assert.throws(f.prepare, /EOS_PUBLISH_IO/); } finally { fs.unlinkSync = unlink; }
    assert.deepEqual(fs.readFileSync(path.join(f.root, oldName)), f.oldBytes);
    assert.deepEqual(fs.readFileSync(path.join(f.root, f.secondName)), f.secondBytes);
    assert.deepEqual(f.originalSeal(), sealed);
    assert.equal(f.siblings().length, 1);
    const backup = path.join(f.parent, f.siblings()[0]);
    assert.equal(JSON.parse(fs.readFileSync(path.join(backup, 'restore.json'), 'utf8')).state, 'aborted-restored');
    assert.deepEqual(fs.readFileSync(path.join(backup, oldName)), f.oldBytes);
});

test('rollback never overwrites a file created after the original was removed', t => {
    const f = twoOldFiles(t); const replacement = Buffer.from('new independently created file'); const unlink = fs.unlinkSync;
    fs.unlinkSync = function(target) {
        if (String(target) === path.join(f.root, f.secondName)) {
            f.write(oldName, replacement);
            throw Object.assign(new Error('injected I/O failure'), { code: 'EIO' });
        }
        return unlink.apply(this, arguments);
    };
    try { assert.throws(f.prepare, /EOS_PUBLISH_RESTORE_CONFLICT/); } finally { fs.unlinkSync = unlink; }
    assert.deepEqual(fs.readFileSync(path.join(f.root, oldName)), replacement);
    assert.deepEqual(fs.readFileSync(path.join(f.root, f.secondName)), f.secondBytes);
    const backup = path.join(f.parent, f.siblings()[0]);
    assert.deepEqual(fs.readFileSync(path.join(backup, oldName)), f.oldBytes);
    assert.equal(JSON.parse(fs.readFileSync(path.join(backup, 'restore.json'), 'utf8')).state, 'restore-conflict');
});
