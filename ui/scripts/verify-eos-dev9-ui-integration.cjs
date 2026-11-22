/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
/* Isolierte Quell-/Dateisystem-/HTTP-Double-Prüfung. Verändert weder EOS-Originale
 * noch laufende Dienste. Belege werden ausschließlich mit --report geschrieben. */
'use strict';
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const integration = require('../integrations/eos-admin-dev9/apply-ui-login.cjs');
const referencePath = 'integrations/eos-admin-dev9/reference/eos-role-bootstrap.dev9.txt';
const reference = fs.readFileSync(path.join(root, referencePath));
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const results = [];
const proxyEvidence = Object.freeze({ checked: true, mode: 'eos', anonymousBlocked: true, uiPath: '/proxy/nexowatt-ui.2/api/auth/status' });

async function check(name, callback) {
  await callback(); results.push({ name, result: 'PASS' }); console.log('PASS ' + name);
}

async function withCheckout(callback) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nw-eos-ui-integration-'));
  try {
    for (const relative of integration.FILES) {
      const file = path.join(directory, relative);
      fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, reference);
    }
    await callback(directory);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
}

function findNode(source, predicate) {
  let found;
  function walk(node) { if (predicate(node)) { assert.equal(found, undefined, 'AST-Auswahl ist eindeutig'); found = node; } ts.forEachChild(node, walk); }
  walk(source); assert.ok(found, 'Belegter Quellknoten vorhanden'); return found;
}

/** Tatsächliche Funktionen aus dem gepatchten JS ausführen; keine nachgebaute Rollenlogik. */
function landing(instance = '2', address = 'https://eos.fixture/admin/index.html', baseAddress = 'https://eos.fixture/admin/') {
  const sourceText = integration.patchedSource(reference, instance).toString('utf8');
  const source = ts.createSourceFile('eos-role-bootstrap.js', sourceText, ts.ScriptTarget.ES2022, true, ts.ScriptKind.JS);
  assert.equal(source.parseDiagnostics.length, 0);
  const initializer = name => findNode(source, node => ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name).initializer.getText(source);
  const callback = findNode(source, node => ts.isArrowFunction(node) && node.parameters.length === 1
    && node.parameters[0].name.getText(source) === 'policy' && node.body.getText(source).includes('lockExpertMode(role);'));
  const calls = []; const location = new URL(address);
  location.replace = url => calls.push({ kind: 'redirect', url });
  const context = vm.createContext({ URL, base: new URL(baseAddress), window: { location, sessionStorage: { removeItem() {} } },
    launch: () => calls.push({ kind: 'launch' }),
    showFirstLoginPassword: (_policy, _base, own) => calls.push({ kind: own ? 'own-password' : 'first-password' }),
    lockExpertMode: role => calls.push({ kind: 'lock-expert', role }),
    showProductPortal: policy => calls.push({ kind: 'portal', role: policy.role }),
    currentRoute: () => 'tab-intro', isAllowed: () => true, defaultTab: () => 'tab-intro', navigate: route => calls.push({ kind: 'navigate', route }),
    installOwnPasswordLink: () => calls.push({ kind: 'admin-links' }) });
  vm.runInContext('var normalize = (' + initializer('normalize') + '); var roleFromPolicy = (' + initializer('roleFromPolicy')
    + '); var eosUiTarget = (' + initializer('eosUiTarget') + '); var land = (' + callback.getText(source) + ');', context);
  return { calls, run: policy => context.land(policy), target: base => context.eosUiTarget(new URL(base)).href };
}

const customer = () => ({ authenticated: true, role: 'enduser', user: 'system.user.fixture', mustChangePassword: false });
const anonymous = () => ({ mode: 'eos', configured: true, enabled: true, protectWrites: true, authenticated: false, authed: false });

