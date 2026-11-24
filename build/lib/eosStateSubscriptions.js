"use strict";
/** Copyright (c) 2026 NexoWatt. Proprietary; see LICENSE. */
Object.defineProperty(exports, "__esModule", { value: true });
exports.installEosStateSubscriptions = installEosStateSubscriptions;
/**
 * One controller connection serves two consumers: EMS/host and browser sockets.
 * Controller subscriptions are sets, not reference counts. A browser unsubscribe
 * must therefore release only its own interest, never an EMS subscription.
 *
 * The shared input bus uses the adapter's service identity. Browser access remains
 * checked by SocketCommands for each command AND each published object/state;
 * sharing the input bus does not grant a client permission to receive its events.
 */
function installEosStateSubscriptions(adapter) {
    const subscribeRaw = adapter.subscribeForeignStatesAsync.bind(adapter);
    const unsubscribeRaw = adapter.unsubscribeForeignStatesAsync.bind(adapter);
    const interests = new Map();
    // Explicit module ownership is independent of the existing idempotent host
    // API. Releasing a module must not release another host or socket consumer.
    const hostLeases = new Map();
    const queues = new Map();
    let stopped = false;
    let socketStopped = false;
    let closing;
    let closingSocket;
    function patterns(value, own) {
        // Match the controller's foreign subscribe/unsubscribe default. Own arrays
        // already contain absolute IDs in controller 7; only own strings are fixed.
        const input = !own && !value ? '*' : value;
        const values = Array.isArray(input) ? input : [input];
        if (values.some(item => typeof item !== 'string' || (!item && (!own || Array.isArray(input))))) {
            throw new Error('EOS_STATE_SUBSCRIPTION_PATTERN_INVALID');
        }
        return [
            ...new Set(values.map(item => {
                const text = String(item);
                return own &&
                    !Array.isArray(input) &&
                    text !== adapter.namespace &&
                    !text.startsWith(`${adapter.namespace}.`)
                    ? `${adapter.namespace}.${text}`
                    : text;
            })),
        ];
    }
    function queue(pattern, operation) {
        const previous = queues.get(pattern) || Promise.resolve();
        // Every caller retains its own rejection. A failed call must not poison
        // later retries or cleanup for this pattern.
        const result = previous.then(operation, operation);
        const settled = result.then(() => undefined, () => undefined);
        queues.set(pattern, settled);
        void settled.then(() => {
            if (queues.get(pattern) === settled) {
                queues.delete(pattern);
            }
        });
        return result;
    }
    async function change(scope, pattern, subscribing, cleanup = false) {
        return queue(pattern, async () => {
            if (!cleanup && (stopped || (scope === 'socket' && socketStopped))) {
                // Socket disconnect callbacks can arrive after closeSocket(). The
                // owned cleanup already releases this scope; another unsubscribe
                // is harmless and must not obscure the original shutdown reason.
                if (!subscribing) {
                    return;
                }
                throw new Error('EOS_STATE_SUBSCRIPTIONS_STOPPED');
            }
            const current = interests.get(pattern) || { host: false, socket: false };
            if (current[scope] === subscribing) {
                return;
            }
            const next = { ...current, [scope]: subscribing };
            const leased = Boolean(hostLeases.get(pattern)?.size);
            if (!current.host && !current.socket && !leased && (next.host || next.socket)) {
                await subscribeRaw(pattern);
            }
            else if ((current.host || current.socket) && !next.host && !next.socket && !leased) {
                await unsubscribeRaw(pattern);
            }
            // Commit only after IO succeeds: failed subscribe can be retried,
            // failed unsubscribe retains a tracked active backend interest.
            if (next.host || next.socket) {
                interests.set(pattern, next);
            }
            else {
                interests.delete(pattern);
            }
        });
    }
    async function releaseLease(pattern, token) {
        return queue(pattern, async () => {
            const leases = hostLeases.get(pattern);
            if (!leases?.has(token)) {
                return;
            }
            const current = interests.get(pattern);
            if (leases.size === 1 && !current?.host && !current?.socket) {
                await unsubscribeRaw(pattern);
            }
            // Retain a failed release so the same handle or close() can retry it.
            leases.delete(token);
            if (!leases.size) {
                hostLeases.delete(pattern);
            }
        });
    }
    async function acquireHost(pattern) {
        // No implicit global wildcard and no array overload for module leases.
        if (typeof pattern !== 'string' || !pattern || pattern === '*' || pattern.length > 512) {
            throw new Error('EOS_STATE_SUBSCRIPTION_PATTERN_INVALID');
        }
        const token = Symbol('host-subscription');
        await queue(pattern, async () => {
            if (stopped) {
                throw new Error('EOS_STATE_SUBSCRIPTIONS_STOPPED');
            }
            const leases = hostLeases.get(pattern) || new Set();
            if (leases.size >= 256 || (hostLeases.size >= 1024 && !hostLeases.has(pattern))) {
                throw new Error('EOS_STATE_SUBSCRIPTION_LIMIT');
            }
            const current = interests.get(pattern);
            // Reserve this pattern before asynchronous IO, so simultaneous
            // acquisitions for different patterns cannot outrun the bound.
            hostLeases.set(pattern, leases);
            try {
                if (!leases.size && !current?.host && !current?.socket) {
                    await subscribeRaw(pattern);
                }
                leases.add(token);
            }
            catch (error) {
                if (!leases.size) {
                    hostLeases.delete(pattern);
                }
                throw error;
            }
        });
        return () => releaseLease(pattern, token);
    }
    async function changeAll(scope, own, subscribing, pattern, options) {
        if (options !== undefined && options !== null && (typeof options !== 'object' || Array.isArray(options))) {
            throw new Error('EOS_STATE_SUBSCRIPTION_OPTIONS_INVALID');
        }
        const entries = patterns(pattern, own);
        for (const entry of entries) {
            await change(scope, entry, subscribing);
        }
    }
    function methods(scope) {
        const replacements = {};
        for (const own of [false, true]) {
            for (const subscribing of [true, false]) {
                const name = `${subscribing ? 'subscribe' : 'unsubscribe'}${own ? '' : 'Foreign'}States`;
                replacements[`${name}Async`] = (pattern, options) => changeAll(scope, own, subscribing, pattern, options);
                replacements[name] = (pattern, options, callback) => {
                    const cb = typeof options === 'function' ? options : callback;
                    const opts = typeof options === 'function' ? undefined : options;
                    if (cb !== undefined && cb !== null && typeof cb !== 'function') {
                        throw new Error('EOS_STATE_SUBSCRIPTION_CALLBACK_INVALID');
                    }
                    const done = typeof cb === 'function' ? cb : undefined;
                    void changeAll(scope, own, subscribing, pattern, opts)
                        .then(() => done?.(null), error => {
                        if (done) {
                            done(error instanceof Error ? error : new Error('EOS_STATE_SUBSCRIPTION_FAILED'));
                        }
                        else {
                            adapter.log.error('EOS_STATE_SUBSCRIPTION_FAILED: State subscription operation failed.');
                        }
                    })
                        .catch(() => adapter.log.error('EOS_STATE_SUBSCRIPTION_CALLBACK_FAILED: Subscription callback failed.'));
                };
            }
        }
        return replacements;
    }
    const hostMethods = methods('host');
    for (const [name, method] of Object.entries(hostMethods)) {
        Object.defineProperty(adapter, name, { value: method, writable: true, configurable: true });
    }
    const socketMethods = methods('socket');
    const bound = new Map();
    const socketAdapter = new Proxy(adapter, {
        get(target, key) {
            if (typeof key === 'string' && Object.prototype.hasOwnProperty.call(socketMethods, key)) {
                return socketMethods[key];
            }
            const value = Reflect.get(target, key, target);
            if (typeof value !== 'function') {
                return value;
            }
            if (!bound.has(key)) {
                bound.set(key, value.bind(target));
            }
            return bound.get(key);
        },
    });
    async function release(scope) {
        // Include operations already running at the point of stop. New requests
        // are blocked first, so the drain cannot perpetually replenish itself.
        await Promise.all([...queues.values()]);
        const results = await Promise.allSettled([...interests.keys()].map(pattern => change(scope, pattern, false, true)));
        if (results.some(result => result.status === 'rejected')) {
            throw new Error('EOS_STATE_SUBSCRIPTION_CLEANUP_FAILED');
        }
    }
    return {
        socketAdapter,
        acquireHost,
        closeSocket() {
            socketStopped = true;
            closingSocket ||= release('socket');
            return closingSocket;
        },
        close() {
            stopped = true;
            socketStopped = true;
            closing ||= (async () => {
                // Cleanup retries failed socket releases and still attempts host
                // cleanup if a socket release failed.
                const results = await Promise.allSettled([release('socket'), release('host')]);
                const leaseResults = await Promise.allSettled([...hostLeases].flatMap(([pattern, tokens]) => [...tokens].map(token => releaseLease(pattern, token))));
                results.push(...leaseResults);
                if (results.some(result => result.status === 'rejected')) {
                    throw new Error('EOS_STATE_SUBSCRIPTION_CLEANUP_FAILED');
                }
            })();
            return closing;
        },
    };
}
//# sourceMappingURL=eosStateSubscriptions.js.map