#!/usr/bin/env node
/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
'use strict';
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Prüft den ausgelieferten startServer-/Unload-Pfad über echte lokale
 * HTTP-/HTTPS-Sockets einschließlich Login, Rollen, CSRF, PWA und TLS-Startfehlern.
 * Daten und Wirkung: Controller-Konten, Zertifikatsabruf und Gerätedaten sind
 * lokale Doubles. Express, TLS, HTTP-Routen und Sitzungen bleiben Produktcode.
 * Die zusätzlichen onReady-Fälle führen den tatsächlichen Startablauf aus und
 * protokollieren nachgelagerte Fachinitialisierungen an expliziten Ersatzgrenzen;
 * sie prüfen deren Erreichbarkeit, keine EMS-/Hardware-Regelzyklen.
 * Eine eigene temporäre CA signiert ein Zertifikat mit IP-SAN 127.0.0.1. Clients
 * vertrauen ausdrücklich dieser CA; die Zertifikatsprüfung bleibt eingeschaltet.
 * Alle Schlüssel entstehen zur Laufzeit außerhalb des Repositorys und werden
 * im finally-Pfad entfernt. Der optionale Bericht enthält ausschließlich Hashes,
 * Testnamen und Zähler. Kein Browser-/PWA-Installationstest und kein Hardwaretest.
 * Bei Änderungen: Nach dem Runtime-Build ausführen; echte TLS-Prüfung, geschützte
 * Controller-Grenzen und vollständiges Aufräumen beibehalten. Quellen dürfen sich
 * während eines Laufs nicht ändern. Ein Bericht gilt nur für seine Datei-Hashes.
 */
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const https = require('node:https');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');
const { spawnSync } = require('node:child_process');
const ROOT = path.resolve(__dirname, '..');
const HOST = '127.0.0.1';
const checks = [];
let requestCount = 0;
const verifiedFiles = ['main.js', 'src-ts/runtime-executables/main.ts', 'lib/ui-server-transport.js', 'src-ts/runtime-executables/lib/ui-server-transport.ts',
  'lib/ui-access-policy.js', 'www/index.html', 'www/runtime-base.js', 'www/auth.js', 'www/login.html', 'www/login.js', 'www/login.css', 'www/pwa.js', 'www/manifest.webmanifest', 'www/sw.js',
  'www/nexowatt-eos-logo.png', 'www/apple-touch-icon.png', 'scripts/verify-ui-direct-https.cjs',
  ...fs.readdirSync(path.join(ROOT, 'www/assets/icons')).filter(file => file.endsWith('.png')).map(file => 'www/assets/icons/' + file)];
const fileHashes = () => Object.fromEntries(verifiedFiles.map(file => [file, crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, file))).digest('hex')]));
const initialSourceHashes = fileHashes();

/** Einziger Ersatz für den lokalen Controller; keine Express-/TLS-Abkürzung. */
class ControllerDouble extends EventEmitter {
  constructor(options = {}) {
    super();
    this.name = options.name || 'nexowatt-ui';
    this.namespace = this.name + '.0';
    this.config = {};
    this.stateCache = {};
    this.fixtureStates = new Map();
    this.fixtureObjects = new Map();
    this.fixtureLogs = [];
    this.log = Object.fromEntries(['debug', 'info', 'warn', 'error', 'silly'].map(level => [level, message => { this.fixtureLogs.push(String(message)); }]));
  }
  async setObjectNotExistsAsync() {}
  async getStateAsync(id) { return this.fixtureStates.get(String(id)) || null; }
  async setStateAsync(id, input, ack) {
    const wrapped = input && typeof input === 'object' && Object.hasOwn(input, 'val');
    const value = wrapped ? input.val : input;
    const record = { val: value, ack: wrapped ? input.ack === true : ack === true, ts: Date.now(), lc: Date.now() };
    this.fixtureStates.set(String(id), record);
  }
  async getForeignObjectAsync(id) { return this.fixtureObjects.get(String(id)) || null; }
  async getObjectAsync(id) { return this.fixtureObjects.get(String(id)) || null; }
  async getForeignStateAsync(id) { return this.fixtureStates.get(String(id)) || null; }
  async getForeignObjectsAsync() { return {}; }
  async getForeignStatesAsync() { return {}; }
  async delObjectAsync(id) { this.fixtureObjects.delete(String(id)); }
  async subscribeStatesAsync() {}
  async subscribeForeignStatesAsync() {}
  async setForeignStateAsync(id, value, ack) { return this.setStateAsync(id, value, ack); }
  setTimeout(fn, ms) { return setTimeout(fn, ms); }
  setInterval(fn, ms) { return setInterval(fn, ms); }
  clearTimeout(ref) { clearTimeout(ref); }
  clearInterval(ref) { clearInterval(ref); }
}

const controllerDataDirectories = new WeakMap();
const controllerModule = {
  Adapter: ControllerDouble,
  getAbsoluteInstanceDataDir(adapter) {
    const directory = controllerDataDirectories.get(adapter);
    assert.equal(typeof directory, 'string', 'controller data directory must be a declared temporary fixture');
    return directory;
  },
};

function loadShippedAdapter() {
  const originalLoad = Module._load;
  try {
    Module._load = function loadControllerBoundary(request, ...args) {
      if (request === '@iobroker/adapter-core') return controllerModule;
      return originalLoad.call(this, request, ...args);
    };
    return require(path.join(ROOT, 'main.js'));
  } finally { Module._load = originalLoad; }
}
const adapterFactory = loadShippedAdapter();

const drain = () => new Promise(resolve => setImmediate(resolve));
async function check(name, verify) {
  const started = performance.now();
  await verify();
  checks.push({ name, result: 'PASS', durationMs: Math.round(performance.now() - started) });
  console.log('PASS ' + name);
}

/** Kurzzeitig reservierter Loopback-Port; Produktlisten() bekommt die echte Nummer. */
async function freePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, HOST, resolve); });
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}

