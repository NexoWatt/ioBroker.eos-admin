'use strict';
// Gemeinsame HTTP-Vertrauensgrenze: keine Identität aus Proxyheadern und keine zweite Passwortdatenbank.
const { createHmac, randomBytes, timingSafeEqual } = require('node:crypto');
const SYSTEM_REQUEST = Symbol('eosSystemRequest');
const LOCAL = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
const ENTRY_PAGES = new Set(['/', '/login.html', '/system/', '/installer/', '/nexowatt/license']);
function entryNavigation(req) {
    const headers = req.headers || {};
    const path = String(req.originalUrl || req.url || req.path || '').split('?')[0];
    return (
        ['GET', 'HEAD'].includes(req.method) &&
        headers['sec-fetch-mode'] === 'navigate' &&
        headers['sec-fetch-dest'] === 'document' &&
        !Object.hasOwn(headers, 'origin') &&
        !headers.upgrade &&
        !String(headers.connection || '')
            .toLowerCase()
            .split(/\s*,\s*/)
            .includes('upgrade') &&
        ENTRY_PAGES.has(path)
    );
}
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
function hostOrigin(req, secure) {
    const host = req.headers.host;
    // Host is only an HTTP authority, never a URL, forwarding assertion or user identity.
    if (
        typeof host !== 'string' ||
        !host ||
        host.length > 512 ||
        /[^\x21-\x7e]|[\\/?#@,%]/.test(host) ||
        host.endsWith(':')
    ) {
        return null;
    }
    try {
        const url = new URL(`${secure ? 'https' : 'http'}://${host}`);
        return url.hostname && url.pathname === '/' && !url.username && !url.password && !url.search && !url.hash
            ? url.origin
            : null;
    } catch {
        return null;
    }
}
function transportAllowed(req, origin, secure) {
    if (req.headers['sec-fetch-site'] === 'cross-site' && !entryNavigation(req)) {
        return false;
    }
    if (!secure && !LOCAL.has(req.socket?.remoteAddress)) {
        return false;
    }
    const requestOrigin = hostOrigin(req, secure || !!origin);
    if (!requestOrigin) {
        return false;
    }
    if (origin) {
        return requestOrigin === origin;
    }
    return secure || /^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d{1,5})?$/.test(req.headers.host || '');
}
function sameOrigin(req, origin, secure) {
    if (!transportAllowed(req, origin, secure)) {
        return false;
    }
    const expected = origin || hostOrigin(req, secure);
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
    readSession(req) {
        const token = readAccessToken(req);
        return token ? new Promise(resolve => this.adapter.getSession(`a:${token}`, resolve)) : Promise.resolve(null);
    }
    idleView(req, session) {
        const value = this.adapter.eosSessionSecurity.idleView(session);
        return { ...value, csrfToken: value.authenticated ? this.csrf(req) : '' };
    }
    async idle(req) {
        return this.idleView(req, await this.readSession(req));
    }
    async activity(req, res) {
        res.setHeader('Cache-Control', 'no-store');
        if (!this.csrfAllowed(req)) {
            return res.status(403).json({ error: 'AUTH_CSRF' });
        }
        if (!req.body || Array.isArray(req.body) || typeof req.body !== 'object' || Object.keys(req.body).length) {
            return res.status(400).json({ error: 'AUTH_REQUEST' });
        }
        const session = await this.readSession(req);
        if (!this.adapter.eosSessionSecurity.activity(session)) {
            return res.status(401).json({ ...this.idleView(req, null), error: 'AUTH_IDLE_EXPIRED' });
        }
        return res.status(200).json(this.idleView(req, session));
    }
    async expire(req, res) {
        res.setHeader('Cache-Control', 'no-store');
        if (!this.csrfAllowed(req)) {
            return res.status(403).json({ error: 'AUTH_CSRF' });
        }
        if (!req.body || Array.isArray(req.body) || typeof req.body !== 'object' || Object.keys(req.body).length) {
            return res.status(400).json({ error: 'AUTH_REQUEST' });
        }
        const status = await this.idle(req);
        // A stale timer in one tab cannot end another tab's still-active session.
        if (!status.authenticated) {
            res.clearCookie('access_token', { path: '/' });
            res.clearCookie('refresh_token', { path: '/' });
        }
        return res.status(200).json({ ...status, expired: !status.authenticated });
    }
    /** @returns {Promise<boolean>} */
    bindStream(req, res) {
        return this.adapter.eosSessionSecurity.bindStream(readAccessToken(req), res);
    }
    async status(req) {
        const access = await this.options.resolveAccess(req);
        const first = access.userId ? await this.options.firstLogin(access.userId, access.role) : { required: false };
        const license = this.options.getLicense();
        // Recheck after asynchronous role/password reads; req.user is not a lasting session proof.
        const idle = await this.idle(req);
        const authenticated = !!access.userId && idle.authenticated;
        const role = authenticated ? (access.role === 'enduser' ? 'customer' : access.role) : 'none';
        const activationRequired = authenticated && (!license?.valid || license?.coreEnabled !== true);
        return {
            enabled: true,
            configured: true,
            mode: 'iobroker',
            protectWrites: true,
            authed: authenticated,
            authenticated,
            serverNow: idle.serverNow,
            idleTimeoutMs: idle.idleTimeoutMs,
            idleExpiresAt: authenticated ? idle.idleExpiresAt : null,
            sessionKey: authenticated ? idle.sessionKey : null,
            user: authenticated ? access.userId : null,
            userId: authenticated ? access.userId : null,
            role,
            groups: authenticated ? access.groups || [] : [],
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
            mustChangePassword: authenticated && !!first.required,
            activationRequired,
            nextUrl:
                authenticated && first.required
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
        // Explicit logout and idle expiry affect this login family, not other devices or EMS.
        this.adapter.eosSessionSecurity.revokeSession(session);
        const ids = session ? [`a:${session.aToken}`, `r:${session.rToken}`] : token ? [`a:${token}`] : [];
        await Promise.all(ids.map(id => new Promise(resolve => this.adapter.destroySession(id, resolve))));
        res.clearCookie('access_token', { path: '/' });
        res.clearCookie('refresh_token', { path: '/' });
        res.setHeader('Cache-Control', 'no-store');
        return res.status(200).json({ ok: true });
    }
}
module.exports = {
    SYSTEM_REQUEST,
    publicOrigin,
    hostOrigin,
    transportAllowed,
    sameOrigin,
    readAccessToken,
    UnifiedSessions,
};
