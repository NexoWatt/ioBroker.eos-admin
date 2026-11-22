'use strict';
// Real controller, installed tarball and HTTP endpoints. No physical devices.
const path = require('node:path');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { tests } = require('@iobroker/testing');
const { password } = require(path.join(path.dirname(require.resolve('@iobroker/js-controller-common-db')), 'lib/common/password.js'));
const base = 'http://127.0.0.1:18188';
tests.integration(path.resolve(__dirname, '..'), {
    controllerVersion: '7.2.5',
    loglevel: 'info',
    defineAdditionalTests({ suite }) {
        suite('Unified real HTTP onboarding', getHarness => {
            let harness;
            const secret = randomBytes(24).toString('base64url');
            let cookie = '';
            before(async function () {
                this.timeout(60000);
                harness = getHarness();
                const hash = await new Promise((resolve, reject) => password(secret).hash(null, null, (error, value) => error ? reject(error) : resolve(value)));
                await harness.objects.setObjectAsync('system.user.eosintegration', {
                    _id: 'system.user.eosintegration', type: 'user', common: {name: 'EOS integration', enabled: true, password: hash},
                    native: {nexowattEosAccount: {passwordInitialized: true, passwordSetupVersion: 1}},
                });
                const group = await harness.objects.getObjectAsync('system.group.administrator');
                group.common.members = [...new Set([...(group.common.members || []), 'system.user.eosintegration'])];
                await harness.objects.setObjectAsync(group._id, group);
                await harness.changeAdapterConfig('eos-admin', {native: {port: 18188, bind: '127.0.0.1', secure: false, eosExternalOrigin: ''}});
                await harness.startAdapterAndWait();
                for (let i = 0; i < 100; i++) {
                    try { if ((await fetch(base + '/api/auth/status')).status === 200) return; } catch { /* bounded readiness poll */ }
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
                throw new Error('Unified HTTP did not become ready');
            });
            it('serves the single login and its actual script without an Origin header', async () => {
                const response = await fetch(base + '/login.html');
                assert.equal(response.status, 200);
                assert.match(await response.text(), /NexoWatt/);
                const script = await fetch(base + '/static/login.js');
                assert.equal(script.status, 200);
                assert.match(script.headers.get('content-type'), /javascript/);
            });
            it('denies anonymous APIs and rejects cross-origin authentication', async () => {
                assert.equal((await fetch(base + '/api/state')).status, 401);
                const response = await fetch(base + '/api/auth/login', {method: 'POST', headers: {'content-type': 'application/json', origin: 'https://untrusted.invalid'}, body: JSON.stringify({user: 'eosintegration', password: secret})});
                assert.equal(response.status, 403);
            });
            it('authenticates once and directs the administrator to central activation', async () => {
                const response = await fetch(base + '/api/auth/login', {method: 'POST', headers: {'content-type': 'application/json', origin: base}, body: JSON.stringify({user: 'eosintegration', password: secret})});
                const body = await response.json();
                assert.equal(response.status, 200, JSON.stringify(body));
                assert.ok(!body.access_token && !body.refresh_token, 'no bearer tokens in JSON');
                cookie = response.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
                assert.match(cookie, /access_token=/);
                const status = await (await fetch(base + '/api/auth/status', {headers: {cookie}})).json();
                assert.equal(status.authenticated, true);
                assert.equal(status.role, 'admin');
                assert.equal(status.activationRequired, true);
                assert.equal(status.nextUrl, '/nexowatt/license');
                assert.equal((await fetch(base + '/nexowatt/license', {headers: {cookie}})).status, 200);
                assert.equal((await fetch(base + '/system/', {headers: {cookie}})).status, 200);
            });
            it('requires CSRF for logout and revokes the authenticated session', async () => {
                const headers = {cookie, origin: base};
                assert.equal((await fetch(base + '/api/auth/logout', {method: 'POST', headers})).status, 403);
                const status = await (await fetch(base + '/api/auth/status', {headers: {cookie}})).json();
                const response = await fetch(base + '/api/auth/logout', {method: 'POST', headers: {...headers, 'x-nw-csrf': status.csrfToken}});
                assert.equal(response.status, 200);
                const after = await (await fetch(base + '/api/auth/status', {headers: {cookie}})).json();
                assert.equal(after.authenticated, false);
            });
        });
    },
});