function certificateFixture() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nexowatt-direct-https-'));
  fs.chmodSync(directory, 0o700);
  const file = name => path.join(directory, name);
  const openssl = args => {
    const result = spawnSync('openssl', args, { stdio: 'pipe', timeout: 15000, maxBuffer: 256 * 1024 });
    assert.equal(result.status, 0, 'OpenSSL must generate temporary integration certificates successfully');
  };
  try {
    openssl(['req', '-x509', '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:P-256', '-nodes', '-days', '1',
      '-subj', '/CN=NexoWatt temporary integration CA', '-addext', 'basicConstraints=critical,CA:TRUE',
      '-addext', 'keyUsage=critical,keyCertSign,cRLSign', '-keyout', file('ca.key'), '-out', file('ca.pem')]);
    openssl(['req', '-new', '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:P-256', '-nodes',
      '-subj', '/CN=127.0.0.1', '-keyout', file('server.key'), '-out', file('server.csr')]);
    fs.writeFileSync(file('server.ext'), 'basicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature\nextendedKeyUsage=serverAuth\nsubjectAltName=IP:127.0.0.1\n');
    const sign = (output, days, issuer = 'ca') => openssl(['x509', '-req', '-in', file('server.csr'), '-CA', file(issuer + '.pem'), '-CAkey', file(issuer + '.key'),
      '-set_serial', '0x' + crypto.randomBytes(16).toString('hex'), '-days', String(days), '-extfile', file('server.ext'), '-out', file(output)]);
    sign('server.pem', 1);
    sign('expired.pem', 0);
    openssl(['req', '-new', '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:P-256', '-nodes',
      '-subj', '/CN=NexoWatt temporary intermediate CA', '-keyout', file('intermediate.key'), '-out', file('intermediate.csr')]);
    fs.writeFileSync(file('intermediate.ext'), 'basicConstraints=critical,CA:TRUE,pathlen:0\nkeyUsage=critical,keyCertSign,cRLSign\nsubjectKeyIdentifier=hash\nauthorityKeyIdentifier=keyid,issuer\n');
    openssl(['x509', '-req', '-in', file('intermediate.csr'), '-CA', file('ca.pem'), '-CAkey', file('ca.key'),
      '-set_serial', '0x' + crypto.randomBytes(16).toString('hex'), '-days', '1', '-extfile', file('intermediate.ext'), '-out', file('intermediate.pem')]);
    sign('intermediate-server.pem', 1, 'intermediate');
    openssl(['genpkey', '-algorithm', 'EC', '-pkeyopt', 'ec_paramgen_curve:P-256', '-out', file('other.key')]);
    for (const name of ['ca.key', 'server.key', 'intermediate.key', 'other.key']) fs.chmodSync(file(name), 0o600);
    const read = name => fs.readFileSync(file(name), 'utf8');
    const key = read('server.key'), cert = read('server.pem'), ca = read('ca.pem');
    assert.equal(new crypto.X509Certificate(cert).checkIP(HOST), HOST, 'server fixture contains the actual IP SAN');
    assert(new Date(new crypto.X509Certificate(read('expired.pem')).validTo).getTime() < Date.now(), 'expired fixture is already invalid');
    return { directory, key, cert, ca, otherKey: read('other.key'), expired: read('expired.pem'),
      intermediate: read('intermediate.pem'), intermediateCert: read('intermediate-server.pem'),
      cleanup: () => fs.rmSync(directory, { recursive: true, force: true }) };
  } catch (error) { fs.rmSync(directory, { recursive: true, force: true }); throw error; }
}

async function makeHarness(certificates, { config = {}, certificateResult, certificateReader, port } = {}) {
  const adapter = adapterFactory({});
  controllerDataDirectories.set(adapter, path.join(certificates.directory, 'controller-' + crypto.randomBytes(8).toString('hex')));
  const actualPort = port ?? await freePort();
  const password = crypto.randomBytes(32).toString('hex');
  const accounts = new Map();
  const groups = new Map();
  const certificateCalls = [];
  const writes = [];
  adapter.config = {
    ip: HOST, port: actualPort, secure: true, certPublic: 'fixture-public', certPrivate: 'fixture-private', certChained: 'fixture-chain',
    auth: { enabled: true, mode: 'iobroker' }, accessControl: { customerWritePolicy: 'session' },
    smartHomeConfig: { version: 3, floors: [], rooms: [], functions: [], devices: [], pages: [], scenes: [], meta: {} },
    ...config,
  };
  adapter._nwLicenseOk = true;
  adapter._nwLicenseInfo = { ok: true, edition: 'hems', type: 'full' };
  adapter._nwSystemUuid = 'integration-fixture-uuid';
  adapter._nwRefreshLicenseFromConfiguredKey = async () => {};
  adapter._nwGetConfiguredLicenseKey = async () => ({ key: 'integration-fixture-license' });
  adapter.scheduleDerivedFlowUpdate = () => {};
  for (const user of ['admin', 'installer', 'kunde']) {
    const record = { _id: 'system.user.' + user, type: 'user', common: { name: user, enabled: true, password: crypto.randomBytes(32).toString('hex') } };
    accounts.set(user, record); adapter.fixtureObjects.set(record._id, record);
  }
  for (const [group, user] of [['administrator', 'admin'], ['installer', 'installer'], ['user', 'kunde']]) {
    const record = { _id: 'system.group.' + group, type: 'group', common: { name: group, members: ['system.user.' + user] } };
    groups.set(group, record); adapter.fixtureObjects.set(record._id, record);
  }
  adapter.getUserID = async name => accounts.get(name)?._id;
  adapter.checkPassword = (id, supplied, callback) => callback(accounts.has(String(id).slice('system.user.'.length)) && supplied === password, id);
  adapter.getCertificates = certificateReader === null ? undefined : (...args) => {
    certificateCalls.push(args.slice(0, 3));
    if (certificateReader) return certificateReader(...args);
    const callback = args[3];
    callback(null, certificateResult || { key: certificates.key, cert: certificates.cert, ca: certificates.ca }, false);
  };
  adapter.smartHomeDevices = [{ id: 'fixture-light', type: 'switch', io: { switch: { readId: 'fixture.light', writeId: 'fixture.light' } }, behavior: {} }];
  adapter.fixtureObjects.set('fixture.light', { _id: 'fixture.light', type: 'state', common: { name: 'Testlicht', type: 'boolean', role: 'switch', read: true, write: true } });
  adapter.setForeignStateAsync = async (...args) => { writes.push(args); };
  adapter.persistInstallerConfigToState = async () => {};
  let unloadCount = 0;
  let closed = false;
  const base = () => `${adapter.config.secure === true ? 'https' : 'http'}://${HOST}:${actualPort}`;

  /** Echter HTTP-Client; keine Redirect-Verfolgung und kein TLS-Ausnahmeflag. */
  function request(url, { method = 'GET', body, headers = {}, cookie, csrf, protocol, trustCa = true, servername, minVersion, maxVersion } = {}) {
    requestCount += 1;
    const target = new URL(url, base());
    if (protocol) target.protocol = protocol;
    const payload = body === undefined ? null : Buffer.from(JSON.stringify(body));
    return new Promise((resolve, reject) => {
      const secure = target.protocol === 'https:';
      const transport = secure ? https : http;
      const req = transport.request(target, {
        method, agent: false,
        ...(secure ? { rejectUnauthorized: true, ...(trustCa ? { ca: certificates.ca } : {}),
          ...(servername ? { servername } : {}), ...(minVersion ? { minVersion } : {}), ...(maxVersion ? { maxVersion } : {}) } : {}),
        headers: { ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': payload.byteLength } : {}),
          ...(cookie ? { Cookie: cookie } : {}), ...(csrf ? { 'X-NW-CSRF': csrf } : {}), ...headers },
      });
      const timer = setTimeout(() => req.destroy(new Error('Local integration HTTP timeout')), 3000);
      req.once('error', error => { clearTimeout(timer); reject(error); });
      req.once('response', response => {
        const chunks = []; let size = 0;
        const authorized = response.socket.authorized;
        const negotiatedProtocol = response.socket.getProtocol?.();
        response.on('data', chunk => {
          size += chunk.length;
          if (size > 4 * 1024 * 1024) { response.destroy(new Error('Fixture response exceeds its bounded read')); return; }
          chunks.push(chunk);
        });
        response.once('error', error => { clearTimeout(timer); reject(error); });
        response.once('end', () => {
          clearTimeout(timer);
          const bytes = Buffer.concat(chunks); const text = bytes.toString('utf8');
          let data; try { data = JSON.parse(text); } catch {}
          resolve({ status: response.statusCode, headers: response.headers, bytes, text, data, authorized, negotiatedProtocol });
        });
      });
      req.end(payload);
    });
  }

  const start = async () => { await adapter.startServer(); return api; };
  const login = async (user = 'kunde') => {
    const result = await request('/api/auth/login', { method: 'POST', body: { user, password } });
    assert.equal(result.status, 200, 'real login route must accept the controller fixture account');
    const setCookie = (result.headers['set-cookie'] || []).find(value => value.startsWith(adapter._nwAuthCookieName + '='));
    assert(setCookie, 'real login creates its instance-bound cookie');
    assert.match(setCookie, /;\s*HttpOnly(?:;|$)/i);
    assert.match(setCookie, /;\s*SameSite=Lax(?:;|$)/i);
    assert.equal(/;\s*Secure(?:;|$)/i.test(setCookie), adapter.config.secure === true);
    assert.equal(typeof result.data.csrfToken, 'string'); assert(result.data.csrfToken.length >= 16);
    return { cookie: setCookie.split(';')[0], csrf: result.data.csrfToken, result };
  };
  const close = async () => {
    if (closed) return;
    closed = true;
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Product unload exceeded its integration budget')), 2200);
      adapter.onUnload(() => { unloadCount += 1; clearTimeout(timer); resolve(); });
    });
    await drain();
    assert.equal(unloadCount, 1, 'product unload callback fires exactly once');
  };
  const api = { adapter, port: actualPort, base, accounts, groups, certificateCalls, writes, password, request, start, login, close,
    get unloadCount() { return unloadCount; } };
  return api;
}

