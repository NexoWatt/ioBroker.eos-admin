/** Copyright (c) 2026 NexoWatt. All rights reserved. Confidential and Proprietary. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { preparePublish } = require('../tools/eos-prepare-publish.cjs');
const project = path.resolve(__dirname, '..');
const SEAL = 'release-manifests/unified/files.json';
const CATALOG = 'release-manifests/unified/obsolete-admin-assets.json';
const hash = data => crypto.createHash('sha256').update(data).digest('hex');
function fixture(t, extra = { 'adminWww/assets/old-001.js': 'console.log("old one");\n' }, currentOverrides = {}) {
    const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'eos-publish-prepare-'));
    const root = path.join(parent, 'Repo mit Leerzeichen'); fs.mkdirSync(root);
    t.after(() => fs.rmSync(parent, { recursive: true, force: true }));
    const write = (relative, data) => { const absolute = path.join(root, relative); fs.mkdirSync(path.dirname(absolute), { recursive: true }); fs.writeFileSync(absolute, data); };
    const manifestSource = fs.readFileSync(path.join(project, 'tools/eos-release-manifest.cjs'), 'utf8')
        .replace('const roots = [', `const roots = ['tools/eos-prepare-publish.cjs', '${CATALOG}', `);
    const current = {
        'package.json': JSON.stringify({ name: 'iobroker.eos-admin', version: '9.0.13' }),
        'adminWww/index.html': '<script src="./assets/current-CURRENT.js"></script>',
        'adminWww/assets/current-CURRENT.js': 'console.log("current");\n',
        'ui/admin/react/index.html': '<script src="./assets/installer-CURRENT.js"></script>',
        'ui/admin/react/assets/installer-CURRENT.js': 'console.log("current installer");\n',
        'tools/eos-prepare-publish.cjs': fs.readFileSync(path.join(project, 'tools/eos-prepare-publish.cjs')),
        'tools/eos-release-manifest.cjs': manifestSource,
        [CATALOG]: JSON.stringify({ schema: 1, algorithm: 'SHA-256', files: Object.fromEntries(Object.entries(extra).map(([name, data]) => [name, [hash(data)]])) }),
        ...currentOverrides,
    };
    for (const [name, data] of Object.entries(current)) write(name, data);
    write(SEAL, JSON.stringify({ schema: 1, algorithm: 'SHA-256', version: '9.0.13', files: Object.fromEntries(Object.entries(current).map(([name, data]) => [name, hash(data)])) }));
    const originalSeal = fs.readFileSync(path.join(root, SEAL));
    const copyExtras = () => { for (const [name, data] of Object.entries(extra)) write(name, data); };
    const backups = () => fs.readdirSync(parent).filter(name => name.includes('.publish-backup-')).map(name => path.join(parent, name));
    return { root, parent, write, current, extra, copyExtras, backups, originalSeal, seal: () => fs.readFileSync(path.join(root, SEAL)), read: relative => fs.readFileSync(path.join(root, relative), 'utf8') };
}
function sameCurrent(f) {
    assert.deepEqual(f.seal(), f.originalSeal);
    for (const [relative, data] of Object.entries(f.current)) assert.equal(hash(fs.readFileSync(path.join(f.root, relative))), hash(data), relative);
}

test('fresh extraction passes without writing a backup or changing the seal', t => {
    const f = fixture(t); const result = preparePublish({ root: f.root });
    assert.deepEqual(result, { version: '9.0.13', quarantined: [], backupDir: null, verifiedFiles: Object.keys(f.current).length });
    assert.equal(f.backups().length, 0); sameCurrent(f);
});

test('known overlay assets are verified, retained outside the repository and absent from the prepared source', t => {
    const f = fixture(t, {
        'adminWww/assets/old-001.js': 'console.log("old one");\n',
        'adminWww/assets/old-002.css': '.old { color: green; }\n',
        'adminWww/remoteEntry-eos-9.0.11.js': 'console.log("older entry");\n',
    });
    f.copyExtras(); const result = preparePublish({ root: f.root });
    assert.deepEqual(result.quarantined.sort(), Object.keys(f.extra).sort()); assert.ok(result.backupDir);
    assert.equal(path.dirname(result.backupDir), f.parent); assert.notEqual(path.dirname(result.backupDir), f.root);
    for (const [relative, data] of Object.entries(f.extra)) {
        assert.equal(fs.existsSync(path.join(f.root, relative)), false);
        assert.equal(fs.readFileSync(path.join(result.backupDir, relative), 'utf8'), data);
    }
    const receipt = JSON.parse(fs.readFileSync(path.join(result.backupDir, 'restore.json'), 'utf8'));
    assert.equal(receipt.state, 'complete'); assert.equal(receipt.originalRoot, f.root);
    assert.ok(receipt.files.every(item => item.state === 'removed' && item.sha256 === hash(f.extra[item.path])));
    if (process.platform !== 'win32') { assert.equal(fs.statSync(result.backupDir).mode & 0o777, 0o700); assert.equal(fs.statSync(path.join(result.backupDir, 'restore.json')).mode & 0o777, 0o600); }
    sameCurrent(f);
});

test('repeating npm preparation is a no-op and does not create more backups', t => {
    const f = fixture(t); f.copyExtras(); const first = preparePublish({ root: f.root }); const second = preparePublish({ root: f.root });
    assert.equal(f.backups().length, 1); assert.equal(second.backupDir, null); assert.deepEqual(second.quarantined, []);
    assert.ok(fs.existsSync(first.backupDir)); sameCurrent(f);
});

test('copying over older admin and installer bundles quarantines every known extra together', t => {
    // Dateinamen des gemeldeten 9.0.6-Rests und des 9.0.0–9.0.5-Rests;
    // synthetische Inhalte für den isolierten Dateisystemtest, keine echten UI-Bundles.
    const f = fixture(t, {
        'adminWww/assets/old-001.js': 'old admin',
        'ui/admin/react/assets/index-Bm4__n5R.js': 'old installer 9.0.6',
        'ui/admin/react/assets/index-fCXC5Pli.js': 'old installer before 9.0.6',
    });
    f.copyExtras(); const result = preparePublish({ root: f.root });
    assert.deepEqual(result.quarantined.sort(), Object.keys(f.extra).sort());
    assert.equal(path.dirname(result.backupDir), f.parent);
    for (const [relative, data] of Object.entries(f.extra)) {
        assert.equal(fs.existsSync(path.join(f.root, relative)), false);
        assert.equal(fs.readFileSync(path.join(result.backupDir, relative), 'utf8'), data);
    }
    sameCurrent(f);
    assert.equal(preparePublish({ root: f.root }).backupDir, null);
});

test('delivered catalogue records the reported installer bytes and their sealed archive provenance', () => {
    const catalogue = JSON.parse(fs.readFileSync(path.join(project, CATALOG), 'utf8'));
    assert.deepEqual(catalogue.files['ui/admin/react/assets/index-Bm4__n5R.js'], ['9cd5d39ab4a92133e19c87399b0b22c8f575346df227b693cdcd659520202fe7']);
    const release6 = catalogue.sources.find(item => item.version === '9.0.6');
    assert.equal(release6.archive, 'NexoWatt_EOS_9.0.6_FULL_REPOSITORY.zip');
    assert.equal(release6.archiveSha256, 'bad276534a5482e4f9a716ffc9ba5ba2d811d421f25550f789c0014247fa5fd4');
    assert.equal(release6.installerAssetFiles, 3);
    assert.equal(release6.matchedSealedInstallerAssetFiles, 3);
    const release15 = catalogue.sources.find(item => item.version === '9.0.15');
    assert.equal(release15.archiveSha256, 'a8d079e3dff1111543ac192b6bb97fc212a63c97fe5d13f01faf61089c6b985f');
    assert.equal(release15.adminFiles, release15.matchedSealedFiles);
    assert.equal(release15.installerAssetFiles, release15.matchedSealedInstallerAssetFiles);
    assert.equal(Object.keys(catalogue.files).filter(name => !name.startsWith('adminWww/') && !name.startsWith('ui/admin/react/assets/')).length, 0);
});

test('a known obsolete installer with changed bytes blocks all admin and installer cleanup', t => {
    const f = fixture(t, { 'adminWww/assets/old-001.js': 'old admin', 'ui/admin/react/assets/index-Bm4__n5R.js': 'known installer' });
    f.copyExtras(); f.write('ui/admin/react/assets/index-Bm4__n5R.js', 'unreviewed installer');
    assert.throws(() => preparePublish({ root: f.root }), { code: 'EOS_PUBLISH_EXTRA_CHANGED' });
    assert.equal(f.backups().length, 0); assert.equal(f.read('adminWww/assets/old-001.js'), 'old admin');
    assert.equal(f.read('ui/admin/react/assets/index-Bm4__n5R.js'), 'unreviewed installer'); sameCurrent(f);
});

test('unknown installer assets are preserved and reject the entire preparation before backups', t => {
    const f = fixture(t, { 'adminWww/assets/old-001.js': 'old admin', 'ui/admin/react/assets/index-Bm4__n5R.js': 'known installer' });
    f.copyExtras(); f.write('ui/admin/react/assets/zz-customer.js', 'customer code');
    assert.throws(() => preparePublish({ root: f.root }), { code: 'EOS_PUBLISH_EXTRA_UNKNOWN' });
    assert.equal(f.backups().length, 0);
    for (const [relative, data] of Object.entries(f.extra)) assert.equal(f.read(relative), data);
    assert.equal(f.read('ui/admin/react/assets/zz-customer.js'), 'customer code'); sameCurrent(f);
});

test('a changed current installer prevents cleanup even when the old installer matches its catalogue', t => {
    const f = fixture(t, { 'ui/admin/react/assets/index-Bm4__n5R.js': 'known installer' });
    f.copyExtras(); f.write('ui/admin/react/assets/installer-CURRENT.js', 'changed current installer');
    assert.throws(() => preparePublish({ root: f.root }), { code: 'EOS_PUBLISH_CURRENT_CHANGED' });
    assert.equal(f.backups().length, 0); assert.equal(f.read('ui/admin/react/assets/index-Bm4__n5R.js'), 'known installer');
    assert.deepEqual(f.seal(), f.originalSeal);
});

test('a current installer HTML reference prevents removal of the referenced historical bundle', t => {
    const f = fixture(t, { 'ui/admin/react/assets/index-Bm4__n5R.js': 'known installer' }, {
        'ui/admin/react/index.html': '<script src="./assets/index-Bm4__n5R.js"></script>',
    });
    f.copyExtras();
    assert.throws(() => preparePublish({ root: f.root }), { code: 'EOS_PUBLISH_ASSET_REFERENCED' });
    assert.equal(f.backups().length, 0); assert.equal(f.read('ui/admin/react/assets/index-Bm4__n5R.js'), 'known installer'); sameCurrent(f);
});

test('all extras are classified before any mutation, including unrelated tracked source additions', t => {
    const f = fixture(t); f.copyExtras(); f.write('src/new-customer-script.js', 'customer code');
    assert.throws(() => preparePublish({ root: f.root }), { code: 'EOS_PUBLISH_EXTRA_UNKNOWN' });
    assert.equal(f.backups().length, 0); assert.equal(f.read('adminWww/assets/old-001.js'), f.extra['adminWww/assets/old-001.js']); sameCurrent(f);
});

test('a backup write failure occurs before deleting any original', t => {
    const f = fixture(t, { 'adminWww/assets/old-001.js': 'one', 'adminWww/assets/old-002.js': 'two' }); f.copyExtras();
    const original = fs.openSync;
    fs.openSync = function (filename, flags, ...args) {
        if (String(filename).includes('.publish-backup-') && String(filename).endsWith('old-002.js') && flags === 'wx') throw Object.assign(new Error('injected write failure'), { code: 'EIO' });
        return original.call(fs, filename, flags, ...args);
    };
    try { assert.throws(() => preparePublish({ root: f.root }), { code: 'EOS_PUBLISH_IO' }); } finally { fs.openSync = original; }
    for (const [relative, data] of Object.entries(f.extra)) assert.equal(f.read(relative), data);
    assert.equal(f.backups().length, 1); sameCurrent(f);
});

test('an interrupted remove restores every previously removed source without changing current files', t => {
    const f = fixture(t, { 'adminWww/assets/old-001.js': 'one', 'adminWww/assets/old-002.js': 'two' }); f.copyExtras();
    const original = fs.unlinkSync;
    fs.unlinkSync = function (filename) { if (filename === path.join(f.root, 'adminWww/assets/old-002.js')) throw Object.assign(new Error('injected unlink failure'), { code: 'EACCES' }); return original.call(fs, filename); };
    try { assert.throws(() => preparePublish({ root: f.root }), { code: 'EOS_PUBLISH_IO' }); } finally { fs.unlinkSync = original; }
    for (const [relative, data] of Object.entries(f.extra)) assert.equal(f.read(relative), data);
    const receipt = JSON.parse(fs.readFileSync(path.join(f.backups()[0], 'restore.json'), 'utf8'));
    assert.equal(receipt.state, 'aborted-restored'); assert.equal(receipt.files.find(item => item.path.endsWith('old-001.js')).state, 'restored'); sameCurrent(f);
});

test('rollback never overwrites a concurrently created replacement and retains its recovery copy', t => {
    const f = fixture(t, { 'adminWww/assets/old-001.js': 'one', 'adminWww/assets/old-002.js': 'two' }); f.copyExtras();
    const original = fs.unlinkSync;
    fs.unlinkSync = function (filename) {
        if (filename === path.join(f.root, 'adminWww/assets/old-002.js')) { f.write('adminWww/assets/old-001.js', 'new concurrent local file'); throw new Error('injected abort'); }
        return original.call(fs, filename);
    };
    try { assert.throws(() => preparePublish({ root: f.root }), { code: 'EOS_PUBLISH_RESTORE_CONFLICT' }); } finally { fs.unlinkSync = original; }
    assert.equal(f.read('adminWww/assets/old-001.js'), 'new concurrent local file'); assert.equal(f.read('adminWww/assets/old-002.js'), 'two');
    const backup = f.backups()[0]; assert.equal(fs.readFileSync(path.join(backup, 'adminWww/assets/old-001.js'), 'utf8'), 'one');
    assert.equal(JSON.parse(fs.readFileSync(path.join(backup, 'restore.json'), 'utf8')).state, 'restore-conflict'); sameCurrent(f);
});

test('a current source changed after backup makes the final gate fail and rolls obsolete removals back', t => {
    const f = fixture(t); f.copyExtras(); const original = fs.unlinkSync;
    fs.unlinkSync = function (filename) {
        const result = original.call(fs, filename);
        if (filename === path.join(f.root, 'adminWww/assets/old-001.js')) f.write('adminWww/assets/current-CURRENT.js', 'new local current build');
        return result;
    };
    try { assert.throws(() => preparePublish({ root: f.root }), { code: 'EOS_PUBLISH_IO' }); } finally { fs.unlinkSync = original; }
    assert.equal(f.read('adminWww/assets/old-001.js'), f.extra['adminWww/assets/old-001.js']);
    assert.equal(f.read('adminWww/assets/current-CURRENT.js'), 'new local current build'); assert.deepEqual(f.seal(), f.originalSeal);
});

test('CLI works offline from a copied directory containing spaces and rejects flags', t => {
    const f = fixture(t); f.copyExtras(); const helper = path.join(f.root, 'tools/eos-prepare-publish.cjs');
    const result = spawnSync(process.execPath, [helper], { cwd: f.root, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr); assert.match(result.stdout, /1 bestätigte alte Admin-\/Installer-Dateien gesichert/);
    const rejected = spawnSync(process.execPath, [helper, '--force'], { cwd: f.root, encoding: 'utf8' });
    assert.equal(rejected.status, 1); assert.match(rejected.stderr, /EOS_PUBLISH_ARGUMENTS/); sameCurrent(f);
});

const reported921Asset = 'adminWww/assets/hostInit-BNFIx0-f.js';
const reported921Bytes = () => fs.readFileSync(path.join(__dirname, 'fixtures/publish-overlay-9.0.21/hostInit-BNFIx0-f.js.fixture'));
const deliveredCatalogue = () => fs.readFileSync(path.join(project, CATALOG));

test('reported Windows overlay asset from sealed 9.0.21 is backed up using the delivered catalogue', t => {
    const bytes = reported921Bytes();
    assert.equal(bytes.length, 6199);
    assert.equal(hash(bytes), 'f536222133dab1acf78d72aebdbfc75d163db120b4253248171dfa99bf6887c1');
    const catalogue = JSON.parse(deliveredCatalogue());
    assert.ok(catalogue.files[reported921Asset].includes(hash(bytes)));
    const provenance = catalogue.sources.find(source => source.version === '9.0.21');
    assert.equal(provenance.archiveSha256, '2e6379843392fbf682670fe05039459fea93c3f702d956cc7edb3e0415d89c7a');
    assert.equal(provenance.manifestSha256, 'feb1d213fe699a635457f7be609b7a40816ffe26c094b419be27d6a7d47efa3f');
    assert.equal(provenance.matchedSealedFiles, 359);
    assert.equal(provenance.matchedSealedInstallerAssetFiles, 3);
    for (const [version, archiveSha256] of [
        ['9.0.22', '460ddbf6c571997739433633ac12d07f129d1f8930dddac63ca069729b09d022'],
        ['9.0.23', 'd354e17adf20728bee0c442179b00365b0d0bc518105ab47e8f39edcbced2000'],
    ]) {
        const source = catalogue.sources.find(item => item.version === version);
        assert.equal(source.archiveSha256, archiveSha256);
        assert.equal(source.matchedSealedFiles, 359);
        assert.equal(source.matchedSealedInstallerAssetFiles, 3);
    }
    const f = fixture(t, { [reported921Asset]: bytes }, { [CATALOG]: deliveredCatalogue() });
    f.copyExtras(); const result = preparePublish({ root: f.root });
    assert.deepEqual(result.quarantined, [reported921Asset]);
    assert.equal(fs.existsSync(path.join(f.root, reported921Asset)), false);
    assert.deepEqual(fs.readFileSync(path.join(result.backupDir, reported921Asset)), bytes);
    sameCurrent(f);
    assert.equal(preparePublish({ root: f.root }).backupDir, null);
});

test('the exact reported filename with changed bytes remains untouched and fails before any backup', t => {
    const f = fixture(t, { [reported921Asset]: reported921Bytes() }, { [CATALOG]: deliveredCatalogue() });
    f.copyExtras(); const changed = Buffer.concat([reported921Bytes(), Buffer.from('\n/* customer edit */\n')]);
    f.write(reported921Asset, changed);
    assert.throws(() => preparePublish({ root: f.root }), { code: 'EOS_PUBLISH_EXTRA_CHANGED' });
    assert.deepEqual(fs.readFileSync(path.join(f.root, reported921Asset)), changed);
    assert.equal(f.backups().length, 0); sameCurrent(f);
});

test('a reported historical asset that is part of the current seal is never removed', t => {
    const f = fixture(t, {}, { [CATALOG]: deliveredCatalogue(), [reported921Asset]: reported921Bytes() });
    const result = preparePublish({ root: f.root });
    assert.deepEqual(result.quarantined, []); assert.equal(result.backupDir, null);
    assert.deepEqual(fs.readFileSync(path.join(f.root, reported921Asset)), reported921Bytes());
    sameCurrent(f);
});
