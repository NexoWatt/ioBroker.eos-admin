'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');

const root = process.env.EOS_SECURITY_TEST_ROOT || path.resolve(__dirname, '..');
const source = path.join(root, process.env.EOS_TEST_RUNTIME === 'build' ? 'build/lib' : 'src/lib', 'eosUploadGuard.js');
const turn = () => new Promise(resolve => setImmediate(resolve));

function pair() {
    const req = new EventEmitter();
    req.aborted = false;
    req.destroy = () => { req.aborted = true; req.emit('aborted'); };
    const res = new EventEmitter();
    res.status = code => { res.code = code; return res; };
    res.json = body => { res.body = body; res.writableEnded = true; res.writableFinished = true; res.emit('finish'); return res; };
    return { req, res, nextCount: 0 };
}

async function fixture(t) {
    const temporary = await fsp.mkdtemp(path.join(os.tmpdir(), 'eos-upload-admission-'));
    let unlock;
    const blocked = new Promise(resolve => { unlock = resolve; });
    let stalled = true;
    let checks = 0;
    let parsers = 0;
    const timers = new Set();
    const module = { exports: {} };
    vm.runInNewContext(fs.readFileSync(source, 'utf8'), {
        module, exports: module.exports, process, Buffer,
        require(name) {
            if (name === 'node:os') return { tmpdir: () => temporary };
            if (name === 'node:fs/promises') return { ...fsp, async mkdir(...args) {
                checks++;
                if (stalled) await blocked;
                return fsp.mkdir(...args);
            } };
            return require(name);
        },
        setTimeout(fn, ms) { assert.equal(ms, 60000); const timer = { fn }; timers.add(timer); return timer; },
        clearTimeout(timer) { timers.delete(timer); },
    }, { filename: source });
    const api = module.exports;
    const middleware = api.createUploadMiddleware(() => {
        parsers++;
        return (_req, _res, next) => next();
    }, { warn() {} });
    const pairs = [];
    function start() {
        const request = pair(); pairs.push(request);
        middleware(request.req, request.res, error => { assert.ifError(error); request.nextCount++; });
        return request;
    }
    async function release() { stalled = false; unlock(); for (let n = 0; n < 15; n++) await turn(); }
    t.after(async () => {
        for (const request of pairs) request.req.destroy();
        await release();
        // Filesystem callbacks may need a few event-loop turns after admission completes.
        await new Promise(resolve => setTimeout(resolve, 50));
        await fsp.rm(temporary, { recursive: true, force: true });
    });
    return { api, temporary, start, release, timers, get checks() { return checks; }, get parsers() { return parsers; } };
}

test('upload admission has no unbounded queue behind a stalled filesystem', async t => {
    const f = await fixture(t);
    const first = f.start(); const second = f.start();
    const overflow = Array.from({ length: 30 }, () => f.start());
    await turn();
    assert.equal(f.checks, 1, 'only the serialized first check reaches the filesystem');
    assert.equal(f.parsers, 0);
    assert.equal(first.res.code, undefined); assert.equal(second.res.code, undefined);
    for (const request of overflow) {
        assert.equal(request.res.code, 503, 'excess work must fail before stalled admission can resume');
        assert.equal(request.nextCount, 0);
    }
});

test('total upload deadline includes admission and late filesystem completion never starts a parser', async t => {
    const f = await fixture(t);
    const first = f.start(); const second = f.start();
    await turn();
    assert.equal(f.timers.size, 2, 'both deadlines begin before filesystem admission');
    for (const timer of [...f.timers]) timer.fn();
    assert.equal(first.res.code, 408); assert.equal(second.res.code, 408);
    assert.equal(first.req.aborted, true); assert.equal(second.req.aborted, true);
    // A timeout cannot release the slot while its non-cancellable filesystem work remains pending.
    const third = f.start(); await turn(); assert.equal(third.res.code, 503);
    await f.release();
    await new Promise(resolve => setTimeout(resolve, 50));
    assert.equal(f.parsers, 0, 'late callbacks cannot revive an expired upload');
    const next = f.start();
    await new Promise(resolve => setTimeout(resolve, 50));
    assert.equal(next.nextCount, 1, 'settled cancelled admissions release capacity');
    assert.equal(f.parsers, 1);
});

test('client abort during admission retires its deadline and never parses later', async t => {
    const f = await fixture(t);
    const request = f.start(); await turn(); request.req.destroy();
    assert.equal(f.timers.size, 0);
    await f.release();
    assert.equal(request.nextCount, 0); assert.equal(f.parsers, 0);
    assert.equal(request.res.code, undefined);
});