/**
 * onReady bleibt unverändert: Nur nachgelagerte Fachinitialisierungen werden als
 * Aufrufgrenzen beobachtet, statt Gerätezyklen zu starten. Mesh, Forecast und
 * Übersichts-Publisher arbeiten mit leerer Konfiguration und lokalen Controller-
 * Daten. Der Zertifikatsabruf und startServer bleiben echte Produktmethoden.
 */
function readyLifecycleHarness(h) {
  const adapter = h.adapter, calls = [], connectionChanges = [];
  const realReady = adapter.onReady, realStart = adapter.startServer;
  const initBoundaries = [
    'migrateNativeConfig', 'ensureInfoConnectionState', 'ensureLicenseStates', '_nwInitLicense',
    'ensureInstallerStates', 'ensureSettingsStates', 'ensureSmartHomeUserStates', 'ensureSimulationStates',
    'ensureWeatherStates', 'ensureEnergyTotalStates', 'ensureNotificationStates', 'loadInstallerConfigFromState',
    '_nwStartPartnerRuntime', '_nwRefreshSystemLanguage', 'ensureStorageFarmStates', 'syncStorageFarmDefaultsToStates',
    'syncStorageFarmConfigFromAdmin', 'syncInstallerConfigToStates', 'syncSettingsToStates', 'syncSettingsConfigToStates',
    'subscribeForecastUiStates', 'ensureEvcsStates', 'ensureRfidStates', 'ensureEvcsSessionsStates', 'loadEvcsSessionsCache',
    'seedEvcsDayBaseCache', 'subscribeEvcsMappedStates', 'scheduleRfidPolicyApply', 'subscribeConfiguredStates',
    'startWeatherService', 'ensureDerivedFlowStates', 'scheduleDerivedFlowUpdate', 'startNotificationMonitor',
    'ensureHistorieExportStates', 'updateHistorieExportStates', 'startHistorieExportTimer', 'initEmsEngine',
    'subscribeEmsUiStates', '_nwStartLiveCoreRefresh', '_nwRefreshLiveCoreDatapoints', 'cleanupOrphanedObjects',
    'updateEnergyTotalsFromInflux', 'buildSmartHomeDevicesFromConfig', 'loadSmartHomeTimersFromState',
    'loadSmartHomeLogicClocksFromState', 'initLogicEngine', '_nwStartConnectionHeartbeat',
  ];
  for (const name of initBoundaries) {
    assert.equal(typeof adapter[name], 'function', 'expected initialization boundary: ' + name);
    adapter[name] = async () => { calls.push(name); };
  }
  adapter._nwGetStorageFarmRuntimeInfo = () => ({ active: false });
  adapter._para14aEebusApi.init = async () => { calls.push('eebus.init'); };
  const setConnection = adapter._nwSetInfoConnection.bind(adapter);
  adapter._nwSetInfoConnection = async (value, reason) => {
    connectionChanges.push({ value, reason });
    return setConnection(value, reason);
  };
  const run = async () => {
    assert.equal(adapter.onReady, realReady);
    assert.equal(adapter.startServer, realStart);
    const originalLoad = Module._load;
    try {
      // Mesh resolves this controller utility lazily during the real onReady.
      Module._load = function loadControllerBoundary(request, ...args) {
        if (request === '@iobroker/adapter-core') return controllerModule;
        return originalLoad.call(this, request, ...args);
      };
      await adapter.onReady();
    } finally { Module._load = originalLoad; }
  };
  return { run, calls, connectionChanges };
}

async function waitForCertificateReader(promise) {
  let timer;
  try {
    await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('Actual startup did not reach the controller certificate reader')), 2000);
    })]);
  } finally { clearTimeout(timer); }
}

async function withServer(certificates, options, verify) {
  const h = await makeHarness(certificates, options);
  try { await h.start(); await verify(h); } finally { await h.close(); }
}

function portAcceptsConnections(port) {
  return new Promise(resolve => {
    const socket = net.connect({ host: HOST, port });
    const finish = connected => { socket.destroy(); resolve(connected); };
    socket.setTimeout(700, () => finish(false));
    socket.once('connect', () => finish(true)); socket.once('error', () => finish(false));
  });
}

