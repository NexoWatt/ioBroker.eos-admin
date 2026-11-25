'use strict';
// NexoWatt proprietary release evidence. Explicit sealing is separate from publishing.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const manifestPath = path.join(root, 'release-manifests/unified/files.json');
const roots = ['ui/tsconfig.flow-measurement.json', 'ui/eslint.flow-measurement.config.mjs', 'ui/tsconfig.postgres-history.json', 'ui/eslint.postgres-history.config.mjs', 'ui/tsconfig.ems-control-values.json', 'ui/eslint.ems-control-values.config.mjs', 'docs/QA-9.0.22-INDEPENDENT.md', 'docs/9.0.22', 'nexowatt-eos-admin-repository-entry-v9-0-22.json', 'package.json', 'package-lock.json', 'io-package.json', '.npmrc', '.gitignore', '.gitattributes', 'LICENSE', 'LICENSE-NEXOWATT.md',
    'START_HIER_9.0.1.md', 'START_HIER_9.0.2.md', 'START_HIER_9.0.3.md', 'START_HIER_9.0.4.md', 'START_HIER_9.0.5.md', 'START_HIER_9.0.6.md', 'START_HIER_9.0.7.md', 'START_HIER_9.0.8.md', 'START_HIER_9.0.9.md', 'START_HIER_9.0.10.md', 'START_HIER_9.0.11.md', 'START_HIER_9.0.12.md', 'START_HIER_9.0.13.md', 'START_HIER_9.0.14.md', 'START_HIER_9.0.15.md', 'START_HIER_9.0.16.md', 'START_HIER_9.0.17.md', 'START_HIER_9.0.18.md', 'START_HIER_9.0.19.md', 'START_HIER_9.0.20.md','START_HIER_9.0.21.md', 'START_HIER_9.0.22.md', 'THIRD-PARTY-NOTICES.md', 'THIRD_PARTY_NOTICES.md', 'NEXOWATT_PROPRIETARY_LICENSE.md', 'README.md', 'NEXOWATT_EOS_BUILD_INFO.json',
    'tasks.mts', 'tsconfig.eos-customer-updates.json', 'ui/tsconfig.eos-updates-ui.json', 'ui/eslint.eos-updates-ui.config.mjs', 'ui/eslint.influx-history-runtime.config.mjs', 'ui/eslint.history-setup-ui.config.mjs', 'ui/tsconfig.influx-history-runtime.json', 'ui/eslint.influx-security.config.mjs', 'ui/tsconfig.influx-security.json', 'ui/eslint.influx-direct.config.mjs', 'ui/tsconfig.influx-direct.json', 'tsconfig.eos-device-ems.json', 'ui/tsconfig.customer-tariff.json', 'ui/tsconfig.customer-tariff-ui.json', 'ui/eslint.customer-tariff.config.mjs', 'ui/eslint.customer-tariff-ui.config.mjs', 'ui/tsconfig.installer-lifecycle.json', 'ui/tsconfig.live-display-ui.json', 'ui/eslint.live-display-ui.config.mjs', 'ui/tsconfig.tariff-display-ui.json', 'ui/eslint.tariff-display-ui.config.mjs', 'ui/tsconfig.storagefarm-dispatch-ui.json', 'ui/eslint.storagefarm-dispatch-ui.config.mjs', 'ui/tsconfig.storagefarm-summary-ui.json', 'ui/eslint.storagefarm-summary-ui.config.mjs', 'ui/tsconfig.power-measurements.json', 'ui/eslint.power-measurements.config.mjs', 'ui/eslint.installer-lifecycle.config.mjs', 'tsconfig.build.json', 'eslint.config.mjs', 'eslint.unified.config.mjs', '.github/workflows/test-and-release.yml',
    'AGENTS.md', 'modules', 'test', 'src-admin/test', 'src', 'build', 'admin', 'adminWww', 'public', 'packages/eos-license-client', 'deploy',
    'ui/release-manifests', 'ui/main.js', 'ui/lib', 'ui/ems', 'ui/backend', 'ui/build-ts', 'ui/www', 'ui/admin',
    'ui/src-ts', 'ui/src-admin-tab/src', 'ui/src-admin-tab/package.json', 'ui/src-admin-tab/package-lock.json',
    'ui/io-package.json', 'ui/package.json', 'ui/package-lock.json', 'src-admin/src', 'src-admin/public', 'src-admin/package.json',
    'src-admin/package-lock.json', 'src-admin/build-tools', 'tools/nexowatt-sync-release-version.cjs', 'tools/nexowatt-version-sync-selftest.cjs', 'tools/eos-release-manifest.cjs', 'tools/eos-release-check.cjs', 'tools/eos-prepare-publish.cjs', 'tools/eos-release-evidence.cjs', 'tools/eos-migration-plan.cjs', 'tools/eos-access-diagnostics.cjs', 'tools/eos-coexistence-recovery.cjs',
    'tools/eos-sbom-vendored.cjs', 'tools/eos-tls-issuer.cjs', 'tools/eos-memory-cache-benchmark.cjs', 'ui/tsconfig.smarthome-setup.json', 'ui/eslint.smarthome-setup.config.mjs', 'ui/tsconfig.hosted-startup-status.json', 'ui/eslint.hosted-startup-status.config.mjs', 'ui/tsconfig.ephemeral-cache.json', 'ui/tsconfig.hosted-adapter.json', 'ui/eslint.hosted-adapter.config.mjs', 'ui/tsconfig.hosted-runtime-stop.json', 'ui/eslint.hosted-runtime-stop.config.mjs', 'ui/tsconfig.smarthome-activation.json', 'ui/tsconfig.smarthome-layout-editor.json', 'ui/eslint.smarthome-layout-editor.config.mjs', 'ui/tsconfig.smarthome-device-categories.json', 'ui/eslint.smarthome-device-categories.config.mjs', 'ui/tsconfig.smarthome-alias-config.json', 'ui/eslint.smarthome-alias-config.config.mjs', 'ui/tsconfig.smarthome-device-aliases.json', 'ui/eslint.smarthome-device-aliases.config.mjs', 'ui/tsconfig.smarthome-device-legacy.json', 'ui/eslint.smarthome-device-legacy.config.mjs', 'ui/tsconfig.smarthome-custom-config.json', 'ui/eslint.smarthome-custom-config.config.mjs', 'ui/tsconfig.smarthome-custom-contract.json', 'ui/eslint.smarthome-custom-contract.config.mjs', 'ui/tsconfig.smarthome-custom-views.json', 'ui/eslint.smarthome-custom-views.config.mjs', 'ui/tsconfig.smarthome-device-controls-browser.json', 'ui/eslint.smarthome-device-controls-browser.config.mjs', 'ui/tsconfig.smarthome-device-config.json', 'ui/eslint.smarthome-device-config.config.mjs', 'ui/tsconfig.smarthome-device-detection.json', 'ui/eslint.smarthome-device-detection.config.mjs', 'ui/tsconfig.smarthome-device-api.json', 'ui/eslint.smarthome-device-api.config.mjs', 'ui/tsconfig.smarthome-device-controls.json', 'ui/eslint.smarthome-device-controls.config.mjs', 'ui/tsconfig.smarthome-presentation.json', 'ui/eslint.smarthome-presentation.config.mjs', 'ui/tsconfig.smarthome-touch.json', 'ui/eslint.smarthome-touch.config.mjs', 'ui/tsconfig.smarthome-feedback.json', 'ui/eslint.smarthome-feedback.config.mjs', 'ui/tsconfig.preserved-ui-config.json', 'ui/tsconfig.ui-auth-frontend.json', 'ui/eslint.eos-session-idle.config.mjs', 'ui/eslint.smarthome-activation.config.mjs', 'ui/eslint.preserved-ui-config.config.mjs', 'tools/nexowatt-vendored-webserver.cjs', 'tools/vendor/webserver-3.4.0-source.provenance.json',
    'tools/vendor/webserver-3.4.0-no-private-key-logs.patch', 'tools/vendor/WEBSERVER_PATCH_REVIEW.md', 'ui/LICENSE', 'ui/NOTICE', 'ui/scripts', 'ui/test/unified', 'ui/docs/security/eslint-reviewed-findings.json', 'ui/docs/security/eslint-legacy-baseline.json', 'ui/docs/unified', 'docs/licensing/ISSUER_AND_STORAGE.md',
    'docs/unified', 'reports/unified', 'ui/reports/unified', 'reports/security/unified-backend-tests.tap',
    'docs/reports/unified-9.0.0-alpha.1', 'docs/reports/unified-9.0.1', 'docs/reports/unified-9.0.2', 'docs/reports/unified-9.0.3', 'docs/reports/unified-9.0.4', 'docs/reports/unified-9.0.5', 'docs/reports/unified-9.0.6', 'docs/reports/unified-9.0.7', 'docs/reports/unified-9.0.8', 'docs/reports/unified-9.0.9', 'docs/reports/unified-9.0.10', 'docs/reports/unified-9.0.11', 'docs/reports/unified-9.0.12', 'docs/reports/unified-9.0.13', 'docs/reports/unified-9.0.14', 'docs/reports/unified-9.0.15', 'docs/reports/unified-9.0.16', 'docs/reports/unified-9.0.17', 'docs/reports/unified-9.0.18', 'docs/reports/unified-9.0.19', 'docs/reports/unified-9.0.20','docs/reports/unified-9.0.21', 'docs/reports/unified-9.0.22', 'tools/system', 'tsconfig.eos-history-backup-scope.json', 'tsconfig.eos-postgres-system.json', 'release-manifests/unified'];
