"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EosKiosk = void 0;
exports.kioskPath = kioskPath;
exports.kioskRouteAllowed = kioskRouteAllowed;
exports.kioskSetAllowed = kioskSetAllowed;
/** Copyright (c) 2026 NexoWatt. Proprietary; see LICENSE. */
const node_crypto_1 = require("node:crypto");
const record = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const userId = (v) => typeof v === 'string' && /^system\.user\.[A-Za-z0-9_.@-]{1,128}$/.test(v);
const fail = (code) => new Error(code);
function kioskPath(req) {
    const raw = String(req.url || '').split('?')[0];
    // No URL aliases, encodings or static path normalization may widen the grant.
    return raw.length <= 1024 && !/[\\%]|[^\x21-\x7e]|\/\/+|(?:^|\/)\.\.?\//.test(raw) ? raw : '';
}
const READ = new Set([
    '/',
    '/index.html',
    '/evcs.html',
    '/storagefarm.html',
    '/history.html',
    '/smarthome.html',
    '/config',
    '/api/state',
    '/events',
    '/api/locale',
    '/api/history',
    '/api/flow/qc/read',
    '/api/relay/summary',
    '/api/relay/snapshot',
    '/api/bhkw/snapshot',
    '/api/generator/snapshot',
    '/api/smarthome/devices',
    '/api/smarthome/layout',
    '/api/smarthome/scenes',
    '/api/smarthome/timers',
    '/api/smarthome/control-history',
]);
const AUTH_READ = new Set(['/api/auth/status', '/api/strict-auth/status', '/api/auth/idle']);
const SMART_WRITE = new Set([
    'toggle',
    'level',
    'color',
    'cover',
    'player',
    'rtrSetpoint',
    'climate',
    'value',
    'scene/run',
    'timers',
    'control',
]);
function kioskRouteAllowed(req) {
    const path = kioskPath(req);
    if (!path) {
        return false;
    }
    if (['GET', 'HEAD'].includes(req.method)) {
        return (READ.has(path) ||
            AUTH_READ.has(path) ||
            /^\/(?:static|assets|fonts|icons)\/[A-Za-z0-9_./-]+\.(?:js|mjs|css|png|jpe?g|svg|ico|woff2?|ttf)$/.test(path) ||
            /^\/static\/i18n\/(?:de|en|nl)\.json$/.test(path));
    }
    return (req.method === 'POST' &&
        (path === '/api/set' ||
            (path.startsWith('/api/smarthome/') && SMART_WRITE.has(path.slice('/api/smarthome/'.length)))));
}
function kioskSetAllowed(body) {
    if (!record(body) ||
        Object.keys(body).some(k => !['scope', 'key', 'value', 'expectedChargingIdentity', 'expectedChargingLayoutRevision'].includes(k)) ||
        typeof body.scope !== 'string' ||
        typeof body.key !== 'string' ||
        body.key.length > 128 ||
        !['string', 'boolean', 'number'].includes(typeof body.value)) {
        return false;
    }
    const { scope, key, value } = body;
    for (const field of ['expectedChargingIdentity', 'expectedChargingLayoutRevision']) {
        if (!Object.prototype.hasOwnProperty.call(body, field)) {
            continue;
        }
        if (!(scope === 'ems' || scope === 'evcs' || (scope === 'settings' && /^evcs/.test(key))) ||
            typeof body[field] !== 'string' ||
            !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(body[field])) {
            return false;
        }
    }
    const boolean = typeof value === 'boolean';
    const number = typeof value === 'number' && Number.isFinite(value);
    if (scope === 'ems') {
        const match = /^(?:evcs\.([1-9]\d{0,2})|lp([1-9]\d{0,2})|chargingManagement\.wallboxes\.lp([1-9]\d{0,2}))\.(userMode|emsMode|autoSource|userAutoSource|regEnabled|stationEnabled|userStationEnabled|phaseMode|userPhaseMode|storageAssist|storageAssistEnabled|userStorageAssistEnabled|goalEnabled|goalTargetSocPct|goalFinishTs|goalBatteryKwh)$/.exec(key);
        if (/^evcs\.(?:global|all)\.(?:storageAssist|storageAssistEnabled|userStorageAssistEnabled)$/.test(key)) {
            return boolean;
        }
        if (!match) {
            return false;
        }
        const prop = match[4];
        if (['userMode', 'emsMode'].includes(prop)) {
            return ['auto', 'pv', 'minpv', 'boost'].includes(String(value));
        }
        if (['autoSource', 'userAutoSource'].includes(prop)) {
            return ['standard', 'strategy'].includes(String(value));
        }
        if (['phaseMode', 'userPhaseMode'].includes(prop)) {
            return ['auto-pv', 'fixed-1p', 'fixed-3p'].includes(String(value));
        }
        if (prop === 'goalTargetSocPct') {
            return number && Number(value) >= 0 && Number(value) <= 100;
        }
        if (prop === 'goalBatteryKwh') {
            return number && Number(value) > 0 && Number(value) <= 1000;
        }
        if (prop === 'goalFinishTs') {
            return number && Number(value) >= 0 && Number(value) <= 8.64e15;
        }
        return boolean;
    }
    // Legacy dashboard fallback serializes the three modes as numeric 1/2/3.
    const legacyMode = number && Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 3;
    if (scope === 'settings') {
        return (key === 'evcsActive' && boolean) || (key === 'evcsMode' && legacyMode);
    }
    if (scope === 'evcs') {
        return /^[1-9]\d{0,2}\.mode$/.test(key) ? legacyMode : /^[1-9]\d{0,2}\.active$/.test(key) && boolean;
    }
    if (scope === 'flow') {
        const match = /^(consumer|consumers|producer|producers)\.[1-9]\d{0,2}\.(switch|setpoint|regEnabled|mode|boost)$/.exec(key);
        return (!!match &&
            (['switch', 'regEnabled', 'boost'].includes(match[2])
                ? boolean
                : match[2] === 'setpoint'
                    ? number && Math.abs(Number(value)) <= 1e9
                    : typeof value === 'string' &&
                        ['inherit', 'pvAuto', 'manual', 'manual1', 'manual2', 'manual3', 'off'].includes(value)));
    }
    if (['relay', 'bhkw', 'generator'].includes(String(scope))) {
        const prefix = scope === 'relay' ? 'r' : scope === 'bhkw' ? 'b' : 'g';
        const match = new RegExp(`^${prefix}[1-9]\\d{0,2}\\.(switch|value|mode|command)$`).exec(key);
        return (!!match &&
            (match[1] === 'switch'
                ? boolean
                : match[1] === 'value'
                    ? number && Math.abs(Number(value)) <= 1e9
                    : typeof value === 'string' && ['auto', 'manual', 'off', 'on', 'pv', 'start', 'stop'].includes(value)));
    }
    return false;
}
/** A kiosk capability never represents an ioBroker account or a technical role. */
class EosKiosk {
    storage;
    id;
    cookie;
    config = { schemaVersion: 1, enabled: false, revision: 0, enabledBy: null };
    secret = (0, node_crypto_1.randomBytes)(32);
    available = false;
    saving = false;
    fresh = new WeakMap();
    streams = new Set();
    constructor(storage) {
        this.storage = storage;
        if (!/^eos-admin\.\d{1,6}$/.test(storage.namespace)) {
            throw fail('KIOSK_NAMESPACE');
        }
        this.id = `${storage.namespace}.kiosk.configuration`;
        this.cookie = `nw_kiosk_${storage.namespace.replace('.', '_').replace('-', '_')}`;
    }
    async initialize() {
        try {
            const object = await this.storage.read(this.id);
            if (object !== null && object !== undefined) {
                if (!record(object) ||
                    object._id !== this.id ||
                    object.type !== 'config' ||
                    !record(object.native) ||
                    !record(object.acl) ||
                    object.acl.owner !== 'system.user.admin' ||
                    object.acl.ownerGroup !== 'system.group.administrator' ||
                    object.acl.object !== 0x600) {
                    throw fail('KIOSK_CONFIGURATION');
                }
                const n = object.native;
                if (Object.keys(n).some(k => !['schemaVersion', 'enabled', 'revision', 'enabledBy'].includes(k)) ||
                    n.schemaVersion !== 1 ||
                    typeof n.enabled !== 'boolean' ||
                    !Number.isSafeInteger(n.revision) ||
                    Number(n.revision) < 0 ||
                    !(n.enabledBy === null || userId(n.enabledBy)) ||
                    (n.enabled && !userId(n.enabledBy))) {
                    throw fail('KIOSK_CONFIGURATION');
                }
                this.config = n;
            }
            this.available = true;
        }
        catch {
            this.available = false;
        }
    }
    view() {
        return {
            enabled: this.available && this.config.enabled,
            revision: this.config.revision,
            available: this.available,
        };
    }
    async ready() {
        return (this.available &&
            this.config.enabled &&
            !!this.config.enabledBy &&
            (await this.storage.ready(this.config.enabledBy)));
    }
    mac(value) {
        return (0, node_crypto_1.createHmac)('sha256', this.secret).update(value).digest('hex');
    }
    token(req) {
        const fresh = this.fresh.get(req);
        const raw = req.headers.cookie;
        if (!fresh && (typeof raw !== 'string' || raw.length > 16384)) {
            return '';
        }
        const values = typeof raw === 'string'
            ? raw
                .split(';')
                .map(v => v.trim())
                .filter(v => v.startsWith(`${this.cookie}=`))
            : [];
        if (!fresh && values.length !== 1) {
            return '';
        }
        const token = fresh || values[0].slice(this.cookie.length + 1);
        if (!/^[a-f0-9]{48}\.[a-f0-9]{64}$/.test(token)) {
            return '';
        }
        const [nonce, signature] = token.split('.');
        return (0, node_crypto_1.timingSafeEqual)(Buffer.from(signature), Buffer.from(this.mac(`cookie:${nonce}`))) ? token : '';
    }
    bootstrap(req, res) {
        if (!this.view().enabled ||
            !['GET', 'HEAD'].includes(req.method) ||
            !kioskRouteAllowed(req) ||
            this.token(req)) {
            return;
        }
        const nonce = (0, node_crypto_1.randomBytes)(24).toString('hex');
        const token = `${nonce}.${this.mac(`cookie:${nonce}`)}`;
        this.fresh.set(req, token);
        res.cookie(this.cookie, token, {
            path: '/',
            httpOnly: true,
            sameSite: 'strict',
            secure: this.storage.secure,
            maxAge: 31_536_000_000,
        });
    }
    csrf(req) {
        const token = this.token(req);
        return this.view().enabled && token ? this.mac(`csrf:${token}`) : '';
    }
    async access(req) {
        if (!kioskRouteAllowed(req) || new URL(req.url, 'http://localhost').searchParams.get('admin') === '1') {
            return null;
        }
        const token = this.token(req);
        if (!token || !(await this.ready()) || this.token(req) !== token) {
            return null;
        }
        return {
            enabled: true,
            configured: true,
            mode: 'kiosk',
            protectWrites: true,
            authed: true,
            authenticated: true,
            kiosk: true,
            kioskEnabled: true,
            user: null,
            userId: null,
            role: 'customer',
            groups: [],
            capabilities: ['frontend.open'],
            serverNow: Date.now(),
            idleTimeoutMs: 0,
            idleExpiresAt: null,
            sessionKey: `kiosk:${token.slice(0, 48)}`,
            csrfToken: this.csrf(req),
            credentialKey: this.csrf(req),
            mustChangePassword: false,
            activationRequired: false,
            nextUrl: '/',
            loginUrl: '/login.html?admin=1',
            logoutUrl: '/api/auth/logout',
        };
    }
    bindStream(req, res) {
        if (!this.view().enabled || !this.token(req) || this.streams.size >= 128) {
            return false;
        }
        this.streams.add(res);
        res.once('close', () => this.streams.delete(res));
        return true;
    }
    async save(input, user, authorize) {
        if (!record(input) ||
            Object.keys(input).length !== 2 ||
            typeof input.enabled !== 'boolean' ||
            !Number.isSafeInteger(input.revision) ||
            !userId(user)) {
            throw fail('KIOSK_REQUEST');
        }
        if (!this.available) {
            throw fail('KIOSK_UNAVAILABLE');
        }
        if (this.saving || input.revision !== this.config.revision || this.config.revision >= Number.MAX_SAFE_INTEGER) {
            throw fail('KIOSK_CONFLICT');
        }
        this.saving = true;
        try {
            if (!(await authorize())) {
                throw fail('KIOSK_AUTH');
            }
            if (input.enabled && !(await this.storage.ready(user))) {
                throw fail('KIOSK_NOT_READY');
            }
            const next = {
                schemaVersion: 1,
                enabled: input.enabled,
                revision: this.config.revision + 1,
                enabledBy: user,
            };
            if (!(await authorize())) {
                throw fail('KIOSK_AUTH');
            }
            await this.storage.write(this.id, {
                _id: this.id,
                type: 'config',
                common: { name: 'EOS dashboard kiosk' },
                native: next,
                acl: { owner: 'system.user.admin', ownerGroup: 'system.group.administrator', object: 0x600 },
            });
            this.config = next;
            this.secret = (0, node_crypto_1.randomBytes)(32);
            for (const response of this.streams) {
                response.end();
            }
            this.streams.clear();
            // Turning the wall tablet into a kiosk must never retain an ambient technical session.
            this.storage.revoke(next.enabled);
            return { ok: true, ...this.view(), reauthenticate: next.enabled };
        }
        finally {
            this.saving = false;
        }
    }
}
exports.EosKiosk = EosKiosk;
//# sourceMappingURL=eosKiosk.js.map