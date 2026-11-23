'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../public/eos-migration/index.js'), 'utf8');

function node(tag = 'div') {
    return { tag, _text: '', children: [], events: {}, hidden: false,
        get textContent() { return this._text + this.children.map(child => child.textContent).join(''); },
        set textContent(value) { this._text = String(value); this.children = []; },
        set innerHTML(_value) { assert.fail('migration data must not become HTML'); },
        append(...values) { this.children.push(...values); }, replaceChildren() { this._text = ''; this.children = []; },
        addEventListener(event, callback) { this.events[event] = callback; },
    };
}
async function fixture(initial) {
    const elements = new Map(); const calls = []; let payload = initial; let status = 200;
    const get = id => { if (!elements.has(id)) elements.set(id, node()); return elements.get(id); };
    const context = { Error, AbortSignal, document: { getElementById: get, createElement: node },
        async fetch(url, options) { calls.push({ url, options }); return { status, ok: status === 200, json: async () => payload }; } };
    const settle = async () => { for (let i = 0; i < 30 && get('refresh').disabled !== false; i++) await new Promise(resolve => setImmediate(resolve)); assert.equal(get('refresh').disabled, false); };
    vm.runInNewContext(source, context, { filename: 'migration/index.js' }); await settle();
    return { get, calls, async refresh(value, code = 200) { payload = value; status = code; get('refresh').events.click(); await settle(); } };
}

test('migration page explains blocked protected fields and shows existing instances without mutation requests', async () => {
    const f = await fixture({ phase: 'BLOCKED', code: 'EOS_MIGRATION_PROTECTED_FIELDS_UNAVAILABLE', existingAdaptersUnchanged: true,
        sources: [{ id: 'ui', source: 'nexowatt-ui.0', namespacePreserved: false }, { id: 'eebus', source: 'eebus.0', namespacePreserved: false }], updatedAt: Date.now() });
    assert.equal(f.get('status-heading').textContent, 'Übernahme nicht gestartet');
    assert.match(f.get('reason-description').textContent, /geschützte Zugangsdaten oder Schlüssel/);
    assert.equal(f.get('unchanged-notice').hidden, false);
    assert.match(f.get('unchanged-notice').textContent, /keine bisherigen Adapter angehalten/);
    assert.match(f.get('sources').textContent, /nexowatt-ui\.0/); assert.match(f.get('sources').textContent, /eebus\.0/);
    await f.refresh({ phase: 'COMMITTED', sources: [{ id: 'devices', source: 'nexowatt-devices.0', namespacePreserved: true }] });
    assert.equal(f.get('status-heading').textContent, 'Übernahme abgeschlossen');
    assert.equal(f.get('unchanged-notice').hidden, true);
    assert.match(f.get('sources').textContent, /Datenpunktnamen beibehalten/);
    assert.ok(f.calls.every(call => call.url === '/api/eos/migration' && call.options.method === undefined && call.options.body === undefined));
});

test('migration page rejects markup-shaped data and renders authentication failure as text', async () => {
    const marker = '<img src=x onerror=malicious()>';
    const f = await fixture({ phase: marker, code: marker, updatedAt: Infinity, existingAdaptersUnchanged: true,
        sources: [{ id: 'devices', source: marker }, { id: marker, source: 'eebus.0' }], native: { privateKey: marker } });
    assert.equal(f.get('status-heading').textContent, 'Status nicht verfügbar');
    for (const id of ['status-heading', 'phase-description', 'status-code', 'reason-description', 'sources']) assert.doesNotMatch(f.get(id).textContent, /<img|malicious|privateKey/);
    assert.equal(f.get('unchanged-notice').hidden, true);
    await f.refresh({}, 401);
    assert.match(f.get('request-message').textContent, /erneut bei EOS anmelden/);
    assert.equal(f.get('request-message').className, 'eos-message is-error');
});

test('late license activation explains the pending restart without claiming a missing license or completed migration', async () => {
    const f = await fixture({ phase: 'LICENSE_REQUIRED', code: 'EOS_MIGRATION_LICENSE_REQUIRED', updatedAt: null });
    assert.match(f.get('phase-description').textContent, /fehlt eine gültige/);
    await f.refresh({ phase: 'LICENSE_REQUIRED', code: 'EOS_MIGRATION_RESTART_REQUIRED', updatedAt: null });
    assert.match(f.get('status-heading').textContent, /Neustart erforderlich/);
    assert.match(f.get('phase-description').textContent, /Systemfreigabe ist gültig/);
    assert.match(f.get('reason-description').textContent, /EOS-Adapterinstanz neu starten/);
    assert.equal(f.get('updated-at').textContent, 'Noch nicht gespeichert');
    assert.ok(f.calls.every(call => call.options.method === undefined && call.options.body === undefined));
});
