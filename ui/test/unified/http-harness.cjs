'use strict';
/** Actual hosted HTTP routes; database and host-confirmed sessions are fixtures.
 * This does not test central OAuth or real device communication. */
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module');
const http = require('node:http'), crypto = require('node:crypto');
const { UnifiedSessions } = require('../../../src/lib/eosUnifiedBoundary');
const filename = path.resolve(__dirname, '../../main.js');
const compiled = new Module(filename, module);
compiled.filename = filename; compiled.paths = Module._nodeModulePaths(path.dirname(filename));
compiled._compile(fs.readFileSync(filename, 'utf8') + '\nmodule.exports.TestRuntime = NexoWattVis;\n', filename);
const Runtime = compiled.exports.TestRuntime;
async function createHarness(options = {}) {
  const states = new Map(), objects = new Map(), sessions = new Map(), saved = [];
  const namespace = 'eos-admin.0';
  const qualified = id => id.startsWith(namespace + '.') ? id : namespace + '.' + id;
  const write = (id, state, ack) => {
    const value = state && typeof state === 'object' && Object.hasOwn(state, 'val') ? state : { val: state, ack: !!ack };
    states.set(id, { ...value, ts: Date.now(), lc: Date.now() });
  };
  const owner = { namespace, instance: 0, config: { port: 8188, eosUi: {},
    ...(options.legacyNamespace ? { eosUiMigration: { preserveNamespace: true, source: options.legacyNamespace } } : {}) },
    log: { info() {}, warn() {}, error() {}, debug() {} },
    getStateAsync: async id => states.get(qualified(id)) || null,
    setStateAsync: async (id, value, ack) => write(qualified(id), value, ack),
    setStateChangedAsync: async (id, value, ack) => write(qualified(id), value, ack),
    getForeignStateAsync: async id => states.get(id) || null,
    setForeignStateAsync: async (id, value, ack) => write(id, value, ack),
    getForeignObjectAsync: async id => objects.get(id) || null,
    setForeignObjectAsync: async (id, obj) => objects.set(id, structuredClone(obj)),
    setForeignObjectNotExistsAsync: async (id, obj) => { if (!objects.has(id)) objects.set(id, structuredClone(obj)); },
    extendForeignObjectAsync: async (id, patch) => { const old = objects.get(id) || {}; objects.set(id, { ...old, ...patch, common: { ...old.common, ...patch.common } }); },
    getObjectAsync: async id => objects.get(qualified(id)) || null,
    setObjectNotExistsAsync: async (id, obj) => { if (!objects.has(qualified(id))) objects.set(qualified(id), structuredClone(obj)); },
    extendObjectAsync: async (id, patch) => { const old = objects.get(qualified(id)) || {}; objects.set(qualified(id), { ...old, ...patch }); },
    getForeignObjectsAsync: async () => ({}), getStatesAsync: async () => ({}), getForeignStatesAsync: async () => ({}),
    getObjectViewAsync: async () => ({ rows: [] }),
    subscribeForeignStatesAsync: async () => {}, subscribeStatesAsync: async () => {},
    subscribeForeignObjectsAsync: async () => {}, subscribeStates() {},
    setTimeout, clearTimeout, setInterval, clearInterval,
  };
  const policy = new UnifiedSessions(owner, { secure: false, externalOrigin: '', getLicense: () => null,
    resolveAccess: async () => ({}), firstLogin: async () => ({ required: false }) });
  const bridge = {
    originAllowed: req => policy.requestAllowed(req), canWrite: () => true,
    getLicense: () => ({ valid: true, coreEnabled: true, edition: 'home', limits: { chargePoints: 3, batteries: 2 }, features: ['energy','wallet','smartHome','microgridSlave'] }),
    resolveAccess: async req => sessions.get(String(req.headers.cookie || '').replace(/^fixture=/, '')) || null,
  };
  const adapter = new Runtime({ owner, bridge });
  adapter.config = { auth: {}, accessControl: {}, smartHomeConfig: { version: 3, floors: [], rooms: [], functions: [], devices: [], pages: [], scenes: [], meta: {} } };
  adapter._nwLicenseOk = true;
  // This route fixture represents an already loaded runtime; lifecycle tests
  // use createHostedRuntime/the real child and exercise hydration separately.
  adapter._nwInstallerConfigHydrated = true;
  adapter._nwRefreshLicenseFromConfiguredKey = async () => {};
  adapter.scheduleDerivedFlowUpdate = () => {};
  adapter.persistInstallerConfigToState = async patch => saved.push(structuredClone(patch));
  await adapter.startServer();
  const server = http.createServer((req,res) => adapter._hostedApp(req,res));
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const login = async user => {
    const token = crypto.randomBytes(24).toString('hex');
    const role = user === 'kunde' ? 'customer' : user;
    const capabilities = role === 'admin' ? ['*'] : role === 'installer'
      ? ['frontend.open','appcenter.open','mapping.edit','chargepoints.configure','mesh.configure','exportGuard.configure','smarthome.configure','nexologic.configure','diagnostics.open','energyWallet.customerSettings']
      : ['frontend.open','energyWallet.customerSettings'];
    sessions.set(token, { authenticated: true, user: 'system.user.' + user, role, capabilities,
      groups: [], mustChangePassword: false, credentialKey: token, csrfToken: token });
    return token;
  };
  async function request(url, { token, method = 'GET', body, headers = {}, csrf = true, redirect = 'follow' } = {}) {
    const response = await fetch(base + url, { method, redirect, headers: {
      Origin: base, ...(token ? { Cookie: 'fixture=' + token } : {}),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(token && csrf ? { 'X-NW-CSRF': typeof csrf === 'string' ? csrf : token } : {}), ...headers,
    }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const text = await response.text(); let data; try { data=JSON.parse(text); } catch {}
    return { status: response.status, response, headers: response.headers, text, data };
  }
  const close = async () => { adapter._nwCloseSseClients(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); };
  return { adapter, owner, bridge, request, login, base, saved, close, objects, states };
}
module.exports = { createHarness };
