'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../public/nexowatt-license.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '../public/nexowatt-license.html'), 'utf8');
const uuid = '550e8400-e29b-41d4-a716-446655440000';
const active = { v: 1, valid: true, code: 'LICENSE_VALID', uuid, edition: 'home', expiresAt: null, coreEnabled: true, tokenVersion: 3, scope: 'system', limits: { chargePoints: 3, batteries: 2 }, features: ['energy'] };
const missing = { v: 1, valid: false, code: 'LICENSE_KEY_UNKNOWN', uuid, edition: null, expiresAt: null, coreEnabled: false, tokenVersion: null, scope: null, limits: {}, features: [] };
const key = crypto.generateKeyPairSync('ed25519').publicKey.export({ type: 'spki', format: 'pem' });
const fingerprint = crypto.createHash('sha256').update(crypto.createPublicKey(key).export({ type: 'spki', format: 'der' })).digest('hex');
const keyRow = { kid: 'manufacturer', fingerprint, source: 'restored' };
const trust = { v: 1, ready: true, code: 'TRUST_READY', canImport: true, source: 'restored', keys: [keyRow], allowedKeys: [{ ...keyRow, source: 'release' }] };
const unavailable = { ...trust, ready: false, code: 'TRUST_MISSING', source: 'none', keys: [] };
class Element {}
function element(id) {
    return Object.assign(new Element(), { id, textContent: '', hidden: false, disabled: false, className: '', files: [], value: '', children: [], attributes: {},
        setAttribute(name, value) { this.attributes[name] = value; },
        append(...nodes) { this.children.push(...nodes); }, replaceChildren(...nodes) { this.children = nodes; this.textContent = ''; },
        focus() { this.focused = true; }, click() { this.clicked = true; }, remove() { this.removed = true; } });
}
async function idle(ui) {
    for (let i = 0; i < 1000; i++) {
        await new Promise(resolve => setImmediate(resolve));
        if (!ui.get('refresh').disabled) return;
    }
    throw new Error('UI did not settle');
}
async function page(handler, options = {}) {
    const elements = Object.fromEntries([...html.matchAll(/\bid="([^"]+)"/g)].map(([, id]) => [id, element(id)]));
    const calls = []; const downloads = []; const timers = new Set();
    const context = { HTMLInputElement: Element, HTMLTextAreaElement: Element, document: { getElementById: id => elements[id], createElement: tag => element(tag), body: element('body') },
        fetch: async (url, init) => { calls.push({ url, init }); return handler(url.replace('/nexowatt/license/', ''), init); },
        setTimeout: (fn, ms) => { const timer = setTimeout(fn, options.fastDeadline ? Math.min(ms, 15) : ms); timers.add(timer); return timer; },
        clearTimeout: timer => { timers.delete(timer); clearTimeout(timer); }, AbortController, TextDecoder, TextEncoder, Uint8Array, Blob, atob, btoa,
        URL: { createObjectURL: blob => { downloads.push(blob); return 'blob:test'; }, revokeObjectURL: () => {} }, confirm: () => true };
    vm.runInNewContext(source, context, { filename: 'nexowatt-license.js' });
    const ui = { get: id => elements[id], calls, downloads, close: () => { for (const timer of timers) clearTimeout(timer); } };
    await idle(ui);
    return ui;
}
const response = value => Response.json(value);
function standard(route) { return response(route === 'status' ? active : trust); }
async function fileSelection(ui, bytes, name = 'any-public-name.json') {
    const data = typeof bytes === 'string' ? new TextEncoder().encode(bytes) : bytes;
    ui.get('trustFile').files = [{ name, size: data.byteLength, arrayBuffer: async () => data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) }];
    ui.get('trustFile').onchange();
}

