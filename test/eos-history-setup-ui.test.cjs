/** Copyright (c) 2026 NexoWatt. Confidential and proprietary. */
'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript');
const root = path.resolve(__dirname, '..'), src = path.join(root, 'ui/src-admin-tab/src');
function load(file, dependencies = {}, context = {}) {
  const code = ts.transpileModule(fs.readFileSync(path.join(src, file), 'utf8'), { fileName: file,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, { module, exports: module.exports, URL, Date, Error, console,
    require(id) { if (Object.hasOwn(dependencies, id)) return dependencies[id]; throw Error('Unexpected dependency ' + id); }, ...context });
  return module.exports;
}
const contracts = load('lib/historySetup.ts');
function sample(provider = 'influxdb2') {
  return { ok: true, configurationRevision: 'r1', config: { provider, instance: 'influxdb.0', untouchedHistory: { value: 1 },
    influxdb2: { url: 'https://influx.example:8086/', organization: 'NexoWatt', bucket: 'eos', hasToken: true, hasCaCertificate: true } },
    status: { provider, state: provider === 'adapter' ? 'disabled' : 'ready', queueDepth: 0, droppedPoints: 0, lastWriteAt: null, lastReadAt: null, lastError: '', writeVerified: false } };
}
const plain = value => JSON.parse(JSON.stringify(value));
function hooks() {
  let cursor = 0, writes = 0; const values = [], effects = [], cleanup = [];
  return { React: { createElement(type, props, ...children) { return { type, props: { ...props, children } }; },
    useState(initial) { const i = cursor++; if (!(i in values)) values[i] = initial; return [values[i], value => { values[i] = typeof value === 'function' ? value(values[i]) : value; writes++; }]; },
    useRef(initial) { const i = cursor++; if (!(i in values)) values[i] = { current: initial }; return values[i]; },
    useEffect(fn) { const i = cursor++; if (!(i in values)) { values[i] = true; effects.push(fn); } }, useMemo(fn) { cursor++; return fn(); } },
    render(fn) { cursor = 0; return fn(); }, start() { for (const effect of effects.splice(0)) cleanup.push(effect()); },
    unmount() { cleanup.splice(0).forEach(fn => fn?.()); }, get writes() { return writes; } };
}
function nodes(value) { if (Array.isArray(value)) return value.flatMap(nodes); if (!value || typeof value !== 'object') return []; return [value, ...nodes(value.props?.children)]; }
function text(value) { if (Array.isArray(value)) return value.map(text).join(' '); if (!value || typeof value !== 'object') return String(value ?? ''); return text(value.props?.children); }
async function settle() { for (let i = 0; i < 8; i++) await Promise.resolve(); }
function fixture(initial = sample()) {
  const host = hooks(), requests = [];
  const api = (...args) => new Promise((resolve, reject) => requests.push({ args, resolve, reject }));
  const Page = load('pages/HistorySetupPage.tsx', { react: host.React, './PageShell': 'PageShell',
    '../lib/adminConnection': { historySetupRequest: api, getRuntimeProxyBase: () => 'https://eos.example/proxy/eos-admin.0' }, '../lib/historySetup': contracts }).default;
  let tree;
  const render = () => { tree = host.render(Page); return tree; };
  const get = id => nodes(tree).find(node => node.props?.id === id);
  const click = name => { const node = nodes(tree).find(node => node.type === 'button' && text(node) === name); assert.ok(node, name); node.props.onClick(); };
  render(); host.start();
  return { host, requests, render, get, click, text: () => text(tree), tree: () => tree,
    async ready() { requests[0].resolve(initial); await settle(); render(); },
    change(id, value) { const node = get(id); assert.ok(node, id); node.props.onChange({ target: { value, checked: value } }); render(); },
    save() { nodes(tree).find(node => node.type === 'form').props.onSubmit({ preventDefault() {} }); },
  };
}
test('public contract discards secrets and invalid success responses cannot unlock saves', () => {
  const s = sample(); s.config.influxdb2.token = 'never-show-token'; s.config.influxdb2.caCertificate = 'never-show-ca';
  const parsed = contracts.parseHistoryResponse(s); assert.doesNotMatch(JSON.stringify(parsed), /never-show/);
  assert.equal(parsed.config.influxdb2.hasToken, true); assert.equal(contracts.historyDraft(parsed.config).token, '');
  for (const bad of [{}, { ...s, configurationRevision: '' }, { ...s, config: { provider: 'other' } }, { ...s, status: null }]) assert.throws(() => contracts.parseHistoryResponse(bad));
  assert.equal(contracts.parseHistoryResponse(sample('adapter')).config.instance, 'influxdb.0');
});
test('draft payload preserves adapter mode and does not send public flags or unrelated history settings', () => {
  const saved = contracts.parseHistoryResponse(sample()).config, draft = contracts.historyDraft(saved);
  let payload = contracts.historyPayload(draft, saved);
  assert.deepEqual(Object.keys(payload).sort(), ['influxdb2', 'provider']);
  assert.deepEqual(Object.keys(payload.influxdb2).sort(), ['bucket', 'caCertificate', 'clearCaCertificate', 'organization', 'token', 'url']);
  assert.equal(payload.influxdb2.token, ''); assert.equal(payload.influxdb2.caCertificate, '');
  draft.provider = 'adapter'; draft.token = 'unsaved-token'; payload = contracts.historyPayload(draft, saved);
  assert.deepEqual(plain(payload), { provider: 'adapter', instance: 'influxdb.0' });
});
test('saved token cannot be reused at another origin; explicit new token permits a new valid URL', () => {
  const saved = contracts.parseHistoryResponse(sample()).config, draft = contracts.historyDraft(saved);
  for (const url of ['https://other.example:8086', 'http://influx.example:8086', 'https://influx.example:8888']) {
    draft.url = url; assert.throws(() => contracts.historyPayload(draft, saved), /TOKEN_ORIGIN_CHANGED/);
  }
  draft.token = 'new-token'; assert.equal(contracts.historyPayload(draft, saved).influxdb2.token, 'new-token');
  for (const url of ['file:///tmp/secret', 'https://user:password@influx.example', 'https://influx.example/api/v2/write', 'https://influx.example/?token=leak']) {
    draft.url = url; assert.throws(() => contracts.historyPayload(draft, saved), /URL_INVALID/);
  }
  draft.url = saved.influxdb2.url; draft.token = ''; saved.influxdb2.hasToken = false; assert.throws(() => contracts.historyPayload(draft, saved), /TOKEN_REQUIRED/);
});
test('custom CA preserve/remove and HTTPS rules are explicit; read check never establishes write permission', () => {
  const saved = contracts.parseHistoryResponse(sample()).config, draft = contracts.historyDraft(saved);
  draft.clearCaCertificate = true; assert.equal(contracts.historyPayload(draft, saved).influxdb2.clearCaCertificate, true);
  draft.caCertificate = 'PEM'; assert.throws(() => contracts.historyPayload(draft, saved), /CA_INVALID/);
  draft.clearCaCertificate = false; draft.url = 'http://local:8086'; draft.token = 'new'; assert.throws(() => contracts.historyPayload(draft, saved), /CA_INVALID/);
  assert.deepEqual(plain(contracts.parseHistoryCheck({ ok: true, check: { reachable: true, readable: true, writeVerified: true } })), { reachable: true, readable: true });
  assert.throws(() => contracts.parseHistoryCheck({ ok: true, check: { reachable: 'yes', readable: true } }));
});
test('errors translate auth/network/TLS/bucket/conflict without leaking raw upstream details', () => {
  for (const [code, pattern] of [['EOS_INFLUX_AUTHORIZATION_FAILED', /401\/403/], ['EOS_INFLUX_NOT_FOUND', /Bucket/], ['EOS_INFLUX_TLS_FAILED', /TLS/], ['EOS_INFLUX_CONNECTION_FAILED', /nicht erreichbar/]]) assert.match(contracts.historyError({ payload: { error: code } }), pattern);
  assert.match(contracts.historyError({ status: 401 }), /EOS-Sitzung/); assert.match(contracts.historyError({ status: 403 }), /Installer/); assert.match(contracts.historyError({ status: 409 }), /inzwischen geändert/);
  assert.doesNotMatch(contracts.historyError(new Error('upstream token=secret http://password')), /secret|password/);
});
test('actual React mode change is local; draft check and explicit revision save use separate API operations', async () => {
  const f = fixture(sample('adapter')); await f.ready(); assert.equal(f.get('historyProvider').props.value, 'adapter'); assert.equal(f.get('historyToken'), undefined);
  f.change('historyProvider', 'influxdb2'); assert.equal(f.requests.length, 1);
  f.change('historyToken', 'replacement-token'); f.click('Verbindung prüfen');
  assert.equal(f.requests.length, 2); assert.equal(f.requests[1].args[0], '/check'); assert.equal(f.requests[1].args[1].expectedConfigurationRevision, undefined);
  f.requests[1].resolve({ ok: true, check: { reachable: true, readable: true, writeVerified: true } }); await settle(); f.render();
  assert.match(f.text(), /Schreibzugriff Nicht durch diesen Test geprüft/); assert.equal(f.get('historyToken').props.value, 'replacement-token');
  f.save(); f.save(); assert.equal(f.requests.length, 3, 'double-submit is bounded');
  assert.equal(f.requests[2].args[0], ''); assert.equal(f.requests[2].args[1].expectedConfigurationRevision, 'r1');
  const updated = sample(); updated.configurationRevision = 'r2'; f.requests[2].resolve(updated); await settle(); f.render();
  assert.equal(f.get('historyToken').props.value, ''); assert.match(f.text(), /Historie-Einstellungen gespeichert/);
  const links = nodes(f.tree()).filter(n => n.type === 'a').map(n => n.props.href);
  assert.ok(links.includes('https://eos.example/proxy/eos-admin.0/history.html'));
});
test('failed/conflicting saves keep draft secrets and revision; status refresh cannot replace the unsaved draft', async () => {
  const f = fixture(); await f.ready(); f.change('historyBucket', 'draft-bucket'); f.change('historyToken', 'unsaved-secret');
  f.save(); f.requests[1].reject({ status: 409, payload: { error: 'EOS_INSTALLER_CONFIG_CONFLICT' } }); await settle(); f.render();
  assert.equal(f.get('historyToken').props.value, 'unsaved-secret'); assert.equal(f.get('historyBucket').props.value, 'draft-bucket'); assert.match(f.text(), /inzwischen geändert/); assert.equal(f.requests.length, 2);
  f.click('Status aktualisieren'); const newer = sample(); newer.configurationRevision = 'r9'; newer.config.influxdb2.bucket = 'other-writer'; f.requests[2].resolve(newer); await settle(); f.render();
  assert.equal(f.get('historyBucket').props.value, 'draft-bucket'); f.save(); assert.equal(f.requests[3].args[1].expectedConfigurationRevision, 'r1');
  f.requests[3].reject({ status: 401 }); await settle(); f.render(); assert.match(f.text(), /EOS-Sitzung/); assert.equal(f.get('historyToken').props.value, 'unsaved-secret');
});
test('draft edits invalidate old check results; transport ready cannot fake read/write success', async () => {
  const f = fixture(); await f.ready(); assert.match(f.text(), /Letzter bestätigter Schreibzugriff Noch nicht bestätigt/); assert.match(f.text(), /Letzter bestätigter Lesezugriff Noch nicht bestätigt/);
  f.click('Verbindung prüfen'); f.requests[1].resolve({ ok: true, check: { reachable: true, readable: true, writeVerified: false } }); await settle(); f.render(); assert.match(f.text(), /Erreichbarkeit Bestätigt/);
  f.change('historyOrganization', 'changed'); assert.match(f.text(), /Erreichbarkeit Noch nicht geprüft/);
  f.host.unmount(); const before = f.host.writes; f.requests[0].resolve(sample()); await settle(); assert.equal(f.host.writes, before);
});
test('failed initial load leaves write actions disabled and explicit retry can recover', async () => {
  const f = fixture(); f.requests[0].reject({ status: 403 }); await settle(); f.render(); assert.match(f.text(), /Installer- oder Admin/);
  assert.equal(nodes(f.tree()).find(n => n.type === 'button' && text(n) === 'Speichern').props.disabled, true);
  f.click('Erneut laden'); f.requests[1].resolve(sample()); await settle(); f.render(); assert.equal(f.get('historyToken').props.type, 'password');
  assert.equal(nodes(f.tree()).find(n => n.type === 'button' && text(n) === 'Speichern').props.disabled, false);
});
test('late initial response after unmount cannot expose data or unlock controls', async () => {
  const f = fixture(); f.host.unmount(); const before = f.host.writes; f.requests[0].resolve(sample()); await settle(); assert.equal(f.host.writes, before);
});
test('installer action is admin/installer only and uses confirmed runtime/proxy origin in the same tab', async () => {
  for (const role of ['admin', 'installer', 'customer']) {
    const host = hooks(), opens = []; let resolve;
    const module = load('pages/InstallerPage.tsx', { react: host.React, './PageShell': 'PageShell', './ProtectedRuntimeRoute': { useRuntimeAccess: () => ({ authed: true, role }) },
      '../lib/installerNavigation': { installerModuleLinks: () => [], installerReturnLinks: () => [] },
      '../lib/adminConnection': { getInstance: () => '3', openExternal: url => opens.push(url), resolveRuntimeBaseUrl: () => new Promise(r => { resolve = r; }) } }, { window: { location: { port: '8188', protocol: 'https:' } } });
    let tree = host.render(module.default); host.start(); let action = nodes(tree).find(n => n.type === 'button' && text(n) === 'Historie einrichten');
    if (role === 'customer') { assert.equal(action, undefined); continue; }
    assert.equal(action.props.disabled, true); action.props.onClick(); assert.deepEqual(opens, []);
    resolve('https://eos.example/proxy/eos-admin.3'); await settle(); tree = host.render(module.default); action = nodes(tree).find(n => n.type === 'button' && text(n) === 'Historie einrichten'); action.props.onClick();
    assert.deepEqual(opens, ['https://eos.example/proxy/eos-admin.3/installer/?instance=3#/history-setup']);
  }
});
test('actual route retains protected capability and explicit roles; responsive history section is scoped', () => {
  const source = fs.readFileSync(path.join(src, 'App.tsx'), 'utf8');
  assert.match(source, /path="\/history-setup" element={<ProtectedRuntimeRoute capability="appcenter.open"[^\n]*allowedRoles={DYNAMIC_GRID_ROLES}><HistorySetupPage/);
  assert.match(source, /const DYNAMIC_GRID_ROLES = \['admin', 'installer'\]/);
  const css = fs.readFileSync(path.join(src, 'styles.css'), 'utf8');
  assert.match(css, /@media \(max-width: 640px\) { \.nw-history-grid, \.nw-history-check-grid, \.nw-history-runtime { grid-template-columns: 1fr;/);
  assert.match(fs.readFileSync(path.join(root, 'ui/www/ems-apps.html'), 'utf8'), /href="\/installer\/#\/history-setup"/);
});

test('saved read/write errors and duplicate recording warning stay independent of a successful opposite operation', async () => {
  const initial = sample(); initial.status.lastWriteAt = 1800000000000; initial.status.writeVerified = true;
  initial.status.readError = 'EOS_INFLUX_AUTHORIZATION_FAILED'; initial.status.lastError = initial.status.readError;
  initial.status.legacyRecordingCount = 7; initial.status.warnings = ['EOS_INFLUX_LEGACY_RECORDING_ACTIVE'];
  const f = fixture(initial); await f.ready();
  assert.match(f.text(), /Lesezugriff Noch nicht bestätigt InfluxDB lehnt den Zugriff ab/);
  assert.match(f.text(), /Für\s+7\s+EOS-Datenpunkte.*Aufzeichnung.*doppelt geschrieben/);
  assert.match(f.text(), /im bisherigen ioBroker-InfluxDB-Adapter noch eine Aufzeichnung eingerichtet/);
  assert.match(f.text(), /Ziel-Bucket und Betriebsstatus dieses Adapters prüfen/);
  assert.doesNotMatch(f.text(), /Aufzeichnung über einen ioBroker-InfluxDB-Adapter aktiv/);
  assert.match(f.text(), /10-Minuten-Raster/); assert.doesNotMatch(f.text(), /Transport bereit/);
  assert.equal(contracts.historyState(contracts.parseHistoryResponse(sample()).status), 'Eingerichtet; Zugriff noch nicht bestätigt');
  assert.equal(contracts.historyState(contracts.parseHistoryResponse(initial).status), 'Eingerichtet');
  f.click('Status aktualisieren'); initial.status.readError = ''; initial.status.writeError = 'EOS_INFLUX_QUEUE_FULL'; initial.status.lastError = initial.status.writeError;
  initial.status.lastReadAt = 1800000001000; f.requests[1].resolve(initial); await settle(); f.render();
  assert.match(f.text(), /Schreibzugriff.*Warteschlange ist voll/); assert.doesNotMatch(f.text(), /Lesezugriff Noch nicht bestätigt/);
});
test('concrete backend error codes distinguish busy/config/save/address and post-save activation failures', () => {
  for (const [code, expected] of [['EOS_INFLUX_CHECK_BUSY', /Prüfung|Verbindungsprüfung/], ['EOS_INFLUX_CONFIG_BUSY', /gerade gespeichert/],
    ['EOS_INFLUX_NEW_DESTINATION_REQUIRES_TOKEN', /Token neu eingeben/], ['EOS_INFLUX_TOKEN_INVALID', /Token fehlt/], ['EOS_INFLUX_HTTP_REQUIRES_LOCAL_ADDRESS', /HTTPS/],
    ['EOS_INFLUX_ADDRESS_FORBIDDEN', /nicht zulässig/], ['EOS_INFLUX_CONFIG_SAVE_FAILED', /nicht gespeichert/], ['EOS_INFLUX_TOKEN_DECRYPTION_FAILED', /Token erneut/],
    ['EOS_INFLUX_TOKEN_ENCRYPTION_FAILED', /nicht sicher gespeichert/], ['EOS_UI_OWNERSHIP_REQUIRED', /Betriebsfreigabe/]]) {
    assert.match(contracts.historyError({ status: 409, payload: { error: code } }), expected, code);
  }
  assert.match(contracts.historyError({ payload: { saved: true, error: 'EOS_UI_OWNERSHIP_REQUIRED' } }), /wurden gespeichert.*noch nicht vollständig aktiviert/);
});
test('actual dedicated transport wrapper retains single same-origin API boundary and rejects unplanned suffixes', async () => {
  const source = fs.readFileSync(path.join(src, 'lib/adminConnection.ts'), 'utf8');
  const ast = ts.createSourceFile('adminConnection.ts', source, ts.ScriptTarget.Latest, true);
  const fn = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'historySetupRequest'); assert.ok(fn);
  const code = ts.transpileModule(fn.getText(ast), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const calls = [], module = { exports: {} }; vm.runInNewContext(code, { module, exports: module.exports, requestRuntimeApi: (...args) => { calls.push(args); return Promise.resolve({ ok: true }); } });
  const payload = { history: { provider: 'influxdb2' } };
  await module.exports.historySetupRequest('/check', payload); assert.deepEqual(plain(calls), [['/api/installer/history/check', payload, 15000]]);
  await assert.rejects(module.exports.historySetupRequest('/../../other', payload)); assert.equal(calls.length, 1);
});

function newInstallation() {
  const value = sample('adapter');
  value.config.instance = '';
  value.config.newInstallationAllowed = true;
  value.config.influxdb2 = { url: '', organization: '', bucket: '', hasToken: false, hasCaCertificate: false };
  value.config.postgresql = { profile: 'local', provisioned: false };
  return value;
}
test('PostgreSQL public response accepts only local provision status and discards all database secrets', () => {
  const value = newInstallation(); value.config.provider = 'postgresql'; value.status.provider = 'postgresql';
  value.config.postgresql = { profile: 'local', provisioned: true, password: 'fixture-secret', connectionString: 'fixture-secret', caCertificate: 'fixture-secret', privateKey: 'fixture-secret' };
  const result = contracts.parseHistoryResponse(value);
  assert.deepEqual(plain(result.config.postgresql), { profile: 'local', provisioned: true });
  assert.doesNotMatch(JSON.stringify(result), /fixture-secret|privateKey|connectionString/);
  for (const bad of [undefined, { profile: 'remote', provisioned: true }, { profile: 'local', provisioned: 'true' }]) {
    value.config.postgresql = bad;
    assert.throws(() => contracts.parseHistoryResponse(value), /RESPONSE_INVALID/);
  }
});
test('empty legacy config is never automatically classified as new; PostgreSQL requires explicit intent and preserves active history', () => {
  const saved = contracts.parseHistoryResponse(newInstallation()).config;
  const draft = contracts.historyDraft(saved);
  assert.equal(draft.provider, 'adapter'); assert.equal(draft.newInstallation, false);
  const unconfirmed = { ...saved, newInstallationAllowed: false };
  assert.equal(contracts.canSelectNewPostgresql(unconfirmed), false, 'absence of config alone is not server approval');
  draft.provider = 'postgresql'; assert.throws(() => contracts.historyPayload(draft, saved), /NEW_INSTALLATION_REQUIRED/);
  draft.newInstallation = true; draft.token = 'unsaved-influx-token'; draft.caCertificate = 'unsaved-influx-ca';
  assert.deepEqual(plain(contracts.historyPayload(draft, saved)), { provider: 'postgresql', postgresql: { profile: 'local' }, newInstallation: true });
  for (const provider of ['adapter', 'influxdb2']) {
    const existing = contracts.parseHistoryResponse(sample(provider)).config;
    assert.equal(contracts.canSelectNewPostgresql(existing), false);
    assert.throws(() => contracts.historyPayload(draft, existing), /EXISTING_HISTORY/);
  }
  const existingPg = { ...saved, provider: 'postgresql' };
  assert.deepEqual(plain(contracts.historyPayload(contracts.historyDraft(existingPg), existingPg)), { provider: 'postgresql', postgresql: { profile: 'local' } });
});
test('explicit server new-site eligibility handles factory adapter defaults without converting saved configurations', () => {
  const value = newInstallation(); value.config.instance = 'influxdb.0';
  const saved = contracts.parseHistoryResponse(value).config;
  assert.equal(contracts.canSelectNewPostgresql(saved), true);
  assert.equal(contracts.historyDraft(saved).provider, 'adapter');
  const draft = { ...contracts.historyDraft(saved), provider: 'postgresql', newInstallation: true };
  assert.equal(contracts.historyPayload(draft, saved).newInstallation, true);
  delete value.config.newInstallationAllowed;
  assert.equal(contracts.canSelectNewPostgresql(contracts.parseHistoryResponse(value).config), false);
  value.config.newInstallationAllowed = 'true'; assert.throws(() => contracts.parseHistoryResponse(value), /RESPONSE_INVALID/);
});
test('new-installation UI is explicit and PostgreSQL test remains read-only with no system command or exposed credentials', async () => {
  const f = fixture(newInstallation()); await f.ready();
  assert.equal(f.get('historyProvider').props.value, 'adapter'); assert.equal(f.requests.length, 1);
  f.click('Neue Anlage mit PostgreSQL einrichten'); f.render();
  assert.equal(f.get('historyProvider').props.value, 'postgresql'); assert.equal(f.get('historyNewInstallation').props.checked, true);
  assert.equal(f.get('historyToken'), undefined); assert.equal(f.get('historyUrl'), undefined);
  assert.match(f.text(), /Systemeinrichtung erforderlich/); assert.match(f.text(), /TLS mit Zertifikatsprüfung/);
  assert.equal(f.requests.length, 1, 'the action only changes draft and does not provision system');
  f.click('Verbindung prüfen'); assert.deepEqual(plain(f.requests[1].args), ['/check', { history: { provider: 'postgresql', postgresql: { profile: 'local' }, newInstallation: true } }]);
  f.requests[1].resolve({ ok: true, check: { reachable: true, readable: true, writeVerified: true } }); await settle(); f.render();
  assert.match(f.text(), /Schreibzugriff Nicht durch diesen Test geprüft/);
  f.save(); assert.equal(f.requests[2].args[1].expectedConfigurationRevision, 'r1');
});
test('PostgreSQL direct selection cannot save before confirmation and existing Influx UI never offers a new-site action', async () => {
  const fresh = fixture(newInstallation()); await fresh.ready(); fresh.change('historyProvider', 'postgresql');
  const save = nodes(fresh.tree()).find(node => node.type === 'button' && text(node) === 'Speichern'); assert.equal(save.props.disabled, true);
  fresh.save(); await settle(); fresh.render(); assert.equal(fresh.requests.length, 1); assert.match(fresh.text(), /Neuanlage bestätigen/);
  const existing = fixture(sample()); await existing.ready();
  assert.equal(nodes(existing.tree()).some(node => node.type === 'button' && text(node) === 'Neue Anlage mit PostgreSQL einrichten'), false);
  assert.equal(nodes(existing.tree()).find(node => node.type === 'option' && node.props.value === 'postgresql').props.disabled, true);
});
test('PostgreSQL prerequisite refresh leaves pending new-installation intent and revision untouched', async () => {
  const f = fixture(newInstallation()); await f.ready(); f.click('Neue Anlage mit PostgreSQL einrichten'); f.render();
  f.click('Status aktualisieren'); const updated = newInstallation(); updated.config.postgresql.provisioned = true; updated.configurationRevision = 'r9';
  f.requests[1].resolve(updated); await settle(); f.render();
  assert.match(f.text(), /Geschütztes Verbindungsprofil vorhanden/); assert.equal(f.get('historyNewInstallation').props.checked, true);
  f.save(); assert.equal(f.requests[2].args[1].expectedConfigurationRevision, 'r1');
});
test('PostgreSQL failure codes distinguish setup, TLS, credentials and queue failures without upstream leakage', () => {
  for (const [code, expected] of [['EOS_POSTGRES_NOT_PROVISIONED', /Systemsetup/], ['EOS_POSTGRES_TLS_FAILED', /Zertifikat/],
    ['EOS_POSTGRES_AUTHORIZATION_FAILED', /Datenbankrollen/], ['EOS_POSTGRES_QUEUE_FULL', /verworfen/], ['EOS_POSTGRES_DISK_FULL', /vollen Datenträger/], ['EOS_POSTGRES_RESOURCE_LIMIT', /Ressourcenbegrenzung/], ['EOS_POSTGRES_EXISTING_HISTORY', /nicht durchgeführt/]]) {
    assert.match(contracts.historyError({ payload: { error: code, detail: 'private-secret' } }), expected);
    assert.doesNotMatch(contracts.historyError({ payload: { error: code, detail: 'private-secret' } }), /private-secret/);
  }
});
