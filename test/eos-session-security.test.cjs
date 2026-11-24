'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { stripTypeScriptTypes } = require('node:module');
assert.equal(typeof stripTypeScriptTypes, 'function', 'Release tests require a supported Node.js 22/24 version (or a supported Node.js version exposing stripTypeScriptTypes). Run node --version.');
const { EosSessionSecurity } = require('../src/lib/eosSessionSecurity');
// Real, version-pinned upstream OAuth model. Type erasure retains an empty import
// for an all-type declaration; remove that one non-runtime import only.
const upstreamSource = fs.readFileSync(path.join(__dirname, 'fixtures/oauth2-model-v1.4.0.ts'), 'utf8');
const upstream = import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(upstreamSource, { mode: 'transform' }).replace("import 'oauth2-server';", '')).toString('base64')}`);
const clone = value => JSON.parse(JSON.stringify(value));
const STAMP = 'nexowattEosSessionV1';
const controllerGroupView = require('./fixtures/controller-7.2.5-group-view.json');
function groupRows(documents) {
    const rows = [];
    const map = vm.runInNewContext(`(${controllerGroupView.view.map})`, {
        emit(id, value) { rows.push({ id, value }); },
    }, { timeout: 1000 });
    documents.forEach(map);
    return rows;
}
async function setup(options) {
    const sessions = new Map();
    const users = { 'system.user.operator': { type: 'user', common: { enabled: true, password: 'test-password-hash-1' }, native: {} } };
    const groups = groupRows([{ _id: 'system.group.eos-installer', type: 'group', common: { name: 'EOS Installer', members: ['system.user.operator'], acl: { object: { read: true } } } }]);
    const adapter = {
        config: {}, log: { warn() {}, info() {}, debug() {}, error() {} },
        getSession(id, cb) { cb(sessions.has(id) ? clone(sessions.get(id)) : null); },
        setSession(id, ttl, value, cb) { sessions.set(id, clone(value)); cb?.(null); },
        async destroySession(id) { sessions.delete(id); },
        async getForeignObjectAsync(id) { return users[id] ? clone(users[id]) : null; },
        async getObjectViewAsync() { return { rows: clone(groups) }; },
        checkPassword(name, password, cb) { cb(name === 'operator' && password === 'test-only-passphrase', `system.user.${name}`); },
    };
    const security = new EosSessionSecurity(adapter, options);
    const model = new (await upstream).OAuth2Model(adapter, { noBasicAuth: true });
    security.bindOAuthModel(model);
    let number = 0;
    const issue = async (user) => {
        user ||= await model.getUser('operator', 'test-only-passphrase');
        const pair = { accessToken: `access-token-${++number}`, refreshToken: `refresh-token-${number}`, accessTokenExpiresAt: new Date(Date.now() + 60000), refreshTokenExpiresAt: new Date(Date.now() + 120000) };
        await model.saveToken(pair, { id: 'ioBroker' }, user);
        return pair;
    };
    return { adapter, security, model, sessions, users, groups, issue };
}

test('pinned upstream password login, token pair and refresh work with security binding', async () => {
    const x = await setup();
    const first = await x.issue();
    assert.equal((await x.model.getAccessToken(first.accessToken)).user.id, 'operator');
    assert.equal(x.sessions.get(`a:${first.accessToken}`)[STAMP].fingerprint.length, 64);
    assert.deepEqual(x.sessions.get(`a:${first.accessToken}`)[STAMP], x.sessions.get(`r:${first.refreshToken}`)[STAMP]);
    const refresh = await x.model.getRefreshToken(first.refreshToken);
    const next = await x.issue(refresh.user);
    assert.ok(await x.model.getAccessToken(next.accessToken));
    x.security.stop();
});

test('real controller group view accepts string and translated display keys using canonical object IDs', async () => {
    for (const name of ['Administrators', { en: 'Administrators', de: 'Administratoren' }]) {
        const x = await setup();
        const documents = clone(controllerGroupView.groups);
        documents[0].common.name = name;
        x.groups.splice(0, x.groups.length, ...groupRows(documents));
        assert.deepEqual(x.groups[0].id, name);
        assert.notEqual(x.groups[0].id, x.groups[0].value._id);
        const token = await x.issue();
        assert.ok(await x.model.getAccessToken(token.accessToken));
        x.security.stop();
    }
});

test('group display names, metadata and row order do not change credential proofs', async () => {
    const x = await setup();
    x.groups.push(...groupRows([{ _id: 'system.group.other', type: 'group', common: { name: 'Other', members: [], acl: {} } }]));
    const token = await x.issue();
    const before = await x.security.snapshot('operator');
    x.groups[0].id = { en: 'Renamed', de: 'Umbenannt' };
    x.groups[0].value.common.name = x.groups[0].id;
    x.groups[0].value.native = { unrelated: true };
    x.groups.reverse();
    assert.deepEqual(await x.security.snapshot('operator'), before);
    assert.ok(await x.model.getAccessToken(token.accessToken));
    x.security.stop();
});

test('missing, foreign, empty and duplicate canonical group IDs fail closed despite valid view keys', async () => {
    for (const mutate of [
        x => { delete x.groups[0].value._id; },
        x => { x.groups[0].value._id = 'system.user.admin'; },
        x => { x.groups[0].value._id = 'system.group.'; },
        x => { x.groups[0].value._id = 42; },
        x => { x.groups.push(clone(x.groups[0])); x.groups[1].id = 'Different display name'; },
    ]) {
        const x = await setup();
        const token = await x.issue();
        x.groups[0].id = 'system.group.looks-valid';
        mutate(x);
        assert.equal(await x.model.getUser('operator', 'test-only-passphrase'), null);
        assert.ok(!await x.model.getAccessToken(token.accessToken));
        assert.ok(!await x.model.getRefreshToken(token.refreshToken));
        x.security.stop();
    }
});

test('canonical group identity and ACL mutations revoke established capabilities', async () => {
    for (const mutate of [
        x => { x.groups[0].value._id = 'system.group.replaced'; },
        x => { x.groups[0].value.common.acl.object.read = false; },
        x => { x.groups[0].value.acl = { owner: 'system.user.operator', object: 0x600 }; },
    ]) {
        const x = await setup();
        const token = await x.issue();
        mutate(x);
        assert.ok(!await x.model.getAccessToken(token.accessToken));
        assert.ok(!await x.model.getRefreshToken(token.refreshToken));
        x.security.stop();
    }
});

test('all devices access and refresh tokens reject changed password without waiting for object event', async () => {
    const x = await setup();
    const tokens = [await x.issue(), await x.issue()];
    x.users['system.user.operator'].common.password = 'test-password-hash-2';
    for (const token of tokens) {
        assert.ok(!await x.model.getAccessToken(token.accessToken));
        assert.ok(!await x.model.getRefreshToken(token.refreshToken));
    }
    x.security.stop();
});

test('disable, deletion and changed group ACL independently invalidate both token classes', async () => {
    for (const mutate of [x => { x.users['system.user.operator'].common.enabled = false; }, x => { delete x.users['system.user.operator']; }, x => { x.groups[0].value.common.acl.object.read = false; }, x => { x.groups[0].value.common.members = []; }]) {
        const x = await setup(); const token = await x.issue(); mutate(x);
        assert.ok(!await x.model.getAccessToken(token.accessToken));
        assert.ok(!await x.model.getRefreshToken(token.refreshToken));
        x.security.stop();
    }
});

test('observed disable then re-enable cannot resurrect old token after snapshot returns to original', async () => {
    const x = await setup(); const token = await x.issue(); const previous = clone(x.users['system.user.operator']);
    x.users['system.user.operator'].common.enabled = false;
    x.security.handleObjectChange('system.user.operator', x.users['system.user.operator'], previous);
    x.users['system.user.operator'] = previous;
    assert.ok(!await x.model.getAccessToken(token.accessToken));
    assert.ok(!await x.model.getRefreshToken(token.refreshToken));
    assert.ok(await x.model.getAccessToken((await x.issue()).accessToken));
    x.security.stop();
});

test('legacy and unbound external tokens are rejected and direct internal minting is denied', async () => {
    const x = await setup();
    x.sessions.set('a:legacy', { user: 'operator', aExp: Date.now() + 60000 });
    assert.ok(!await x.model.getAccessToken('legacy'));
    await assert.rejects(x.adapter.setSession('a:unbound', 60, { user: 'operator' }), /REAUTHENTICATION/);
    await assert.rejects(x.model.generateTokens('operator'), /REAUTHENTICATION/);
    x.security.stop();
});

test('proof cannot be forged by passing a user-shaped object or copied authenticated identity', async () => {
    const x = await setup();
    const user = await x.model.getUser('operator', 'test-only-passphrase');
    await assert.rejects(x.issue({ ...user }), /REAUTHENTICATION/);
    await assert.rejects(x.issue({ id: 'operator', [STAMP]: { epoch: x.security.epoch } }), /REAUTHENTICATION/);
    x.security.stop();
});

test('password mutation during credential verification and before token save fails closed', async () => {
    const x = await setup();
    x.adapter.checkPassword = (name, password, cb) => { x.users['system.user.operator'].common.password = 'changed-in-check'; cb(true, 'system.user.operator'); };
    assert.equal(await x.model.getUser('operator', 'test-only-passphrase'), null);
    x.adapter.checkPassword = (name, password, cb) => cb(true, 'system.user.operator');
    const user = await x.model.getUser('operator', 'test-only-passphrase');
    x.users['system.user.operator'].common.password = 'changed-before-save';
    await assert.rejects(x.issue(user), /REAUTHENTICATION/);
    x.security.stop();
});

test('refresh credential cannot cross revocation between lookup and save', async () => {
    const x = await setup(); const old = await x.issue();
    const refresh = await x.model.getRefreshToken(old.refreshToken);
    x.security.revoke();
    await assert.rejects(x.issue(refresh.user), /REAUTHENTICATION/);
    x.security.stop();
});

test('restart generation does not accept previously saved capabilities', async () => {
    const x = await setup(); const old = await x.issue();
    x.security.revoke();
    assert.ok(!await x.model.getAccessToken(old.accessToken));
    assert.ok(!await x.model.getRefreshToken(old.refreshToken));
    x.security.stop();
});

test('session database failures and bounded stalled reads fail closed without unbounded backlog', async () => {
    const x = await setup({ timeoutMs: 25, maxPending: 3 }); const old = await x.issue();
    x.adapter.getForeignObjectAsync = () => new Promise(() => {});
    assert.ok(!await x.model.getAccessToken(old.accessToken));
    assert.ok(!await x.model.getAccessToken(old.accessToken));
    assert.ok(!await x.model.getAccessToken(old.accessToken));
    assert.equal(x.security.pending, 3);
    assert.ok(!await x.model.getAccessToken(old.accessToken));
    assert.equal(x.security.pending, 3);
    x.security.stop();
});

test('socket revocation synchronously blocks commands, clears subscriptions and closes every connection', async () => {
    const x = await setup(); const handlers = {}; let closed = 0; let cleared = 0;
    const socketAdmin = {
        addEventHandler(name, handler) { handlers[name] = handler; },
        __updateSession() { return true; },
        __getUserFromSocket(client, callback) { callback(null, 'system.user.operator', Date.now() + 60000); },
        unsubscribeSocket() { cleared++; },
    };
    x.security.bindSockets(socketAdmin);
    const clients = [{ emit() {}, disconnect() { closed++; } }, { emit() {}, close() { closed++; } }];
    const pair = await x.issue();
    for (const client of clients) {
        client.conn = { request: { headers: { cookie: `access_token=${pair.accessToken}` } } };
        handlers.connect(client);
        assert.equal(socketAdmin.__updateSession(client), false, 'pending sockets have no authority');
        await new Promise((resolve, reject) => socketAdmin.__getUserFromSocket(client, error => error ? reject(Error(error)) : resolve()));
        assert.equal(socketAdmin.__updateSession(client), true);
    }
    x.security.revoke();
    for (const client of clients) assert.equal(socketAdmin.__updateSession(client), false);
    assert.equal(closed, 2); assert.equal(cleared, 2);
    x.security.stop();
});

test('metadata-only account updates do not revoke established capabilities', async () => {
    const x = await setup(); const token = await x.issue(); const previous = clone(x.users['system.user.operator']);
    x.users['system.user.operator'].native.displayHint = 'irrelevant';
    x.security.handleObjectChange('system.user.operator', x.users['system.user.operator'], previous);
    assert.ok(await x.model.getAccessToken(token.accessToken));
    x.security.stop();
});

test('expired access and refresh capabilities fail closed in the common session reader', async () => {
    const x = await setup(); const pair = await x.issue();
    x.sessions.get(`a:${pair.accessToken}`).aExp = Date.now() - 1;
    x.sessions.get(`r:${pair.refreshToken}`).rExp = Date.now() - 1;
    assert.ok(!await x.model.getAccessToken(pair.accessToken));
    assert.ok(!await x.model.getRefreshToken(pair.refreshToken));
    x.security.stop();
});

test('late socket authentication cannot reopen a connection after revocation', async () => {
    const x = await setup(); const handlers = {}; let originalCallback; let closed = 0;
    const socketAdmin = {
        addEventHandler(name, handler) { handlers[name] = handler; },
        __updateSession() { return true; },
        __getUserFromSocket(client, callback) { originalCallback = callback; },
        unsubscribeSocket() {},
    };
    x.security.bindSockets(socketAdmin);
    const client = { emit() {}, disconnect() { closed++; } }; handlers.connect(client);
    const result = new Promise(resolve => socketAdmin.__getUserFromSocket(client, (error, user) => resolve({ error, user })));
    x.security.revoke(); originalCallback(null, 'system.user.operator', Date.now() + 60000);
    assert.ok((await result).error); assert.equal(x.security.isSocketAllowed(client), false); assert.ok(closed >= 1);
    x.security.stop();
});

test('real five-second watchdog closes a socket after a missed credential object event', async () => {
    const x = await setup(); const handlers = {}; let closed = false;
    const socketAdmin = {
        addEventHandler(name, handler) { handlers[name] = handler; },
        __updateSession() { return true; },
        __getUserFromSocket(client, callback) { callback(null, 'system.user.operator', Date.now() + 60000); },
        unsubscribeSocket() {},
    };
    x.security.bindSockets(socketAdmin);
    const pair = await x.issue();
    const client = { conn: { request: { headers: { cookie: `access_token=${pair.accessToken}` } } }, emit() {}, disconnect() { closed = true; } }; handlers.connect(client);
    await new Promise((resolve, reject) => socketAdmin.__getUserFromSocket(client, error => error ? reject(Error(error)) : resolve()));
    x.users['system.user.operator'].common.password = 'changed-with-no-event';
    await new Promise(resolve => setTimeout(resolve, 5250));
    assert.equal(closed, true); assert.equal(x.security.isSocketAllowed(client), false);
    x.security.stop();
});

test('idle deadline rejects access and refresh at ten minutes despite status reads and automatic token rotation', async t => {
    let now = 0;
    const x = await setup({ now: () => now }); t.after(() => x.security.stop());
    const first = await x.issue();
    const familyId = x.sessions.get(`a:${first.accessToken}`)[STAMP].familyId;
    now = 540000;
    for (let i = 0; i < 20; i++) {
        const session = await x.adapter.getSession(`a:${first.accessToken}`);
        assert.equal(x.security.idleView(session).authenticated, true);
    }
    const refresh = await x.model.getRefreshToken(first.refreshToken);
    const second = await x.issue(refresh.user);
    assert.equal(x.sessions.get(`a:${second.accessToken}`)[STAMP].familyId, familyId);
    now = 599999;
    assert.ok(await x.model.getAccessToken(second.accessToken));
    now = 600000;
    assert.equal(await x.model.getAccessToken(first.accessToken), null);
    assert.equal(await x.model.getAccessToken(second.accessToken), null);
    assert.equal(await x.model.getRefreshToken(second.refreshToken), null);
    assert.equal(x.security.families.size, 0);
    assert.equal(x.security.activity(x.sessions.get(`a:${first.accessToken}`)), false, 'an old activity request cannot resurrect a family');
});

test('only explicit activity extends the same family; other independent logins remain isolated', async t => {
    let now = 0;
    const x = await setup({ now: () => now }); t.after(() => x.security.stop());
    const phone = await x.issue(); const desktop = await x.issue();
    assert.notEqual(x.sessions.get(`a:${phone.accessToken}`)[STAMP].familyId, x.sessions.get(`a:${desktop.accessToken}`)[STAMP].familyId);
    now = 599999;
    assert.equal(x.security.activity(await x.adapter.getSession(`a:${desktop.accessToken}`)), true);
    now = 600000;
    assert.equal(await x.model.getAccessToken(phone.accessToken), null);
    assert.ok(await x.model.getAccessToken(desktop.accessToken));
    const refreshed = await x.issue((await x.model.getRefreshToken(desktop.refreshToken)).user);
    x.security.revokeSession(await x.adapter.getSession(`a:${desktop.accessToken}`));
    assert.equal(await x.model.getAccessToken(refreshed.accessToken), null);
    assert.equal(await x.model.getRefreshToken(refreshed.refreshToken), null);
    const next = await x.issue();
    assert.ok(await x.model.getAccessToken(next.accessToken), 'fresh credentials can create a new login');
});

test('idle read and token-save races recheck after asynchronous work', async t => {
    let now = 0;
    const x = await setup({ now: () => now }); t.after(() => x.security.stop());
    const first = await x.issue();
    const savedGet = x.adapter.getForeignObjectAsync;
    x.adapter.getForeignObjectAsync = async id => { const value = await savedGet(id); now = 600000; return value; };
    assert.equal(await x.model.getAccessToken(first.accessToken), null);
    x.adapter.getForeignObjectAsync = savedGet;
    const second = await x.issue();
    const refresh = await x.model.getRefreshToken(second.refreshToken);
    now += 600000;
    await assert.rejects(x.issue(refresh.user), /REAUTHENTICATION/);
    assert.equal(await x.model.getRefreshToken(second.refreshToken), null);
});

test('idle expiry uses a monotonic clock and is unchanged by a backwards wall clock', async t => {
    let now = 0;
    const x = await setup({ now: () => now }); t.after(() => x.security.stop());
    const first = await x.issue();
    const wall = Date.now();
    t.mock.method(Date, 'now', () => wall - 86400000);
    now = 599999;
    assert.ok(await x.model.getAccessToken(first.accessToken));
    now = 600000;
    assert.equal(await x.model.getAccessToken(first.accessToken), null);
    assert.equal(await x.model.getRefreshToken(first.refreshToken), null);
});

test('bounded families prune expired entries and never evict another still-active login', async t => {
    let now = 0;
    const x = await setup({ now: () => now, maxFamilies: 2 }); t.after(() => x.security.stop());
    const first = await x.issue(); await x.issue();
    assert.equal(await x.model.getUser('operator', 'test-only-passphrase'), null);
    assert.ok(await x.model.getAccessToken(first.accessToken));
    now = 600000;
    assert.ok(await x.model.getAccessToken((await x.issue()).accessToken));
    assert.equal(x.security.families.size, 1);
    x.security.stop();
    assert.equal(x.security.families.size, 0);
});

test('idle timer disposes silent SSE and sockets, rejects refreshed old sockets and preserves active other family', async t => {
    const { EventEmitter } = require('node:events');
    let now = 0;
    const x = await setup({ now: () => now }); t.after(() => x.security.stop());
    const idle = await x.issue(); const active = await x.issue();
    const handlers = {}; let rotations = 0;
    const socketAdmin = {
        addEventHandler(name, handler) { handlers[name] = handler; },
        __updateSession() { return true; },
        __getUserFromSocket(client, callback) { callback(null, 'system.user.operator', Date.now() + 60000); },
        unsubscribeSocket(client) { client.unsubscribed = true; },
        commands: { commands: { updateTokenExpiration(client, token, callback) { rotations++; callback(null, true); } } },
    };
    x.security.bindSockets(socketAdmin);
    const client = new EventEmitter(); client.conn = { request: { headers: { cookie: `access_token=${idle.accessToken}` } } };
    client.disconnect = () => { client.closed = true; client.emit('disconnect'); };
    handlers.connect(client);
    await new Promise((resolve, reject) => socketAdmin.__getUserFromSocket(client, error => error ? reject(Error(error)) : resolve()));
    const response = new EventEmitter(); response.end = () => { response.ended = true; response.emit('finish'); };
    assert.equal(await x.security.bindStream(idle.accessToken, response), true);
    now = 599999;
    x.security.activity(await x.adapter.getSession(`a:${active.accessToken}`));
    const refreshed = await x.issue((await x.model.getRefreshToken(idle.refreshToken)).user);
    await new Promise(resolve => socketAdmin.commands.commands.updateTokenExpiration(client, refreshed.accessToken, (error, allowed) => { assert.equal(error, null); assert.equal(allowed, true); resolve(); }));
    now = 600000;
    // A real server timer must dispose even when neither browser nor data source sends anything.
    await new Promise(resolve => setTimeout(resolve, 1100));
    assert.equal(response.ended, true); assert.equal(client.closed, true); assert.equal(client.unsubscribed, true);
    assert.equal(x.security.streams.size, 0); assert.equal(x.security.isSocketAllowed(client), false);
    await new Promise(resolve => socketAdmin.commands.commands.updateTokenExpiration(client, active.accessToken, (error, allowed) => { assert.ok(error); assert.equal(allowed, false); resolve(); }));
    assert.equal(rotations, 1); assert.ok(await x.model.getAccessToken(active.accessToken));
});

test('throwing authentication callbacks and upstream token rotation do not cause unhandled promise rejection', async t => {
    const x = await setup(); t.after(() => x.security.stop());
    const pair = await x.issue(); let warnings = 0;
    x.adapter.log.warn = () => { warnings++; };
    const handlers = {};
    const socketAdmin = {
        addEventHandler(name, handler) { handlers[name] = handler; },
        __updateSession() { return true; },
        __getUserFromSocket(client, callback) { callback(null, 'system.user.operator', Date.now() + 60000); },
        unsubscribeSocket() {},
        commands: { commands: { updateTokenExpiration() { throw new Error('simulated upstream failure'); } } },
    };
    x.security.bindSockets(socketAdmin);
    const client = () => ({ conn: { request: { headers: { cookie: `access_token=${pair.accessToken}` } } }, emit() {}, disconnect() { this.closed = true; } });
    const throwing = client(); handlers.connect(throwing);
    socketAdmin.__getUserFromSocket(throwing, () => { throw new Error('simulated callback failure'); });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(throwing.closed, true);
    const rotating = client(); handlers.connect(rotating);
    await new Promise((resolve, reject) => socketAdmin.__getUserFromSocket(rotating, error => error ? reject(Error(error)) : resolve()));
    socketAdmin.commands.commands.updateTokenExpiration(rotating, pair.accessToken, () => { throw new Error('simulated error callback failure'); });
    x.adapter.getSession(`a:${pair.accessToken}`, () => { throw new Error('simulated stored-session callback failure'); });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(rotating.closed, true);
    assert.equal(warnings, 3);
    assert.ok(await x.model.getAccessToken(pair.accessToken), 'transport callback failure does not stop another connection in the family');
});

test('TOTP account contract never falls back to password-only issuance or cached/refresh tokens', async()=>{
 for(const value of [{totp:{enabled:true}}, {totp:'test-marker'}, {totp:false}, 'malformed', []]) {
  const x=await setup();const token=await x.issue(); const previous=clone(x.users['system.user.operator']);
  x.users['system.user.operator'].common.externalAuthentication=value;
  assert.equal(await x.model.getUser('operator','test-only-passphrase'),null);
  assert.ok(!await x.model.getAccessToken(token.accessToken));assert.ok(!await x.model.getRefreshToken(token.refreshToken));
  const epoch=x.security.epoch;x.security.handleObjectChange('system.user.operator',x.users['system.user.operator'],previous);assert.notEqual(x.security.epoch,epoch);x.security.stop();
 }
});
