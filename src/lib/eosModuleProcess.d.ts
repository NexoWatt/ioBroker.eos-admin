import type { InternalDeviceHealth } from './eosDashboardProcessStatus';
import type { Readable } from 'node:stream';

export interface ModuleProcessHealth {
    mode: 'process';
    state: 'stopped' | 'starting' | 'running' | 'stopping' | 'error';
    pid: number | null;
    generation: number;
    lastError: string;
    lastHeartbeatAt: number;
}

export interface ProcessModuleAdapter {
    namespace: string;
    hostNamespace?: string;
    eosTargetNamespace?: string;
    instance?: number;
    config?: Record<string, unknown>;
    log: Partial<Record<'debug' | 'info' | 'warn' | 'error', (message: string) => void>>;
    getObjectAsync?: (id: string) => Promise<unknown>;
    getStateAsync?: (id: string) => Promise<unknown>;
    getStatesAsync?: (pattern: string) => Promise<unknown>;
    getObjectViewAsync?: (design: string, type: string, range: unknown) => Promise<unknown>;
    setObjectNotExistsAsync?: (id: string, object: unknown) => Promise<unknown>;
    extendObjectAsync?: (id: string, object: unknown) => Promise<unknown>;
    setStateAsync?: (id: string, value: unknown, ack?: boolean) => Promise<unknown>;
    setStateChangedAsync?: (id: string, value: unknown, ack?: boolean) => Promise<unknown>;
    delObjectAsync?: (id: string, options?: unknown) => Promise<unknown>;
    setForeignObjectNotExistsAsync?: (id: string, object: unknown) => Promise<unknown>;
    extendForeignObjectAsync?: (id: string, object: unknown) => Promise<unknown>;
    delForeignObjectAsync?: (id: string, options?: unknown) => Promise<unknown>;
    subscribeStatesAsync?: (pattern: string) => Promise<unknown>;
    unsubscribeStatesAsync?: (pattern: string) => Promise<unknown>;
    getBackupDataFolders?: () => Promise<string[]>;
    sendBackupNotification?: (plan: unknown) => Promise<void>;
    sendTo?: (target: string, command: string, payload: unknown, callback: (result: unknown) => void) => void;
}

export interface ModuleProcessOptions {
    id: 'devices' | 'eebus' | 'backup' | 'ocpp';
    baseDir: string;
    generation: number;
    canOperate: () => boolean;
    onFailure?: (code: string) => void;
    moduleOptions: {
        adapter: ProcessModuleAdapter;
        config: Record<string, unknown>;
        dataDir: string;
        installationDir?: string;
        eosDataDir?: string;
        preservedUiNamespace?: string;
        getHistoryBackupRequirement?: () => Promise<unknown>;
    };
    heartbeatMs?: number;
    watchdogMs?: number;
    startTimeoutMs?: number;
    workerPath?: string;
}

export class EosModuleProcess {
    constructor(options: ModuleProcessOptions);
    health(): ModuleProcessHealth;
    getDeviceHealth(): (InternalDeviceHealth & { observedAt: number }) | null;
    revoke(): void;
    start(): Promise<void>;
    stop(): Promise<void>;
    getStatus(): Promise<unknown>;
    command(name: string, payload: unknown): Promise<unknown>;
    onStateChange(id: string, state: unknown): Promise<unknown>;
    onMessage(message: unknown): Promise<unknown>;
    getDownload(name: string): Promise<{ stream: Readable; filename: string; contentType?: string; size?: number }>;
}
