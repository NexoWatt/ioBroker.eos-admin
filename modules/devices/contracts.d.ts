export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue | undefined };
export interface DeviceConfig {
    id: string;
    templateId: string;
    protocol: string;
    enabled?: boolean;
    pollIntervalMs?: number;
    connection?: Record<string, JsonValue | undefined>;
    [key: string]: JsonValue | undefined;
}
export interface DevicesConfig {
    enabled: boolean;
    pollIntervalMs: number;
    modbusTimeoutMs: number;
    registerAddressOffset: number;
    devices: DeviceConfig[];
    devicesJson?: string;
}
export interface DeviceTemplate {
    id: string;
    category: string;
    manufacturer: string;
    model?: string;
    name?: string;
    protocols?: string[];
    [key: string]: unknown;
}
export interface State { val?: unknown; ack: boolean; }
export interface DeviceAdapter {
    namespace: string;
    instance?: number;
    log: { warn(message: string): void; info(message: string): void; error(message: string): void; debug(message: string): void };
    setObjectNotExistsAsync(id: string, object: Record<string, unknown>): Promise<unknown>;
    setStateAsync(id: string, state: State): Promise<unknown>;
    getStateAsync?(id: string): Promise<unknown>;
    getObjectAsync?(id: string): Promise<unknown>;
    extendObjectAsync?(id: string, object: Record<string, unknown>): Promise<unknown>;
}
export interface Driver {
    disconnect(): Promise<unknown>;
    canOperate?: () => boolean;
    hostedDisconnectFailed?: boolean;
    [key: string]: unknown;
}
export interface HostedRuntime {
    started: boolean;
    _hbOnline?: boolean;
    getDashboardReachability?(now: number): 'online' | 'offline' | 'unknown';
    driver?: Driver | null;
    _writeQueue?: Map<unknown, unknown>;
    _stopWriteLoop?(): void;
    _createDriver(): Driver;
    initObjects(): Promise<unknown>;
    start(options?: { backgroundInitialPoll?: boolean }): Promise<unknown>;
    stop(): Promise<unknown>;
    handleStateChange(id: string, state: State): Promise<unknown>;
}
export interface HostedOptions {
    adapter: DeviceAdapter;
    canOperate: () => boolean;
    config?: unknown;
    dataDir?: string;
    runtimeFactory?: (device: DeviceConfig, template: DeviceTemplate) => HostedRuntime;
}
