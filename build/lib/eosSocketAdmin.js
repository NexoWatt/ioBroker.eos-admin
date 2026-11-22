"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EosSocketAdmin = void 0;
const node_perf_hooks_1 = require("node:perf_hooks");
const socket_classes_1 = require("@iobroker/socket-classes");
function record(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
/** Narrow compatibility boundary for the pinned socket-classes 2.10.0 implementation. */
function thresholdCommands(value) {
    if (!record(value) ||
        !record(value.subscribes) ||
        !record(value.eventsThreshold) ||
        typeof value.start !== 'function' ||
        typeof value.disableEventThreshold !== 'function' ||
        typeof value.stateChange !== 'function') {
        return false;
    }
    const threshold = value.eventsThreshold;
    return (typeof threshold.active === 'boolean' &&
        ['count', 'timeActivated', 'accidents', 'repeatSeconds', 'value', 'checkInterval'].every(key => typeof threshold[key] === 'number' && Number.isFinite(threshold[key])) &&
        Number(threshold.repeatSeconds) > 0 &&
        Number(threshold.value) > 0 &&
        Number(threshold.checkInterval) > 0 &&
        (value.subscribes.stateChange === undefined || record(value.subscribes.stateChange)));
}
/**
 * Admin transport for the combined owner. Authentication, ACLs and commands stay upstream.
 * Only the threshold lifecycle is owned here: the upstream timer assumes a browser has
 * subscribed already, and its detached async transitions cannot be cancelled on close.
 */
class EosSocketAdmin extends socket_classes_1.SocketAdmin {
    thresholdCommands;
    interval;
    transitionTimer;
    transitionGeneration = 0;
    thresholdActivatedAt = 0;
    closed = false;
    thresholdChanged;
    constructor(settings, adapter, objects) {
        super(settings, adapter, objects);
        const commands = this.commands;
        if (!thresholdCommands(commands)) {
            throw new Error('EOS_SOCKET_CONTRACT: Unsupported socket threshold interface');
        }
        this.thresholdCommands = commands;
        // No browser subscription is a valid state, including during a busy EMS start.
        commands.subscribes.stateChange ??= Object.create(null);
        commands.start = callback => this.startThreshold(callback);
        commands.disableEventThreshold = () => this.disableThreshold();
        // The UI command otherwise reaches the upstream private enable method directly.
        // Keep the original command permission boundary, including EOS's later role guard.
        this.addCommandHandler('eventsThreshold', (client, enabled) => {
            if (this.closed ||
                typeof enabled !== 'boolean' ||
                !this.commands?._checkPermissions(client, 'eventsThreshold', undefined, enabled)) {
                return;
            }
            if (enabled) {
                this.enableThreshold();
            }
            else {
                this.disableThreshold();
            }
        });
    }
    startThreshold(callback) {
        if (this.closed || this.interval) {
            return;
        }
        this.thresholdChanged = callback;
        const threshold = this.thresholdCommands.eventsThreshold;
        this.interval = setInterval(() => {
            if (!threshold.active) {
                threshold.accidents = threshold.count > threshold.value ? threshold.accidents + 1 : 0;
                if (threshold.accidents >= threshold.repeatSeconds) {
                    this.enableThreshold();
                }
                threshold.count = 0;
            }
            else if (node_perf_hooks_1.performance.now() - this.thresholdActivatedAt > 60_000) {
                this.disableThreshold();
            }
        }, threshold.checkInterval);
    }
    scheduleTransition(enabled, delay) {
        if (this.transitionTimer) {
            clearTimeout(this.transitionTimer);
        }
        const generation = ++this.transitionGeneration;
        this.transitionTimer = setTimeout(() => {
            this.transitionTimer = undefined;
            void this.applyTransition(enabled, generation).catch(() => {
                if (!this.closed) {
                    this.adapter.log.error('EOS_SOCKET_THRESHOLD_FAILED: State subscription transition failed');
                }
            });
        }, delay);
    }
    transitionCurrent(enabled, generation) {
        return (!this.closed &&
            generation === this.transitionGeneration &&
            this.thresholdCommands.eventsThreshold.active === enabled);
    }
    async applyTransition(enabled, generation) {
        if (!this.transitionCurrent(enabled, generation)) {
            return;
        }
        const threshold = this.thresholdCommands.eventsThreshold;
        if (enabled) {
            this.adapter.log.info(`Unsubscribe from all states, except system's, because over ${threshold.repeatSeconds} seconds the number of events is over ${threshold.value} (in last second ${threshold.count})`);
        }
        this.thresholdChanged?.(enabled);
        if (!enabled) {
            try {
                await this.adapter.unsubscribeForeignStatesAsync('system.adapter.*');
            }
            catch {
                this.adapter.log.error('EOS_SOCKET_THRESHOLD_UNSUBSCRIBE_FAILED: Cannot release system state subscription');
            }
        }
        for (const pattern of Object.keys(this.thresholdCommands.subscribes.stateChange)) {
            if (!this.transitionCurrent(enabled, generation)) {
                return;
            }
            try {
                if (enabled) {
                    await this.adapter.unsubscribeForeignStatesAsync(pattern);
                }
                else {
                    await this.adapter.subscribeForeignStatesAsync(pattern);
                }
            }
            catch {
                this.adapter.log.error('EOS_SOCKET_THRESHOLD_SUBSCRIPTION_FAILED: Cannot change browser state subscription');
            }
        }
        if (enabled && this.transitionCurrent(enabled, generation)) {
            try {
                await this.adapter.subscribeForeignStatesAsync('system.adapter.*');
            }
            catch {
                this.adapter.log.error('EOS_SOCKET_THRESHOLD_SUBSCRIBE_FAILED: Cannot subscribe to system states');
            }
        }
    }
    enableThreshold() {
        const threshold = this.thresholdCommands.eventsThreshold;
        if (this.closed || threshold.active) {
            return;
        }
        threshold.active = true;
        threshold.timeActivated = Date.now();
        this.thresholdActivatedAt = node_perf_hooks_1.performance.now();
        this.scheduleTransition(true, 100);
    }
    disableThreshold() {
        const threshold = this.thresholdCommands.eventsThreshold;
        if (this.closed || !threshold.active) {
            return;
        }
        threshold.accidents = 0;
        threshold.count = 0;
        threshold.active = false;
        threshold.timeActivated = 0;
        this.adapter.log.info('Subscribe to all states again');
        this.scheduleTransition(false, 50);
    }
    stateChange(id, state) {
        if (this.closed) {
            return;
        }
        // The EMS may still own a controller subscription while the browser is throttled.
        // Keep the upstream cache current but do not forward that traffic to browser clients.
        if (this.thresholdCommands.eventsThreshold.active && !id.startsWith('system.adapter.')) {
            this.thresholdCommands.stateChange(id, state);
            return;
        }
        super.stateChange(id, state);
    }
    close() {
        if (this.closed) {
            return;
        }
        this.closed = true;
        this.transitionGeneration++;
        this.thresholdCommands.eventsThreshold.active = false;
        this.thresholdChanged = undefined;
        clearInterval(this.interval);
        clearTimeout(this.transitionTimer);
        this.interval = undefined;
        this.transitionTimer = undefined;
        super.close();
    }
}
exports.EosSocketAdmin = EosSocketAdmin;
//# sourceMappingURL=eosSocketAdmin.js.map