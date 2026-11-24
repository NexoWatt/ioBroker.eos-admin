'use strict';
// Read-only publication gate. Never rebuild or re-seal a changed delivery here.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const p = require('../package.json');
const io = require('../io-package.json');
const lock = require('../package-lock.json');
assert.equal(p.name, 'iobroker.eos-admin');
assert.equal(io.common.name, 'eos-admin');
assert.equal(io.common.title, 'NexoWatt EOS');
assert.equal(io.common.version, p.version);
assert.equal(lock.version, p.version);
assert.equal(lock.packages[''].version, p.version);
assert.equal(require('../ui/package.json').version, p.version);
assert.equal(require('../ui/package-lock.json').version, p.version);
assert.equal(require('../ui/package-lock.json').packages[''].version, p.version);
// EOS owns a narrow threshold lifecycle around this reviewed socket API.
assert.equal(p.dependencies['@iobroker/socket-classes'], '2.10.0');
assert.equal(lock.packages[''].dependencies['@iobroker/socket-classes'], '2.10.0');
assert.equal(lock.packages['node_modules/@iobroker/socket-classes'].version, '2.10.0');
const uiWebManifest = JSON.parse(fs.readFileSync(path.join(root, 'ui/www/manifest.webmanifest'), 'utf8'));
assert.equal(uiWebManifest.version, p.version);
assert.equal(uiWebManifest.appVersion, p.version);
assert.equal(p.license, 'SEE LICENSE IN LICENSE');
assert.equal(io.common.licenseInformation.type, 'paid');
assert.equal(io.native.port, 8188);
assert.equal(io.native.bind, '0.0.0.0');
assert.equal(io.native.secure, true);
assert.equal(io.native.eosLockLegacyAdmin, false);
assert.equal(io.native.certPublic, 'defaultPublic');
assert.equal(io.native.certPrivate, 'defaultPrivate');
assert.equal(io.native.auth, true);
assert.equal(io.native.eosAutoMigrate, true);
assert.equal(io.common.compact, false);
assert.equal(p.publishConfig.tag, 'next');
assert.match(p.version, /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/);
assert.ok(!p.dependencies['iobroker.nexowatt-ui'], 'UI must be an internal module');
for (const rel of [p.main, 'ui/main.js', 'adminWww/index.html', 'ui/www/login.html', 'ui/admin/react/index.html',
    'build/lib/eosCookieNamespace.js', 'build/lib/eosNewsSecurity.js', 'build/lib/eosSocketSecret.js', 'build/lib/eosRolePolicy.js', 'build/lib/eosUnifiedBoundary.js', 'build/lib/eosLicenseService.js', 'build/lib/eosModuleConfigStore.js', 'build/lib/eosDeviceEmsPlan.js', 'build/lib/eosDeviceEmsService.js', 'modules/devices/admin/ems-assignment.js', 'ui/lib/installer-lifecycle.js', 'ui/lib/customer-tariff.js', 'ui/www/customer-tariff.js', 'ui/www/customer-tariff.css',
    'build/lib/eosLegacyMigration.js', 'build/lib/eosTlsManager.js', 'build/lib/eosTlsHttp.js',
    'modules/backup/index.js', 'modules/backup/build/index.js', 'modules/backup/build/worker.js',
    'modules/backup/build/restore-cli.js', 'modules/backup/admin/index.html', 'modules/shared/eos-module.css',
    'public/eos-tls/index.html', 'public/eos-migration/index.html',
    'build/lib/eosSocketAdmin.js', 'build/lib/eosStateSubscriptions.js', 'build/lib/eosModuleHost.js', 'build/lib/eosModuleHttp.js', 'build/lib/eosDiscovery.js', 'modules/devices/index.js', 'modules/devices/admin/index.html', 'modules/eebus/index.js', 'modules/eebus/build/lib/eebusRuntime.js', 'modules/eebus/admin/index.html', 'release-manifests/unified/runtime.cdx.json']) {
    assert.ok(fs.statSync(path.join(root, rel)).isFile(), `MISSING_RUNTIME: ${rel}`);
}
assert.equal(require('./nexowatt-vendored-webserver.cjs').inspectVendoredWebserver(p, lock, root), null, 'VENDORED_SOURCE_PROVENANCE');
const manifest = require('./eos-release-manifest.cjs');
const count = manifest.check();
require('./eos-release-evidence.cjs').check();
const findings = [];
for (const rel of manifest.listFiles()) {
    if (!/\.(?:js|cjs|mjs|ts|tsx|json|json5|html|md|txt|conf|yml|yaml)$/.test(rel)) continue;
    const text = fs.readFileSync(path.join(root, rel), 'utf8');
    if (/-----BEGIN (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----[\r\n]+[A-Za-z0-9+/=]{24}/.test(text)) findings.push(`${rel}:private-key`);
    if (/\bnpm_[A-Za-z0-9]{30,}\b|\bgh[pousr]_[A-Za-z0-9]{30,}\b/.test(text)) findings.push(`${rel}:registry-token`);
    if (/^\s*(?:_authToken|\/\/[^\s]+:_authToken)\s*=\s*(?!\$\{)[^\s]+/m.test(text)) findings.push(`${rel}:npm-credential`);
}
assert.equal(findings.length, 0, `SECRET_SCAN: ${findings.join(', ')}`);
console.log(`EOS ${p.version}: package, defaults, ${count} sealed files and targeted secret rules passed.`);
