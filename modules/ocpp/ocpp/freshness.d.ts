export interface ConnectionHealthOptions {
    now: number; socketConnected: boolean; connectedAt: number; lastMessageAt: number;
    lastHeartbeatAt: number; heartbeatIntervalSec: number;
    heartbeatTimeoutFactor: unknown; activityTimeoutSec: unknown;
}
export function hasConfirmedSessionActivity(entry: { lastBootAt?: number; lastHeartbeatAt?: number; lastStatusAt?: number; lastMeterAt?: number }): boolean;
export function deriveConnectionHealth(options: ConnectionHealthOptions): {
    socketConnected: boolean; online: boolean; activityFresh: boolean; heartbeatAlive: boolean;
    lastActivityAt: number; activityWindowMs: number; heartbeatWindowMs: number;
};
export function dataFreshForEos(online: boolean, powerFresh: boolean, safeZero: boolean): boolean;

export function activityTimeoutMs(intervalSec: unknown, heartbeatFactor: unknown, minimumSec: unknown): number;
