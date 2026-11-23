import { performance } from 'node:perf_hooks';
import { SocketAdmin, type SocketSettings } from '@iobroker/socket-classes';

interface ThresholdState {
    count: number;
    timeActivated: number;
    active: boolean;
    accidents: number;
    repeatSeconds: number;
    value: number;
    checkInterval: number;
}

interface ThresholdCommands {
    subscribes: Record<string, Record<string, number>>;
    eventsThreshold: ThresholdState;
    start(onThresholdChanged: (enabled: boolean) => void): void;
    disableEventThreshold(): void;
    stateChange(id: string, state: ioBroker.State | null | undefined): void;
    updateRatings: SocketAdmin['updateRatings'];
}

function record(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Narrow compatibility boundary for the pinned socket-classes 2.10.0 implementation. */
function thresholdCommands(value: unknown): value is ThresholdCommands {
    if (
        !record(value) ||
        !record(value.subscribes) ||
        !record(value.eventsThreshold) ||
        typeof value.start !== 'function' ||
        typeof value.disableEventThreshold !== 'function' ||
        typeof value.stateChange !== 'function' ||
        typeof value.updateRatings !== 'function'
    ) {
        return false;
    }
    const threshold = value.eventsThreshold;
    return (
        typeof threshold.active === 'boolean' &&
        ['count', 'timeActivated', 'accidents', 'repeatSeconds', 'value', 'checkInterval'].every(
            key => typeof threshold[key] === 'number' && Number.isFinite(threshold[key]),
        ) &&
        Number(threshold.repeatSeconds) > 0 &&
        Number(threshold.value) > 0 &&
        Number(threshold.checkInterval) > 0 &&
        (value.subscribes.stateChange === undefined || record(value.subscribes.stateChange))
    );
}

/**
 * Admin transport for the combined owner. Authentication, ACLs and commands stay upstream.
 * The threshold lifecycle is owned here: the upstream timer assumes a browser has
 * subscribed already, and its detached async transitions cannot be cancelled on close.
 * External ratings remain optional: no system UUID leaves EOS without an explicit opt-in.
 */
export class EosSocketAdmin extends SocketAdmin {
    private readonly thresholdCommands: ThresholdCommands;
    private interval: NodeJS.Timeout | undefined;
    private transitionTimer: NodeJS.Timeout | undefined;
    private transitionGeneration = 0;
    private thresholdActivatedAt = 0;
    private closed = false;
    private thresholdChanged: ((enabled: boolean) => void) | undefined;

    constructor(settings: SocketSettings, adapter: ioBroker.Adapter, objects: Record<string, ioBroker.Object>) {
        super(settings, adapter, objects);
        const commands: unknown = this.commands;
        if (!thresholdCommands(commands)) {
            throw new Error('EOS_SOCKET_CONTRACT: Unsupported socket threshold interface');
        }
        this.thresholdCommands = commands;
        // No browser subscription is a valid state, including during a busy EMS start.
        commands.subscribes.stateChange ??= Object.create(null);
        commands.start = callback => this.startThreshold(callback);
        commands.disableEventThreshold = () => this.disableThreshold();
        // SocketAdmin.updateRatings and the getRatings RPC share this checked
        // commands object in pinned socket-classes 2.10.0. No private-field access
        // or ACL replacement: retain upstream fetching only after explicit consent.
        const updateRatings = commands.updateRatings.bind(commands);
        commands.updateRatings = (uuid, isAutoUpdate) => {
            const config: unknown = adapter.config;
            if (this.closed || !record(config) || config.eosExternalRatings !== true) {
                return Promise.resolve(null);
            }
            return updateRatings(uuid, isAutoUpdate);
        };
        // The UI command otherwise reaches the upstream private enable method directly.
        // Keep the original command permission boundary, including EOS's later role guard.
        this.addCommandHandler('eventsThreshold', (client, enabled: unknown) => {
            if (
                this.closed ||
                typeof enabled !== 'boolean' ||
                !this.commands?._checkPermissions(client, 'eventsThreshold', undefined, enabled)
            ) {
                return;
            }
            if (enabled) {
                this.enableThreshold();
            } else {
                this.disableThreshold();
            }
        });
    }

    private startThreshold(callback: (enabled: boolean) => void): void {
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
            } else if (performance.now() - this.thresholdActivatedAt > 60_000) {
                this.disableThreshold();
            }
        }, threshold.checkInterval);
    }

    private scheduleTransition(enabled: boolean, delay: number): void {
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

    private transitionCurrent(enabled: boolean, generation: number): boolean {
        return (
            !this.closed &&
            generation === this.transitionGeneration &&
            this.thresholdCommands.eventsThreshold.active === enabled
        );
    }

    private async applyTransition(enabled: boolean, generation: number): Promise<void> {
        if (!this.transitionCurrent(enabled, generation)) {
            return;
        }
        const threshold = this.thresholdCommands.eventsThreshold;
        if (enabled) {
            this.adapter.log.info(
                `Unsubscribe from all states, except system's, because over ${threshold.repeatSeconds} seconds the number of events is over ${threshold.value} (in last second ${threshold.count})`,
            );
        }
        this.thresholdChanged?.(enabled);
        if (!enabled) {
            try {
                await this.adapter.unsubscribeForeignStatesAsync('system.adapter.*');
            } catch {
                this.adapter.log.error(
                    'EOS_SOCKET_THRESHOLD_UNSUBSCRIBE_FAILED: Cannot release system state subscription',
                );
            }
        }
        for (const pattern of Object.keys(this.thresholdCommands.subscribes.stateChange)) {
            if (!this.transitionCurrent(enabled, generation)) {
                return;
            }
            try {
                if (enabled) {
                    await this.adapter.unsubscribeForeignStatesAsync(pattern);
                } else {
                    await this.adapter.subscribeForeignStatesAsync(pattern);
                }
            } catch {
                this.adapter.log.error(
                    'EOS_SOCKET_THRESHOLD_SUBSCRIPTION_FAILED: Cannot change browser state subscription',
                );
            }
        }
        if (enabled && this.transitionCurrent(enabled, generation)) {
            try {
                await this.adapter.subscribeForeignStatesAsync('system.adapter.*');
            } catch {
                this.adapter.log.error('EOS_SOCKET_THRESHOLD_SUBSCRIBE_FAILED: Cannot subscribe to system states');
            }
        }
    }

    private enableThreshold(): void {
        const threshold = this.thresholdCommands.eventsThreshold;
        if (this.closed || threshold.active) {
            return;
        }
        threshold.active = true;
        threshold.timeActivated = Date.now();
        this.thresholdActivatedAt = performance.now();
        this.scheduleTransition(true, 100);
    }

    private disableThreshold(): void {
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

    override stateChange(id: string, state: ioBroker.State | null | undefined): void {
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

    override close(): void {
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