function listFiles() {
    const files = [];
    function walk(rel) {
        const abs = path.join(root, rel);
        if (rel === 'release-manifests/unified/files.json') return; // The seal cannot hash itself.
        let st;
        try { st = fs.lstatSync(abs); } catch (error) {
            if (error && error.code === 'ENOENT') return;
            throw error;
        }
        if (st.isSymbolicLink()) throw new Error(`RELEASE_SYMLINK: ${rel}`);
        if (st.isDirectory()) {
            for (const name of fs.readdirSync(abs).sort()) walk(`${rel}/${name}`);
        } else if (st.isFile()) files.push(rel);
        else throw new Error(`RELEASE_SPECIAL_FILE: ${rel}`);
    }
    for (const rel of roots) walk(rel);
    return [...new Set(files)].sort();
}
function snapshot() {
    return Object.fromEntries(listFiles().map(rel => [rel, crypto.createHash('sha256').update(fs.readFileSync(path.join(root, rel))).digest('hex')]));
}
function inspect() {
    const m = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const current = snapshot();
    const added = Object.keys(current).filter(rel => !Object.hasOwn(m.files, rel));
    const missing = Object.keys(m.files).filter(rel => !Object.hasOwn(current, rel));
    const modified = Object.keys(current).filter(rel => Object.hasOwn(m.files, rel) && m.files[rel] !== current[rel]);
    return { version: require('../package.json').version, sealedVersion: m.version,
        files: Object.keys(current).length, added, missing, modified };
}
function check() {
    const result = inspect();
    if (result.sealedVersion !== result.version) throw new Error('RELEASE_VERSION_CHANGED');
    const changed = [...result.added, ...result.missing, ...result.modified].sort();
    if (changed.length) throw new Error(`RELEASE_CONTENT_CHANGED: ${changed.slice(0, 20).join(', ')}. ` +
        'Use node tools/eos-release-manifest.cjs --diagnose for added/missing/modified files. ' +
        'npm publish backs up recognized obsolete Admin and Installer assets automatically. Changed current files or unknown extras require restoring the supplied release. Do not re-seal a mixed build.');
    return result.files;
}
if (require.main === module) {
    if (process.argv.includes('--diagnose')) {
        const result = inspect();
        console.log(JSON.stringify(result, null, 2));
        if (result.version !== result.sealedVersion || result.added.length || result.missing.length || result.modified.length) process.exitCode = 1;
    } else if (process.argv.includes('--write')) {
        fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
        fs.writeFileSync(manifestPath, JSON.stringify({schema: 1, version: require('../package.json').version,
            generatedAt: new Date().toISOString(), algorithm: 'SHA-256', files: snapshot()}, null, 2) + '\n');
        console.log('Explicit release seal written; this is an integrity record, not a signature or product approval.');
    } else console.log(`Verified ${check()} sealed files.`);
}
module.exports = {check, inspect, snapshot, listFiles};
