'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'); const path = require('node:path'); const vm = require('node:vm'); const ts = require('typescript');
const plain = value => JSON.parse(JSON.stringify(value));
const source = ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '../../src-ts/runtime-executables/www/smarthome-alias-config.ts'), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const device = () => ({ id: 'customer-light', alias: 'Kundenlicht', type: 'device', roomId: 'living', functionId: 'light', behavior: { favorite: true }, customView: { kind: 'universal', settings: { title: 'Kundenwert' } }, io: { deviceControls: { profile: 'custom_universal', fields: [{ key: 'VALUE', readId: 'source.0.value' }] } }, importProvenance: { sourceId: 'source.0', sourceValues: { 'io.deviceControls.fields.VALUE.readId': 'source.0.value' } } });
function success(original) { const output = plain(original); output.io.deviceControls.fields[0].readId = 'alias.0.eos.value'; output.importProvenance.sourceValues['io.deviceControls.fields.VALUE.readId'] = 'alias.0.eos.value'; return { ok: true, devices: [output], created: ['alias.0.eos.value'], reused: [] }; }
function fixture(reply, permission = true) {
  const calls = []; const timers = new Map(); let timerId = 0;
  const window = { NW_AUTH: { hasCapability: cap => permission && cap === 'mapping.edit' } };
  const context = vm.createContext({ window, AbortController, TextEncoder, TextDecoder, setTimeout: callback => { const id = ++timerId; timers.set(id, callback); return id; }, clearTimeout: id => timers.delete(id),
    fetch: async (url, options) => { calls.push({ url, options }); return reply ? reply(url, options) : new Response(JSON.stringify(success(JSON.parse(options.body).devices[0]))); },
  });
  vm.runInContext(source, context);
  return { api: window.NW_SH_ALIAS_CONFIG, context, calls, timers, window };
}
function deferred() { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }
function addLegacy(context, names) {
  const input = fs.readFileSync(path.resolve(__dirname, '../../src-ts/runtime-executables/www/smarthome-config.ts'), 'utf8');
  const file = ts.createSourceFile('config.ts', input, ts.ScriptTarget.Latest, true);
  const code = file.statements.filter(node => ts.isFunctionDeclaration(node) && names.includes(node.name?.text)).map(node => node.getText(file)).join('\n'); vm.runInContext(code, context);
}

test('alias response changes only io and baseline, preserving all customer draft settings', async () => {
  const original = device();
  const f = fixture((_url, options) => { const result = success(JSON.parse(options.body).devices[0]); result.devices[0].roomId = 'unexpected'; result.devices[0].behavior = {}; result.devices[0].customView = null; return new Response(JSON.stringify(result)); });
  const result = await f.api.create([original]);
  assert.equal(result.devices[0].io.deviceControls.fields[0].readId, 'alias.0.eos.value');
  assert.equal(result.devices[0].roomId, 'living'); assert.deepEqual(plain(result.devices[0].behavior), original.behavior); assert.deepEqual(plain(result.devices[0].customView), original.customView);
  assert.equal(result.devices[0].importProvenance.sourceValues['io.deviceControls.fields.VALUE.readId'], 'alias.0.eos.value');
  assert.equal(original.io.deviceControls.fields[0].readId, 'source.0.value');
  assert.equal(f.calls[0].url, '/api/smarthome/aliases'); assert.equal(f.calls[0].options.method, 'POST'); assert.equal(f.calls[0].options.credentials, 'same-origin'); assert.equal(f.calls.length, 1);
});

test('permission, duplicate IDs, overlimit selection and mismatched responses reject without draft mutation', async () => {
  const denied = fixture(null, false); await assert.rejects(denied.api.create([device()]), /mapping.edit/); assert.equal(denied.calls.length, 0);
  const f = fixture(); await assert.rejects(f.api.create([device(), device()]), /doppelt/); await assert.rejects(f.api.create(Array.from({ length: 101 }, (_, i) => ({ ...device(), id: 'id' + i }))), /100/); assert.equal(f.calls.length, 0);
  const bad = fixture(() => new Response(JSON.stringify({ ok: true, devices: [{ ...device(), id: 'different' }], created: [], reused: [] })));
  await assert.rejects(bad.api.create([device()]), /passt nicht/);
});

