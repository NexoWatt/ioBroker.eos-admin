/** Copyright (c) 2026 NexoWatt. All rights reserved. Confidential and Proprietary. */
'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), vm = require('node:vm');
const { pathToFileURL } = require('node:url');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file));
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const touchHash = '083e11ab28ec00b37d3d47776946c5fad4d79277fdc440cdbb20181a7f064f76';
const originalHash = '952ceb9cef3f7f22a150dd8ea396285f70b9d8c19de8e7c1452bf2ff983ae6bd';
function attrs(tag) { return Object.fromEntries([...tag.matchAll(/([a-z-]+)\s*=\s*["']([^"']*)["']/gi)].map(m => [m[1].toLowerCase(), m[2]])); }
function tags(html, name) { return [...html.matchAll(new RegExp('<' + name + '\\b[^>]*>', 'gi'))].map(m => attrs(m[0])); }
const touch = html => tags(html, 'link').filter(tag => tag.rel === 'apple-touch-icon');
const pages = ['login', 'index', 'history', 'settings', 'smarthome', 'smarthome-config', 'storagefarm', 'ems-apps', 'evcs', 'energy-ledger', 'logic', 'simulation'].map(p => `ui/www/${p}.html`).concat('src-admin/index.html');
test('existing 180px branding is reused byte-for-byte; uploaded 1024px logo and root fallback remain unchanged', () => {
  const icon = read('ui/www/assets/icons/nexowatt-180.png'); assert.equal(hash(icon), touchHash);
  assert.equal(icon.subarray(0, 8).toString('hex'), '89504e470d0a1a0a'); assert.equal(icon.readUInt32BE(16), 180); assert.equal(icon.readUInt32BE(20), 180);
  assert.deepEqual(read('src-admin/public/assets/icons/nexowatt-180.png'), icon);
  for (const file of ['ui/www/assets/icons/nexowatt-1024.png', 'ui/www/apple-touch-icon.png', 'src-admin/public/apple-touch-icon.png']) assert.equal(hash(read(file)), originalHash, file);
});
test('all actual shared page heads declare the same public iPhone icon with a content-specific cache key', () => {
  for (const file of pages) {
    const html = read(file).toString(); const icons = touch(html); assert.equal(icons.length, 1, file);
    assert.equal(icons[0].sizes, '180x180'); assert.equal(icons[0].type, 'image/png');
    for (const page of ['/', '/login.html?returnTo=%2F', '/system/', '/static/login.html']) {
      const resolved = new URL(icons[0].href, 'https://nexowatt.example:8188' + page);
      assert.equal(resolved.origin, 'https://nexowatt.example:8188'); assert.equal(resolved.pathname, '/assets/icons/nexowatt-180.png');
      assert.equal(resolved.searchParams.get('v'), touchHash.slice(0, 12));
    }
    assert.equal(tags(html, 'link').filter(t => t.rel === 'manifest').length, 1);
  }
});
test('login form has the supplied uncropped emblem before its heading, independent of the story wordmark', () => {
  const html = read('ui/www/login.html').toString(), card = html.slice(html.indexOf('<div class="nw-login-card">'));
  const icons = tags(card, 'img').filter(t => t.class === 'nw-login-app-icon'); assert.equal(icons.length, 1);
  assert.equal(icons[0].src, '/assets/icons/nexowatt-192.png'); assert.equal(icons[0].alt, 'NexoWatt EOS');
  assert.equal(icons[0].width, '64'); assert.equal(icons[0].height, '64'); assert.equal(icons[0].loading, 'eager');
  assert.ok(card.indexOf('nw-login-app-icon') < card.indexOf('id="loginTitle"')); assert.ok(read('ui/www/assets/icons/nexowatt-192.png').length > 100);
  const css = read('ui/www/login.css').toString(), rule = /\.nw-login-app-icon\{([^}]+)\}/.exec(css)?.[1];
  assert.ok(rule); assert.match(rule, /display:block/); assert.match(rule, /object-fit:contain/); assert.doesNotMatch(rule, /absolute|display:none|overflow:hidden/);
});
test('actual console build rebasing keeps the new touch icon at the public EOS root and leaves scripts untouched', async () => {
  const { rootWebappAssetUrls } = await import(pathToFileURL(path.join(root, 'src-admin/build-tools/eos-public-assets.mjs')).href);
  const input = '<link rel="apple-touch-icon" sizes="180x180" href="./assets/icons/nexowatt-180.png?v=083e11ab28ec"><script src="./assets/application.js"></script><link rel="stylesheet" href="./assets/application.css">';
  const out = rootWebappAssetUrls(input);
  assert.equal(touch(out)[0].href, '/assets/icons/nexowatt-180.png?v=083e11ab28ec');
  assert.match(out, /<script src="\.\/assets\/application.js"><\/script>/); assert.match(out, /href="\.\/assets\/application.css"/);
});
test('existing validated hosted-prefix HTML projection keeps anonymous logo and installation links in that instance', () => {
  const file = path.join(root, 'ui/src-ts/runtime-executables/lib/runtime-proxy-html.ts'); const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { module, exports: module.exports, require, Buffer, URL });
  for (const prefix of ['/proxy/nexowatt-ui.0', '/office/proxy/nexowatt-ui.3']) {
    const html = module.exports.rewriteRuntimeProxyHtml(read('ui/www/login.html').toString(), prefix);
    assert.equal(touch(html)[0].href, prefix + '/assets/icons/nexowatt-180.png?v=083e11ab28ec');
    assert.equal(tags(html, 'img').find(t => t.class === 'nw-login-app-icon').src, prefix + '/assets/icons/nexowatt-192.png');
    assert.equal(tags(html, 'link').find(t => t.rel === 'manifest').href, prefix + '/manifest.webmanifest');
  }
  assert.throws(() => module.exports.rewriteRuntimeProxyHtml(read('ui/www/login.html').toString(), '/proxy/other.0'));
  const manifest = JSON.parse(read('ui/www/manifest.webmanifest'));
  assert.equal(manifest.id, '/'); assert.equal(manifest.start_url, '.'); assert.equal(manifest.scope, './');
  assert.ok(manifest.icons.some(icon => icon.sizes === '1024x1024'));
});