test('central page has keyboard-operable recovery tabs and distinguishes public export from the generator vault', async t => {
    const ui = await page(standard); t.after(ui.close);
    assert.match(html, /Öffentliche Prüfschlüssel &amp; Wiederherstellung/);
    assert.match(html, /verschlüsselte Tresor-Backup und dessen Passphrase im Key-Generator/);
    assert.match(html, /Beides gehört niemals in EOS/);
    ui.get('trustTab').onclick();
    assert.equal(ui.get('trustTab').attributes['aria-selected'], 'true');
    assert.equal(ui.get('licensePanel').hidden, true);
    ui.get('trustTab').onkeydown({ key: 'ArrowLeft', preventDefault() {} });
    assert.equal(ui.get('licenseTab').focused, true);
    assert.equal(ui.get('trustPanel').hidden, true);
});

test('pending and rejected activation clear all old entitlements and the continue link; specific error survives near the code', async t => {
    let reject;
    const ui = await page((route) => route === 'activate' ? new Promise(resolve => { reject = resolve; }) : standard(route)); t.after(ui.close);
    assert.equal(ui.get('continue').hidden, false);
    ui.get('token').value = 'NWL3.synthetic';
    const pending = ui.get('activate').onclick();
    assert.equal(ui.get('continue').hidden, true);
    assert.equal(ui.get('uuid').textContent, '–');
    assert.equal(ui.get('limits').textContent, '–');
    assert.equal(ui.get('token').value, '');
    reject(Response.json({ error: 'STORAGE_AUTH_FAILED', token: 'must-not-be-shown' }, { status: 400 }));
    await pending;
    assert.equal(ui.get('statusCode').textContent, 'STORAGE_AUTH_FAILED');
    assert.match(ui.get('message').textContent, /Schlüsselsicherung/);
    assert.match(ui.get('activationError').textContent, /STORAGE_AUTH_FAILED/);
    assert.equal(ui.get('activationError').hidden, false);
    assert.equal(ui.get('continue').hidden, true);
    assert.doesNotMatch(ui.get('message').textContent, /must-not-be-shown/);
    await ui.get('refresh').onclick();
    assert.equal(ui.get('continue').hidden, false);
    assert.equal(ui.get('activationError').hidden, true);
});

test('NWL2 adapter-only status is explicit and cannot grant the merged core in the browser', async t => {
    const ui = await page(route => response(route === 'status' ? { ...active, tokenVersion: 2, scope: 'adapters', coreEnabled: false } : trust)); t.after(ui.close);
    assert.equal(ui.get('continue').hidden, true);
    assert.match(ui.get('core').textContent, /NWL2-Erweiterungslizenz/);
    assert.equal(ui.get('statusCode').textContent, 'LICENSE_VALID');
});

test('strictly public import uses the central authenticated route, updates trust and rechecks the existing license without reactivation', async t => {
    const ui = await page((route) => response(route === 'status' ? missing : route === 'trust/import' ? { ...trust, licenseStatus: active } : unavailable)); t.after(ui.close);
    assert.equal(ui.get('continue').hidden, true);
    await fileSelection(ui, JSON.stringify({ manufacturer: key }), 'not-a-required-filename.data');
    assert.equal(ui.get('importTrust').disabled, false);
    await ui.get('importTrust').onclick();
    const write = ui.calls.find(call => call.url.endsWith('/trust/import'));
    assert.deepEqual(JSON.parse(write.init.body), { keys: { manufacturer: key } });
    assert.equal(write.init.headers['X-EOS-License'], '1');
    assert.equal(write.init.credentials, 'same-origin');
    assert.equal(write.init.redirect, 'error');
    assert.equal(write.init.cache, 'no-store');
    assert.equal(ui.calls.some(call => call.url.endsWith('/activate')), false);
    assert.equal(ui.get('continue').hidden, false);
    assert.match(ui.get('trustKeys').children[0].children[1].textContent, new RegExp(fingerprint));
    assert.match(ui.get('trustKeys').children[0].children[2].textContent, /Lokal wiederhergestellte Kopie/);
    assert.match(ui.get('allowedKeys').children[0].children[2].textContent, /Herstellerfreigabe/);
});

