#!/usr/bin/env node
/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { execFileSync, spawnSync } = require('node:child_process');
const guard = require('./check-repository-secrets.cjs');
const root = path.resolve(__dirname, '..');

// Dangerous fixtures exist only in disposable directories, with random values.
// Never commit reusable test credentials. The explicitly requested historical
// compatibility site is read from the product only, never duplicated here.
const value = crypto.randomBytes(32).toString('hex');
const bad = JSON.stringify({ host: 'smtp.example.invalid', auth: { user: 'local-test-user', pass: value }, password: value });
const scan = (text, name = 'fixture.js') => guard.inspectContent(name, Buffer.from(text));
assert.ok(scan(bad).some(f => f.rule === 'literal-smtp-password'));
assert.ok(scan('const smtpPassword = ' + JSON.stringify(value)).length);
assert.ok(scan('export SMTP_PASSWORD=' + value).length);
assert.ok(scan('smtps://' + 'local-test-user:' + value + '@smtp.example.invalid').length);
assert.ok(scan('-----BEGIN ' + 'PRIVATE KEY-----\n' + value).length);
assert.deepEqual(scan('const smtp = { password: "", user: "" };'), []);
assert.deepEqual(scan('const smtp = { password: process.env.SMTP_PASSWORD };'), []);
assert.deepEqual(scan('const smtp = { password: incoming.password };'), []);
assert.deepEqual(scan('SMTP_PASSWORD=${MAIL_SECRET}'), []);
assert.deepEqual(scan('SMTP_PASSWORD=""'), []);
assert.deepEqual(scan('input({id:"mailPassword",type:"password",value:entered}); // SMTP form'), []);
// Auch HMAC-Fixtures enthalten ausschließlich frische Zufallswerte. Der echte
// Lizenzschlüssel und seine früheren Konstanten gehören nicht in Testquellen.
const hmacMethod = 'create' + 'Hmac';
const hmacCall = key => 'crypto.' + hmacMethod + '("sha256", ' + key + ');';
const hmacLiteral = JSON.stringify(value);
for (const quote of ['"', "'", '`']) {
  const findings = scan(hmacCall(quote + value + quote));
  assert.ok(findings.some(f => f.rule === 'literal-hmac-key'), 'direct HMAC literal blocks');
  assert.equal(JSON.stringify(findings).includes(value), false, 'HMAC values never leave scanner results');
  assert.deepEqual(scan(hmacCall(quote + quote)), [], 'empty HMAC placeholder is not a secret');
}
for (const identifier of ['secret', 'SECRET', 'licenseSecret', 'HMAC_KEY', 'signingKey']) {
  const findings = scan('const ' + identifier + ' = ' + hmacLiteral + ';\n' + hmacCall(identifier));
  assert.ok(findings.some(f => f.rule === 'literal-hmac-secret'), 'named HMAC secret blocks');
  assert.equal(JSON.stringify(findings).includes(value), false);
}
assert.ok(scan('const secret: string = ' + hmacLiteral + ';\n' + hmacCall('secret'))
  .some(f => f.rule === 'literal-hmac-secret'), 'typed runtime source is covered');
for (const key of ['process.env.LICENSE_SECRET', 'privateConfig.licenseSecret', 'input.key', '`' + '${privateConfig.licenseSecret}' + '`']) {
  assert.deepEqual(scan(hmacCall(key)), [], 'dynamic configuration remains allowed');
  assert.deepEqual(scan('const secret = ' + key + ';\n' + hmacCall('secret')), []);
}
assert.deepEqual(scan('const secret = "";\n' + hmacCall('secret')), []);
assert.deepEqual(scan('const publicLabel = "HMAC configuration";\n' + hmacCall('privateConfig.key')), []);
assert.deepEqual(scan('const secret = ' + hmacLiteral + ';'), [], 'rule is scoped to a module using HMAC');