async function expectClosedStart(certificates, options, verifyError) {
  const h = await makeHarness(certificates, options);
  try {
    let failure;
    try { await h.start(); } catch (error) { failure = error; }
    assert(failure instanceof Error, 'invalid TLS configuration must reject actual startServer');
    if (verifyError) await verifyError(failure, h);
    assert.equal(Boolean(h.adapter.server?.listening), false, 'invalid TLS never leaves a listening server');
    assert.equal(await portAcceptsConnections(h.port), false, 'configured port remains closed; no HTTP fallback');
    for (const text of [String(failure.message), ...h.adapter.fixtureLogs]) {
      assert(!text.includes('BEGIN PRIVATE KEY') && !text.includes('BEGIN EC PRIVATE KEY'), 'private PEM never enters startup diagnostics');
      assert(!text.includes('PRIVATE-CONTROLLER-ERROR'), 'untrusted controller error details are not exposed');
    }
    return { h, failure };
  } finally { await h.close(); }
}

function openSse(h, certificates, session) {
  return new Promise((resolve, reject) => {
    const request = https.get(new URL('/events', h.base()), { ca: certificates.ca, rejectUnauthorized: true, agent: false, headers: { Cookie: session.cookie } });
    const timer = setTimeout(() => request.destroy(new Error('SSE initial frame missing')), 2000);
    request.once('error', error => { clearTimeout(timer); reject(error); });
    request.once('response', response => {
      if (response.statusCode !== 200) { request.destroy(); clearTimeout(timer); reject(new Error('Authenticated SSE route rejected fixture')); return; }
      let text = '';
      const closed = new Promise(done => { response.once('close', done); });
      response.on('data', chunk => {
        text += chunk.toString('utf8');
        if (text.includes('data: ')) { clearTimeout(timer); resolve({ request, response, closed }); }
      });
      response.on('error', () => {});
    });
  });
}

/** Kleine DOM-Hülle; Fetch-Antworten und CSRF stammen vollständig vom echten HTTPS-Server. */
async function bootAuthAgainstHttps(h, session) {
  const nodes = new Map(), listeners = new Map(), timeouts = new Set(), intervals = new Set();
  const redirects = [], calls = [];
  class Element {
    constructor(tag = 'div') {
      this.tagName = tag.toUpperCase(); this.children = []; this.attributes = new Map(); this.hidden = false; this.inert = false;
      this.style = { removeProperty(key) { delete this[key]; } }; this.classes = new Set();
      this.classList = { add: value => this.classes.add(value), remove: value => this.classes.delete(value), contains: value => this.classes.has(value) };
    }
    set id(value) { this._id = value; nodes.set(value, this); }
    get id() { return this._id; }
    set innerHTML(value) { if (value.includes('nw-auth-actions')) { this.paragraph = new Element('p'); this.actions = new Element(); } }
    appendChild(node) { this.children.push(node); return node; }
    append(...children) { this.children.push(...children); }
    replaceChildren(...children) { this.children = children; }
    setAttribute(key, value) { this.attributes.set(key, value); }
    getAttribute(key) { return this.attributes.get(key) ?? null; }
    removeAttribute(key) { this.attributes.delete(key); }
    querySelector(selector) { return selector === 'p' ? this.paragraph : selector === '.nw-auth-actions' ? this.actions : null; }
    addEventListener() {}
  }
  const body = new Element('body'), header = new Element('header'), content = new Element('main');
  body.append(header, content);
  const location = new URL('/', h.base()); location.replace = target => redirects.push(String(target));
  const document = { body, head: new Element('head'), documentElement: new Element('html'), hidden: false, readyState: 'loading', baseURI: location.href,
    getElementById: id => nodes.get(id) || null, createElement: tag => new Element(tag), querySelectorAll: () => [],
    querySelector: selector => selector === 'header.topbar' ? header : selector === '#nwAuthGate .nw-auth-actions' ? nodes.get('nwAuthGate')?.actions : null,
    addEventListener: (event, fn) => listeners.set('document:' + event, fn) };
  const navigator = { onLine: true, serviceWorker: { controller: { postMessage() {} } } };
  // Nur der Netzwerkadapter hält das durch echten Login erhaltene HttpOnly-Cookie.
  // Der Auth-Code erhält weder das Cookie noch einen vorgegebenen CSRF-Token.
  let cookie = session.cookie;
  const nativeFetch = async (input, init = {}) => {
    const target = new URL(input instanceof Request ? input.url : input instanceof URL ? input.href : input, location.href);
    assert.equal(target.origin, h.base(), 'frontend integration never connects to an external host');
    const method = init.method || (input instanceof Request ? input.method : 'GET');
    const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));
    let rawBody = init.body;
    if (rawBody === undefined && input instanceof Request && !['GET', 'HEAD'].includes(method.toUpperCase())) rawBody = await input.clone().text();
    calls.push({ path: target.pathname, method: method.toUpperCase(), csrf: headers.get('X-NW-CSRF') });
    const response = await h.request(target.pathname + target.search, { method, cookie,
      ...(rawBody === undefined ? {} : { body: JSON.parse(String(rawBody)) }),
      headers: { ...Object.fromEntries(headers), ...(!['GET', 'HEAD'].includes(method.toUpperCase()) ? { Origin: h.base() } : {}) } });
    for (const value of response.headers['set-cookie'] || []) {
      if (value.startsWith(h.adapter._nwAuthCookieName + '=')) cookie = value.includes('Max-Age=0') ? '' : value.split(';')[0];
    }
    const responseHeaders = new Headers();
    for (const [key, value] of Object.entries(response.headers)) if (value !== undefined && key !== 'set-cookie') responseHeaders.set(key, Array.isArray(value) ? value.join(', ') : String(value));
    return new Response(response.bytes, { status: response.status, headers: responseHeaders });
  };
  const window = { location, document, navigator, fetch: nativeFetch, HTMLElement: Element, URL, URLSearchParams, Request, Response, Headers, AbortController, TextDecoder, CustomEvent, Uint8Array, console,
    setTimeout(fn, ms) { const timer = setTimeout(() => { timeouts.delete(timer); fn(); }, ms); timeouts.add(timer); return timer; },
    clearTimeout(timer) { timeouts.delete(timer); clearTimeout(timer); },
    setInterval(fn, ms) { const timer = setInterval(fn, ms); intervals.add(timer); return timer; },
    clearInterval(timer) { intervals.delete(timer); clearInterval(timer); },
    addEventListener: (event, fn) => listeners.set('window:' + event, fn), dispatchEvent() {} };
  window.window = window; window.self = window; window.top = window;
  const context = vm.createContext(window);
  const close = () => { for (const timer of timeouts) clearTimeout(timer); for (const timer of intervals) clearInterval(timer); };
  try {
    for (const name of ['runtime-base', 'auth']) {
      const response = await h.request('/static/' + name + '.js', session);
      assert.equal(response.status, 200);
      assert(response.bytes.equals(fs.readFileSync(path.join(ROOT, 'www', name + '.js'))));
      vm.runInContext(response.text, context, { filename: 'https-served-' + name + '.js' });
    }
    assert.equal(window.NW_RUNTIME.isProxy, false, 'actual runtime-base recognizes direct HTTPS');
    document.readyState = 'complete'; listeners.get('document:DOMContentLoaded')?.();
    await window.NW_AUTH.refreshStatus();
    assert.equal(window.NW_AUTH.getState().authed, true, 'actual HTTPS auth response unlocks the product wrapper');
    assert.equal(content.inert, false);
    return { window, context, content, calls, redirects, close };
  } catch (error) { close(); throw error; }
}

