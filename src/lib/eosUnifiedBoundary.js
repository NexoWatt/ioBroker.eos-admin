'use strict';
// Gemeinsame HTTP-Vertrauensgrenze: keine Identität aus Proxyheadern und keine zweite Passwortdatenbank.
const { createHmac, randomBytes, timingSafeEqual } = require('node:crypto');
const SYSTEM_REQUEST = Symbol('eosSystemRequest');
const LOCAL = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
function publicOrigin(value) {
    if (value === undefined || value === null || value === '') {
        return '';
    }
    if (typeof value !== 'string' || value.length > 256) {
        throw new Error('EOS_PUBLIC_ORIGIN_INVALID');
    }
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:' || parsed.origin !== value || parsed.username || parsed.password) {
        throw new Error('EOS_PUBLIC_ORIGIN_INVALID');
    }
    return parsed.origin;
}
function transportAllowed(req, origin, secure) {
    if (req.headers['sec-fetch-site'] === 'cross-site') {
        return false;
    }
    if (!secure && !LOCAL.has(req.socket?.remoteAddress)) {
        return false;
    }
    if (origin) {
        return req.headers.host === new URL(origin).host;
    }
    return secure || /^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d{1,5})?$/.test(req.headers.host || '');
}
function sameOrigin(req, origin, secure) {
    if (!transportAllowed(req, origin, secure)) {
        return false;
    }
    const expected = origin || `${secure ? 'https' : 'http'}://${req.headers.host}`;
    return (
        req.headers.origin === expected &&
        (!req.headers['sec-fetch-site'] || req.headers['sec-fetch-site'] === 'same-origin')
    );
}
function readAccessToken(req) {
    const cookies =
        typeof req.headers.cookie === 'string'
            ? req.headers.cookie
                  .split(';')
                  .map(v => v.trim())
                  .filter(v => v.startsWith('access_token='))
            : [];
    if (cookies.length > 1) {
        return null;
    }
    const value = cookies.length
        ? cookies[0].slice(13)
        : /^Bearer ([A-Za-z0-9_-]{16,4096})$/.exec(req.headers.authorization || '')?.[1];
    return typeof value === 'string' && /^[A-Za-z0-9_-]{16,4096}$/.test(value) ? value : null;
}
class UnifiedSessions {
    constructor(adapter, options) {
        this.adapter = adapter;
        this.options = options;
        this.origin = publicOrigin(options.externalOrigin);
        this.secret = randomBytes(32);
        this.rates = new Map();
    }
    originAllowed(req) {
        return sameOrigin(req, this.origin, this.options.secure);
    }
    requestAllowed(req) {
        if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
            return (
                transportAllowed(req, this.origin, this.options.secure) &&
                (!req.headers.origin || this.originAllowed(req))
            );
        }
        return this.originAllowed(req);
    }
    machineRequestAllowed(req) {
        return (
            !req.headers.origin &&
            !req.headers.cookie &&
            !req.headers['sec-fetch-site'] &&
            !req.headers['sec-fetch-mode'] &&
            transportAllowed(req, this.origin, this.options.secure)
        );
    }
    csrf(req) {
        const token = readAccessToken(req);
        return token
            ? createHmac('sha256', this.secret)
                  .update(`${this.adapter.eosSessionSecurity?.epoch}:${token}`)
                  .digest('hex')
            : '';
    }
    csrfAllowed(req) {
        const supplied = req.headers['x-nw-csrf'];
        const expected = this.csrf(req);
        return (
            this.originAllowed(req) &&
            typeof supplied === 'string' &&
            /^[a-f0-9]{64}$/.test(supplied) &&
            expected.length === 64 &&
            timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))
        );
    }
    async status(req) {
        const access = await this.options.resolveAccess(req);
        const first = access.userId ? await this.options.firstLogin(access.userId, access.role) : { required: false };
        const license = this.options.getLicense();
        const authenticated = !!access.userId;
        const role = authenticated ? (access.role === 'enduser' ? 'customer' : access.role) : 'none';
        const activationRequired = authenticated && (!license?.valid || license?.coreEnabled !== true);
        return {
            enabled: true,
            configured: true,
            mode: 'iobroker',
            protectWrites: true,
            authed: authenticated,
            authenticated,
            user: access.userId || null,
            userId: access.userId || null,
            role,
            groups: access.groups || [],
            capabilities:
                role === 'admin'
                    ? ['*']
                    : role === 'installer'
                      ? [
                            'frontend.open',
                            'appcenter.open',
                            'mapping.edit',
                            'chargepoints.configure',
                            'mesh.configure',
                            'exportGuard.configure',
                            'smarthome.configure',
                            'nexologic.configure',
                            'diagnostics.open',
                            'energyWallet.customerSettings',
                        ]
                      : role === 'customer'
                        ? ['frontend.open', 'energyWallet.customerSettings']
                        : [],
            csrfToken: authenticated ? this.csrf(req) : '',
            credentialKey: authenticated ? this.csrf(req) : '',
            mustChangePassword: !!first.required,
            activationRequired,
            nextUrl: first.required
                ? '/system/?passwordSetup'
                : activationRequired && role === 'admin'
                  ? '/nexowatt/license'
                  : '/',
            loginUrl: '/login.html',
            logoutUrl: '/api/auth/logout',
        };
    }
    loginRate(req, user) {
        const now = Date.now();
        for (const [key, row] of this.rates) {
            if (row.until <= now) {
                this.rates.delete(key);
            }
        }
        if (this.rates.size > 510) {
            return false;
        }
        let allowed = true;
        for (const key of [`ip:${req.socket?.remoteAddress || 'unknown'}`, `user:${user.toLowerCase()}`]) {
            let rate = this.rates.get(key);
            if (!rate) {
                rate = { until: now + 60000, count: 0 };
                this.rates.set(key, rate);
            }
            if (++rate.count > 10) {
                allowed = false;
            }
        }
        return allowed;
    }
    prepareLogin(req, res, next) {
        res.setHeader('Cache-Control', 'no-store');
        if (!this.originAllowed(req)) {
            return res.status(403).json({ error: 'AUTH_ORIGIN' });
        }
        const { user, password } = req.body || {};
        if (
            typeof user !== 'string' ||
            !/^(?:system\.user\.)?[A-Za-z0-9_.@-]{1,128}$/.test(user) ||
            typeof password !== 'string' ||
            !password ||
            password.length > 1024 ||
            Object.keys(req.body).some(k => !['user', 'password'].includes(k))
        ) {
            return res.status(400).json({ error: 'AUTH_REQUEST' });
        }
        if (!this.loginRate(req, user)) {
            res.setHeader('Retry-After', '60');
            return res.status(429).json({ error: 'AUTH_RATE' });
        }
        req.body = {
            grant_type: 'password',
            username: user.replace(/^system\.user\./, ''),
            password,
            client_id: 'ioBroker',
            stayloggedin: 'false',
        };
        req.headers['content-type'] = 'application/x-www-form-urlencoded';
        req.url = '/oauth/token';
        const json = res.json.bind(res);
        res.json = value => json(value?.access_token ? { ok: true } : { error: 'AUTH_FAILED' });
        next();
    }
    async logout(req, res) {
        if (!this.csrfAllowed(req)) {
            return res.status(403).json({ error: 'AUTH_CSRF' });
        }
        const token = readAccessToken(req);
        const session = token ? await new Promise(resolve => this.adapter.getSession(`a:${token}`, resolve)) : null;
        // Epoch revocation is deliberately immediate: all open transports lose stale authority.
        this.adapter.eosSessionSecurity?.revoke();
        this.adapter.eosHostedRuntime?.revokeSessions?.();
        const ids = session ? [`a:${session.aToken}`, `r:${session.rToken}`] : token ? [`a:${token}`] : [];
        await Promise.all(ids.map(id => new Promise(resolve => this.adapter.destroySession(id, resolve))));
        res.clearCookie('access_token', { path: '/' });
        res.clearCookie('refresh_token', { path: '/' });
        res.setHeader('Cache-Control', 'no-store');
        return res.status(200).json({ ok: true });
    }
}
module.exports = { SYSTEM_REQUEST, publicOrigin, transportAllowed, sameOrigin, readAccessToken, UnifiedSessions };