// Begrenzte Bestandsausnahme: tatsächlicher Produktstandort, keine zweite Kopie
// des alten Werts in Testquellen. Pfad, Methode, Wert und einzelne Fundstelle
// sind jeweils Teil des Vertrags; alle Veränderungen bleiben blockiert.
const licenseSource = fs.readFileSync(path.join(root, 'src-ts/runtime-executables/main.ts'), 'utf8');
const legacyMethod = /\n[ \t]*_nwLegacyLicenseSecret\(\)[^\n]*\{[\s\S]*?\n[ \t]*\}/.exec(licenseSource);
assert.ok(legacyMethod, 'Named historical compatibility method exists');
const legacyBody = 'class Fixture {' + legacyMethod[0] + '\n}\n' + hmacCall('process.env.LICENSE_SECRET');
for (const name of ['main.js', 'src-ts/runtime-executables/main.ts', 'src-ts/runtime-mirrors/main.ts']) {
  assert.deepEqual(scan(legacyBody, name), [], 'Only exact historical site is allowed');
  const changed = legacyBody.replace(/(legacyLicenseSecret\s*=\s*)(['"])([^\r\n]*?)\2/, (_, prefix) => prefix + hmacLiteral);
  assert.ok(scan(changed, name).some(f => f.rule === 'literal-hmac-secret'), 'Different value at allowed site blocks');
  assert.ok(scan(legacyBody.replace('_nwLegacyLicenseSecret()', '_otherLicenseSecret()'), name)
    .some(f => f.rule === 'literal-hmac-secret'), 'Different method blocks');
  assert.ok(scan(legacyBody.replaceAll('legacyLicenseSecret', 'otherLicenseSecret'), name)
    .some(f => f.rule === 'literal-hmac-secret'), 'Different variable blocks');
  assert.ok(scan(legacyBody + '\nclass Duplicate {' + legacyMethod[0] + '\n}', name)
    .some(f => f.rule === 'literal-hmac-secret'), 'Duplicated compatibility sites block');
  assert.ok(scan(legacyBody + '\nconst secret = ' + hmacLiteral + ';', name)
    .some(f => f.rule === 'literal-hmac-secret'), 'Additional secret in same file blocks');
}
for (const name of ['other.js', 'docs/main.js', 'copy/main.js', 'test/main.ts']) {
  assert.ok(scan(legacyBody, name).some(f => f.rule === 'literal-hmac-secret'), 'Same historical value outside exact paths blocks');
}
for (const key of ['NEXOWATT_LICENSE_HMAC_SECRET', 'API_TOKEN', 'PRIVATE_KEY', 'SERVICE_API_KEY']) {
  for (const content of [value, JSON.stringify(value), "'" + value + "'"]) {
    const findings = scan(key + '=' + content, 'configuration.txt');
    assert.ok(findings.some(f => f.rule === 'secret-environment-value'), 'literal ENV secret blocks outside private filenames');
    assert.equal(JSON.stringify(findings).includes(value), false);
  }
  for (const content of ['', '""', "''", '# set privately', '${PRIVATE_VALUE}', '"${PRIVATE_VALUE}" # set privately', '$PRIVATE_VALUE', '%PRIVATE_VALUE%']) {
    assert.deepEqual(scan(key + '=' + content + '\nPUBLIC_PORT=8080', 'configuration.txt'), [], 'empty/dynamic ENV placeholder is allowed');
  }
}
assert.ok(scan('SECRET=' + JSON.stringify('#' + value)).some(f => f.rule === 'secret-environment-value'), 'a quoted hash prefix is not a comment');
// Synthetische Tokens erst zur Laufzeit zusammensetzen, nie wiederverwendbare
// Zugangsdaten oder Scanner-Ausnahmen als Fixtures ins Repository aufnehmen.
for (const [prefix, suffix, rule] of [
  ['gh' + 'p_', value.slice(0, 36), 'github-token'],
  ['github_' + 'pat_', value, 'github-fine-grained-token'],
  ['gl' + 'pat-', value, 'gitlab-token'],
  ['np' + 'm_', value.slice(0, 36), 'npm-token'],
  ['AK' + 'IA', value.toUpperCase().slice(0, 16), 'aws-access-key-id'],
  ['xo' + 'xb-', value, 'slack-token'],
  ['sk-' + 'proj-', value, 'openai-project-token'],
]) {
  const token = prefix + suffix;
  const findings = scan('const token = ' + JSON.stringify(token));
  assert.ok(findings.some(f => f.rule === rule), rule);
  assert.equal(JSON.stringify(findings).includes(token), false, 'token values never leave scanner results');
  assert.deepEqual(scan('const token = ' + JSON.stringify(prefix + 'example')), [], 'short placeholders are not secrets');
}
for (const name of ['notification-mail.json', 'data/notification-mail.json.123.tmp', 'data/notification-ledger.json', '.env', '.env.production', 'license.env', 'nested/server.env', 'nested/server.env.production', '.npmrc', 'nested/private.pem', 'iobroker-data/objects.jsonl', 'private-server-installation/README.txt']) {
  assert.ok(scan('{}', name).some(f => f.rule === 'installation-data-or-private-key'), name);
}
assert.deepEqual(scan('SMTP_PASSWORD=""', '.env.example'), []);
for (const name of ['.env.template', 'license.env.example', 'nested/server.env.template']) {
  assert.deepEqual(scan('NEXOWATT_LICENSE_HMAC_SECRET=', name), [], 'empty example/template files may be public');
  assert.ok(scan('NEXOWATT_LICENSE_HMAC_SECRET=' + value, name).some(f => f.rule === 'secret-environment-value'), 'example filenames do not exempt real secrets');
}
const entries = [
  { name: 'admin/react/index.html', read: () => Buffer.from('<script src="./assets/index-current.js"></script>') },
  { name: 'admin/react/assets/index-current.js', read: () => Buffer.from('') },
  { name: 'admin/react/assets/index-old.js', read: () => Buffer.from('') },
];
assert.equal(guard.assetFindings(entries)[0].file, entries[2].name);
assert.deepEqual(guard.assetFindings(entries.slice(0, 2)), []);

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nw-secret-guard-'));
const git = (...args) => execFileSync('git', args, { cwd: directory, stdio: ['ignore', 'pipe', 'pipe'] });
const write = (name, text) => { const target = path.join(directory, name); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, text); };
try {
  git('init', '--quiet');
  git('config', 'user.name', 'Local test'); git('config', 'user.email', 'test@example.invalid');
  write('scripts/check-repository-secrets.cjs', fs.readFileSync(path.join(root, 'scripts/check-repository-secrets.cjs')));
  write('scripts/verify-release-artifact.js', fs.readFileSync(path.join(root, 'scripts/verify-release-artifact.js')));
  write('scripts/install-githooks.js', fs.readFileSync(path.join(root, 'scripts/install-githooks.js')));
  write('.githooks/pre-commit', fs.readFileSync(path.join(root, '.githooks/pre-commit')));
  fs.chmodSync(path.join(directory, '.githooks/pre-commit'), 0o644);
  execFileSync(process.execPath, ['scripts/install-githooks.js'], { cwd: directory, stdio: ['ignore', 'pipe', 'pipe'] });
  assert.equal(git('config', 'core.hooksPath').toString().trim(), '.githooks');
  if (process.platform !== 'win32') assert.ok(fs.statSync(path.join(directory, '.githooks/pre-commit')).mode & 0o111);
  write('.gitignore', 'notification-mail.json*\n.env*\n');
  write('mail.js', bad);
  git('add', '.');
  // A clean working copy must not hide a previously staged secret.
  write('mail.js', 'const smtp = { password: process.env.SMTP_PASSWORD };\n');
  assert.deepEqual(guard.checkRepository(directory).findings, []);
  assert.ok(guard.checkRepository(directory, true).findings.length);
  const commit = spawnSync('git', ['commit', '-m', 'must be blocked'], { cwd: directory, encoding: 'utf8' });
  assert.notEqual(commit.status, 0);
  assert.ok((commit.stdout + commit.stderr).includes('literal-smtp-password'));
  assert.equal((commit.stdout + commit.stderr).includes(value), false, 'hook diagnostics redact all secret values');
  git('add', 'mail.js');
  assert.deepEqual(guard.checkRepository(directory, true).findings, []);
  git('commit', '--quiet', '-m', 'safe fixture');
  const hmacBad = 'const SECRET = ' + hmacLiteral + ';\n' + hmacCall('SECRET');
  const hmacSafe = hmacCall('process.env.LICENSE_SECRET');
  write('hmac.js', hmacBad);
  git('add', 'hmac.js');
  write('hmac.js', hmacSafe);
  assert.deepEqual(guard.checkRepository(directory).findings, []);
  assert.ok(guard.checkRepository(directory, true).findings.some(f => f.rule === 'literal-hmac-secret'));
  const hmacCommit = spawnSync('git', ['commit', '-m', 'must block embedded HMAC key'], { cwd: directory, encoding: 'utf8' });
  assert.notEqual(hmacCommit.status, 0);
  assert.ok((hmacCommit.stdout + hmacCommit.stderr).includes('literal-hmac-secret'));
  assert.equal((hmacCommit.stdout + hmacCommit.stderr).includes(value), false);
  git('add', 'hmac.js');
  assert.deepEqual(guard.checkRepository(directory, true).findings, []);
  git('commit', '--quiet', '-m', 'safe HMAC fixture');
  write('hmac.js', hmacBad);
  const hmacRelease = spawnSync(process.execPath, ['scripts/verify-release-artifact.js'], { cwd: directory, encoding: 'utf8' });
  assert.notEqual(hmacRelease.status, 0);
  assert.ok((hmacRelease.stdout + hmacRelease.stderr).includes('literal-hmac-secret'), 'publish blocks embedded HMAC keys before metadata');
  assert.equal((hmacRelease.stdout + hmacRelease.stderr).includes(value), false);
  write('hmac.js', hmacSafe);
  write('notification-mail.json', '{}');
  git('add', '--force', 'notification-mail.json');
  assert.ok(guard.checkRepository(directory, true).findings.some(f => f.rule === 'installation-data-or-private-key'), 'already indexed ignored files are checked');
  fs.unlinkSync(path.join(directory, 'notification-mail.json'));
  git('rm', '--cached', 'notification-mail.json');
  write('mail.js', bad);
  const release = spawnSync(process.execPath, ['scripts/verify-release-artifact.js'], { cwd: directory, encoding: 'utf8' });
  assert.notEqual(release.status, 0);
  assert.ok((release.stdout + release.stderr).includes('literal-smtp-password'), 'publish gate invokes scanner before metadata');
  assert.equal((release.stdout + release.stderr).includes(value), false);
} finally {
  fs.rmSync(directory, { recursive: true, force: true });
}

const source = fs.readFileSync(path.join(root, 'src-admin-tab/src/pages/NotificationMailPage.tsx'), 'utf8');
assert.ok(source.includes("user: ''"), 'no baked-in SMTP login in the frontend');
assert.ok(source.includes("const [password, setPassword] = useState('')"));
assert.ok(source.includes('value="info@nexowatt.com"'), 'public sender remains unchanged');
assert.ok(source.includes('setPassword(\'\')'), 'password is cleared after save');
const repository = guard.checkRepository(root);
assert.equal(repository.findings.length, 0, JSON.stringify(repository.findings));
console.log('[1.0.10 security] OK: SMTP/HMAC literals, URLs/env/private keys and token formats, runtime files, clean UI fields, obsolete bundles, real staged-index hook, redacted failures and publish gate.');
