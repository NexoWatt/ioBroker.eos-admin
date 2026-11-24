'use strict';
// EOS session boundary. Stored tokens are capabilities: a refreshed capability may
// inherit an existing proof, but must never acquire a new proof merely by being saved.
const { AsyncLocalStorage } = require('node:async_hooks');
const { createHash, randomBytes } = require('node:crypto');
const { performance } = require('node:perf_hooks');
const STAMP = 'nexowattEosSessionV1';
const IDLE_TIMEOUT_MS = 600000;
const normalizeUser = value => typeof value === 'string' && /^(?:system\.user\.)?[A-Za-z0-9_.@-]{1,128}$/.test(value)
    ? value.startsWith('system.user.')
        ? value
        : `system.user.${value}`
    : null;
const failure = () => new Error('EOS_SESSION_REAUTHENTICATION_REQUIRED');
function stable(value, depth = 0) {
    if (depth > 12) {
        throw failure();
    }
    if (Array.isArray(value)) {
        return value.map(item => stable(item, depth + 1));
    }
    if (value && typeof value === 'object') {
        return Object.fromEntries(Object.keys(value)
            .sort()
            .map(key => [key, stable(value[key], depth + 1)]));
    }
    return value;
}
function securityProjection(id, object) {
    if (!object) {
        return null;
    }
    if (id.startsWith('system.user.')) {
        const native = object.native || {};
        return [
            object.type,
            object.common?.password,
            object.common?.externalAuthentication ?? null,
            object.common?.enabled !== false,
            object.acl,
            native.nexowattEosAccount?.forcePasswordChange === true,
            native.nexowattPasswordChangeRequired === true,
            native.eosPasswordChangeRequired === true,
        ];
    }
    if (id.startsWith('system.group.')) {
        return [object.type, [...(object.common?.members || [])].sort(), object.common?.acl, object.acl];
    }
    return null;
}
class EosSessionSecurity {
    constructor(adapter, options = {}) {
        this.adapter = adapter;
        this.epoch = randomBytes(32).toString('hex');
        this.context = new AsyncLocalStorage();
        this.proofs = new WeakMap();
        this.connections = new Map();
        // Idle time is monotonic; changing the installation's clock cannot prolong it.
        // Only credential login creates a family. Refresh and ordinary traffic never touch it.
        this.now = options.now || (() => performance.now());
        this.families = new Map();
        this.maxFamilies =
            Number.isInteger(options.maxFamilies) && options.maxFamilies > 0
                ? Math.min(options.maxFamilies, 1024)
                : 1024;
        this.streams = new Map();
        this.maxPending = options.maxPending || 32;
        this.timeoutMs = options.timeoutMs || 2000;
        this.pending = 0;
        this.stopped = false;
        this.getOriginal = adapter.getSession.bind(adapter);
        this.setOriginal = adapter.setSession.bind(adapter);
        this.socketAdmin = null;
        adapter.getSession = (id, callback) => {
            const task = this.bounded(async () => {
                if (typeof id !== 'string' || !/^[ar]:/.test(id) || id.length > 4098) {
                    return null;
                }
                const data = await new Promise(resolve => this.getOriginal(id, resolve));
                const stamp = data?.[STAMP];
                const expiry = id.startsWith('a:') ? data?.aExp : data?.rExp;
                if (!stamp || !this.family(stamp) || !Number.isFinite(expiry) || expiry <= Date.now()) {
                    return null;
                }
                const proof = await this.snapshot(data.user);
                // The database may have answered after the deadline passed.
                return this.matches(stamp, proof) && this.family(stamp) ? data : null;
            }).catch(() => null);
            if (typeof callback === 'function') {
                void task.then(value => this.complete(callback, [value]));
                return;
            }
            return task;
        };
        adapter.setSession = (id, ttl, data, callback) => {
            const proof = this.context.getStore();
            const task = this.bounded(async () => {
                if (!proof ||
                    !/^[ar]:/.test(id) ||
                    !this.matches(proof, await this.snapshot(data?.user)) ||
                    !this.family(proof)) {
                    throw failure();
                }
                const stamped = { ...data, [STAMP]: { ...proof } };
                await new Promise((resolve, reject) => this.setOriginal(id, ttl, stamped, error => (error ? reject(error) : resolve())));
                if (!this.family(proof)) {
                    throw failure();
                }
            });
            if (typeof callback === 'function') {
                void task.then(() => this.complete(callback, [null]), () => this.complete(callback, [failure()]));
                return;
            }
            return task;
        };
        // Disposal does not depend on a browser timer, incoming command or state publication.
        this.idleTimer = setInterval(() => this.pruneFamilies(), 1000);
        this.idleTimer.unref?.();
    }
    /** Callback exceptions must not turn a rejected transport into an adapter-wide unhandled rejection. */
    complete(callback, args, client) {
        try {
            callback(...args);
        }
        catch {
            if (client) {
                this.disconnect(client);
            }
            try {
                this.adapter.log?.warn?.('EOS_SESSION_CALLBACK_FAILED: Authentication callback failed; transport remains denied.');
            }
            catch {
                /* Logging cannot re-open the capability or escape the error boundary. */
            }
        }
    }
    /** New password login only. The bounded map stores no passwords or bearer tokens. */
    createFamily(proof) {
        this.pruneFamilies();
        if (this.stopped || proof.epoch !== this.epoch || this.families.size >= this.maxFamilies) {
            throw failure();
        }
        const familyId = randomBytes(24).toString('hex');
        const stamped = { ...proof, familyId };
        this.families.set(familyId, { proof: stamped, expiresAt: this.now() + IDLE_TIMEOUT_MS });
        return stamped;
    }
    /** Reads never extend authority; a missing/expired family cannot be reconstructed from a token. */
    family(proof) {
        const row = proof?.familyId && this.families.get(proof.familyId);
        if (!row || !this.matches(row.proof, proof)) {
            return null;
        }
        if (row.expiresAt <= this.now()) {
            this.revokeFamily(proof.familyId);
            return null;
        }
        return row;
    }
    pruneFamilies() {
        const now = this.now();
        for (const [id, row] of this.families) {
            if (row.expiresAt <= now) {
                this.revokeFamily(id);
            }
        }
    }
    /** One browser login, including its refreshed tokens and tabs, without affecting EMS or other logins. */
    revokeFamily(familyId) {
        if (!familyId || !this.families.delete(familyId)) {
            return;
        }
        for (const [client, record] of this.connections) {
            if (record.proof?.familyId === familyId) {
                this.disconnect(client);
            }
        }
        for (const [response, id] of this.streams) {
            if (id === familyId) {
                this.streams.delete(response);
                try {
                    response.end();
                }
                catch {
                    try {
                        response.destroy?.();
                    }
                    catch {
                        /* the family is already revoked; future authorization remains denied */
                    }
                }
            }
        }
    }
    /** Public timing metadata is not authentication authority; the monotonic family remains authoritative. */
    idleView(session) {
        const row = session?.[STAMP] && this.family(session[STAMP]);
        const serverNow = Date.now();
        return {
            authenticated: !!row,
            serverNow,
            idleTimeoutMs: IDLE_TIMEOUT_MS,
            idleExpiresAt: row ? serverNow + Math.max(0, Math.ceil(row.expiresAt - this.now())) : null,
            sessionKey: row ? row.proof.familyId : null,
        };
    }
    /** Called only by the origin- and CSRF-protected activity endpoint, never a general HTTP/socket hook. */
    activity(session) {
        const row = session?.[STAMP] && this.family(session[STAMP]);
        if (!row) {
            return false;
        }
        row.expiresAt = this.now() + IDLE_TIMEOUT_MS;
        return true;
    }
    revokeSession(session) {
        this.revokeFamily(session?.[STAMP]?.familyId);
    }
    /** Keep a long-lived browser response within its family even when no data frames are produced. */
    async bindStream(token, response) {
        const session = typeof token === 'string' ? await this.adapter.getSession(`a:${token}`) : null;
        const row = session?.[STAMP] && this.family(session[STAMP]);
        if (!row || this.streams.size >= 256 || response.destroyed || response.writableEnded) {
            return false;
        }
        this.streams.set(response, row.proof.familyId);
        const cleanup = () => {
            this.streams.delete(response);
            response.removeListener?.('close', cleanup);
            response.removeListener?.('finish', cleanup);
        };
        response.once('close', cleanup);
        response.once('finish', cleanup);
        return true;
    }
    bounded(operation) {
        if (this.stopped || this.pending >= this.maxPending) {
            return Promise.reject(failure());
        }
        this.pending++;
        // A timed-out database operation keeps its slot until it really settles. Repeated
        // timeouts cannot create an unbounded backlog in a disconnected controller.
        const work = Promise.resolve()
            .then(operation)
            .finally(() => {
            this.pending--;
        });
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(failure()), this.timeoutMs);
            work.then(value => {
                clearTimeout(timer);
                resolve(value);
            }, error => {
                clearTimeout(timer);
                reject(error);
            });
        });
    }
    async snapshot(candidate) {
        const userId = normalizeUser(candidate);
        if (!userId || this.stopped) {
            throw failure();
        }
        const epoch = this.epoch;
        const [user, result] = await Promise.all([
            this.adapter.getForeignObjectAsync(userId),
            this.adapter.getObjectViewAsync('system', 'group', {
                startkey: 'system.group.',
                endkey: 'system.group.\u9999',
            }),
        ]);
        if (!user ||
            user.type !== 'user' ||
            user.common?.enabled === false ||
            typeof user.common?.password !== 'string' ||
            !user.common.password ||
            !Array.isArray(result?.rows) ||
            result.rows.length > 1024 ||
            epoch !== this.epoch ||
            this.stopped) {
            throw failure();
        }
        // The inherited UI account contract recognizes ioBroker TOTP here. The bundled
        // OAuth model has no second-factor challenge: never downgrade that account to password-only.
        const external = user.common.externalAuthentication;
        if (external !== undefined &&
            external !== null &&
            (typeof external !== 'object' ||
                Array.isArray(external) ||
                (external.totp !== undefined && external.totp !== null))) {
            throw failure();
        }
        const groupIds = new Set();
        const groups = result.rows
            .map(row => {
            // The controller's system/group view emits common.name as row.id.
            // That view key may be translated and is not the object's identity.
            const groupId = row?.value?._id;
            if (!row?.value ||
                row.value.type !== 'group' ||
                typeof groupId !== 'string' ||
                !groupId.startsWith('system.group.') ||
                groupId.length <= 'system.group.'.length ||
                groupId.length > 1024 ||
                groupIds.has(groupId)) {
                throw failure();
            }
            groupIds.add(groupId);
            return [groupId, securityProjection(groupId, row.value)];
        })
            .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
        const text = JSON.stringify(stable([userId, securityProjection(userId, user), groups]));
        if (Buffer.byteLength(text) > 1024 * 1024) {
            throw failure();
        }
        return { epoch, userId, fingerprint: createHash('sha256').update(text).digest('hex') };
    }
    matches(a, b) {
        return (!this.stopped &&
            a?.epoch === this.epoch &&
            a?.epoch === b?.epoch &&
            a?.userId === b?.userId &&
            a?.fingerprint === b?.fingerprint);
    }
    bindOAuthModel(model) {
        for (const name of ['getUser', 'getRefreshToken', 'saveToken']) {
            if (typeof model?.[name] !== 'function') {
                throw failure();
            }
        }
        const getUser = model.getUser.bind(model);
        const getRefresh = model.getRefreshToken.bind(model);
        const save = model.saveToken.bind(model);
        model.getUser = async (name, password) => {
            try {
                return await this.bounded(async () => {
                    const before = await this.snapshot(name);
                    const user = await getUser(name, password);
                    if (!user || !this.matches(before, await this.snapshot(user.id))) {
                        return null;
                    }
                    this.proofs.set(user, this.createFamily(before));
                    return user;
                });
            }
            catch {
                return null;
            }
        };
        model.getRefreshToken = async (token) => {
            try {
                return await this.bounded(async () => {
                    const stored = await new Promise(resolve => this.adapter.getSession(`r:${token}`, resolve));
                    if (!stored?.[STAMP]) {
                        return null;
                    }
                    const result = await getRefresh(token);
                    if (!result?.user ||
                        !this.matches(stored[STAMP], await this.snapshot(result.user.id)) ||
                        !this.family(stored[STAMP])) {
                        return null;
                    }
                    this.proofs.set(result.user, stored[STAMP]);
                    return result;
                });
            }
            catch {
                return null;
            }
        };
        model.saveToken = async (token, client, user) => {
            const proof = user && this.proofs.get(user);
            if (!proof) {
                throw failure();
            }
            return this.bounded(async () => {
                if (!this.matches(proof, await this.snapshot(user.id)) || !this.family(proof)) {
                    throw failure();
                }
                return this.context.run(proof, () => save(token, client, user));
            });
        };
    }
    handleObjectChange(id, object, previous) {
        if (!/^system\.(?:user|group)\./.test(id)) {
            return;
        }
        try {
            if (JSON.stringify(stable(securityProjection(id, object))) ===
                JSON.stringify(stable(securityProjection(id, previous)))) {
                return;
            }
        }
        catch {
            /* Malformed security objects also revoke all sessions. */
        }
        this.revoke();
    }
    revoke() {
        this.epoch = randomBytes(32).toString('hex');
        for (const id of this.families.keys()) {
            this.revokeFamily(id);
        }
        for (const client of this.connections.keys()) {
            this.disconnect(client);
        }
    }
    disconnect(client) {
        const record = this.connections.get(client);
        if (record) {
            record.revoked = true;
        }
        this.connections.delete(client);
        try {
            this.socketAdmin?.unsubscribeSocket(client);
        }
        catch {
            /* transport still closes */
        }
        try {
            client.emit?.('reauthenticate');
        }
        catch {
            /* transport still closes */
        }
        try {
            if (typeof client.disconnect === 'function') {
                client.disconnect(true);
            }
            else {
                client.close?.();
            }
        }
        catch {
            /* command and publication guards remain denied */
        }
    }
    isSocketAllowed(client) {
        const record = this.connections.get(client);
        return this.isSocketPending(client) && !!record.proof && !!this.family(record.proof);
    }
    isSocketPending(client) {
        const record = this.connections.get(client);
        return !!record && !record.revoked && !this.stopped && record.epoch === this.epoch;
    }
    socketToken(client) {
        const request = client?.conn?.request;
        const query = request?.query?.token;
        const authorization = request?.headers?.authorization;
        const cookies = (request?.headers?.cookie || '')
            .split(';')
            .map(value => value.trim())
            .filter(value => value.startsWith('access_token='));
        if (cookies.length > 1) {
            return null;
        }
        const token = query || (authorization?.startsWith('Bearer ') ? authorization.slice(7) : '') || cookies[0]?.slice(13);
        return typeof token === 'string' && /^[A-Za-z0-9_-]{1,4096}$/.test(token) ? token : null;
    }
    bindSockets(socketAdmin) {
        if (typeof socketAdmin.addEventHandler !== 'function' ||
            typeof socketAdmin.__updateSession !== 'function' ||
            typeof socketAdmin.__getUserFromSocket !== 'function') {
            throw failure();
        }
        this.socketAdmin = socketAdmin;
        socketAdmin.addEventHandler('connect', client => {
            if (this.connections.size >= 256) {
                this.disconnect(client);
                return;
            }
            this.connections.set(client, { epoch: this.epoch, revoked: false });
            // Also clean up connections that close before upstream installs its post-auth hooks.
            client.on?.('disconnect', () => this.connections.delete(client));
        });
        socketAdmin.addEventHandler('disconnect', client => this.connections.delete(client));
        const update = socketAdmin.__updateSession.bind(socketAdmin);
        socketAdmin.__updateSession = client => this.isSocketAllowed(client) && update(client);
        const originalAuth = socketAdmin.__getUserFromSocket.bind(socketAdmin);
        socketAdmin.__getUserFromSocket = (client, callback) => {
            const epoch = this.epoch;
            let answered = false;
            const reply = (...args) => {
                if (answered) {
                    return;
                }
                answered = true;
                this.complete(callback, args, client);
            };
            const deny = () => {
                this.disconnect(client);
                reply('reauthentication required');
            };
            try {
                originalAuth(client, (error, user, expiry) => {
                    if (error || epoch !== this.epoch || !this.isSocketPending(client)) {
                        deny();
                        return;
                    }
                    const token = this.socketToken(client);
                    void Promise.resolve()
                        .then(() => (token ? this.adapter.getSession(`a:${token}`) : null))
                        .then(session => {
                        const proof = session?.[STAMP];
                        if (!proof ||
                            normalizeUser(user) !== proof.userId ||
                            epoch !== this.epoch ||
                            !this.isSocketPending(client) ||
                            !this.family(proof)) {
                            deny();
                            return;
                        }
                        this.connections.get(client).proof = proof;
                        reply(null, user, expiry);
                    })
                        .catch(deny);
                });
            }
            catch {
                deny();
            }
        };
        // These pinned upstream publication paths do not call __updateSession themselves.
        // Keep their subscription checks, adding the same immediate family boundary as state/file frames.
        if (typeof socketAdmin.sendLog === 'function' && typeof socketAdmin.getSocketsList === 'function') {
            socketAdmin.sendLog = entry => {
                const sockets = socketAdmin.getSocketsList();
                for (const client of Array.isArray(sockets) ? sockets : Object.values(sockets || {})) {
                    if (this.isSocketAllowed(client) && client.subscribe?.log?.length) {
                        try {
                            client.emit('log', entry);
                        }
                        catch {
                            this.disconnect(client);
                        }
                    }
                }
            };
        }
        if (typeof socketAdmin.commands?.publishInstanceMessage === 'function') {
            const publish = socketAdmin.commands.publishInstanceMessage.bind(socketAdmin.commands);
            socketAdmin.commands.publishInstanceMessage = (client, ...args) => {
                try {
                    return this.isSocketAllowed(client) && publish(client, ...args);
                }
                catch {
                    this.disconnect(client);
                    return false;
                }
            };
        }
        // Upstream intentionally exempts token rotation from its ordinary session check.
        // The exemption must not revive an idle family or attach another login to stale ACLs.
        const commands = socketAdmin.commands?.commands;
        if (typeof commands?.updateTokenExpiration === 'function') {
            const updateToken = commands.updateTokenExpiration.bind(commands);
            commands.updateTokenExpiration = (client, token, callback) => {
                let answered = false;
                const reply = (...args) => {
                    if (!answered && typeof callback === 'function') {
                        answered = true;
                        this.complete(callback, args, client);
                    }
                };
                const deny = () => {
                    this.disconnect(client);
                    reply('reauthentication required', false);
                };
                if (!this.isSocketAllowed(client) ||
                    typeof token !== 'string' ||
                    !/^[A-Za-z0-9_-]{1,4096}$/.test(token)) {
                    deny();
                    return;
                }
                void this.adapter
                    .getSession(`a:${token}`)
                    .then(session => {
                    if (!this.isSocketAllowed(client) ||
                        session?.[STAMP]?.familyId !== this.connections.get(client)?.proof?.familyId) {
                        deny();
                        return;
                    }
                    updateToken(client, token, (...args) => {
                        if (!this.isSocketAllowed(client)) {
                            deny();
                        }
                        else {
                            reply(...args);
                        }
                    });
                })
                    .catch(deny);
            };
        }
        // Polling is an additional missed-event safeguard, not a grace period for normal
        // user/group events: those call revoke synchronously before publication.
        this.timer = setInterval(() => {
            for (const [client, record] of this.connections) {
                if (!record.proof || record.checking || record.revoked) {
                    continue;
                }
                record.checking = true;
                void this.bounded(() => this.snapshot(record.proof.userId))
                    .then(current => {
                    if (!this.matches(record.proof, current)) {
                        this.disconnect(client);
                    }
                }, () => this.disconnect(client))
                    .finally(() => {
                    record.checking = false;
                });
            }
        }, 5000);
        this.timer.unref?.();
    }
    stop() {
        this.stopped = true;
        clearInterval(this.timer);
        clearInterval(this.idleTimer);
        this.revoke();
    }
}
module.exports = { EosSessionSecurity, securityProjection, IDLE_TIMEOUT_MS };
//# sourceMappingURL=eosSessionSecurity.js.map