test('private keys, encrypted vaults, invalid UTF-8, mixed maps and malformed public JSON never leave the browser', async t => {
    for (const input of [
        JSON.stringify({ privateKey: '-----BEGIN PRIVATE KEY-----\nsynthetic\n-----END PRIVATE KEY-----' }),
        JSON.stringify({ v: 1, kdf: {}, ciphertext: 'synthetic-encrypted-vault' }),
        JSON.stringify({ manufacturer: key, foreign: 'not a public key' }),
        JSON.stringify({ manufacturer: key, nested: { public: key } }),
        JSON.stringify([key]), '{', new Uint8Array([0xff, 0xfe]),
    ]) {
        const ui = await page(standard); t.after(ui.close);
        await fileSelection(ui, input); await ui.get('importTrust').onclick();
        assert.equal(ui.calls.filter(call => call.init.method === 'POST').length, 0);
        assert.match(ui.get('statusCode').textContent, /^TRUST_(?:INVALID|PRIVATE_KEY_REJECTED)$/);
        assert.equal(ui.get('continue').hidden, true);
    }
});

test('oversized files are rejected before reading and exact size is checked after reading', async t => {
    const ui = await page(standard); t.after(ui.close); let read = false;
    ui.get('trustFile').files = [{ size: 32769, arrayBuffer() { read = true; throw new Error('unexpected'); } }];
    await ui.get('importTrust').onclick();
    assert.equal(read, false); assert.equal(ui.get('statusCode').textContent, 'TRUST_FILE_TOO_LARGE');
    await ui.get('refresh').onclick();
    ui.get('trustFile').files = [{ size: 2, arrayBuffer: async () => new Uint8Array(32769).buffer }];
    await ui.get('importTrust').onclick();
    assert.equal(ui.get('statusCode').textContent, 'TRUST_FILE_TOO_LARGE');
    assert.equal(ui.calls.filter(call => call.init.method === 'POST').length, 0);
});

test('unknown issuer rejection is actionable and leaves no stale UI authorization', async t => {
    const ui = await page(route => route === 'trust/import' ? Response.json({ error: 'TRUST_IMPORT_UNKNOWN_KEY' }, { status: 400 }) : standard(route)); t.after(ui.close);
    await fileSelection(ui, JSON.stringify({ manufacturer: key })); await ui.get('importTrust').onclick();
    assert.equal(ui.get('statusCode').textContent, 'TRUST_IMPORT_UNKNOWN_KEY');
    assert.match(ui.get('message').textContent, /vollständig abgewiesen/);
    assert.match(ui.get('message').textContent, /autorisierte OS-Einrichtung/);
    assert.equal(ui.get('continue').hidden, true);
});

test('untrusted response fields never become key rows or text; malformed status fails closed', async t => {
    for (const bad of [
        { ...trust, keys: [{ ...keyRow, kid: '<img onerror=x>' }] },
        { ...trust, keys: [{ ...keyRow, fingerprint: 'not-a-fingerprint' }] },
        { ...trust, keys: [{ ...keyRow, source: 'attacker' }] },
        { ...trust, keys: Array(33).fill(keyRow) },
        { ...trust, keys: [keyRow, keyRow] },
        { ...trust, ready: true, keys: [] },
    ]) {
        const ui = await page(route => response(route === 'status' ? active : bad)); t.after(ui.close);
        assert.equal(ui.get('statusCode').textContent, 'LICENSE_RESPONSE');
        assert.equal(ui.get('continue').hidden, true); assert.equal(ui.get('trustKeys').children.length, 0);
    }
    const ui = await page(() => Response.json({ error: 'private raw service detail' }, { status: 500 })); t.after(ui.close);
    assert.equal(ui.get('statusCode').textContent, 'SERVICE_UNAVAILABLE');
    assert.doesNotMatch(ui.get('message').textContent, /private raw/);
});

