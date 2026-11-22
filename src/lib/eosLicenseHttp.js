'use strict';

const { safeCode } = require('./eosLicenseService');
const { hostOrigin } = require('./eosUnifiedBoundary');

function isLocal(address) {
    return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1';
}

function publicOriginValue(value) {
    if (value === undefined || value === '') {
        return null;
    }
    if (typeof value !== 'string' || value.length > 2048) {
        throw new TypeError('LICENSE_PUBLIC_ORIGIN_INVALID');
    }
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
        throw new TypeError('LICENSE_PUBLIC_ORIGIN_INVALID');
    }
    return url.origin;
}

function sameOrigin(req, secure, publicOrigin) {
    // Neither forwarded-host nor forwarded-proto is a trust source here.
    try {
        const configuredOrigin = publicOriginValue(publicOrigin);
        const requestOrigin = hostOrigin(req, secure || !!configuredOrigin);
        const expected = configuredOrigin || requestOrigin;
        return (
            !!requestOrigin &&
            req.headers.origin === expected &&
            (!configuredOrigin || requestOrigin === configuredOrigin) &&
            req.headers['x-eos-license'] === '1' &&
            (!req.headers['sec-fetch-site'] || req.headers['sec-fetch-site'] === 'same-origin')
        );
    } catch {
        return false;
    }
}

function registerLicenseRoutes(
    app,
    { service, authorize, secure, publicOrigin, jsonParser, trustJsonParser = jsonParser, pagePath, scriptPath },
) {
    const configuredOrigin = publicOriginValue(publicOrigin);
    const rates = new Map();
    const guard =
        (write = false) =>
        async (req, res, next) => {
            res.setHeader('Cache-Control', 'no-store');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('X-Content-Type-Options', 'nosniff');
            try {
                if (!(await authorize(req))) {
                    return res.status(403).json({ error: 'LICENSE_ADMIN_REQUIRED' });
                }
                // UUIDs and activation tokens must not travel over plaintext LAN.
                if ((!secure || configuredOrigin) && !req.socket?.encrypted && !isLocal(req.socket?.remoteAddress)) {
                    return res.status(403).json({ error: 'LICENSE_HTTPS_REQUIRED' });
                }
                if (write && !sameOrigin(req, secure, configuredOrigin || undefined)) {
                    return res.status(403).json({ error: 'LICENSE_ORIGIN' });
                }
                const now = Date.now();
                for (const [key, value] of rates) {
                    if (now - value.start >= 60000) {
                        rates.delete(key);
                    }
                }
                const key = `${write ? 'w' : 'r'}:${req.socket?.remoteAddress || 'unknown'}`;
                let rate = rates.get(key);
                if (!rate) {
                    if (rates.size >= 128) {
                        return res.status(429).json({ error: 'LICENSE_RATE_LIMIT' });
                    }
                    rate = { start: now, count: 0 };
                    rates.set(key, rate);
                }
                if (++rate.count > (write ? 10 : 60)) {
                    return res.status(429).json({ error: 'LICENSE_RATE_LIMIT' });
                }
                next();
            } catch {
                res.status(503).json({ error: 'SERVICE_UNAVAILABLE' });
            }
        };
    const handle =
        (operation, attachment = false) =>
        (req, res) => {
            void Promise.resolve()
                .then(() => operation(req))
                .then(result => {
                    if (attachment) {
                        res.setHeader(
                            'Content-Disposition',
                            'attachment; filename="nexowatt-license-public-trust.json"',
                        );
                    }
                    return res.status(200).json(result);
                })
                .catch(error => {
                    const code = safeCode(error);
                    const unavailable =
                        /^(?:STORAGE|SERVICE)_/.test(code) ||
                        /^(?:TRUST_(?:MISSING|STARTING|FILE_MISSING|READ_DENIED|PERMISSIONS|PATH|PLATFORM_UNSUPPORTED|RELEASE_METADATA))$/.test(
                            code,
                        );
                    res.status(unavailable ? 503 : 400).json({ error: code });
                });
        };
    app.get('/nexowatt/license', guard(), (_req, res) => {
        res.setHeader(
            'Content-Security-Policy',
            "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; base-uri 'none'; frame-ancestors 'self'; form-action 'self'",
        );
        res.sendFile(pagePath);
    });
    app.get('/nexowatt/license/app.js', guard(), (_req, res) => res.sendFile(scriptPath));
    app.get(
        '/nexowatt/license/status',
        guard(),
        handle(() => service.status()),
    );
    app.get(
        '/nexowatt/license/trust/status',
        guard(),
        handle(() => service.trustStatus()),
    );
    app.get(
        '/nexowatt/license/trust/export',
        guard(),
        handle(() => service.exportTrust(), true),
    );
    app.post(
        '/nexowatt/license/trust/import',
        guard(true),
        trustJsonParser,
        handle(req => {
            const body = req.body;
            const keys = body?.keys;
            if (
                !body ||
                typeof body !== 'object' ||
                Array.isArray(body) ||
                Object.keys(body).length !== 1 ||
                !Object.prototype.hasOwnProperty.call(body, 'keys') ||
                !keys ||
                typeof keys !== 'object' ||
                Array.isArray(keys) ||
                Object.keys(keys).length < 1 ||
                Object.keys(keys).length > 32 ||
                Object.values(keys).some(value => typeof value !== 'string') ||
                Buffer.byteLength(JSON.stringify(keys), 'utf8') > 32768
            ) {
                throw Object.assign(new Error('TRUST_FORMAT'), { code: 'TRUST_FORMAT' });
            }
            // The service verifies PEM type, exact manufacturer/OS authority,
            // canonical byte limits and persistence before accepting any key.
            return service.importTrust(keys);
        }),
    );
    app.post(
        '/nexowatt/license/trust/recheck',
        guard(true),
        jsonParser,
        handle(req => {
            if (
                !req.body ||
                typeof req.body !== 'object' ||
                Array.isArray(req.body) ||
                Object.keys(req.body).length !== 0
            ) {
                throw Object.assign(new Error('TRUST_FORMAT'), { code: 'TRUST_FORMAT' });
            }
            return service.recheckTrust();
        }),
    );
    app.post(
        '/nexowatt/license/activate',
        guard(true),
        jsonParser,
        handle(req => {
            if (
                !req.body ||
                Array.isArray(req.body) ||
                Object.keys(req.body).length !== 1 ||
                typeof req.body.token !== 'string' ||
                req.body.token.length > 16384
            ) {
                throw Object.assign(new Error('LICENSE_FORMAT'), { code: 'LICENSE_FORMAT' });
            }
            return service.activate(req.body.token.trim());
        }),
    );
    app.post(
        '/nexowatt/license/remove',
        guard(true),
        jsonParser,
        handle(req => {
            if (!req.body || Array.isArray(req.body) || Object.keys(req.body).length !== 0) {
                throw Object.assign(new Error('LICENSE_FORMAT'), { code: 'LICENSE_FORMAT' });
            }
            return service.remove();
        }),
    );
    // Body parser errors must never serialize input or stack traces.
    app.use('/nexowatt/license', (error, _req, res, _next) => {
        res.status(error?.type === 'entity.too.large' ? 413 : 400).json({ error: 'LICENSE_REQUEST' });
    });
}

module.exports = { registerLicenseRoutes, sameOrigin, isLocal, publicOriginValue };
