/** Copyright (c) 2026 NexoWatt. All rights reserved. Confidential and Proprietary. */
'use strict';
// Routing integration fixture: real pinned OAuth model and EOS session security.
// Only controller persistence/password lookup are doubles; no forged session stamp
// or authenticated-idle shortcut is accepted by the product code under test.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { stripTypeScriptTypes } = require('node:module');
const { EosSessionSecurity } = require('../../src/lib/eosSessionSecurity');
const source = fs.readFileSync(path.join(__dirname, 'oauth2-model-v1.4.0.ts'), 'utf8');
const upstream = import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source, { mode: 'transform' })
    .replace("import 'oauth2-server';", '')).toString('base64')}`);
const clone = value => structuredClone(value);

async function installIdleSession(owner, options = {}) {
    const token = options.token || 'a'.repeat(40);
    const user = (options.user || 'operator').replace(/^system\.user\./, '');
    const userId = `system.user.${user}`;
    const password = 'isolated-test-only-passphrase';
    const sessions = new Map();
    const userObject = { _id: userId, type: 'user', common: { enabled: true, password: 'isolated-test-password-hash' }, native: {} };
    const groups = [{ id: 'Administrators', value: {
        _id: 'system.group.administrator', type: 'group', common: { name: 'Administrators', members: [userId], acl: {} }, native: {},
    } }];
    const originalObject = owner.getForeignObjectAsync?.bind(owner);
    const originalView = owner.getObjectViewAsync?.bind(owner);
    owner.getForeignObjectAsync = async (id, ...args) => id === userId
        ? clone(userObject) : originalObject ? originalObject(id, ...args) : null;
    owner.getObjectViewAsync = async (design, search, ...args) => design === 'system' && search === 'group'
        ? { rows: clone(groups) } : originalView ? originalView(design, search, ...args) : { rows: [] };
    owner.checkPassword = (name, supplied, callback) => callback(name === user && supplied === password, `system.user.${name}`);
    owner.getSession = (id, callback) => callback(sessions.has(id) ? clone(sessions.get(id)) : null);
    owner.setSession = (id, _ttl, value, callback) => { sessions.set(id, clone(value)); callback?.(null); };
    owner.destroySession = async (id, callback) => { sessions.delete(id); callback?.(null); };
    const security = new EosSessionSecurity(owner, options.now ? { now: options.now } : {});
    owner.eosSessionSecurity = security;
    try {
        const model = new (await upstream).OAuth2Model(owner, { noBasicAuth: true });
        security.bindOAuthModel(model);
        const authenticatedUser = await model.getUser(user, password);
        assert.ok(authenticatedUser, 'fixture must obtain its user through password authentication');
        await model.saveToken({
            accessToken: token, refreshToken: `refresh-${token}`,
            accessTokenExpiresAt: new Date(Date.now() + 3600000), refreshTokenExpiresAt: new Date(Date.now() + 7200000),
        }, { id: 'ioBroker' }, authenticatedUser);
        const session = await owner.getSession(`a:${token}`);
        assert.ok(session, 'fixture token must pass the real credential and idle-family checks');
        assert.equal(security.idleView(session).authenticated, true);
        return { token, userId, security, model, sessions, cleanup: () => security.stop() };
    } catch (error) {
        security.stop();
        throw error;
    }
}

module.exports = { installIdleSession };
