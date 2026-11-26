'use strict';
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { runInNewContext } = require('node:vm');
const { setImmediate: settle } = require('node:timers/promises');

const directory = join(__dirname, '../public/eos-tls');
const html = readFileSync(join(directory, 'index.html'), 'utf8');
const script = readFileSync(join(directory, 'index.js'), 'utf8');
const requestId = '39a5'.repeat(8);
const fingerprint = 'a3'.repeat(32);
const displayedFingerprint = Array(32).fill('A3').join(':');
const names = ['nexowatt', '192.168.10.192'];
const pending = { requestId, names, local: true, rootFingerprint: fingerprint };

async function page(replies, writeText) {
    const elements = new Map();
    const calls = [];
    const create = () => ({
        children: [],
        value: '',
        checked: false,
        handlers: new Map(),
        addEventListener(name, handler) { this.handlers.set(name, handler); },
        replaceChildren() { this.children = []; },
        append(...nodes) { this.children.push(...nodes); },
        removeAttribute(name) { delete this[name]; },
        reportValidity() { return Boolean(this.value); },
        focus() { this.focused = true; },
        select() { this.selected = true; },
    });
    for (const declaration of html.matchAll(/<[^>]*\sid="([^"]+)"[^>]*>/g)) {
        const element = create();
        element.hidden = /(?:\s)hidden(?:\s|>)/.test(declaration[0]);
        elements.set(declaration[1], element);
    }
    const get = id => {
        assert.ok(elements.has(id), `Missing page element ${id}`);
        return elements.get(id);
    };
    runInNewContext(script, {
        document: { getElementById: get, createElement: create },
        navigator: writeText ? { clipboard: { writeText } } : {},
        AbortController, setTimeout, clearTimeout,
        async fetch(url, options) {
            calls.push({ url, options });
            assert.ok(replies.length, `Unexpected request ${url}`);
            const { body, status = 200 } = replies.shift();
            return Response.json(body, { status });
        },
    });
    await settle();
    return {
        calls, get,
        async emit(id, event) {
            const handler = get(id).handlers.get(event);
            assert.ok(handler, `No ${event} handler for ${id}`);
            await handler({ preventDefault() {} });
            await settle();
        },
    };
}

test('certificate page creates a local draft and activates it without uploading files', async () => {
    const clipboard = [];
    const view = await page([
        { body: { csrfToken: 'session-token', suggestedNames: ['nexowatt'] } },
        { body: { pending } },
        { body: { pending: null, restartRequired: true, rootFingerprint: fingerprint } },
    ], async value => clipboard.push(value));
    assert.equal(view.get('localDraft').hidden, true);
    assert.equal(view.get('names').value, 'nexowatt');
    view.get('names').value = '\n nexowatt\n192.168.10.192\n';
    view.get('replace').checked = true;
    await view.emit('localForm', 'submit');
    assert.equal(view.get('localDraft').hidden, false);
    assert.equal(view.get('externalDraft').hidden, true);
    assert.equal(view.get('replace').checked, false);
    for (const [file, id] of [['device.pem', 'localDeviceDownload'], ['root.pem', 'localRootDownload'], ['root.cer', 'localTrustDownload']]) {
        assert.equal(view.get(id).href, `/api/eos/tls/local/${file}?requestId=${requestId}`);
    }
    assert.equal(view.get('localFingerprint').value, displayedFingerprint);
    await view.emit('copyFingerprint', 'click');
    assert.deepEqual(clipboard, [displayedFingerprint]);
    await view.emit('activateLocal', 'click');
    assert.equal(view.get('localDraft').hidden, true);
    assert.equal(view.get('localDeviceDownload').href, undefined);
    assert.equal(view.get('rootDownload').hidden, false);
    assert.match(view.get('message').textContent, /Adapterneustart/);
    assert.deepEqual(view.calls.map(call => call.url), ['/api/eos/tls', '/api/eos/tls/local', '/api/eos/tls/local/activate']);
    assert.deepEqual(JSON.parse(view.calls[1].options.body), { names, replace: true });
    assert.deepEqual(JSON.parse(view.calls[2].options.body), { requestId, rootFingerprint: displayedFingerprint });
    for (const call of view.calls.slice(1)) {
        assert.equal(call.options.method, 'POST');
        assert.equal(call.options.headers['x-nw-csrf'], 'session-token');
        assert.equal(call.options.credentials, 'same-origin');
        assert.equal(call.options.redirect, 'error');
    }
});

test('prepared root changes warn before activation and fingerprint copying falls back to selection', async () => {
    const view = await page([{ body: { csrfToken: 'token', pending, rootFingerprint: 'fa'.repeat(32) } }]);
    assert.equal(view.get('trustChange').hidden, false);
    await view.emit('copyFingerprint', 'click');
    assert.equal(view.get('localFingerprint').selected, true);
    assert.match(view.get('message').textContent, /markiert/);
    assert.equal(view.calls.length, 1, 'showing a draft does not activate it');
});

test('manufacturer request remains available behind the optional panel', async () => {
    const view = await page([
        { body: { csrfToken: 'token', suggestedNames: names } },
        { body: { pending: { requestId, names } } },
    ]);
    await view.emit('requestForm', 'submit');
    assert.equal(view.get('externalWorkflow').open, true);
    assert.equal(view.get('externalDraft').hidden, false);
    assert.equal(view.get('localDraft').hidden, true);
    assert.equal(view.get('activateLocal').disabled, true);
    assert.equal(view.calls[1].url, '/api/eos/tls/request');
    assert.deepEqual(JSON.parse(view.calls[1].options.body), { names, replace: false });
});

test('invalid drafts expose neither download links nor activation', async () => {
    for (const corrupt of [
        { ...pending, requestId: 'bad?href' },
        { ...pending, rootFingerprint: 'not a fingerprint' },
    ]) {
        const view = await page([{ body: { csrfToken: 'token', pending: corrupt } }]);
        assert.equal(view.get('localDraft').hidden, true);
        assert.equal(view.get('localRootDownload').href, undefined);
        assert.equal(view.get('activateLocal').disabled, true);
        await view.emit('activateLocal', 'click');
        assert.equal(view.calls.length, 1);
    }
});