test('partial failure and timeout preserve draft and are never retried automatically', async () => {
  const original = device(); const f = fixture(() => new Response(JSON.stringify({ ok: false, created: ['alias.0.partial'], reused: [], uncertain: ['alias.0.pending'] }), { status: 409 }));
  await assert.rejects(f.api.create([original]), /1 angelegt.*1 unbestätigt/); assert.equal(f.calls.length, 1); assert.equal(original.io.deviceControls.fields[0].readId, 'source.0.value');
  const timeout = fixture((_url, options) => new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))));
  const pending = timeout.api.create([device()]); for (const trigger of timeout.timers.values()) trigger();
  await assert.rejects(pending, /nicht bestätigt.*vorhanden/); assert.equal(timeout.calls.length, 1);
});

test('concurrent alias requests are rejected instead of racing or duplicating objects', async () => {
  const gate = deferred(); const f = fixture(() => gate.promise); const first = f.api.create([device()]);
  await assert.rejects(f.api.create([device()]), /läuft bereits/); gate.resolve(new Response(JSON.stringify(success(device())))); await first; assert.equal(f.calls.length, 1);
});

test('manual alias action keeps concurrent room changes but rejects concurrent mapping changes', async () => {
  for (const changeMapping of [false, true]) {
    const gate = deferred(); const f = fixture(() => gate.promise); const dev = device(); const messages = [];
    Object.assign(f.context, { nwShcState: { config: { devices: [dev], rooms: [], functions: [] } }, nwValidateConfig: () => ({ errors: [] }), nwMarkDirty() {}, nwRenderAll() {}, nwSetStatus: value => messages.push(value) });
    f.window.confirm = () => true; addLegacy(f.context, ['nwCreateDeviceDraftAliases']);
    const status = {}; const button = {}; const pending = f.context.nwCreateDeviceDraftAliases(dev, status, button);
    dev.roomId = 'changed-while-waiting'; if (changeMapping) dev.io.deviceControls.fields[0].readId = 'manual.changed';
    gate.resolve(new Response(JSON.stringify(success(device())))); await pending;
    assert.equal(dev.roomId, 'changed-while-waiting'); assert.equal(dev.customView.settings.title, 'Kundenwert');
    assert.equal(dev.io.deviceControls.fields[0].readId, changeMapping ? 'manual.changed' : 'alias.0.eos.value');
    if (changeMapping) assert.match(messages.at(-1), /zwischenzeitlich geändert/);
  }
});

test('detected imports do not change device or room drafts before successful alias completion', async () => {
  for (const fail of [false, true]) {
    const gate = deferred(); const f = fixture(() => gate.promise); const original = device(); const results = [{ id: 'proposal', sourceId: 'source.0', importable: true, proposal: original }];
    const config = { devices: [], rooms: [], functions: [] }; const messages = []; let assignmentsCommitted = 0;
    Object.assign(f.context, { nwShcState: { config, detector: { results, useAliases: true } }, nwShcfgCloneJson: plain, nwShcfgGetDetectorAssignment: () => ({ roomId: 'new-room', functionId: '' }), nwShcfgDraftContainsSuggestion: () => false,
      nwShcfgAcceptDetectedAssignment(_suggestion, _assignment, commit = true) { if (commit) { assignmentsCommitted++; config.rooms.push({ id: 'new-room' }); } },
      nwAddDeviceFromTemplate(_type, options) { assert.equal(options.draftOnly, true); return { ...original, id: 'customer-light', io: {} }; }, nwNormalizeDeviceOrder() {}, nwMarkDirty() {}, nwRenderAll() {}, nwRenderShcfgDetector() {}, nwSetDetectorStatus: message => messages.push(message),
    });
    f.window.confirm = () => true; addLegacy(f.context, ['nwImportTypeDetectedSuggestion']);
    const pending = f.context.nwImportTypeDetectedSuggestion('proposal');
    assert.equal(config.devices.length, 0); assert.equal(config.rooms.length, 0); assert.equal(assignmentsCommitted, 0);
    if (fail) gate.resolve(new Response(JSON.stringify({ ok: false, created: ['alias.0.partial'], reused: [] }), { status: 409 }));
    else gate.resolve(new Response(JSON.stringify(success({ ...original, roomId: 'new-room', functionId: null }))));
    await pending;
    assert.equal(config.devices.length, fail ? 0 : 1); assert.equal(config.rooms.length, fail ? 0 : 1);
    if (!fail) { assert.equal(config.devices[0].roomId, 'new-room'); assert.equal(config.devices[0].io.deviceControls.fields[0].readId, 'alias.0.eos.value'); }
    else assert.match(messages.at(-1), /unverändert/);
  }
});

