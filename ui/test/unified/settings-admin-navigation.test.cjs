'use strict';
// Navigation contract: native anchor plus actual proxy URL helper. No graphical browser proof.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '../..');
const html = fs.readFileSync(path.join(root, 'www/settings.html'), 'utf8');
const runtime = ts.transpileModule(fs.readFileSync(path.join(root,
  'src-ts/runtime-executables/www/runtime-base.ts'), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None },
}).outputText;

test('Settings Admin link uses normal same-tab navigation without a popup click handler', () => {
  const link = /<a\b[^>]*\bid="openInstallerBtn"[^>]*>/.exec(html)?.[0];
  assert.ok(link, 'Admin entry must exist');
  assert.match(link, /\bhref="\/system\/"/);
  assert.match(link, /\btarget="_self"/);
  assert.doesNotMatch(html, /window\.open\(adminUrl/);
  assert.doesNotMatch(html, /getElementById\(['"]openInstallerBtn['"]\)/);
  assert.match(html, /href="https:\/\/open-meteo\.com\/" target="_blank"/,
    'unrelated external documentation still opens separately');
});

test('Settings migration entry is initially hidden, explicitly admin-only and opens in the same tab', () => {
  const link = /<a\b[^>]*\bid="openMigrationBtn"[^>]*>Bestandsübernahme<\/a>/.exec(html)?.[0];
  assert.ok(link, 'Bestandsübernahme entry must exist beside Admin öffnen');
  assert.match(link, /\bhref="\/migration\/"/);
  assert.match(link, /\btarget="_self"/);
  assert.match(link, /\sdata-nw-admin-link(?:\s|>)/);
  assert.match(link, /\shidden(?:\s|>)/);
  assert.match(link, /\bstyle="display:none"/);
  assert.doesNotMatch(link, /\bonclick\s*=/);
});

test('Admin and migration URLs remain on the TLS origin and outside the UI proxy for direct and proxied settings', () => {
  const origins = ['https://nexowatt', 'https://192.168.10.153:8188', 'https://192.168.10.153:8081'];
  for (const origin of origins) {
    for (const pathname of ['/settings.html', '/system/proxy/nexowatt-ui.0/settings.html']) {
      const location = { origin, pathname, href: origin + pathname };
      const window = { location };
      vm.runInNewContext(runtime, { window, document: { baseURI: location.href }, URL });
      for (const entry of ['/system/', '/migration/']) {
        const mapped = window.NW_RUNTIME.url(entry);
        const destination = new URL(mapped, location.href);
        assert.equal(destination.origin, origin);
        assert.equal(destination.pathname, entry);
        assert.equal(destination.search, '', 'no session token or query credentials in link');
      }
    }
  }
});
