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
    const elements = new Map(), calls = [], timers = new Map(), handlers = {};
    let payload = initial, status = 200, postPayload, postStatus = 202, postWait = null, serial = 0;
    const get = id => { if (!elements.has(id)) elements.set(id, node()); return elements.get(id); };
    const context = { Error, AbortSignal, window: { addEventListener(key, fn) { handlers[key] = fn; } },
        document: { hidden:false, getElementById:get, createElement:node, addEventListener(key, fn) { handlers[key] = fn; } },
        setTimeout(fn, ms) { const id = ++serial; timers.set(id, {fn,ms}); return id; },
        clearTimeout(id) { timers.delete(id); },
        async fetch(url, options) {
            calls.push({ url, options });
            const post = options.method === 'POST';
            if (post && postWait) await postWait;
            const code = post ? postStatus : status, result = post ? postPayload : payload;
            return { status:code, ok:code >= 200 && code < 300, json:async() => result };
        } };
    const settle = async () => { for (let i = 0; i < 30 && get('refresh').disabled !== false; i++) await new Promise(resolve => setImmediate(resolve)); assert.equal(get('refresh').disabled, false); };
    vm.runInNewContext(source, context, { filename: 'migration/index.js' }); await settle();
    return { get, calls, timers, settle,
        async refresh(value, code = 200) { payload = value; status = code; get('refresh').events.click(); await settle(); },
        post(value, code = 202, waiting = null) { postPayload = value; postStatus = code; postWait = waiting; },
        async poll(value, code = 200) { payload = value; status = code; const timer = timers.values().next().value; assert.ok(timer); timer.fn(); await settle(); },
    };
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
    assert.equal(f.get('status-heading').textContent, 'Status nicht verfügbar');
});

test('late license activation explains the pending restart without claiming a missing license or completed migration', async () => {
    const f = await fixture({ phase: 'LICENSE_REQUIRED', code: 'EOS_MIGRATION_LICENSE_REQUIRED', updatedAt: null });
    assert.match(f.get('phase-description').textContent, /fehlt eine gültige/);
    await f.refresh({ phase: 'LICENSE_REQUIRED', code: 'EOS_MIGRATION_RESTART_REQUIRED', updatedAt: null });
    assert.match(f.get('status-heading').textContent, /Automatischer Neustart/);
    assert.match(f.get('phase-description').textContent, /Systemfreigabe ist gültig/);
    assert.match(f.get('reason-description').textContent, /Bleibt dieser Status dauerhaft.*EOS-Adapterinstanz einmal in ioBroker neu starten/);
    assert.equal(f.get('updated-at').textContent, 'Noch nicht gespeichert');
    assert.ok(f.calls.every(call => call.options.method === undefined && call.options.body === undefined));
});

const migrationRevision = '12345678-1234-4234-8234-123456789abc';
const offer = (extra = {}) => ({ phase:'BLOCKED', code:'EOS_MIGRATION_SOURCE_VERSION',
    revision:migrationRevision, csrfToken:'fixture-csrf', canStart:true, canActivateDevices:true, operation:{state:'idle',code:''},
    sources:[{id:'ui',source:'nexowatt-ui.0',sourceVersion:'1.0.35',enabled:false},
        {id:'devices',source:'nexowatt-devices.0',sourceVersion:'0.5.172',enabled:false}],
    ...extra });