test('selected updates are staged through aliases while unrelated draft changes survive', async () => {
  const gate = deferred(); const f = fixture(() => gate.promise); const original = device();
  const selectedPath = 'io.deviceControls.fields.VALUE.readId';
  const suggestion = { id: 'proposal', importable: true, sourceId: 'source.0', targetType: 'device', proposal: { importProvenance: { sourceId: 'source.0', sourceValues: { [selectedPath]: 'source.0.new' } } }, update: { deviceId: original.id, changes: [{ path: selectedPath, current: 'source.0.value', proposed: 'source.0.new' }] } };
  const config = { devices: [original] };
  Object.assign(f.context, { nwShcState: { config, detector: { results: [suggestion], useAliases: true } }, nwShcfgCloneJson: plain, nwMarkDirty() {}, nwRenderAll() {}, nwRenderShcfgDetector() {}, nwSetDetectorStatus() {} });
  f.window.confirm = () => true;
  addLegacy(f.context, ['nwShcfgImportFieldAllowed', 'nwShcfgImportFieldValue', 'nwApplyTypeDetectedUpdate', 'nwApplyTypeDetectedUpdateWithAliases']);
  const pending = f.context.nwApplyTypeDetectedUpdateWithAliases('proposal', [selectedPath]);
  assert.equal(original.io.deviceControls.fields[0].readId, 'source.0.value');
  original.roomId = 'updated-room'; original.behavior.favorite = false;
  const staged = JSON.parse(f.calls[0].options.body).devices[0]; assert.equal(staged.io.deviceControls.fields[0].readId, 'source.0.new');
  gate.resolve(new Response(JSON.stringify(success(staged)))); assert.equal(await pending, true);
  assert.equal(config.devices[0].roomId, 'updated-room'); assert.equal(config.devices[0].behavior.favorite, false);
  assert.equal(config.devices[0].io.deviceControls.fields[0].readId, 'alias.0.eos.value');
  assert.equal(config.devices[0].customView.settings.title, 'Kundenwert');
});

test('frontend accepts the real alias service response and an explicit second call reuses objects', async () => {
  const Module = require('node:module'); const loaded = new Map();
  function load(name) {
    if (loaded.has(name)) return loaded.get(name).exports;
    const filename = path.resolve(__dirname, `../../lib/${name}.js`); const mod = new Module(filename, module);
    mod.filename = filename; mod.paths = Module._nodeModulePaths(path.dirname(filename)); loaded.set(name, mod);
    const originalRequire = mod.require.bind(mod); mod.require = name => name.startsWith('./smarthome-') ? load(name.slice(2)) : originalRequire(name);
    mod._compile(ts.transpileModule(fs.readFileSync(path.resolve(__dirname, `../../src-ts/runtime-executables/lib/${name}.ts`), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText, filename);
    return mod.exports;
  }
  const service = load('smarthome-device-aliases');
  const objects = new Map([['source.0.value', { type: 'state', common: { type: 'number', read: true, write: false, role: 'value' }, native: {} }]]);
  let creates = 0;
  const f = fixture(async (_url, options) => {
    const result = await service.createDeviceAliases(JSON.parse(options.body).devices, {
      async readObject(id) { return objects.get(id); },
      async createObjectIfAbsent(id, object) { if (!objects.has(id)) { objects.set(id, plain(object)); creates++; } },
      async writeState() { assert.fail('alias config never writes device values'); },
    });
    return new Response(JSON.stringify({ ok: true, ...result }));
  });
  const first = await f.api.create([device()]); const created = creates;
  assert.ok(created > 0); assert.match(first.devices[0].io.deviceControls.fields[0].readId, /^alias\.0\.nexowatt_eos\./);
  const second = await f.api.create(first.devices);
  assert.equal(creates, created); assert.equal(second.created.length, 0); assert.ok(second.reused.length > 0); assert.equal(f.calls.length, 2);
});
