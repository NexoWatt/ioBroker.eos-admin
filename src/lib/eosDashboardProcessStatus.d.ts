export type DashboardProcessId = 'ui' | 'ems' | 'devices' | 'eebus' | 'backup' | 'ocpp';
export interface DashboardProcessStatus {
    observedAt: number;
    deviceHealth: DashboardDeviceHealth;
    state: 'ok' | 'fault' | 'unknown';
    failed: DashboardProcessId[];
    paused: DashboardProcessId[];
    waiting?: DashboardProcessId[];
}
export function dashboardProcessStatus(sources: unknown, now?: number): DashboardProcessStatus;
export interface DashboardDeviceHealth {
    state: 'ok' | 'fault' | 'unknown';
    offline: { name: string }[];
    totalOffline: number;
}
export interface InternalDeviceHealth extends DashboardDeviceHealth {
    complete: boolean;
    tracked: { key: string; name: string; state: 'online' | 'offline' | 'disabled' | 'unknown' }[];
}
export function normalizedDeviceHealth(value: unknown): InternalDeviceHealth | null;
export function notificationProcessStatus(
    sources: unknown,
    now?: number,
): {
    processes: Record<DashboardProcessId, 'online' | 'offline' | 'unknown' | 'disabled'>;
    devices: Record<'devices' | 'eebus' | 'ocpp', Pick<InternalDeviceHealth, 'complete' | 'tracked'>>;
};
