import test from 'node:test';
import assert from 'node:assert/strict';
import { logoutUnifiedSession } from '../src/helpers/eosUnifiedSession.ts';
import { licenseEndpoint, parseLicenseStatus } from '../src/components/SystemSettings/eosLicenseApi.ts';

test('license operations remain on the EOS origin from a nested system route', () => {
    assert.equal(licenseEndpoint('status', 'https://192.0.2.8/system/index.html'), 'https://192.0.2.8/nexowatt/license/status');
    assert.equal(licenseEndpoint('activate', 'https://192.0.2.8/system/deep/route'), 'https://192.0.2.8/nexowatt/license/activate');
});

test('logout uses one session and CSRF protection, without reading OAuth tokens', async () => {
    const requests = [];
    const fetcher = async (url, options) => {
        requests.push({ url, options });
        return new Response(JSON.stringify(url.endsWith('status')
            ? { authenticated: true, csrfToken: 'session_csrf_0123456789' }
            : { ok: true }), { status: 200 });
    };
    await logoutUnifiedSession(fetcher);
    assert.deepEqual(requests.map(item => item.url), ['/api/auth/status', '/api/auth/logout']);
    assert.equal(requests[1].options.headers['X-NW-CSRF'], 'session_csrf_0123456789');
    assert.equal(requests[1].options.method, 'POST');
    assert.equal(requests[1].options.credentials, 'same-origin');
    assert.equal(requests[1].options.redirect, 'error');
    assert.equal(requests[0].options.signal, requests[1].options.signal);
});

test('missing CSRF or failed status never sends a logout mutation', async () => {
    for (const [status, body] of [[200, {}], [503, {}], [200, { authenticated: true, csrfToken: '\r\ninvalid' }]]) {
        let count = 0;
        const fetcher = async () => { count++; return new Response(JSON.stringify(body), { status }); };
        await assert.rejects(logoutUnifiedSession(fetcher));
        assert.equal(count, 1);
    }
});

test('logout failure is not reported as a successful revocation', async () => {
    let count = 0;
    await assert.rejects(logoutUnifiedSession(async () => {
        count++;
        return new Response(JSON.stringify({ authenticated: true, csrfToken: 'session_csrf_0123456789' }), {
            status: count === 1 ? 200 : 503,
        });
    }), /SESSION_LOGOUT_UNCONFIRMED/);
});

test('already expired session does not require a write', async () => {
    let count = 0;
    await logoutUnifiedSession(async () => { count++; return new Response('{}', { status: 401 }); });
    assert.equal(count, 1);
});

test('central license status accepts the controller UUID variants supported by the verifier', () => {
    const status = { v: 1, valid: true, code: 'LICENSE_VALID', uuid: 'de12345678-1234-1234-1234-123456789abc', edition: 'home', expiresAt: null, limits: { chargePoints: 3, batteries: 2 }, features: ['energy'] };
    assert.equal(parseLicenseStatus(status).uuid, status.uuid);
    assert.throws(() => parseLicenseStatus({ ...status, uuid: 'invalid-device' }), /LICENSE_RESPONSE/);
});
