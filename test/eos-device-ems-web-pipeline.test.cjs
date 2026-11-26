'use strict';
// Legacy business-pipeline cases intentionally retain an in-process UI seam so
// their deep runtime assertions remain meaningful. A separate case below mounts
// the production Web wiring with the real UI/EMS child and uses only public
// status, HTTP and controller-state observations. Controller/auth/device IO are fixtures.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const Module = require('node:module');
const http = require('node:http');
const crypto = require('node:crypto');
const express = require('express');
const root = path.resolve(__dirname, '..');
const clone = value => value == null ? value : structuredClone(value);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const glob = pattern => new RegExp('^' + pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');

async function pipeline(t, options = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'eos-web-pipeline-'));
  const objects = new Map(clone(options.persistedObjects || []));
  const states = new Map(clone(options.persistedStates || [])); const writes = []; const logs = [];
  const subscriptions = new Set(); const runtimes = []; let actualRuntime;
  const aliasReads = []; let aliasesVisible = options.aliasesVisible !== false;
  let ownership = true;
  const namespace = 'eos-admin.0';
  const qualify = id => id.startsWith(`${namespace}.`) ? id : `${namespace}.${id}`;
  const emitState = (id, state) => queueMicrotask(() => {
    owner.eosModuleHost?.onStateChange(id, clone(state));
    owner.eosHostedRuntime?.onStateChange(id, clone(state));
  });
  const emitObject = (id, object) => queueMicrotask(() => owner.eosModuleHost?.onObjectChange(id, clone(object)));
  const putObject = async (id, object) => {
    const value = { ...clone(object), _id: id }; objects.set(id, value); emitObject(id, value);
  };
  const putState = async (id, input, ack) => {
    const supplied = input && typeof input === 'object' && Object.hasOwn(input, 'val') ? input : { val: input, ack: !!ack };
    const state = { ...clone(supplied), ts: supplied.ts || Date.now(), lc: supplied.lc || Date.now() };
    states.set(id, state); writes.push({ id, state }); emitState(id, state);
  };
  const owner = {
    namespace, instance: 0, host: 'qa-host', name: 'eos-admin',
    config: { port: 8188, eosUi: { history: { instance: '' }, weather: { enabled: false } }, eosModules: {} },
    log: Object.fromEntries(['info', 'warn', 'error', 'debug', 'silly'].map(level => [level, message => logs.push({ level, message })])),
    encrypt: value => `fixture:${Buffer.from(value).toString('base64')}`,
    decrypt: value => Buffer.from(value.slice('fixture:'.length), 'base64').toString(),
    eosLicenseService: { allowsEmbeddedModule: () => true,
      statusView: () => ({ valid: true, coreEnabled: true, edition: 'pro', limits: { chargePoints: 12, batteries: 4 },
        features: ['energy', 'wallet', 'smartHome', 'microgridSlave', 'microgridMaster'] }) },
    eosOwnership: { canWrite: () => ownership, status: () => ({ state: ownership ? 'owned' : 'blocked' }) },
    eosMigration: { allowsStartup: () => true, status: () => ({ phase: 'NOT_NEEDED' }) },
    getForeignObjectAsync: async id => clone(objects.get(id) || null),
    setForeignObjectAsync: putObject,
    setForeignObjectNotExistsAsync: async (id, object) => { if (!objects.has(id)) await putObject(id, object); },
    extendForeignObjectAsync: async (id, patch) => {
      const old = objects.get(id) || {};
      await putObject(id, { ...old, ...clone(patch), common: { ...old.common, ...patch.common }, native: { ...old.native, ...patch.native } });
    },
    delForeignObjectAsync: async id => { objects.delete(id); },
    getForeignObjectsAsync: async (pattern, type) => {
      if (pattern.includes('.aliases.v1.')) aliasReads.push(pattern);
      return Object.fromEntries([...objects]
        .filter(([id, object]) => glob(pattern).test(id) && (!type || object.type === type)).map(([id, object]) => [id, clone(object)]));
    },
    getObjectViewAsync: async (_design, type, range) => ({ rows: [...objects]
      .filter(([id, obj]) => obj.type === type && id >= range.startkey && id <= range.endkey).map(([id, value]) => ({ id, value: clone(value) })) }),
    getForeignStateAsync: async id => {
      if (id === `${namespace}.installer.configJson` && options.beforeInstallerRead) await options.beforeInstallerRead();
      if (!aliasesVisible && id.endsWith('.aliases.meta.manifest')) return null;
      return clone(states.get(id) || null);
    },
    getForeignStatesAsync: async pattern => Object.fromEntries([...states].filter(([id]) => glob(pattern).test(id)).map(([id, state]) => [id, clone(state)])),
    setForeignStateAsync: putState,
    setForeignStateChangedAsync: async (id, value, ack) => {
      const val = value && typeof value === 'object' && Object.hasOwn(value, 'val') ? value.val : value;
      if (states.get(id)?.val !== val) await putState(id, value, ack);
    },
    delForeignStateAsync: async id => { states.delete(id); },
    subscribeForeignStatesAsync: async id => { subscriptions.add(id); },
    unsubscribeForeignStatesAsync: async id => { subscriptions.delete(id); },
    subscribeForeignObjectsAsync: async () => {}, unsubscribeForeignObjectsAsync: async () => {},
    sendTo: (_instance, _command, _message, callback) => callback?.({ error: 'QA_NO_HISTORY_SERVER' }),
    sendToAsync: async () => ({ error: 'QA_NO_HISTORY_SERVER' }),
    setTimeout, clearTimeout, setInterval, clearInterval,
  };
  for (const [local, foreign] of Object.entries({ getStateAsync: 'getForeignStateAsync', setStateAsync: 'setForeignStateAsync',
    setStateChangedAsync: 'setForeignStateChangedAsync', getObjectAsync: 'getForeignObjectAsync',
    setObjectAsync: 'setForeignObjectAsync', setObjectNotExistsAsync: 'setForeignObjectNotExistsAsync',
    extendObjectAsync: 'extendForeignObjectAsync', delObjectAsync: 'delForeignObjectAsync' })) {
    owner[local] = (id, ...args) => owner[foreign](qualify(id), ...args);
  }
  for (const name of ['getForeignState', 'setForeignState', 'setForeignStateChanged', 'getForeignObject',
    'setForeignObject', 'setForeignObjectNotExists', 'extendForeignObject', 'delForeignObject', 'getForeignStates',
    'subscribeForeignStates', 'unsubscribeForeignStates', 'subscribeForeignObjects', 'unsubscribeForeignObjects']) {
    owner[name] = (...args) => {
      const callback = typeof args.at(-1) === 'function' ? args.pop() : null;
      const result = owner[`${name}Async`](...args);
      if (callback) result.then(value => callback(null, value), callback);
      return result;
    };
  }
  objects.set('system.config', { _id: 'system.config', type: 'config', common: { language: 'de' }, native: {} });
  for (const [id, config] of Object.entries(options.initialModules || {})) {
    owner.config.eosModules[id] = { v: 1, encrypted: owner.encrypt(JSON.stringify(config)) };
  }
  objects.set(`system.adapter.${namespace}`, { _id: `system.adapter.${namespace}`, type: 'instance', common: { enabled: true, host: 'qa-host' }, native: clone(owner.config) });
  if (options.savedPatch) states.set(`${namespace}.installer.configJson`, { val: JSON.stringify(options.savedPatch), ack: true, ts: Date.now() });
  const devices = require('../modules/devices');
  const { DeviceRuntime } = require('../modules/devices/lib/deviceRuntime');
  const hostLibrary = require('../build/lib/eosModuleHost');
  class HostWithTransportBoundary extends hostLibrary.EosModuleHost {
    constructor(adapter, supplied) {
      super(adapter, { ...supplied, factories: { ...options.moduleFactories, devices: { ...devices,
        createHostedModule: args => devices.createHostedModule({ ...args, runtimeFactory: (cfg, template) => {
          const deviceRuntime = new DeviceRuntime(args.adapter, cfg, template, args.config);
          const driver = options.driverFactory?.(cfg, deviceRuntime);
          if (driver) {
            deviceRuntime._createDriver = () => driver;
            runtimes.push(deviceRuntime);
          } else {
            deviceRuntime._createDriver = () => { throw new Error('QA_PHYSICAL_TRANSPORT_BLOCKED'); };
            deviceRuntime.start = async () => { runtimes.push(deviceRuntime); };
            deviceRuntime.stop = async () => {};
          }
          return deviceRuntime;
        } }) } } });
    }
  }
  // Exporting the class permits observation only: all startup methods run unchanged.
  const controller = { I18n: { getTranslatedObject: () => ({}) },
    getAbsoluteInstanceDataDir: () => directory, controllerDir: path.join(root, 'node_modules/iobroker.js-controller') };
  const controllerLoad = Module._load;
  Module._load = function (name, ...args) { return name === '@iobroker/adapter-core' ? controller : controllerLoad.call(this, name, ...args); };
  t.after(() => { Module._load = controllerLoad; });
  const uiFile = path.join(root, 'ui/main.js'); const uiModule = new Module(uiFile, module);
  uiModule.filename = uiFile; uiModule.paths = Module._nodeModulePaths(path.dirname(uiFile));
  const uiRequire = uiModule.require.bind(uiModule);
  uiModule.require = name => name === '@iobroker/adapter-core' ? controller : uiRequire(name);
  uiModule._compile(fs.readFileSync(uiFile, 'utf8') + '\nmodule.exports.TestRuntime = NexoWattVis;\n', uiFile);
  const ready = uiModule.exports.TestRuntime.prototype.onReady;
  uiModule.exports.TestRuntime.prototype.onReady = function (...args) { actualRuntime = this; return ready.apply(this, args); };
  const webFile = path.join(root, 'build/lib/web.js'); const nativeRequire = Module.createRequire(webFile);
  const processLibrary = nativeRequire('./eosUiProcess');
  const childRuntimeFile = path.join(directory, 'child-runtime.cjs');
  if (options.realProcess) {
    // The installed controller is absent in this executor. Replace only its
    // filesystem locator inside the child; the real UI/EMS methods remain intact.
    fs.writeFileSync(childRuntimeFile, `const id=require.resolve('@iobroker/adapter-core',{paths:[${JSON.stringify(root)}]});
require.cache[id]={id,filename:id,loaded:true,exports:{getAbsoluteInstanceDataDir:()=>${JSON.stringify(directory)}}};
module.exports=require(${JSON.stringify(uiFile)});\n`);
  }
  const exports = {};
  vm.runInNewContext(fs.readFileSync(webFile, 'utf8'), {
    exports, module: { exports }, __dirname: path.dirname(webFile), __filename: webFile,
    Buffer, URL, console, process, setTimeout, clearTimeout, setInterval, clearInterval,
    require: name => name === '@iobroker/adapter-core' ? controller
      : name === './eosModuleHost' ? { ...hostLibrary, EosModuleHost: HostWithTransportBoundary }
        : name === './eosUiProcess' ? { ...processLibrary,
          createEosUiProcess: (adapter, bridge, supplied) => options.realProcess
            ? processLibrary.createEosUiProcess(adapter, bridge, { ...supplied, runtimePath: childRuntimeFile })
            : uiModule.exports.createHostedRuntime(adapter, bridge) }
        : name === 'node:module' ? { ...Module, createRequire: file => {
          const load = Module.createRequire(file); return id => id === uiFile ? uiModule.exports : load(id);
        } } : nativeRequire(name),
  }, { filename: webFile, timeout: 5000 });
  const app = express();
  const token = 'qa-session-0123456789abcdef0123456789';
  const session = { authenticated: true, user: 'system.user.admin', userId: 'system.user.admin', role: 'admin',
    groups: [], capabilities: ['*'], mustChangePassword: false, activationRequired: false, credentialKey: token, csrfToken: token };
  const web = Object.assign(Object.create(exports.default.prototype), {
    baseDir: root, adapter: owner, settings: { auth: true, secure: false, port: 8188 }, systemRequests: new WeakSet(),
    systemLanguage: 'de', server: { app }, closed: false, startupFailed: false,
    unified: { status: async req => req.headers.cookie === `fixture=${token}` ? session : { authenticated: false },
      csrfAllowed: async req => req.headers['x-nw-csrf'] === token,
      requestAllowed: req => !req.headers.origin || req.headers.origin === `http://${req.headers.host}`,
      machineRequestAllowed: () => false },
  });
  let server;
  t.after(async () => {
    ownership = false;
    await owner.eosModuleHost?.stop(); await owner.eosHostedRuntime?.stop().catch(() => {});
    if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    fs.rmSync(directory, { recursive: true, force: true });
  });
  await web.mountUnifiedRuntime();
  app.use((_req, res) => res.status(404).end());
  server = http.createServer(app); web.server.server = server;
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const startup = Promise.all([owner.eosModuleHost.start(), owner.eosHostedRuntime.startOperational()]);
  const request = async (url, method = 'GET', body) => {
    if (method === 'PUT' && /^\/api\/eos\/modules\/[^/]+$/.test(url) && body && !Object.hasOwn(body, 'expectedConfigurationRevision')) {
      const loaded = await request(url);
      body = { ...body, expectedConfigurationRevision: loaded.data.configurationRevision };
    }
    const response = await fetch(origin + url, { method, headers: { Cookie: `fixture=${token}`, Origin: origin,
      'X-NW-CSRF': token, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const text = await response.text(); let data; try { data = JSON.parse(text); } catch {}
    return { status: response.status, text, data };
  };
  return { request, startup, owner, web, states, objects, writes, logs, runtimes, subscriptions, aliasReads,
    runtime: () => actualRuntime, ownership: value => { ownership = value; },
    revealAliases: () => { aliasesVisible = true; } };
}

async function waitForView(x, predicate, attempts = 160) {
  let view;
  for (let i = 0; i < attempts; i++) {
    view = await x.request('/api/eos/modules/devices');
    if (predicate(view.data)) return view.data;
    await sleep(50);
  }
  assert.fail(JSON.stringify({ view: view.data, runtime: x.owner.eosHostedRuntime.status(), logs: x.logs.slice(-20) }));
}
const wallboxConfig = () => ({ enabled: true, devices: [{ id: 'wallbox', name: 'Wallbox', enabled: true,
  templateId: 'evcs.abl.emh1.evcc2_3.modbusAscii', protocol: 'modbusAscii', connection: {}, ems: { mode: 'auto' } }] });

test('production Web mount reaches the real UI/EMS child and reconciles a device HTTP save through IPC', { timeout: 45000 }, async t => {
  const x = await pipeline(t, { realProcess: true });
  await x.startup;
  for (let attempt = 0; attempt < 100 && !x.owner.eosHostedRuntime.status().emsReady; attempt++) await sleep(50);
  const status = x.owner.eosHostedRuntime.status();
  assert.equal(status.process.mode, 'process'); assert.notEqual(status.process.pid, process.pid);
  assert.equal(status.emsReady, true, JSON.stringify({ status, logs: x.logs.slice(-20) }));
  assert.equal(x.runtime(), undefined, 'the real child exposes no mutable parent runtime instance');
  const live = await x.request('/api/state'); assert.equal(live.status, 200, live.text);
  const answer = await x.request('/api/eos/modules/devices', 'PUT', { config: wallboxConfig() });
  assert.equal(answer.status, 200, answer.text);
  const ready = await waitForView(x, view => view?.status?.active === true
    && view.emsCommissioning?.state === 'ready' && view.emsCommissioning?.statuses?.length === 1);
  assert.equal(ready.emsCommissioning.statuses.length, 1);
  const committed = JSON.parse(x.states.get('eos-admin.0.installer.configJson').val);
  assert.equal(committed.settingsConfig.evcsList.length, 1);
  assert.equal(committed.settingsConfig.evcsList[0].powerId, 'eos-admin.0.devices.wallbox.aliases.v1.r.power');
  const installer = await x.request('/api/installer/config'); assert.equal(installer.status, 200, installer.text);
  const heartbeat = x.states.get('eos-admin.0.ems.core.schedulerHeartbeatSequence')?.val;
  for (let attempt = 0; attempt < 100 && !(x.states.get('eos-admin.0.ems.core.schedulerHeartbeatSequence')?.val > heartbeat); attempt++) await sleep(50);
  assert.ok(x.states.get('eos-admin.0.ems.core.schedulerHeartbeatSequence')?.val > heartbeat, 'the actual EMS scheduler continues across IPC after reconciliation');
  assert.equal(x.writes.some(row => row.id.includes('.devices.') && row.state.ack === false), false,
    'commissioning offline telemetry must not emit physical device commands');
});

function profileGuardSetup(enabled = true, manualAlias = false) {
  const base = 'eos-admin.0.devices.customer.storage';
  const config = { enabled: true, devices: [{ id: 'customer.storage', name: 'Kundenspeicher', enabled: true,
    templateId: 'ess.fenecon.FeneconHomeEssImpl', protocol: 'modbusTcp', connection: {}, ems: { mode: 'manual' } }] };
  const target = `${base}.aliases.v1.ctrl.powerSetpointW`;
  return { config, replacement: { ...clone(config), devices: [{ ...clone(config.devices[0]),
    templateId: 'ess.fenecon.FeneconProEssImpl' }] }, options: {
    initialModules: { devices: config },
    savedPatch: { storageFarm: { enabled, storages: [{ id: 'customer-storage', enabled: true,
      name: 'Kundenanlage unverändert', vendorProfile: 'fenecon-openems', feneconControlMode: 'direct-ess',
      maxChargeW: 4000, maxDischargeW: 4500, coupling: 'dc', socId: manualAlias ? 'alias.0.customer.soc' : `${base}.aliases.v1.r.soc`,
      signedPowerId: manualAlias ? 'alias.0.customer.power' : `${base}.aliases.v1.r.essActivePower`,
      setSignedPowerId: manualAlias ? 'alias.0.customer.charge' : target }] },
      emsApps: { apps: { storagefarm: { installed: true, enabled } } } },
    persistedObjects: manualAlias ? [
      ['charge', target, 'W', true], ['power', `${base}.aliases.v1.r.essActivePower`, 'W', false],
      ['soc', `${base}.aliases.v1.r.soc`, '%', false],
    ].map(([name, id, unit, write]) => [`alias.0.customer.${name}`, { _id: `alias.0.customer.${name}`, type: 'state',
      common: { type: 'number', read: true, write, unit, alias: { id: { read: id, write: id } } }, native: {} }]) : [],
  } };
}

async function setFarmEnabled(x, enabled) {
  const current = await x.request('/api/installer/config');
  assert.equal(current.status, 200, current.text);
  return x.request('/api/installer/config', 'POST', { expectedConfigurationRevision: current.data.configurationRevision,
    patch: { emsApps: { apps: { storagefarm: { installed: true, enabled } } } }, restartEms: true });
}

test('legacy in-process business pipeline: actual module HTTP rejects a live profile replacement before persistence and allows it after AppCenter deactivation', { timeout: 90000 }, async t => {
  for (const manualAlias of [false, true]) await t.test(manualAlias ? 'external split ioBroker alias' : 'direct Devices alias', async child => {
    const setup = profileGuardSetup(true, manualAlias);
    const x = await pipeline(child, setup.options); await x.startup;
    await waitForView(x, view => view?.status?.active === true && view.emsCommissioning.state === 'ready');
    // All active row references in the external case use customer aliases;
    // only the production bounded resolver can discover the device identity.
    const entry = x.owner.eosModuleHost.entries.get('devices');
    const originalRuntime = entry.runtime;
    const originalConfig = clone(entry.config);
    const originalObject = clone(x.objects.get('eos-admin.0.modules.devices.configuration'));
    const rejected = await x.request('/api/eos/modules/devices', 'PUT', { config: setup.replacement });
    assert.equal(rejected.status, 400, rejected.text);
    assert.equal(rejected.data.error, 'EOS_DEVICES_PROFILE_IN_USE', rejected.text);
    assert.deepEqual(entry.config, originalConfig);
    assert.deepEqual(x.objects.get('eos-admin.0.modules.devices.configuration'), originalObject);
    assert.equal(entry.runtime, originalRuntime, 'rejected profile change cannot stop the current device transport');
    const deactivated = await setFarmEnabled(x, false);
    assert.equal(deactivated.status, 200, deactivated.text);
    const accepted = await x.request('/api/eos/modules/devices', 'PUT', { config: setup.replacement });
    assert.equal(accepted.status, 200, accepted.text);
    assert.equal(entry.config.devices[0].templateId, setup.replacement.devices[0].templateId);
    assert.equal(x.runtime().config.emsApps.apps.storagefarm.enabled, false);
  });
});

test('legacy in-process business pipeline: actual profile HTTP reservation blocks concurrent AppCenter activation and releases after a failed controller commit', { timeout: 90000 }, async t => {
  const setup = profileGuardSetup(false);
  const x = await pipeline(t, setup.options); await x.startup;
  await waitForView(x, view => view?.status?.active === true && view.emsCommissioning.state === 'ready');
  const entry = x.owner.eosModuleHost.entries.get('devices'); const originalRuntime = entry.runtime;
  const original = clone(entry.config);
  let release; let observed;
  const held = new Promise((_, reject) => { release = () => reject(new Error('QA controller persistence failed')); });
  const entered = new Promise(resolve => { observed = resolve; });
  const originalWrite = x.owner.setForeignObjectAsync;
  x.owner.setForeignObjectAsync = async (id, value) => {
    if (id === 'eos-admin.0.modules.devices.configuration') { observed(); await held; }
    return originalWrite(id, value);
  };
  t.after(() => { release(); x.owner.setForeignObjectAsync = originalWrite; });
  const saving = x.request('/api/eos/modules/devices', 'PUT', { config: setup.replacement });
  await Promise.race([entered, sleep(2000).then(() => assert.fail('profile save never reached the real controller commit'))]);
  try {
    const blocked = await setFarmEnabled(x, true);
    assert.equal(blocked.status, 409, blocked.text);
    assert.equal(blocked.data.error, 'Konfiguration wird bereits gespeichert.');
    assert.equal(x.runtime().config.emsApps.apps.storagefarm.enabled, false);
  } finally { release(); await saving; }
  const failed = await saving;
  assert.equal(failed.status, 400, failed.text);
  assert.deepEqual(entry.config, original);
  assert.equal(entry.runtime, originalRuntime);
  x.owner.setForeignObjectAsync = originalWrite;
  const accepted = await x.request('/api/eos/modules/devices', 'PUT', { config: setup.replacement });
  assert.equal(accepted.status, 200, accepted.text);
  assert.equal(entry.config.devices[0].templateId, setup.replacement.devices[0].templateId);
  const afterRelease = await setFarmEnabled(x, false);
  assert.equal(afterRelease.status, 200, afterRelease.text);
});

test('legacy in-process business pipeline: removing and reintroducing a device ID cannot reuse its still-active EMS references with another profile', { timeout: 90000 }, async t => {
  const setup = profileGuardSetup(true);
  const x = await pipeline(t, setup.options); await x.startup;
  await waitForView(x, view => view?.status?.active === true && view.emsCommissioning.state === 'ready');
  const removed = await x.request('/api/eos/modules/devices', 'PUT', { config: { ...setup.config, devices: [] } });
  assert.equal(removed.status, 200, removed.text);
  await waitForView(x, view => view?.status?.active === true && view.emsCommissioning.state === 'ready');
  const removedEnvelope = clone(x.objects.get('eos-admin.0.modules.devices.configuration'));
  const blocked = await x.request('/api/eos/modules/devices', 'PUT', { config: setup.replacement });
  assert.equal(blocked.status, 400, blocked.text);
  assert.equal(blocked.data.error, 'EOS_DEVICES_PROFILE_IN_USE');
  assert.deepEqual(x.owner.eosModuleHost.entries.get('devices').config.devices, []);
  assert.deepEqual(x.objects.get('eos-admin.0.modules.devices.configuration'), removedEnvelope);
  assert.equal((await setFarmEnabled(x, false)).status, 200);
  const accepted = await x.request('/api/eos/modules/devices', 'PUT', { config: setup.replacement });
  assert.equal(accepted.status, 200, accepted.text);
});

async function waitForState(x, id, value) {
  for (let i = 0; i < 100; i++) {
    if (x.states.get(`eos-admin.0.${id}`)?.val === value) return;
    await sleep(50);
  }
  assert.equal(x.states.get(`eos-admin.0.${id}`)?.val, value, JSON.stringify({ id,
    snapshot: x.runtime()?._nvpFreshnessSnapshot,
    farm: x.states.get('eos-admin.0.storageFarm.storagesStatusJson')?.val,
    powers: [...x.states].filter(([key]) => /\.aliases\.v1\.r\.(power|powerAc|essActivePower)$/.test(key)),
    logs: x.logs.slice(-10) }));
}

test('legacy in-process business pipeline: production Web bridge and actual hosted startup process device-save HTTP without manual reconciliation', { timeout: 90000 }, async t => {
  let measurement = { aCTIVE_POWER: 1.23, aCTIVE_CONSUMPTION_POWER: 1.23, aCTIVE_PRODUCTION_POWER: 0 };
  let disconnected = false;
  const x = await pipeline(t, { driverFactory: cfg => {
    if (cfg.id !== 'grid.sma') return null;
    return { lastSeen: 0, async readDatapoints() {
      if (disconnected) throw Object.assign(new Error('QA transport disconnected'), { code: 'ECONNRESET' });
      this.lastSeen = Date.now(); return clone(measurement);
    }, async disconnect() {}, async writeDatapoint() { throw new Error('QA_UNEXPECTED_PHYSICAL_WRITE'); } };
  } });
  await x.startup;
  assert.equal(x.owner.eosHostedRuntime.status().state, 'ready', JSON.stringify(x.logs.slice(-20)));
  const config = { enabled: true, devices: [
    { id: 'storage.home', name: 'FENECON', enabled: true, templateId: 'ess.fenecon.FeneconHomeEssImpl',
      protocol: 'modbusTcp', connection: {}, ems: { mode: 'storageFarm', scope: 'M0' } },
    { id: 'storage.solax', name: 'SolaX', enabled: true, templateId: 'ess.solax.SolaXHybridX1X3Ess',
      protocol: 'modbusTcp', connection: {}, ems: { mode: 'storageFarm', scope: 'M0' } },
    { id: 'grid.sma', name: 'SMA Netz', enabled: true, templateId: 'meter.sma.SmaEnergyMeterSpeedwireImpl',
      protocol: 'speedwire', pollIntervalMs: 250, connection: {}, ems: { mode: 'gridMeter', scope: 'M0' } },
  ] };
  const answer = await x.request('/api/eos/modules/devices', 'PUT', { config });
  assert.equal(answer.status, 200, answer.text);
  let view;
  for (let attempt = 0; attempt < 100; attempt++) {
    view = await x.request('/api/eos/modules/devices');
    if (view.data?.emsCommissioning?.state === 'ready') break;
    await sleep(50);
  }
  assert.equal(view.data?.emsCommissioning?.state, 'ready', JSON.stringify({ view: view.data, logs: x.logs.slice(-20) }));
  const saved = JSON.parse(x.states.get('eos-admin.0.installer.configJson').val);
  assert.equal(saved.storageFarm.storages.length, 2);
  assert.equal(saved.datapoints.gridPointPower, 'eos-admin.0.devices.grid.sma.aliases.v1.r.power');
  await waitForState(x, 'ems.gridMeasurementFresh', true);
  await waitForState(x, 'ems.gridPowerRawW', 1230);
  const importing = x.runtime()._nwResolveGridImportExportFromCache();
  assert.equal(importing.gridBuyW, 1230);
  assert.equal(importing.gridSellW, 0);
  measurement = { aCTIVE_POWER: -1.5, aCTIVE_CONSUMPTION_POWER: 0, aCTIVE_PRODUCTION_POWER: 1.5 };
  await waitForState(x, 'ems.gridPowerRawW', -1500);
  const exporting = x.runtime()._nwResolveGridImportExportFromCache();
  assert.equal(exporting.gridBuyW, 0);
  assert.equal(exporting.gridSellW, 1500);
  disconnected = true;
  await waitForState(x, 'devices.grid.sma.aliases.v1.comm.connected', false);
  await waitForState(x, 'ems.gridMeasurementFresh', false);
  assert.equal(x.writes.some(row => row.id.includes('.devices.') && row.state.ack === false), false);
});

test('legacy in-process business pipeline: one device HTTP save adopts the manual farm row, adds SolaX and SMA M0, and activates the corresponding app atomically', { timeout: 90000 }, async t => {
  const home = 'eos-admin.0.devices.storage.home';
  const manual = { id: 'customer-existing-storage', name: 'Kundenname beibehalten', enabled: true,
    vendorProfile: 'fenecon-openems', feneconControlMode: 'direct-ess', coupling: 'dc', maxChargeW: 4321,
    maxDischargeW: 4567, socId: `${home}.aliases.v1.r.soc`, signedPowerId: `${home}.aliases.v1.r.essActivePower`,
    setSignedPowerId: `${home}.aliases.v1.ctrl.powerSetpointW`, customerMemo: 'retain' };
  const x = await pipeline(t, { savedPatch: { storageFarm: { enabled: true, storages: [manual] },
    settings: { customerPreference: 'preserve' }, emsApps: { apps: { storagefarm: { installed: true, enabled: true } } } } });
  await x.startup;
  assert.equal(x.owner.eosHostedRuntime.status().state, 'ready', JSON.stringify(x.logs.slice(-20)));
  const activation = limits => ({ requested: true, requestId: crypto.randomUUID(), limits });
  // A currently active manual row already reserves the not-yet-created device ID.
  // Deactivate it before introducing that identity; the explicit request below
  // then validates, adopts and reactivates it in one coherent commissioning save.
  const prepared = await setFarmEnabled(x, false);
  assert.equal(prepared.status, 200, prepared.text);
  const config = { enabled: true, devices: [
    { id: 'storage.home', name: 'FENECON', enabled: true, templateId: 'ess.fenecon.FeneconHomeEssImpl',
      protocol: 'modbusTcp', connection: {}, ems: { mode: 'storageFarm', scope: 'M0',
        activation: activation({ maxChargeW: 4321, maxDischargeW: 4567, coupling: 'dc', capacityKWh: 10 }) } },
    { id: 'storage.solax', name: 'SolaX', enabled: true, templateId: 'ess.solax.SolaXHybridX1X3Ess',
      protocol: 'modbusTcp', connection: {}, ems: { mode: 'storageFarm', scope: 'M0',
        activation: activation({ maxChargeW: 3000, maxDischargeW: 3500, coupling: 'ac', capacityKWh: 10 }) } },
    { id: 'grid.sma', name: 'SMA Netz', enabled: true, templateId: 'meter.sma.SmaEnergyMeterSpeedwireImpl',
      protocol: 'speedwire', connection: {}, ems: { mode: 'gridMeter', scope: 'M0', activation: activation({}) } },
  ] };
  const beforeWrites = x.writes.length;
  const answer = await x.request('/api/eos/modules/devices', 'PUT', { config });
  assert.equal(answer.status, 200, answer.text);
  let view;
  for (let attempt = 0; attempt < 160; attempt++) {
    view = await x.request('/api/eos/modules/devices');
    if (view.data?.emsCommissioning?.state === 'ready' && view.data.emsCommissioning.statuses.length === 3) break;
    await sleep(50);
  }
  assert.equal(view.data?.emsCommissioning?.state, 'ready', JSON.stringify({ view: view.data, logs: x.logs.slice(-25) }));
  assert.equal(view.data?.status?.active, true);
  assert.equal(view.data.emsCommissioning.statuses.length, 3);
  const saved = JSON.parse(x.states.get('eos-admin.0.installer.configJson').val);
  assert.equal(saved.storageFarm.storages.length, 2);
  const existing = saved.storageFarm.storages.find(row => row.id === manual.id);
  assert.equal(existing.name, manual.name);
  assert.equal(existing.maxChargeW, manual.maxChargeW);
  assert.equal(existing.customerMemo, manual.customerMemo);
  assert.equal(saved.storageFarm.storages.every(row => row.enabled === true), true, JSON.stringify({ rows: saved.storageFarm.storages, ems: view.data.emsCommissioning }));
  assert.equal(saved.emsApps.apps.storagefarm.installed, true);
  assert.equal(saved.emsApps.apps.storagefarm.enabled, true);
  assert.equal(saved.datapoints.gridPointPower, 'eos-admin.0.devices.grid.sma.aliases.v1.r.power');
  assert.equal(saved.settings.customerPreference, 'preserve');
  const commits = x.writes.slice(beforeWrites).filter(row => row.id === 'eos-admin.0.installer.configJson');
  assert.equal(commits.length, 1, 'one device action commits one coherent EMS snapshot');
  // A completed scheduler cycle deliberately sends zero safety setpoints to
  // stale/unavailable stores. Checking before its first tick made this test
  // scheduling-dependent; a keepalive/heartbeat alone is not a completed tick.
  const completedTick = Number(x.runtime()._nwEmsSchedulerHealth?.lastTickEndMs || 0);
  for (let attempt = 0; attempt < 100
    && !(Number(x.runtime()._nwEmsSchedulerHealth?.lastTickEndMs || 0) > completedTick); attempt++) await sleep(50);
  assert.ok(Number(x.runtime()._nwEmsSchedulerHealth?.lastTickEndMs || 0) > completedTick,
    'the actual EMS scheduler must complete a new cycle before its offline dispatch is checked');
  const safetyTargets = new Set([`${home}.aliases.v1.ctrl.powerSetpointW`,
    'eos-admin.0.devices.storage.solax.aliases.v1.ctrl.powerSetpointW']);
  const unsafeCommands = x.writes.filter(row => row.id.includes('.devices.') && row.state.ack === false)
    .filter(row => !safetyTargets.has(row.id) || typeof row.state.val !== 'number'
      || !Number.isFinite(row.state.val) || row.state.val !== 0);
  assert.deepEqual(unsafeCommands, [],
    'missing/offline telemetry permits only numeric zero safety setpoints at the two configured signed-power endpoints');
  const installer = await x.request('/api/installer/config');
  assert.equal(installer.status, 200, installer.text);
  const stopped = await x.request('/api/installer/config', 'POST', {
    expectedConfigurationRevision: installer.data.configurationRevision,
    patch: { emsApps: { apps: { storagefarm: { installed: true, enabled: false } } } }, restartEms: true,
  });
  assert.equal(stopped.status, 200, stopped.text);
  const invalidPaths = [];
  const inspectJson = (value, key) => {
    if (value === undefined || typeof value === 'number' && !Number.isFinite(value)) invalidPaths.push(`${key}:${String(value)}`);
    else if (value && typeof value === 'object') for (const [childKey, child] of Object.entries(value)) inspectJson(child, `${key}.${childKey}`);
  };
  inspectJson(require('../src/lib/eosDeviceEmsService').projectDeviceEmsConfig(x.runtime().config), 'config');
  assert.deepEqual(invalidPaths, [], 'AppCenter must not poison the next device plan with invalid normalized values');
  const replay = await x.request('/api/eos/modules/devices', 'PUT', { config });
  assert.equal(replay.status, 200, replay.text);
  await waitForView(x, current => current?.emsCommissioning?.state === 'ready');
  const afterReplay = JSON.parse(x.states.get('eos-admin.0.installer.configJson').val);
  assert.equal(afterReplay.emsApps.apps.storagefarm.enabled, false, 'consumed activation must not override explicit AppCenter disable');
  assert.equal(afterReplay.storageFarm.storages.length, 2);
  assert.equal(afterReplay.storageFarm.storages.find(row => row.id === manual.id).customerMemo, 'retain');
  await x.owner.eosModuleHost.stop(); await x.owner.eosHostedRuntime.stop();
  await t.test('legacy in-process business pipeline: fresh hosted instance rehydrates the persisted device and EMS configuration without another setup call', async child => {
    const restarted = await pipeline(child, { persistedObjects: [...x.objects], persistedStates: [...x.states] });
    await restarted.startup;
    await waitForView(restarted, current => current?.status?.active === true && current.emsCommissioning.state === 'ready');
    const afterRestart = JSON.parse(restarted.states.get('eos-admin.0.installer.configJson').val);
    assert.deepEqual(afterRestart.storageFarm.storages, afterReplay.storageFarm.storages);
    assert.equal(afterRestart.emsApps.apps.storagefarm.enabled, false);
    assert.equal(afterRestart.settings.customerPreference, 'preserve');
    assert.equal(afterRestart.datapoints.gridPointPower, saved.datapoints.gridPointPower);
  });
});

test('legacy in-process business pipeline: HTTP rejects a new device ID during unknown hosted configuration hydration, then accepts the retained draft after readiness', { timeout: 90000 }, async t => {
  let release; let observed;
  const held = new Promise(resolve => { release = resolve; });
  const loading = new Promise(resolve => { observed = resolve; });
  t.after(() => release());
  const x = await pipeline(t, { beforeInstallerRead: async () => { observed(); await held; } });
  await loading;
  assert.equal(x.owner.eosHostedRuntime.status().state, 'starting');
  const saved = await x.request('/api/eos/modules/devices', 'PUT', { config: wallboxConfig() });
  assert.equal(saved.status, 400, saved.text);
  assert.equal(saved.data.error, 'EOS_DEVICES_PROFILE_CHECK_UNAVAILABLE');
  assert.equal(x.objects.has('eos-admin.0.modules.devices.configuration'), false);
  assert.equal(x.writes.some(row => row.id.includes('.devices.') && row.state.ack === false), false);
  release(); await x.startup;
  const accepted = await x.request('/api/eos/modules/devices', 'PUT', { config: wallboxConfig() });
  assert.equal(accepted.status, 200, accepted.text);
  const ready = await waitForView(x, view => view?.emsCommissioning?.state === 'ready' && view.emsCommissioning.statuses.length === 1);
  assert.equal(ready.status.active, true);
  assert.equal(JSON.parse(x.states.get('eos-admin.0.installer.configJson').val).settingsConfig.evcsList.length, 1);
});

test('legacy in-process business pipeline: late actual manifest event completes commissioning; telemetry bursts do not restart inventory scans', { timeout: 90000 }, async t => {
  const x = await pipeline(t, { aliasesVisible: false }); await x.startup;
  const saved = await x.request('/api/eos/modules/devices', 'PUT', { config: wallboxConfig() });
  assert.equal(saved.status, 200, saved.text);
  await waitForView(x, view => view?.emsCommissioning?.statuses?.some(row => row.status === 'pending'));
  x.revealAliases();
  const manifestId = 'eos-admin.0.devices.wallbox.aliases.meta.manifest';
  await x.owner.setForeignStateAsync(manifestId, x.states.get(manifestId));
  await waitForView(x, view => view?.emsCommissioning?.state === 'ready' && view.emsCommissioning.statuses.length === 1);
  const count = x.aliasReads.length;
  for (let i = 0; i < 250; i++) await x.owner.setForeignStateAsync('eos-admin.0.devices.wallbox.aliases.v1.r.power', { val: 1000 + i, ack: true });
  await sleep(350);
  assert.equal(x.aliasReads.length, count, 'normal telemetry must not rebuild the alias inventory');
});

test('legacy in-process business pipeline: running Devices retain an ownership lease while other modules initialize slowly', { timeout: 90000 }, async t => {
  const starts = [];
  const slowFactory = id => ({ validateConfig: config => config,
    createHostedModule: () => ({ async start() { starts.push(id); await sleep(7500); }, async stop() {}, async getStatus() { return {}; } }) });
  const x = await pipeline(t, { initialModules: { devices: { enabled: true, devices: [] }, eebus: { enabled: true }, backup: { enabled: true } },
    moduleFactories: { eebus: slowFactory('eebus'), backup: slowFactory('backup') } });
  for (let i = 0; i < 50 && !starts.includes('eebus'); i++) await sleep(50);
  assert(starts.includes('eebus'), JSON.stringify(x.logs));
  const entry = x.owner.eosModuleHost.entries.get('devices');
  const generation = entry.generation;
  assert.equal(x.owner.eosModuleHost.canOperate('devices', generation), true);
  await sleep(12500);
  assert(starts.includes('backup'));
  assert.equal(x.owner.eosModuleHost.canOperate('devices', generation), true,
    'an unrelated module startup must not starve the Devices ownership renewal');
  await x.startup;
  assert.equal((await x.request('/api/eos/modules/devices')).data.status.active, true);
});

test('legacy in-process business pipeline: real device polling keeps FENECON PV, converter feedback and battery flow distinct in an activated mixed farm', { timeout: 90000 }, async t => {
  // These are driver-decoded samples, not real Modbus frames or simulated physics.
  // The transport never changes measured power in response to a command acknowledgement.
  const measurements = {
    home: { bATTERY_POWER: 0, bATTERY_AC_POWER: 0, eSS0_ACTIVE_POWER: 5, eSS_SOC_IN: 60, sOC: 60,
      pV_DC_POWER: 5, pV_AC_POWER: 0, pV_POWER_SUM: 5, gRID_POWER: 1, lOAD_POWER: 6,
      mIN_POWER_SETPOINT: -5, mAX_POWER_SETPOINT: 5, State: 0, eSS0_STATE: 1 },
    solax: { bATTERY_POWER: 0, sOC: 55, pV_POWER: 0, aLLOWED_CHARGE_POWER: 3000,
      aLLOWED_DISCHARGE_POWER: 3500, vPP8_BATTERY_POWER_TARGET: 0 },
    grid: { aCTIVE_POWER: 1, aCTIVE_CONSUMPTION_POWER: 1, aCTIVE_PRODUCTION_POWER: 0 },
  };
  const physicalCommands = [];
  let gridOffline = false;
  const x = await pipeline(t, { driverFactory: cfg => ({ lastSeen: 0,
    async readDatapoints() {
      if (cfg.id === 'grid' && gridOffline) throw Object.assign(new Error('QA grid transport disconnected'), { code: 'ECONNRESET' });
      this.lastSeen = Date.now(); return clone(measurements[cfg.id]);
    },
    async writeDatapoint(dp, value) { physicalCommands.push({ device: cfg.id, dp: dp.id, value }); },
    async disconnect() {},
  }) });
  await x.startup;
  const activation = limits => ({ requested: true, requestId: crypto.randomUUID(), limits });
  const config = { enabled: true, devices: [
    { id: 'home', name: 'FENECON', enabled: true, templateId: 'ess.fenecon.FeneconHomeEssImpl',
      protocol: 'modbusTcp', pollIntervalMs: 250, connection: {}, ems: { mode: 'storageFarm', scope: 'M0',
        activation: activation({ maxChargeW: 4000, maxDischargeW: 4500, coupling: 'dc', capacityKWh: 10 }) } },
    { id: 'solax', name: 'SolaX', enabled: true, templateId: 'ess.solax.SolaXHybridX1X3Ess',
      protocol: 'modbusTcp', pollIntervalMs: 250, connection: {}, ems: { mode: 'storageFarm', scope: 'M0',
        activation: activation({ maxChargeW: 3000, maxDischargeW: 3500, coupling: 'ac', capacityKWh: 10 }) } },
    { id: 'grid', name: 'SMA', enabled: true, templateId: 'meter.sma.SmaEnergyMeterSpeedwireImpl',
      protocol: 'speedwire', pollIntervalMs: 250, connection: {}, ems: { mode: 'gridMeter', scope: 'M0', activation: activation({}) } },
  ] };
  const saved = await x.request('/api/eos/modules/devices', 'PUT', { config });
  assert.equal(saved.status, 200, saved.text);
  await waitForView(x, current => current?.emsCommissioning?.state === 'ready' && current.emsCommissioning.statuses.length === 3);
  await waitForState(x, 'storageFarm.powerSourcesOnline', 2);
  await waitForState(x, 'storageFarm.totalPowerW', 5000);
  await waitForState(x, 'storageFarm.totalBatteryPowerW', 0);
  await waitForState(x, 'derived.core.pv.totalW', 5000);
  const zeroBattery = x.runtime()._nwResolveBatteryFlowFromCache();
  assert.equal(zeroBattery.src, 'storageFarmNet');
  assert.equal(zeroBattery.chargeW, 0); assert.equal(zeroBattery.dischargeW, 0);
  assert.equal(x.runtime()._nwResolveStorageFarmMetricsFromCache().pvTotalW, 5000);

  await x.owner.setForeignStateAsync('eos-admin.0.devices.home.aliases.v1.ctrl.powerSetpointW', { val: 2000, ack: false });
  const commandedTwoKw = () => physicalCommands.some(row => row.device === 'home' && row.dp === 'sET_ACTIVE_POWER' && row.value === 2);
  for (let i = 0; i < 100 && !commandedTwoKw(); i++) await sleep(50);
  assert(commandedTwoKw(), 'actual device command handler converts the 2000 W alias command to the 2 kW driver target');
  assert.equal(x.states.get('eos-admin.0.devices.home.aliases.v1.r.essActivePower').val, 5000,
    'command acknowledgement is not converter feedback');
  assert.equal(x.states.get('eos-admin.0.devices.home.aliases.v1.r.power').val, 0,
    'command acknowledgement is not measured battery discharge');

  measurements.home.bATTERY_AC_POWER = -1; measurements.home.bATTERY_POWER = -1;
  measurements.home.eSS0_ACTIVE_POWER = 4; measurements.solax.bATTERY_POWER = -500;
  await waitForState(x, 'storageFarm.totalBatteryPowerW', -1500);
  await waitForState(x, 'storageFarm.totalPowerW', 3500);
  const charging = x.runtime()._nwResolveBatteryFlowFromCache();
  assert.equal(charging.chargeW, 1500); assert.equal(charging.dischargeW, 0);
  assert.equal(x.states.get('eos-admin.0.derived.core.pv.totalW').val, 5000);

  measurements.home.bATTERY_AC_POWER = 1; measurements.home.bATTERY_POWER = 1;
  measurements.home.eSS0_ACTIVE_POWER = 6; measurements.solax.bATTERY_POWER = 500;
  await waitForState(x, 'storageFarm.totalBatteryPowerW', 1500);
  await waitForState(x, 'storageFarm.totalPowerW', 6500);
  const discharging = x.runtime()._nwResolveBatteryFlowFromCache();
  assert.equal(discharging.chargeW, 0); assert.equal(discharging.dischargeW, 1500);
  assert.equal(x.states.get('eos-admin.0.derived.core.pv.totalW').val, 5000);
  gridOffline = true;
  await waitForState(x, 'devices.grid.aliases.v1.comm.connected', false);
  await waitForState(x, 'ems.gridMeasurementFresh', false);
  const afterFailure = physicalCommands.length;
  await sleep(1300);
  assert.equal(physicalCommands.slice(afterFailure).some(command =>
    ['sET_ACTIVE_POWER', 'sET_GRID_ACTIVE_POWER'].includes(command.dp) && Number(command.value) !== 0), false,
  'an active farm may send a safe zero command, but no nonzero power request after known NVP transport loss');
});
