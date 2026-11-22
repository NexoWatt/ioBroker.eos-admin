/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express5 = require('express');
const express4 = require('express4');
const { createHostedHttpHandler } = require('../ui/lib/hosted-http-boundary');
const { safeHttpFailure } = require('../ui/lib/http-error-boundary');

async function listen(t, app) {
    const server = http.createServer(app);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
    return async (url, options) => {
        const response = await fetch(`http://127.0.0.1:${server.address().port}${url}`, options);
        return { status: response.status, text: await response.text(), headers: response.headers };
    };
}
function safeErrors(app) {
    app.use((error, _req, res, _next) => {
        if (res.headersSent) return res.end();
        const failure = safeHttpFailure(error);
        res.set('Cache-Control', 'no-store').status(failure.status).json(failure.body);
    });
}

test('field regression reproduces missing query with unadapted real Express 5 to 4 dispatch', async t => {
    const host = express5(), ui = express4();
    ui.get('/api/history', (req, res) => res.json({ missing: req.query === undefined }));
    host.use((req, res, next) => ui(req, res, next));
    const request = await listen(t, host);
    assert.deepEqual(JSON.parse((await request('/api/history?from=123')).text), { missing: true });
});

test('embedded parser retains duplicate/nested values and sees the rewritten current URL', async t => {
    const host = express5(), ui = express4();
    host.use('/mounted', (req, _res, next) => { req.url = req.url.replace('/rewrite?', '/read?'); next(); });
    ui.get('/read', (req, res) => res.json({ query: req.query, original: req.originalUrl, base: req.baseUrl }));
    host.use('/mounted', createHostedHttpHandler(ui));
    const request = await listen(t, host);
    const result = await request('/mounted/rewrite?from=1&from=2&nested[value]=3&encoded=a%2Bb');
    assert.equal(result.status, 200);
    assert.deepEqual(JSON.parse(result.text), {
        query: { from: ['1', '2'], nested: { value: '3' }, encoded: 'a+b' },
        original: '/mounted/rewrite?from=1&from=2&nested[value]=3&encoded=a%2Bb', base: '/mounted',
    });
});

test('fallthrough, error return and finish restore host prototypes and own query descriptors', async t => {
    const host = express5(), ui = express4();
    const saved = new Map();
    host.use((req, res, next) => {
        const query = { retained: 'outer' };
        Object.defineProperty(req, 'query', { configurable: true, enumerable: false, writable: false, value: query });
        saved.set(req.path, { req, res, request: Object.getPrototypeOf(req), response: Object.getPrototypeOf(res), query });
        next();
    });
    ui.get('/pass', (_req, _res, next) => next());
    ui.get('/error', async () => { throw new Error('SYNTHETIC_PRIVATE_FAILURE'); });
    ui.get('/finish', (req, res) => res.json({ query: req.query }));
    host.use(createHostedHttpHandler(ui));
    host.use((req, res) => res.status(202).json({ appRestored: req.app === host, query: req.query }));
    host.use((_error, req, res, _next) => res.status(500).json({ appRestored: req.app === host, query: req.query }));
    const request = await listen(t, host);
    for (const path of ['/pass', '/error', '/finish']) {
        const response = await request(`${path}?inside=1`);
        assert.equal(response.status, path === '/pass' ? 202 : path === '/error' ? 500 : 200);
        const context = saved.get(path);
        assert.equal(Object.getPrototypeOf(context.req), context.request);
        assert.equal(Object.getPrototypeOf(context.res), context.response);
        assert.equal(context.req.query, context.query);
        assert.equal(Object.getOwnPropertyDescriptor(context.req, 'query').writable, false);
        assert.equal(Object.getOwnPropertyDescriptor(context.req, 'query').enumerable, false);
        if (path !== '/finish') assert.equal(JSON.parse(response.text).appRestored, true);
        else assert.deepEqual(JSON.parse(response.text).query, { inside: '1' });
    }
});

test('async middleware, route and error-handler rejections stay local and sanitized', async t => {
    const host = express5(), ui = express4();
    const nested = express4.Router();
    ui.use(async (req, _res, next) => {
        if (req.path === '/middleware') throw new Error('SYNTHETIC_PRIVATE_MIDDLEWARE');
        next();
    });
    ui.get('/failed', async () => { await Promise.resolve(); throw new Error('SYNTHETIC_PRIVATE_ROUTE'); });
    ui.get('/empty-rejection', () => Promise.reject());
    ui.get('/sentinel-rejection', () => Promise.reject('route'));
    nested.route('/failed').get(async () => { throw new Error('SYNTHETIC_PRIVATE_NESTED'); });
    ui.use('/nested', nested);
    ui.get('/parser', (_req, _res, next) => next({ type: 'entity.too.large' }));
    ui.get('/stream', async (_req, res) => { res.write('started'); await Promise.resolve(); throw new Error('SYNTHETIC_PRIVATE_STREAM'); });
    ui.get('/healthy', (_req, res) => res.json({ ok: true }));
    ui.use(async (error, req, _res, next) => {
        if (req.path === '/failed') throw new Error('SYNTHETIC_PRIVATE_ERROR_HANDLER');
        next(error);
    });
    safeErrors(ui);
    host.use(createHostedHttpHandler(ui));
    const request = await listen(t, host);
    for (const path of ['/middleware', '/failed', '/nested/failed', '/empty-rejection', '/sentinel-rejection']) {
        const response = await request(path);
        assert.equal(response.status, 500, path);
        assert.equal(JSON.parse(response.text).error, 'internal_error');
        assert.equal(response.headers.get('cache-control'), 'no-store');
        assert.doesNotMatch(response.text, /SYNTHETIC|node_modules|Error:/);
    }
    assert.equal((await request('/parser')).status, 413);
    assert.equal((await request('/stream')).text, 'started');
    assert.deepEqual(JSON.parse((await request('/healthy')).text), { ok: true });
});

test('late rejection after next does not dispatch twice or alter the following route', async t => {
    const host = express5(), ui = express4();
    let downstreamCalls = 0, errorCalls = 0;
    ui.use(async (_req, _res, next) => { next(); await Promise.resolve(); throw new Error('late'); });
    ui.get('/healthy', (_req, res) => { downstreamCalls++; res.json({ ok: true }); });
    ui.use((_error, _req, res, _next) => { errorCalls++; res.status(500).end(); });
    host.use(createHostedHttpHandler(ui));
    const request = await listen(t, host);
    for (let i = 0; i < 2; i++) assert.equal((await request('/healthy')).status, 200);
    assert.equal(downstreamCalls, 2);
    assert.equal(errorCalls, 0);
});

test('per-app containment leaves other apps and framework layer prototypes unchanged', () => {
    const ui = express4(), other = express4();
    const handler = async () => {};
    ui.get('/owned', handler);
    other.get('/other', handler);
    const layer = other._router.stack.find(item => item.route).route.stack[0];
    const before = Object.getPrototypeOf(layer).handle_request;
    createHostedHttpHandler(ui);
    assert.equal(layer.handle, handler);
    assert.equal(Object.getPrototypeOf(layer).handle_request, before);
});