async function main() {
  await check('Referenzhash, Instanzgrenzen und Syntax des tatsächlichen Patch-Ergebnisses', () => {
    assert.equal(hash(reference), integration.BASE_HASH);
    assert.equal(integration.instanceId('0'), '0'); assert.equal(integration.instanceId('999999'), '999999');
    for (const invalid of ['', '01', '-1', '1000000', '../0', 0, undefined]) assert.throws(() => integration.instanceId(invalid), /instance_required/);
    assert.throws(() => integration.patchedSource(Buffer.concat([reference, Buffer.from('\n')]), '0'), /unsupported_eos_source/);
    const patched = integration.patchedSource(reference, '0'); new vm.Script(patched.toString('utf8'));
    const evidence = JSON.parse(fs.readFileSync(path.join(root, 'integrations/eos-admin-dev9/evidence.json'), 'utf8'));
    assert.equal(hash(patched), evidence.patchedSha256Instance0);
  });
  await check('Prüfmodus schreibt nichts; beide Originale und Symlinkfreiheit erforderlich', () => withCheckout(directory => {
    const plan = integration.createPlan(directory, '2'); assert.equal(plan.length, 2);
    assert.equal(fs.existsSync(path.join(directory, 'nexowatt-integration-backups')), false);
    for (const file of plan) assert.equal(hash(fs.readFileSync(file.absolute)), integration.BASE_HASH);
    const second = path.join(directory, integration.FILES[1]); fs.appendFileSync(second, '\n');
    assert.throws(() => integration.createPlan(directory, '2'), /unsupported_eos_source/);
    assert.equal(hash(fs.readFileSync(plan[0].absolute)), integration.BASE_HASH);
    assert.equal(fs.existsSync(path.join(directory, 'nexowatt-integration-backups')), false);
    fs.unlinkSync(second); fs.symlinkSync(plan[0].absolute, second);
    assert.throws(() => integration.createPlan(directory, '2'), /symlink_not_allowed/);
  }));
  await check('Anwendung sichert beide Originale, bindet Manifest-Hashes und verweigert Wiederholung', () => withCheckout(directory => {
    const plan = integration.createPlan(directory, '2');
    assert.throws(() => integration.applyPlan(directory, plan, null), /verified_proxy_required/);
    assert.equal(fs.existsSync(path.join(directory, 'nexowatt-integration-backups')), false);
    const backup = integration.applyPlan(directory, plan, proxyEvidence);
    const manifest = JSON.parse(fs.readFileSync(path.join(backup, 'manifest.json'), 'utf8'));
    assert.equal(manifest.files.length, 2);
    for (const file of plan) {
      assert.equal(hash(fs.readFileSync(path.join(backup, file.relative))), integration.BASE_HASH);
      assert.equal(hash(fs.readFileSync(file.absolute)), file.afterHash);
      const record = manifest.files.find(item => item.path === file.relative);
      assert.equal(record.beforeSha256, integration.BASE_HASH); assert.equal(record.afterSha256, file.afterHash);
    }
    assert.throws(() => integration.createPlan(directory, '2'), /unsupported_eos_source/);
  }));
  await check('Änderung zwischen Prüfung und Anwendung bricht ohne Überschreiben ab', () => withCheckout(directory => {
    const plan = integration.createPlan(directory, '2'); fs.appendFileSync(plan[1].absolute, '\n');
    assert.throws(() => integration.applyPlan(directory, plan, proxyEvidence), /source_changed_after_check/);
    assert.equal(hash(fs.readFileSync(plan[0].absolute)), integration.BASE_HASH);
    assert.equal(fs.existsSync(path.join(directory, 'nexowatt-integration-backups')), false);
  }));
  await check('Proxy-Vorabprüfung fordert HTTPS, anonymen EOS-Status, begrenzte JSON-Antwort', async () => {
    assert.equal(integration.publicTarget('https://eos.fixture/admin/', '2').href, 'https://eos.fixture/admin/proxy/nexowatt-ui.2/api/auth/status');
    for (const address of ['http://eos.fixture/', 'https://eos.fixture/admin', 'https://user:secret@eos.fixture/', 'https://eos.fixture/?x=1']) {
      assert.throws(() => integration.publicTarget(address, '2'), /invalid_public_admin_url/);
    }
    const originalFetch = global.fetch; const calls = []; let response = () => Response.json(anonymous());
    global.fetch = async (target, init) => { calls.push({ target: target.href, init }); return response(); };
    try {
      const verified = await integration.verifyProxy('https://eos.fixture/admin/', '2'); assert.equal(verified.anonymousBlocked, true);
      assert.equal(calls[0].init.redirect, 'error'); assert.equal(calls[0].init.credentials, 'omit');
      assert.equal(new Headers(calls[0].init.headers).get('cookie'), null); assert.equal(new Headers(calls[0].init.headers).get('authorization'), null);
      assert.ok(calls[0].init.signal instanceof AbortSignal);
      for (const changed of [{ mode: 'iobroker' }, { configured: false }, { authenticated: true }, { authed: true }, { protectWrites: false }]) {
        response = () => Response.json({ ...anonymous(), ...changed }); await assert.rejects(integration.verifyProxy('https://eos.fixture/', '2'), /ui_proxy_profile_invalid/);
      }
      response = () => new Response('broken', { headers: { 'content-type': 'application/json' } });
      await assert.rejects(integration.verifyProxy('https://eos.fixture/', '2'), /ui_proxy_invalid_json/);
      response = () => new Response(' '.repeat(65537), { headers: { 'content-type': 'application/json' } });
      await assert.rejects(integration.verifyProxy('https://eos.fixture/', '2'), /ui_proxy_response_too_large/);
      response = () => new Response('<html>', { headers: { 'content-type': 'text/html' } });
      await assert.rejects(integration.verifyProxy('https://eos.fixture/', '2'), /ui_proxy_unavailable/);
    } finally { global.fetch = originalFetch; }
  });
  await check('Kundenziel nutzt den gemeinsamen HTTPS-Ursprung, Präfix und gewählte Instanz', () => {
    const f = landing(); f.run(customer());
    assert.deepEqual(f.calls.filter(call => call.kind === 'redirect'), [{ kind: 'redirect', url: 'https://eos.fixture/admin/proxy/nexowatt-ui.2/' }]);
    assert.equal(f.calls.some(call => call.kind === 'portal' || call.kind === 'launch'), false);
    const direct = landing('0', 'https://eos.fixture/index.html', 'https://eos.fixture/'); direct.run(customer());
    assert.equal(direct.calls.at(-1).url, 'https://eos.fixture/proxy/nexowatt-ui.0/');
    assert.throws(() => f.target('https://other.fixture/admin/'), /gemeinsame HTTPS/);
    const insecure = landing('0', 'http://eos.fixture/index.html', 'http://eos.fixture/');
    assert.throws(() => insecure.run(customer()), /gemeinsame HTTPS/);
  });
  await check('Erstpasswort und eigener Passwortwechsel bleiben vor jeder Kundenweiterleitung', () => {
    const first = landing(); first.run({ ...customer(), mustChangePassword: true });
    assert.equal(first.calls[0].kind, 'first-password'); assert.equal(first.calls.some(call => call.kind === 'redirect'), false);
    const own = landing('2', 'https://eos.fixture/admin/index.html?eosPassword=1'); own.run(customer());
    assert.equal(own.calls[0].kind, 'own-password'); assert.equal(own.calls.some(call => call.kind === 'redirect'), false);
    const noSession = landing(); noSession.run({ authenticated: false });
    assert.equal(noSession.calls[0].kind, 'launch'); assert.equal(noSession.calls.some(call => call.kind === 'redirect'), false);
    for (const key of ['authenticated', 'role', 'user', 'mustChangePassword']) {
      const value = customer(); Reflect.deleteProperty(value, key); const f = landing();
      assert.throws(() => f.run(value), /Endkundensitzung/); assert.equal(f.calls.some(call => call.kind === 'redirect'), false);
    }
  });
  await check('Installateur behält Portal; Administrator behält Admin und UI-/Passwortlinks', () => {
    const installer = landing(); installer.run({ ...customer(), role: 'installer' });
    assert.equal(installer.calls.find(call => call.kind === 'portal').role, 'installer');
    assert.equal(installer.calls.some(call => call.kind === 'redirect' || call.kind === 'launch'), false);
    const admin = landing(); admin.run({ ...customer(), role: 'admin' });
    assert.equal(admin.calls.some(call => call.kind === 'admin-links'), true); assert.equal(admin.calls.at(-1).kind, 'launch');
    assert.equal(admin.calls.some(call => call.kind === 'redirect'), false);
  });
  const sourceFiles = [referencePath, 'integrations/eos-admin-dev9/apply-ui-login.cjs', 'integrations/eos-admin-dev9/ui-login-instance-0.patch',
    'integrations/eos-admin-dev9/nginx-ui-location.conf.example', 'scripts/verify-eos-dev9-ui-integration.cjs'];
  const evidence = { time: new Date().toISOString(), node: process.version, result: 'PASS', scope: 'Isolierte Quell-, Dateisystem- und HTTP-Double-Prüfung; kein Browser, kein EOS-Server, kein Nginx, keine Anlage',
    checks: results, sourceHashes: sourceFiles.map(file => ({ file, sha256: hash(fs.readFileSync(path.join(root, file))) })), deployed: false };
  if (process.argv.includes('--report')) {
    const destination = path.join(root, 'docs/reports/auth-profiles-2026-11-19/eos-integration-evidence.json');
    fs.mkdirSync(path.dirname(destination), { recursive: true }); fs.writeFileSync(destination, JSON.stringify(evidence, null, 2) + '\n');
  }
  console.log(results.length + ' Integrations-Prüfgruppen PASS (keine Live-Anwendung).');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