test('recheck and export use the same central trust source and export only validated public key JSON', async t => {
    const ui = await page(route => response(route === 'status' ? active : route === 'trust/recheck' ? { ...trust, licenseStatus: active } : route === 'trust/export' ? { manufacturer: key } : trust)); t.after(ui.close);
    await ui.get('recheckTrust').onclick();
    const recheck = ui.calls.find(call => call.url.endsWith('/trust/recheck'));
    assert.deepEqual(JSON.parse(recheck.init.body), {}); assert.equal(recheck.init.headers['X-EOS-License'], '1');
    await ui.get('exportTrust').onclick();
    assert.equal(ui.downloads.length, 1);
    assert.deepEqual(JSON.parse(await ui.downloads[0].text()), { manufacturer: key });
    assert.match(ui.get('message').textContent, /ersetzt kein Tresor-Backup/);
});

test('oversized streamed responses are cancelled and cannot preserve an old entitlement', async t => {
    let overflow = false; let cancelled = false;
    const ui = await page(route => overflow && route === 'status' ? new Response(new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(65537)); }, cancel() { cancelled = true; } })) : standard(route)); t.after(ui.close);
    overflow = true; await ui.get('refresh').onclick();
    assert.equal(cancelled, true); assert.equal(ui.get('statusCode').textContent, 'LICENSE_RESPONSE'); assert.equal(ui.get('continue').hidden, true);
});

test('deadline aborts the request and reports unconfirmed status rather than an invalid or missing license', async t => {
    let timeout = false; let aborted = false;
    const ui = await page((route, init) => timeout && route === 'status' ? new Promise((resolve, reject) => {
        init.signal.addEventListener('abort', () => { aborted = true; reject(new Error('aborted')); }, { once: true });
    }) : standard(route), { fastDeadline: true }); t.after(ui.close);
    timeout = true; await ui.get('refresh').onclick();
    assert.equal(aborted, true); assert.equal(ui.get('statusCode').textContent, 'SERVICE_TIMEOUT');
    assert.match(ui.get('status').textContent, /nicht bestätigt/); assert.doesNotMatch(ui.get('message').textContent, /Lizenz ungültig|Keine Lizenz/);
    assert.equal(ui.get('continue').hidden, true);
});

test('registry can show 64 allowed authorities while effective keys stay capped at 32', async t => {
    const allowedKeys = Array.from({ length: 64 }, (_, i) => ({ ...keyRow, kid: `allowed${i}`, source: 'release' }));
    const ui = await page(route => response(route === 'status' ? active : { ...trust, allowedKeys })); t.after(ui.close);
    assert.equal(ui.get('continue').hidden, false); assert.equal(ui.get('allowedKeys').children.length, 64);
    const invalid = await page(route => response(route === 'status' ? active : { ...trust, allowedKeys: [...allowedKeys, { ...keyRow, kid: 'overflow', source: 'os' }] })); t.after(invalid.close);
    assert.equal(invalid.get('statusCode').textContent, 'LICENSE_RESPONSE'); assert.equal(invalid.get('continue').hidden, true);
});

test('trust revocation racing a status read cannot leave the earlier entitlement visible', async t => {
    const ui = await page(route => response(route === 'status' ? active : { ...unavailable, code: 'TRUST_IMPORT_UNKNOWN_KEY' })); t.after(ui.close);
    assert.equal(ui.get('statusCode').textContent, 'TRUST_IMPORT_UNKNOWN_KEY');
    assert.equal(ui.get('continue').hidden, true); assert.equal(ui.get('limits').textContent, '–');
});

test('a malformed public PEM or a non-Ed25519 public key is rejected before import', async t => {
    const wrong = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).publicKey.export({ type: 'spki', format: 'pem' });
    for (const pem of [wrong, key.replace('MCow', 'MEow'), key.replace('MCow', '!!!!')]) {
        const ui = await page(standard); t.after(ui.close);
        await fileSelection(ui, JSON.stringify({ manufacturer: pem })); await ui.get('importTrust').onclick();
        assert.equal(ui.calls.filter(call => call.init.method === 'POST').length, 0);
        assert.equal(ui.get('statusCode').textContent, 'TRUST_INVALID');
    }
});
