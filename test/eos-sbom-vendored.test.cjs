'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { enrich, selectRuntime } = require('../tools/eos-sbom-vendored.cjs');
const provenance = require('../tools/vendor/webserver-3.4.0-source.provenance.json');
const sha = 'a'.repeat(64);
function fixture() {
    return {
        bomFormat: 'CycloneDX', specVersion: '1.5', version: 1,
        serialNumber: 'urn:uuid:00000000-0000-4000-8000-000000000000',
        metadata: { timestamp: '2026-11-22T00:00:00Z', component: { type: 'library', name: 'iobroker.eos-admin', version: '9.0.1', 'bom-ref': 'root' } },
        components: Object.entries(provenance.directDependencies).map(([name, expected]) => ({ type: 'library', name: expected.entry.name || name, version: expected.entry.version, 'bom-ref': name })),
        dependencies: [{ ref: 'root', dependsOn: ['oauth2-server'] }, { ref: 'oauth2-server', dependsOn: [] }],
    };
}
const pkg = { name: 'iobroker.eos-admin', version: '9.0.1' };
test('enrichment preserves original metadata/components/dependency edges and records real ancestry', () => {
    const input = fixture(); const saved = structuredClone(input);
    const { bom, changed, ref } = enrich(input, pkg, provenance, sha);
    assert.equal(changed, true); assert.deepEqual(input, saved);
    assert.deepEqual(bom.metadata, saved.metadata); assert.equal(bom.serialNumber, saved.serialNumber);
    assert.deepEqual(bom.components.slice(0, saved.components.length), saved.components);
    assert.deepEqual(bom.dependencies[1], saved.dependencies[1]);
    assert.deepEqual(bom.dependencies[0].dependsOn, ['oauth2-server', ref]);
    assert.equal(bom.version, 2);
    const c = bom.components.at(-1);
    assert.equal(c.name, '@iobroker/webserver'); assert.equal(c.version, '3.4.0+nexowatt.9.0.1');
    assert.equal(c.licenses[0].license.id, 'MIT'); assert.equal(c.pedigree.ancestors[0].version, '3.4.0');
    assert.equal(c.pedigree.ancestors[0].hashes[0].content, provenance.upstream.sha256);
    assert.equal(c.properties.find(p => p.name === 'nexowatt:provenance:sha256').value, sha);
    assert.equal(c.properties.find(p => p.name === 'nexowatt:modified').value, 'true');
    assert.equal(c.modified, undefined);
});
test('second enrichment is identical and does not increment the BOM version again', () => {
    const first = enrich(fixture(), pkg, provenance, sha);
    const second = enrich(first.bom, pkg, provenance, sha);
    assert.equal(second.changed, false); assert.deepEqual(second.bom, first.bom);
});
test('wrong BOM scope, missing dependencies and conflicting owned records are rejected', () => {
    const wrong = fixture(); wrong.specVersion = '1.6';
    assert.throws(() => enrich(wrong, pkg, provenance, sha), /SBOM_INPUT_INVALID/);
    const missing = fixture(); missing.components.pop();
    assert.throws(() => enrich(missing, pkg, provenance, sha), /SBOM_VENDOR_DEPENDENCY_MISSING/);
    const altered = enrich(fixture(), pkg, provenance, sha).bom; altered.components.at(-1).description = 'unreviewed';
    assert.throws(() => enrich(altered, pkg, provenance, sha), /SBOM_VENDOR_CONFLICT/);
});
function graphFixture() {
    const full = fixture();
    const component = name => ({ type: 'library', name, version: '1.0.0', 'bom-ref': `${name}@1.0.0` });
    full.components = ['production', 'shared', 'development'].map(component);
    full.dependencies = [{ ref: 'root', dependsOn: ['production@1.0.0', 'development@1.0.0'] },
        { ref: 'production@1.0.0', dependsOn: ['shared@1.0.0'] },
        { ref: 'shared@1.0.0', dependsOn: [] },
        { ref: 'development@1.0.0', dependsOn: ['shared@1.0.0'] }];
    const manifest = { ...pkg, dependencies: { production: '^1.0.0' }, devDependencies: { development: '^1.0.0' } };
    const lock = { packages: { '': structuredClone(manifest), 'node_modules/production': { version: '1.0.0' } } };
    return { full, manifest, lock };
}
test('runtime graph closure retains dual-use production/development nodes and removes dev-only roots', () => {
    const f = graphFixture(); const original = structuredClone(f.full);
    const selected = selectRuntime(f.full, f.manifest, f.lock);
    assert.deepEqual(selected.directRefs, ['production@1.0.0']);
    assert.deepEqual(selected.bom.components.map(c => c.name), ['production', 'shared']);
    assert.deepEqual(selected.bom.dependencies[0].dependsOn, ['production@1.0.0']);
    assert.deepEqual(selected.bom.dependencies[1], original.dependencies[1]);
    assert.deepEqual(selected.bom.metadata, original.metadata); assert.deepEqual(f.full, original);
});
test('missing locked roots or missing transitive graph nodes fail closed', () => {
    const missing = graphFixture(); missing.full.components.shift();
    assert.throws(() => selectRuntime(missing.full, missing.manifest, missing.lock), /SBOM_DIRECT_DEPENDENCY_MISSING/);
    const broken = graphFixture(); broken.full.dependencies[1].dependsOn = ['absent@1.0.0'];
    assert.throws(() => selectRuntime(broken.full, broken.manifest, broken.lock), /SBOM_GRAPH_REFERENCE_MISSING/);
    const stale = graphFixture(); stale.lock.packages[''].dependencies.production = '^2.0.0';
    assert.throws(() => selectRuntime(stale.full, stale.manifest, stale.lock), /SBOM_LOCK_DEPENDENCY_INVALID/);
});
test('npm alias components are linked through their upstream identity without inventing a registry release', () => {
    const input = fixture(); input.components[0].name = 'oauth2-server'; input.components[0].purl = 'pkg:npm/%40node-oauth/oauth2-server@5.3.1';
    const output = enrich(input, pkg, provenance, sha).bom;
    assert.ok(output.dependencies.at(-1).dependsOn.includes('oauth2-server'));
    assert.equal(output.components.at(-1).purl, undefined);
});
