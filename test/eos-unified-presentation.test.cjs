'use strict';

const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const test = require('node:test');
const { createHostedRuntime } = require('../ui/lib/eos-presentation');
const { isPresentationRequest } = require('../ui/lib/eos-presentation-routes');

test('only canonical reads enter the presentation process', () => {
  for (const path of ['/', '/static/styles.css', '/assets/icons/nexowatt-180.png', '/manifest.webmanifest',
      '/apple-touch-icon-eos-v2.png', '/apple-touch-icon.png',
      '/static/i18n/de.json', '/api/smarthome/dpsearch?q=licht', '/api/object/tree', '/api/OBJECT/tree/']) {
    assert.equal(isPresentationRequest('GET', path), true, path);
    assert.equal(isPresentationRequest('HEAD', path), true, path);
  }
  for (const path of ['/static/ems-apps.html', '/api/set', '/api/state', '/events', '/settings.html',
      '/api/object/tree//', '/api/%6fbject/tree', '/static/%61pp.js', '/assets/../static/app.js',
      '//static/app.js', '/static/api/operator.js', '/static/config/secret.js', '/static/i18n/it.json',
      '/apple-touch-icon-eos-v3.png', '/%61pple-touch-icon-eos-v2.png']) {
    assert.equal(isPresentationRequest('GET', path), false, path);
  }
  assert.equal(isPresentationRequest('POST', '/api/smarthome/dpsearch'), false);
  assert.equal(isPresentationRequest('POST', '/apple-touch-icon-eos-v2.png'), false);
  assert.equal(isPresentationRequest('OPTIONS', '/'), false);
});

test('presentation routes retain origin, session, license and picker role boundaries', async t => {
  let access = null;
  let grants = ['smartHome'];
  let foreignReads = 0;
  const owner = {
    namespace: 'eos-admin.0', log: { warn() {} },
    async getForeignObjectsAsync(pattern, type) {
      assert.equal(pattern, '*');
      assert.equal(type, 'state');
      foreignReads++;
      return { 'alias.0.light': { common: { role: 'switch', type: 'boolean', name: 'Licht', read: true, write: true } } };
    },
  };
  const runtime = createHostedRuntime(owner, {
    async resolveAccess() { return access; },
    getLicense() { return { valid: true, coreEnabled: true, edition: 'home', limits: { chargePoints: 3, batteries: 2 }, features: grants }; },
    originAllowed(req) { return !req.headers.origin; },
  });
  await runtime.start();
  assert.equal(runtime.status().canWrite, false);
  assert.equal(runtime.status().emsReady, false);
  const server = createServer((req, res) => runtime.handle(req, res, () => { res.writeHead(404).end(); }));
  await new Promise((resolve, reject) => server.once('error', reject).listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    await runtime.stop();
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  });
  const root = `http://127.0.0.1:${server.address().port}`;
  const read = (path, options = {}) => fetch(root + path, { redirect: 'manual', ...options });
  const unauthenticated = await read('/');
  assert.equal(unauthenticated.status, 303);
  assert.equal(unauthenticated.headers.get('Location'), '/login.html?returnTo=%2F');
  assert.equal((await read('/static/styles.css')).status, 200);
  assert.equal((await read('/static/styles.css', { headers: { origin: 'https://elsewhere.invalid' } })).status, 403);
  const icon = await read('/apple-touch-icon-eos-v2.png');
  assert.equal(icon.status, 200);
  assert.match(icon.headers.get('content-type'), /^image\/png/);
  assert.equal((await read('/apple-touch-icon-eos-v2.png', { headers: { origin: 'https://elsewhere.invalid' } })).status, 403);
  const fallback = await read('/apple-touch-icon.png');
  assert.equal(fallback.status, 200);
  assert.deepEqual(await fallback.arrayBuffer(), await icon.arrayBuffer());
  assert.equal((await read('/static/ems-apps.html')).status, 404);
  assert.equal((await read('/api/smarthome/dpsearch')).status, 401);

  const user = 'system.user.fixture';
  access = { authenticated: true, user, role: 'customer', capabilities: ['frontend.open'],
    csrfToken: 'a'.repeat(32), credentialKey: 'fixture' };
  const dashboard = await read('/');
  assert.equal(dashboard.status, 200);
  assert.match(dashboard.headers.get('Cache-Control'), /no-store/);
  const html = await dashboard.text();
  assert.match(html, /static\/dashboard-lp-status\.js/);
  assert.match(html, /rel="apple-touch-icon"[^>]*href="\/apple-touch-icon-eos-v2\.png"/);
  assert.equal((await read('/api/smarthome/dpsearch')).status, 403);
  assert.equal((await read('/api/object/tree')).status, 403);
  assert.equal(foreignReads, 0);

  access = { ...access, role: 'installer', capabilities: ['frontend.open', 'mapping.edit'] };
  grants = [];
  assert.equal((await (await read('/api/smarthome/dpsearch')).json()).error, 'EOS_FEATURE_LICENSE_REQUIRED');
  assert.equal((await (await read('/api/SmartHome/dpsearch/')).json()).error, 'EOS_FEATURE_LICENSE_REQUIRED');
  const tree = await read('/api/OBJECT/tree/?prefix=alias.0');
  assert.equal(tree.status, 200);
  assert.equal((await tree.json()).children[0].id, 'alias.0.light');
  grants = ['smartHome'];
  const found = await read('/api/smarthome/dpsearch?q=licht&direction=write&types=boolean');
  assert.equal(found.status, 200);
  assert.equal((await found.json()).results[0].id, 'alias.0.light');
  assert.equal(foreignReads, 1, 'all picker reads share one index');
  assert.equal((await read('/api/smarthome/dpsearch', { method: 'POST' })).status, 404);
  await runtime.stop();
  assert.equal((await read('/')).status, 404);
});
