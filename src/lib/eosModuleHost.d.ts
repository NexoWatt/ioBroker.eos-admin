import type { Adapter } from '@iobroker/adapter-core';
import type { Readable } from 'node:stream';
import type { LegacyMigrationStatus } from './eosLegacyMigration';
import type { DeviceEmsInventory, DeviceEmsPublicView } from './eosDeviceEmsService';

export interface ModuleBridgeMessage {
    from: string;
    command: string;
    message: unknown;
}
export interface DeviceProfileChanges {
    namespace: string;
    changes: Array<{
        deviceId: string;
        previousTemplateId: string;
        templateId: string;
        previousProtocol: string;
        protocol: string;
    }>;
}
export interface ModuleView {
    id: string;
    config: Record<string, unknown>;
    status: Record<string, unknown>;
    configurationReady: boolean;
    configurationLoaded: boolean;
    configurationRevision: string;
    configurationReason: string;
    emsCommissioning?: DeviceEmsPublicView;
}
export class EosModuleHost {
    constructor(
        owner: Adapter,
        options: {
            baseDir: string;
            dataDir: string;
            installationDir?: string;
            eosDataDir?: string;
            processEnabled?: (id: string) => boolean;
            standbyRequested?: (id: string) => boolean;
        },
    );
    readonly mutation: boolean;
    readonly configurationSavePromise: Promise<unknown> | null;
    start(): Promise<void>;
    stop(): Promise<void>;
    holdMigrationModules(ids: string[]): Promise<void>;
    releaseMigrationModules(ids: string[], transferred: boolean): Promise<void>;
    controlProcess(id: string, action: 'stop' | 'start'): Promise<void>;
    enableProcessModule(id: string): Promise<void>;
    onObjectChange(id: string, object?: unknown): void;
    onStateChange(id: string, state?: ioBroker.State | null): void;
    view(id: string): Promise<ModuleView>;
    status(id: string): Promise<Record<string, unknown>>;
    supervisorState(id: string, includeDevices?: boolean): Record<string, unknown>;
    namespace(id: string): string;
    save(
        id: string,
        config: unknown,
        migration?: Record<string, unknown>,
        expectedConfigurationRevision?: string,
    ): Promise<ModuleView>;
    importLegacy(id: string, instance: unknown): Promise<ModuleView & { migration: Record<string, unknown> }>;
    command(id: string, command: unknown, payload: unknown): Promise<unknown>;
    download(
        id: string,
        name: string,
    ): Promise<{ stream: Readable; filename: string; contentType?: string; size?: number }>;
    migrationStatus(): LegacyMigrationStatus;
    bindBridge(handler: (message: ModuleBridgeMessage) => Promise<unknown>): void;
    receiveBridge(message: { command: string; message?: unknown }): boolean;
    bindDeviceEms(
        handler: (devices: DeviceEmsInventory[]) => Promise<unknown>,
        reserveProfileChange?: (change: DeviceProfileChanges) => Promise<() => void>,
    ): void;
    requestDeviceEms(): void;
    flushDeviceEms(): Promise<void>;
    deviceEmsView(): DeviceEmsPublicView;
}