async function main() {
  const certificates = certificateFixture();
  try {
    await check('HTTP-Modus bleibt explizit HTTP; HTTPS wird nicht stillschweigend angenommen', () => withServer(certificates, { config: { secure: false } }, async h => {
      assert(h.adapter.server instanceof http.Server);
      assert.equal(h.adapter.server instanceof https.Server, false);
      assert.equal(h.certificateCalls.length, 0, 'disabled TLS does not read certificates');
      assert.equal((await h.request('/login.html')).status, 200);
      assert.equal((await h.request('/api/state')).status, 401);
      await h.login(); // Loopback-HTTP compatibility: real login, intentionally no Secure cookie.
      await assert.rejects(h.request('/login.html', { protocol: 'https:' }), 'HTTP port does not become a TLS endpoint');
    }));

    await check('Direktes HTTPS liefert Root-Login, EOS-Logo und alle Anmelde-Assets ohne Sitzung', () => withServer(certificates, {}, async h => {
      assert(h.adapter.server instanceof https.Server, 'actual startServer creates a genuine HTTPS listener');
      assert.deepEqual(h.certificateCalls, [['fixture-public', 'fixture-private', 'fixture-chain']]);
      const root = await h.request('/');
      assert.equal(root.status, 303); assert.match(root.headers.location, /^\/login\.html\?returnTo=/);
      assert.equal(root.authorized, true); assert(['TLSv1.2', 'TLSv1.3'].includes(root.negotiatedProtocol));
      const login = await h.request('/login.html');
      assert.equal(login.status, 200); assert.match(login.headers['content-type'], /^text\/html/);
      assert.match(login.text, /NexoWatt EOS/); assert.doesNotMatch(login.text, /id="loginProfile"/);
      assert.match(login.text, /rel="manifest"/, 'login entry also exposes its PWA manifest');
      assert.match(login.text, /rel="apple-touch-icon"/, 'login entry keeps its install icon');
      const assets = [...new Set([...login.text.matchAll(/(?:src|href)="(\/static\/[^"#]+)"/g)].map(match => match[1]))];
      assert(assets.includes('/static/nexowatt-eos-logo.png'), 'actual EOS logo is referenced');
      for (const asset of assets) {
        const result = await h.request(asset); assert.equal(result.status, 200, asset);
        const expected = asset.endsWith('.css') ? /^text\/css/ : asset.endsWith('.png') ? /^image\/png/ : /^(?:application|text)\/javascript/;
        assert.match(result.headers['content-type'], expected, asset);
        assert(result.bytes.equals(fs.readFileSync(path.join(ROOT, 'www', asset.slice('/static/'.length)))), 'served asset is exactly the shipped file: ' + asset);
      }
    }));

    await check('PWA-Manifest, Service Worker, Icons und Start-URL funktionieren über verifiziertes HTTPS', () => withServer(certificates, {}, async h => {
      const manifest = await h.request('/manifest.webmanifest');
      assert.equal(manifest.status, 200); assert.match(manifest.headers['content-type'], /^application\/manifest\+json/);
      assert.equal(manifest.data.name, 'NexoWatt EOS'); assert.equal(manifest.data.display, 'standalone');
      assert(manifest.bytes.equals(fs.readFileSync(path.join(ROOT, 'www/manifest.webmanifest'))));
      const sw = await h.request('/sw.js'); assert.equal(sw.status, 200); assert.match(sw.headers['content-type'], /^application\/javascript/);
      assert(sw.bytes.equals(fs.readFileSync(path.join(ROOT, 'www/sw.js'))));
      assert(Array.isArray(manifest.data.icons) && manifest.data.icons.length > 0);
      const icons = manifest.data.icons.map(icon => new URL(icon.src, new URL('/manifest.webmanifest', h.base())).pathname);
      for (const icon of [...new Set([...icons, '/apple-touch-icon.png', '/static/nexowatt-eos-logo.png'])]) {
        const result = await h.request(icon); assert.equal(result.status, 200, icon); assert.match(result.headers['content-type'], /^image\/png/);
        assert(result.bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), 'real PNG bytes: ' + icon);
        const source = icon.startsWith('/static/') ? icon.slice(8) : icon.slice(1);
        assert(result.bytes.equals(fs.readFileSync(path.join(ROOT, 'www', source))), 'exact shipped PWA icon: ' + icon);
      }
      const startUrl = new URL(manifest.data.start_url, new URL('/manifest.webmanifest', h.base())).pathname;
      assert.equal((await h.request(startUrl)).status, 303, 'installed start URL remains protected before login');
      const session = await h.login();
      const entered = await h.request(startUrl, session);
      assert.equal(entered.status, 200); assert.match(entered.headers['content-type'], /^text\/html/);
      assert.match(entered.text, /id="linePV"/); assert.doesNotMatch(entered.text, /id="loginForm"/);
      const scripts = [...entered.text.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)].map(match => ({ tag: match[0], pathname: new URL(match[1], h.base()).pathname }));
      const ordered = ['/static/runtime-base.js', '/static/auth.js', '/static/app.js'].map(file => {
        const matches = scripts.filter(script => script.pathname === file);
        assert.equal(matches.length, 1, 'dashboard loads this boot script exactly once: ' + file);
        assert.doesNotMatch(matches[0].tag, /\sasync(?:[\s=>]|$)/i, 'authentication boot must not race via async');
        return scripts.findIndex(script => script.pathname === file);
      });
      assert(ordered[0] < ordered[1] && ordered[1] < ordered[2], 'actual dashboard response loads runtime-base before auth before app');
    }));

    await check('Zertifikatsvertrauen, IP-SAN und Protokolltrennung werden tatsächlich erzwungen', () => withServer(certificates, {}, async h => {
      await assert.rejects(h.request('/login.html', { trustCa: false }), 'foreign CA is not trusted automatically');
      await assert.rejects(h.request('/login.html', { servername: 'different-host.invalid' }), { code: 'ERR_TLS_CERT_ALTNAME_INVALID' });
      await assert.rejects(h.request('/login.html', { minVersion: 'TLSv1.1', maxVersion: 'TLSv1.1' }), 'obsolete TLS cannot establish a connection');
      let plain;
      try { plain = await h.request('/login.html', { protocol: 'http:' }); } catch { plain = null; }
      assert(plain === null || (plain.status >= 400 && !plain.text.includes('loginForm')), 'HTTP on the TLS port never serves the login or credentials endpoint');
      const valid = await h.request('/login.html'); assert.equal(valid.status, 200); assert.equal(valid.authorized, true);
    }));

    await check('Root-CA → Intermediate → IP-Leaf wird als Serverkette ausgeliefert', async () => {
      const certificateResult = { key: certificates.key, cert: certificates.intermediateCert, ca: certificates.intermediate };
      assert.equal(new crypto.X509Certificate(certificates.intermediateCert).checkIP(HOST), HOST);
      await withServer(certificates, { certificateResult }, async h => {
        const response = await h.request('/login.html');
        assert.equal(response.status, 200); assert.equal(response.authorized, true);
        assert.deepEqual(h.certificateCalls, [['fixture-public', 'fixture-private', 'fixture-chain']]);
      });
      await withServer(certificates, { certificateResult, config: { certChained: '' } }, async h => {
        assert.deepEqual(h.certificateCalls, [['fixture-public', 'fixture-private', undefined]]);
        await assert.rejects(h.request('/login.html'), 'trusting only root cannot verify this leaf without the intermediate sent by the server');
      });
    });

    await check('HTTPS-Sitzung: private APIs, Rollen, Secure-Cookie, CSRF, Origin und Logout', () => withServer(certificates, {}, async h => {
      for (const endpoint of ['/api/state', '/config', '/api/history', '/api/smarthome/devices', '/events']) {
        assert.equal((await h.request(endpoint)).status, 401, endpoint);
      }
      const session = await h.login();
      assert.equal((await h.request('/api/state', session)).status, 200);
      assert.equal((await h.request('/api/installer/config', session)).status, 403);
      assert.equal((await h.request('/api/license/info', session)).status, 403);
      const command = { ...session, method: 'POST', body: { id: 'fixture-light', value: true } };
      assert.equal((await h.request('/api/smarthome/toggle', { ...command, csrf: undefined })).status, 403);
      assert.equal((await h.request('/api/smarthome/toggle', { ...command, csrf: 'invalid-csrf-token-long-enough' })).status, 403);
      assert.equal((await h.request('/api/smarthome/toggle', { ...command, headers: { Origin: `http://${HOST}:${h.port}` } })).status, 403);
      assert.equal(h.writes.length, 0, 'denials do not reach the controller write boundary');
      assert.equal((await h.request('/api/smarthome/toggle', { ...command, headers: { Origin: h.base() } })).status, 200);
      assert.equal(h.writes.length, 1); assert.equal(h.writes[0][0], 'fixture.light');
      const admin = await h.login('admin');
      assert.equal((await h.request('/api/license/info', admin)).status, 200);
      assert.equal((await h.request('/api/auth/logout', { ...session, csrf: undefined, method: 'POST' })).status, 403);
      const logout = await h.request('/api/auth/logout', { ...session, method: 'POST' });
      assert.equal(logout.status, 200); assert((logout.headers['set-cookie'] || []).some(value => value.includes('Max-Age=0')));
      assert.equal((await h.request('/api/state', session)).status, 401);
    }));

    await check('Ausgelieferter Auth-Wrapper setzt CSRF für echte HTTPS-/api/set-Aufrufe selbst', () => withServer(certificates, {}, async h => {
      const session = await h.login();
      const frontend = await bootAuthAgainstHttps(h, session);
      try {
        assert.equal(frontend.calls.filter(call => call.path === '/api/auth/status').length, 1, 'initial status comes once from the actual server');
        const response = await vm.runInContext("fetch('/api/set', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scope: 'settings', key: 'price', value: 0.31 }) })", frontend.context);
        assert.equal(response.status, 200); assert.equal((await response.json()).ok, true);
        const mutations = frontend.calls.filter(call => call.path === '/api/set');
        assert.equal(mutations.length, 1, 'no automatic replay of the mutation');
        assert.equal(mutations[0].csrf, session.csrf, 'product wrapper obtains and sends the real server CSRF token');
        assert.equal(h.adapter.fixtureStates.get('settings.price')?.val, 0.31, 'real route reached its controller write boundary');
        await frontend.window.NW_AUTH.logout();
        assert.equal(frontend.calls.find(call => call.path === '/api/auth/logout')?.csrf, session.csrf);
        const denied = await vm.runInContext("fetch('/api/set', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scope: 'settings', key: 'price', value: 0.99 }) })", frontend.context);
        assert.equal(denied.status, 401);
        assert.equal(frontend.calls.filter(call => call.path === '/api/set').length, 1, 'locked wrapper issues no second write');
        assert.equal(h.adapter.fixtureStates.get('settings.price')?.val, 0.31);
        assert.equal((await h.request('/api/state', session)).status, 401, 'server independently invalidated the session');
      } finally { frontend.close(); }
    }));

    for (const change of ['disabled', 'password', 'group']) {
      await check('HTTPS-Sitzungswiderruf nach Kontenänderung: ' + change, () => withServer(certificates, {}, async h => {
        const session = await h.login();
        if (change === 'disabled') h.accounts.get('kunde').common.enabled = false;
        if (change === 'password') h.accounts.get('kunde').common.password = crypto.randomBytes(32).toString('hex');
        if (change === 'group') h.groups.get('user').common.members = [];
        assert.equal((await h.request('/api/state', session)).status, 401);
      }));
    }

    const failures = [
      ['fehlender Zertifikatsname', { config: { certPublic: '' } }, 'NW_UI_TLS_CERTIFICATE_SELECTION_REQUIRED'],
      ['fehlender Schlüsselname', { config: { certPrivate: '' } }, 'NW_UI_TLS_CERTIFICATE_SELECTION_REQUIRED'],
      ['ungültiger Zertifikatsname', { config: { certPublic: 'fixture\npublic' } }, 'NW_UI_TLS_CERTIFICATE_NAME_INVALID'],
      ['ungültiger TLS-Schaltertyp', { config: { secure: 'true' } }, 'NW_UI_TLS_MODE_INVALID'],
      ['Controller-API fehlt', { certificateReader: null }, 'NW_UI_TLS_CERTIFICATE_READER_UNAVAILABLE'],
      ['fehlendes Controller-Ergebnis', { certificateReader: (_public, _private, _chain, callback) => callback(null, null, false) }, 'NW_UI_TLS_CERTIFICATE_FORMAT_INVALID'],
      ['Controller-Lesefehler ohne Detailleck', { certificateReader: (_public, _private, _chain, callback) => callback(new Error('PRIVATE-CONTROLLER-ERROR'), undefined, false) }, 'NW_UI_TLS_CERTIFICATE_READ_FAILED'],
      ['ungültiges Zertifikat', { certificateResult: { key: certificates.key, cert: 'invalid-certificate', ca: certificates.ca } }, 'NW_UI_TLS_CERTIFICATE_FORMAT_INVALID'],
      ['ungültiger privater Schlüssel', { certificateResult: { key: 'invalid-private-key', cert: certificates.cert, ca: certificates.ca } }, 'NW_UI_TLS_KEY_FORMAT_INVALID'],
      ['Schlüssel passt nicht zum Zertifikat', { certificateResult: { key: certificates.otherKey, cert: certificates.cert, ca: certificates.ca } }, 'NW_UI_TLS_KEY_MISMATCH'],
      ['abgelaufenes Zertifikat', { certificateResult: { key: certificates.key, cert: certificates.expired, ca: certificates.ca } }, 'NW_UI_TLS_CERTIFICATE_TIME_INVALID'],
      ['falscher Aussteller in der Kette', { certificateResult: { key: certificates.key, cert: certificates.cert, ca: certificates.intermediate } }, 'NW_UI_TLS_CHAIN_INVALID'],
      ['übergroßer privater Schlüssel', { certificateResult: { key: 'x'.repeat(64 * 1024 + 1), cert: certificates.cert, ca: certificates.ca } }, 'NW_UI_TLS_CERTIFICATE_SIZE_EXCEEDED'],
      ['übergroßes Zertifikat', { certificateResult: { key: certificates.key, cert: 'x'.repeat(64 * 1024 + 1), ca: certificates.ca } }, 'NW_UI_TLS_CERTIFICATE_SIZE_EXCEEDED'],
      ['übergroße Zertifikatskette', { certificateResult: { key: certificates.key, cert: certificates.cert, ca: 'x'.repeat(256 * 1024 + 1) } }, 'NW_UI_TLS_CERTIFICATE_SIZE_EXCEEDED'],
      ['zu viele Zertifikate', { certificateResult: { key: certificates.key, cert: certificates.cert, ca: certificates.ca.repeat(8) } }, 'NW_UI_TLS_CERTIFICATE_SIZE_EXCEEDED'],
    ];
    for (const [label, options, code] of failures) {
      await check('TLS-Startfehler bleibt geschlossen: ' + label, () => expectClosedStart(certificates, options, error => assert.equal(error.code, code)));
    }

    await check('Controller-Zertifikatsabruf: echtes 5-s-Budget und kein verspäteter HTTP-/HTTPS-Start', async () => {
      let lateCallback;
      const started = performance.now();
      await expectClosedStart(certificates, { certificateReader: (_public, _private, _chain, callback) => { lateCallback = callback; } }, async (error, h) => {
        assert.equal(error.code, 'NW_UI_TLS_CERTIFICATE_READ_TIMEOUT');
        const elapsed = performance.now() - started;
        assert(elapsed >= 4800 && elapsed < 6500, 'actual five-second certificate deadline is bounded');
        await assert.rejects(h.start(), { code: 'NW_UI_TLS_CERTIFICATE_READ_PENDING' });
        assert.equal(h.certificateCalls.length, 1, 'no parallel replacement query after timeout');
        assert.equal(h.adapter._nwShuttingDown, false, 'late response is tested before unload, not masked by shutdown');
        assert.equal(typeof lateCallback, 'function');
        lateCallback(null, { key: certificates.key, cert: certificates.cert, ca: certificates.ca }, false);
        await drain(); await drain();
        assert.equal(Boolean(h.adapter.server?.listening), false);
        assert.equal(await portAcceptsConnections(h.port), false, 'late certificate callback cannot bind any fallback server');
      });
    });

    await check('onUnload während Zertifikatsabruf verhindert auch einen später erfolgreichen HTTPS-Start', async () => {
      let lateCallback, notifyRead;
      const readerReached = new Promise(resolve => { notifyRead = resolve; });
      const h = await makeHarness(certificates, { certificateReader: (_public, _private, _chain, callback) => {
        lateCallback = callback; notifyRead();
      } });
      const pendingStart = h.start().then(() => ({ ok: true }), error => ({ ok: false, error }));
      try {
        await waitForCertificateReader(readerReached);
        await h.close();
        assert.equal(h.adapter._nwShuttingDown, true, 'actual onUnload set the shutdown guard before certificate completion');
        lateCallback(null, { key: certificates.key, cert: certificates.cert, ca: certificates.ca }, false);
        lateCallback = null;
        const result = await pendingStart;
        assert.equal(result.ok, false, 'successful controller callback must not resurrect a stopped adapter');
        assert(result.error instanceof Error);
        assert.equal(h.adapter.server, null);
        assert.equal(await portAcceptsConnections(h.port), false, 'no late HTTPS or HTTP fallback listener');
        assert.equal(h.unloadCount, 1);
      } finally {
        if (lateCallback) lateCallback(null, { key: certificates.key, cert: certificates.cert, ca: certificates.ca }, false);
        await pendingStart;
        await h.close();
        h.adapter.server?.closeAllConnections?.();
        h.adapter.server?.close(() => {});
      }
    });

    await check('Tatsächliches onReady führt bei UI-TLS-Konfigfehler EMS- und SmartHome-Initialisierung weiter', async () => {
      const h = await makeHarness(certificates, { config: { certPublic: '' } });
      const lifecycle = readyLifecycleHarness(h);
      try {
        await lifecycle.run();
        for (const name of ['ensureInstallerStates', 'loadInstallerConfigFromState', 'initEmsEngine', 'eebus.init',
          'loadSmartHomeTimersFromState', 'loadSmartHomeLogicClocksFromState', 'initLogicEngine']) {
          assert.equal(lifecycle.calls.filter(value => value === name).length, 1, name + ' must still be reached exactly once');
        }
        assert(lifecycle.calls.indexOf('loadInstallerConfigFromState') < lifecycle.calls.indexOf('initEmsEngine'));
        assert(lifecycle.calls.indexOf('initEmsEngine') < lifecycle.calls.indexOf('eebus.init'));
        assert(lifecycle.calls.indexOf('initEmsEngine') < lifecycle.calls.indexOf('initLogicEngine'));
        assert.equal(lifecycle.calls.includes('_nwStartConnectionHeartbeat'), false);
        assert(lifecycle.connectionChanges.some(value => value.value === false && value.reason === 'ui-tls-config-error'));
        assert(lifecycle.connectionChanges.every(value => value.value === false), 'TLS failure must never mark the web server online');
        assert(h.adapter.fixtureLogs.some(value => value.includes('NW_UI_TLS_CERTIFICATE_SELECTION_REQUIRED')));
        assert(h.adapter.fixtureLogs.includes('NexoWatt EOS ist bereit.'));
        assert.equal(h.adapter._nwShuttingDown, false);
        assert.equal(h.adapter._nwMeshAppSaveInProgress, false, 'startup config lock is released');
        assert.equal(Boolean(h.adapter.server?.listening), false);
        assert.equal(await portAcceptsConnections(h.port), false, 'continuing autonomous initialization does not open HTTP');
      } finally { await h.close(); }
    });

    await check('Tatsächliches onReady startet nach Shutdown während TLS-Abruf weder Webserver noch EMS', async () => {
      let lateCallback, notifyRead;
      const readerReached = new Promise(resolve => { notifyRead = resolve; });
      const h = await makeHarness(certificates, { certificateReader: (_public, _private, _chain, callback) => {
        lateCallback = callback; notifyRead();
      } });
      const lifecycle = readyLifecycleHarness(h);
      const pendingReady = lifecycle.run();
      try {
        await waitForCertificateReader(readerReached);
        await h.close();
        assert.equal(h.adapter._nwShuttingDown, true);
        lateCallback(null, { key: certificates.key, cert: certificates.cert, ca: certificates.ca }, false);
        lateCallback = null;
        await pendingReady;
        for (const name of ['ensureInstallerStates', 'initEmsEngine', 'eebus.init', 'loadSmartHomeTimersFromState', 'initLogicEngine', '_nwStartConnectionHeartbeat']) {
          assert.equal(lifecycle.calls.includes(name), false, name + ' must not be started after shutdown');
        }
        assert.equal(h.adapter._nwMeshAppSaveInProgress, false, 'shutdown still releases the startup config lock');
        assert.equal(h.adapter.server, null);
        assert.equal(await portAcceptsConnections(h.port), false);
        assert.equal(h.adapter.fixtureLogs.includes('NexoWatt EOS ist bereit.'), false);
        assert(lifecycle.connectionChanges.every(value => value.value === false));
        assert.equal(h.unloadCount, 1);
      } finally {
        if (lateCallback) lateCallback(null, { key: certificates.key, cert: certificates.cert, ca: certificates.ca }, false);
        await pendingReady;
        await h.close();
        h.adapter.server?.closeAllConnections?.();
        h.adapter.server?.close(() => {});
      }
    });

    await check('onReady behandelt echte Portkonflikte weiterhin als Startfehler und nicht als TLS-Konfigausnahme', async () => {
      const occupant = http.createServer((_req, res) => { res.end('occupied-ready-fixture'); });
      await new Promise(resolve => occupant.listen(0, HOST, resolve));
      const h = await makeHarness(certificates, { port: occupant.address().port });
      const lifecycle = readyLifecycleHarness(h);
      try {
        await lifecycle.run();
        assert.equal(lifecycle.calls.includes('initEmsEngine'), false, 'non-TLS startup errors are not silently reclassified');
        assert.equal(lifecycle.calls.includes('ensureInstallerStates'), false);
        assert(lifecycle.connectionChanges.some(value => value.reason === 'startup-failed-before-server'));
        assert.equal(h.adapter._nwMeshAppSaveInProgress, false);
        assert.equal(Boolean(h.adapter.server?.listening), false);
        assert.equal((await h.request('/', { protocol: 'http:' })).text, 'occupied-ready-fixture');
      } finally { await h.close(); occupant.closeAllConnections(); await new Promise(resolve => occupant.close(resolve)); }
    });

    await check('Belegter Port weist HTTPS-Start ab und bleibt beim bisherigen Listener', async () => {
      const occupant = http.createServer((_req, res) => { res.end('occupied-fixture'); });
      await new Promise(resolve => occupant.listen(0, HOST, resolve));
      const port = occupant.address().port;
      const h = await makeHarness(certificates, { port });
      try {
        await assert.rejects(h.start(), { code: 'EADDRINUSE' });
        assert.equal(Boolean(h.adapter.server?.listening), false);
        const response = await h.request('/', { protocol: 'http:' });
        assert.equal(response.text, 'occupied-fixture', 'no listener replacement or fallback');
      } finally { await h.close(); occupant.closeAllConnections(); await new Promise(resolve => occupant.close(resolve)); }
    });

    await check('Unvollständiger TLS-Handshake endet im echten 5-s-Serverbudget', () => withServer(certificates, {}, async h => {
      const started = performance.now();
      const socket = net.connect({ host: HOST, port: h.port });
      socket.on('error', () => {});
      try {
        await new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('Native TLS handshake deadline was not enforced')), 6500);
          socket.once('close', () => { clearTimeout(timer); resolve(); });
        });
        const elapsed = performance.now() - started;
        assert(elapsed >= 4800 && elapsed < 6500, 'real stalled TLS handshake is closed after the configured five seconds');
        assert.equal((await h.request('/login.html')).status, 200, 'ordinary HTTPS still works after rejecting the stalled handshake');
      } finally { socket.destroy(); }
    }));

    await check('Echter Unload schließt HTTPS-SSE und angefangene TLS-Sockets vollständig', () => withServer(certificates, {}, async h => {
      const session = await h.login();
      const stream = await openSse(h, certificates, session);
      const rawSocket = net.connect({ host: HOST, port: h.port });
      rawSocket.on('error', () => {});
      await new Promise(resolve => rawSocket.once('connect', resolve));
      const rawClosed = new Promise(resolve => rawSocket.once('close', resolve));
      await drain();
      assert(h.adapter._serverSockets.size >= 2, 'both active stream and unfinished TLS handshake are tracked');
      const server = h.adapter.server;
      await h.close();
      await Promise.race([Promise.all([stream.closed, rawClosed]), new Promise((_, reject) => { const timer = setTimeout(() => reject(new Error('Open socket survived product unload')), 1500); timer.unref(); })]);
      assert.equal(server.listening, false); assert.equal(h.adapter.server, null);
      assert.equal(h.adapter._serverSockets.size, 0); assert.equal(h.unloadCount, 1);
      assert.equal(await portAcceptsConnections(h.port), false);
      stream.request.destroy(); rawSocket.destroy();
    }));
  } finally { certificates.cleanup(); }

  assert.equal(fs.existsSync(certificates.directory), false, 'temporary CA and private keys were actually deleted');
  const sourceHashes = fileHashes();
  assert.deepEqual(sourceHashes, initialSourceHashes, 'sources and assets must not change during the measured integration run');
  const report = { schemaVersion: 1, result: 'PASS', version: JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version,
    checkedAt: new Date().toISOString(), node: process.version, checks: checks.length, requestCount, cases: checks, sourceHashes,
    scope: 'Shipped main.js startServer/onUnload with real Express, HTTP, HTTPS, TLS certificate validation, authenticated routes and PWA assets; actual onReady control flow with downstream subsystem initialization observed at explicit call-tracing boundaries; controller/certificate retrieval and device writes are local doubles.',
    limitations: ['No browser rendering or installed-PWA acceptance test.', 'No real controller certificate store, customer credentials, deployment or hardware.', 'The onReady checks prove initialization reachability and shutdown ordering, not EMS or hardware control cycles.', 'Temporary generated CA and private keys were deleted and are never included in this report.'] };
  if (process.argv.includes('--report')) {
    const directory = path.join(ROOT, 'docs/reports/branding-2026-11-22');
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, 'direct-https-runtime-evidence.json'), JSON.stringify(report, null, 2) + '\n');
  }
  console.log(JSON.stringify({ result: report.result, checks: report.checks, requestCount, node: process.version, scope: report.scope }));
}

main().catch(error => { console.error(error?.stack || String(error)); process.exitCode = 1; });