test('the customer sees actual instance versions and can select a single explicit takeover of disabled sources', async () => {
    const f = await fixture(offer());
    assert.match(f.get('sources').textContent, /nexowatt-ui\.0.*Altinstanz deaktiviert.*1\.0\.35/);
    assert.match(f.get('sources').textContent, /nexowatt-devices\.0.*Altinstanz deaktiviert.*0\.5\.172/);
    assert.equal(f.get('start').disabled,false); assert.equal(f.get('activate-devices').checked,false);
    assert.equal(f.timers.size,0);
    f.get('activate-devices').checked = true;
    let release;
    f.post(offer({canStart:false,operation:{state:'running',code:''}}),202,new Promise(resolve=>{release=resolve;}));
    f.get('start').events.click(); f.get('start').events.click();
    assert.equal(f.get('refresh').disabled,true);
    const posts = f.calls.filter(c=>c.options.method==='POST');
    assert.equal(posts.length,1); assert.equal(posts[0].url, '/api/eos/migration/start');
    assert.equal(posts[0].options.headers['x-nw-csrf'],'fixture-csrf');
    assert.deepEqual(JSON.parse(posts[0].options.body),{expectedRevision:migrationRevision,activateDevices:true});
    release(); await f.settle();
    assert.equal(f.get('start').disabled,true);
    assert.equal(f.get('status-heading').textContent,'Vorprüfung läuft');
    assert.equal(f.get('code-label').textContent,'Meldung der letzten Prüfung');
    assert.match(f.get('operation-message').textContent,/Auftrag läuft|Übernahmeauftrag läuft/);
    assert.equal(f.timers.size,1);
    await f.poll({},503);
    assert.equal(f.timers.size,1); assert.equal(f.get('start').disabled,true);
    assert.match(f.get('request-message').textContent,/erneut ab/);
    await f.poll(offer({phase:'COMMITTED',code:'',canStart:false,operation:{state:'complete',code:''}}));
    assert.equal(f.get('status-heading').textContent,'Übernahme abgeschlossen'); assert.equal(f.timers.size,0);
    assert.equal(f.calls.filter(c=>c.options.method==='POST').length,1);
});

test('only a fresh authenticated server offer enables start; unknown and recovery states cannot be started', async () => {
    const f = await fixture(offer({canStart:false}));
    for (const invalid of [
        {canStart:false}, {csrfToken:null}, {revision:'invalid'}, {operation:{}}, {operation:{state:'running'}},
        {phase:'ROLLBACK_REQUIRED'}, {phase:'ROLLED_BACK'}, {phase:'COMMITTED'}, {phase:'unknown'},
    ]) {
        await f.refresh(offer(invalid)); f.get('start').events.click();
        assert.equal(f.get('start').disabled,true);
        assert.equal(f.calls.some(c=>c.options.method==='POST'),false);
    }
    await f.refresh(offer()); 
    f.get('activate-devices').checked = true;
    await f.refresh(offer({canActivateDevices:false}));
    assert.equal(f.get('activate-devices').checked,false);
    assert.equal(f.get('activate-devices-field').hidden,true);
    f.post({},409);f.get('start').events.click();await f.settle();
    assert.deepEqual(JSON.parse(f.calls.at(-1).options.body),{expectedRevision:migrationRevision,activateDevices:false});
    assert.match(f.get('request-message').textContent,/Status aktualisieren/);
    f.get('start').events.click();
    assert.equal(f.calls.filter(c=>c.options.method==='POST').length,1);
    await f.refresh(offer());assert.equal(f.get('start').disabled,false);
});

test('source metadata describes conflicting origins and missing versions without trusting arbitrary strings', async () => {
    const f = await fixture(offer({sources:[
        {id:'devices',source:'nexowatt-devices.0',sourceVersion:null,instanceVersion:'0.5.172',adapterVersion:'0.5.176',versionCode:'EOS_MIGRATION_VERSION_DIFFERENT',enabled:true},
        {id:'ui',source:'nexowatt-ui.0',sourceVersion:null,instanceVersion:'<script>',adapterVersion:null},
    ]}));
    assert.match(f.get('sources').textContent,/Instanz meldet 0\.5\.172, Adapter meldet 0\.5\.176/);
    assert.match(f.get('sources').textContent,/Versionsangabe fehlt/);
    assert.match(f.get('sources').textContent,/gespeicherte Konfiguration entscheidet/);
    assert.doesNotMatch(f.get('sources').textContent,/<script>/);
    await f.refresh({},403); assert.equal(f.get('start').disabled,true);
});

test('a completed import of a deliberately stopped Devices instance links to the existing module activation screen', async () => {
    const devices = {id:'devices',source:'nexowatt-devices.0',sourceVersion:'0.5.172',enabled:false,targetEnabled:false};
    const f = await fixture(offer({phase:'COMMITTED',canStart:false,sources:[devices]}));
    const link = f.get('sources').children[0].children.find(n => n.tag === 'a');
    assert.equal(link.href,'/runtime/'); assert.match(link.textContent,/Gerätemodul.*aktivieren/);
    assert.match(f.get('sources').textContent,/vor der Übernahme deaktiviert/);
    await f.refresh(offer({phase:'COMMITTED',canStart:false,sources:[{...devices,targetEnabled:true}]}));
    assert.equal(f.get('sources').children[0].children.some(n=>n.tag==='a'),false);
    assert.match(f.get('sources').textContent,/integriertes Gerätemodul freigegeben/);
});
