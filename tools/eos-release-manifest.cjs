'use strict';
// NexoWatt proprietary release evidence. Explicit sealing is separate from publishing.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const manifestPath = path.join(root, 'release-manifests/unified/files.json');
const roots = ['package.json', 'package-lock.json', 'io-package.json', '.npmrc', '.gitignore', '.gitattributes', 'LICENSE', 'LICENSE-NEXOWATT.md',
    'START_HIER_9.0.1.md', 'START_HIER_9.0.2.md', 'START_HIER_9.0.3.md', 'START_HIER_9.0.4.md', 'START_HIER_9.0.5.md', 'THIRD-PARTY-NOTICES.md', 'THIRD_PARTY_NOTICES.md', 'NEXOWATT_PROPRIETARY_LICENSE.md', 'README.md', 'NEXOWATT_EOS_BUILD_INFO.json',
    'tasks.mts', 'tsconfig.build.json', 'eslint.config.mjs', 'eslint.unified.config.mjs', '.github/workflows/test-and-release.yml',
    'AGENTS.md', 'test', 'src-admin/test', 'src', 'build', 'admin', 'adminWww', 'public', 'packages/eos-license-client', 'deploy',
    'ui/main.js', 'ui/lib', 'ui/ems', 'ui/backend', 'ui/build-ts', 'ui/www', 'ui/admin',
    'ui/src-ts', 'ui/src-admin-tab/src', 'ui/src-admin-tab/package.json', 'ui/src-admin-tab/package-lock.json',
    'ui/io-package.json', 'ui/package.json', 'src-admin/src', 'src-admin/public', 'src-admin/package.json',
    'src-admin/package-lock.json', 'tools/eos-release-manifest.cjs', 'tools/eos-release-check.cjs', 'tools/eos-migration-plan.cjs', 'tools/eos-access-diagnostics.cjs',
    'tools/eos-sbom-vendored.cjs', 'tools/nexowatt-vendored-webserver.cjs', 'tools/vendor/webserver-3.4.0-source.provenance.json',
    'tools/vendor/webserver-3.4.0-no-private-key-logs.patch', 'tools/vendor/WEBSERVER_PATCH_REVIEW.md', 'ui/LICENSE', 'ui/NOTICE', 'ui/scripts', 'ui/test/unified', 'ui/docs/unified', 'docs/licensing/ISSUER_AND_STORAGE.md',
    'docs/unified', 'reports/unified', 'ui/reports/unified', 'reports/security/unified-backend-tests.tap',
    'docs/reports/unified-9.0.0-alpha.1', 'docs/reports/unified-9.0.1', 'docs/reports/unified-9.0.2', 'docs/reports/unified-9.0.3', 'docs/reports/unified-9.0.4', 'docs/reports/unified-9.0.5', 'release-manifests/unified/runtime.cdx.json', 'release-manifests/unified/frontend.cdx.json',
    'release-manifests/unified/installer.cdx.json', 'release-manifests/unified/build-environment.cdx.json'];
function listFiles() {
    const files = [];
    function walk(rel) {
        const abs = path.join(root, rel);
        if (!fs.existsSync(abs)) return;
        const st = fs.lstatSync(abs);
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
function check() {
    const m = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const current = snapshot();
    if (m.version !== require('../package.json').version) throw new Error('RELEASE_VERSION_CHANGED');
    const changed = [...new Set([...Object.keys(m.files), ...Object.keys(current)])].filter(rel => m.files[rel] !== current[rel]);
    if (changed.length) throw new Error(`RELEASE_CONTENT_CHANGED: ${changed.slice(0, 20).join(', ')}`);
    return Object.keys(current).length;
}
if (require.main === module) {
    if (process.argv.includes('--write')) {
        fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
        fs.writeFileSync(manifestPath, JSON.stringify({schema: 1, version: require('../package.json').version,
            generatedAt: new Date().toISOString(), algorithm: 'SHA-256', files: snapshot()}, null, 2) + '\n');
        console.log('Explicit release seal written; this is an integrity record, not a signature or product approval.');
    } else console.log(`Verified ${check()} sealed files.`);
}
module.exports = {check, snapshot, listFiles};
