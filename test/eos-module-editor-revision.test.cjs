/* Copyright (c) 2026 NexoWatt. Confidential and proprietary. */
'use strict';
// Execute the actual browser scripts in a small DOM fixture. This checks draft
// preservation and request contracts, not visual layout or a graphical browser.
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const before = '00000000-0000-4000-8000-000000000001';
const after = '00000000-0000-4000-8000-000000000002';
async function settled(predicate) {
    for (let turn = 0; turn < 100; turn++) { if (predicate()) return; await new Promise(resolve => setImmediate(resolve)); }
    assert.fail('browser action did not settle');
}

async function fixture(moduleId) {
    const nodes = new Map(); const inputs = []; const requests = [];
    class Element {
        constructor(tag = 'div') { this.tagName = tag.toUpperCase(); this.events = {}; this.children = []; this.dataset = {}; this.value = ''; this.checked = false; this.textContent = ''; this.classList = { toggle() {} }; }
        set id(value) { this._id = value; nodes.set(value, this); }
        get id() { return this._id; }
        append(...children) { this.children.push(...children); }
        replaceChildren(...children) { this.children = children; }
        addEventListener(name, fn) { this.events[name] = fn; }
        setAttribute(name, value) { this[name] = value; }
        focus() {}
        showModal() { this.open = true; }
        close() { this.open = false; this.events.close?.(); }
        querySelectorAll(selector) {
            const descendants = this.children.flatMap(node => [node, ...(node.querySelectorAll?.('*') || [])]);
            return selector === '*' ? descendants : selector === 'button' ? descendants.filter(node => node.tagName === 'BUTTON')
                : descendants.filter(node => node.dataset?.config);
        }
        checkValidity() { return true; }
        get valueAsNumber() { return Number(this.value); }
    }
    class Input extends Element { constructor() { super('input'); } }
    const source = fs.readFileSync(path.join(__dirname, `../modules/${moduleId}/admin/index.js`), 'utf8');
    for (const match of source.matchAll(/(?:byId|inputById|buttonById|element|inputElement)\('([^']+)'\)/g)) {
        if (!nodes.has(match[1])) { const node = new Element(); node.id = match[1]; }
    }
    const key = moduleId === 'eebus' ? 'serviceName' : 'path';
    let revision = before; let token = 'csrf-old'; let config = { enabled: false, [key]: 'Stored initial value' };
    const context = { Error, Promise, console, AbortController, setTimeout, clearTimeout, structuredClone,
        HTMLInputElement: Input, window: { confirm: () => true, addEventListener() {} },
        document: { getElementById: id => nodes.get(id) || null, querySelectorAll: () => inputs,
            createElement(tag) { const node = tag === 'input' ? new Input() : new Element(tag); if (tag === 'input') inputs.push(node); return node; } },
        async fetch(url, options) {
            requests.push({ url, ...options });
            if (options.method === 'PUT') {
                const body = JSON.parse(options.body);
                assert.equal(options.headers['x-nw-csrf'], token);
                if (body.expectedConfigurationRevision !== revision) return { ok: false, status: 409, json: async () => ({ error: 'EOS_MODULE_CONFIG_CONFLICT' }) };
                config = body.config; revision = after;
            }
            return { ok: true, status: 200, json: async () => ({ csrfToken: token, configurationRevision: revision, config: structuredClone(config), status: { reason: 'DISABLED', details: { history: [], devices: [] } } }) };
        } };
    vm.runInNewContext(source, context, { filename: `${moduleId}/admin/index.js` });
    const field = () => nodes.get(`field-${key}`);
    if (moduleId === 'backup') {
        await settled(() => nodes.has('backup-open-other'));
        await new Promise(resolve => setImmediate(resolve));
        nodes.get('backup-open-other').events.click();
    }
    await settled(() => field()?.value === 'Stored initial value');
    await new Promise(resolve => setImmediate(resolve));
    return { nodes, field, requests, config: () => config,
        externalSave() { config = { ...config, [key]: 'Saved in another browser' }; revision = after; token = 'csrf-current'; },
        async refresh() { nodes.get('refresh').events.click(); await settled(() => nodes.get('message').textContent === 'Status aktualisiert.'); },
        async save() {
            if (moduleId === 'eebus') nodes.get('save').events.click();
            else { nodes.get('dialog-form').events.submit({ preventDefault() {} }); nodes.get('settings').events.submit({ preventDefault() {} }); }
            await settled(() => /inzwischen geändert|gespeichert/.test(nodes.get('message').textContent));
            if (moduleId === 'backup') nodes.get('backup-open-other').events.click();
        },
    };
}

for (const moduleId of ['eebus', 'backup']) {
    test(`${moduleId} status refresh rotates CSRF without blessing a stale draft; conflict preserves input`, async () => {
        const f = await fixture(moduleId); f.field().value = 'My unsaved change'; f.externalSave();
        await f.refresh();
        assert.equal(f.field().value, 'My unsaved change');
        await f.save();
        const writes = f.requests.filter(request => request.method === 'PUT');
        assert.equal(writes.length, 1);
        assert.equal(JSON.parse(writes[0].body).expectedConfigurationRevision, before);
        assert.equal(f.field().value, 'My unsaved change');
        assert.equal(f.config()[moduleId === 'eebus' ? 'serviceName' : 'path'], 'Saved in another browser');
        assert.match(f.nodes.get('message').textContent, /inzwischen geändert/);
    });
    test(`${moduleId} a current draft saves with its loaded revision`, async () => {
        const f = await fixture(moduleId); f.field().value = 'Deliberately saved'; await f.save();
        assert.equal(f.config()[moduleId === 'eebus' ? 'serviceName' : 'path'], 'Deliberately saved');
        assert.equal(f.requests.filter(request => request.method === 'PUT').length, 1);
    });
}
