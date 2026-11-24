import type { Adapter } from '@iobroker/adapter-core';
import type { Readable } from 'node:stream';
import type { LegacyMigrationStatus } from './eosLegacyMigration';
import type { DeviceEmsInventory, DeviceEmsPublicView } from './eosDeviceEmsService';

export interface ModuleBridgeMessage {
    from: string;
    command: string;
    message: unknown;
}
export interface ModuleView {
    id: string;
    config: Record<string, unknown>;
    status: Record<string, unknown>;
    configurationReady: boolean;
    configurationLoaded: boolean;
    configurationReason: string;
    emsCommissioning?: DeviceEmsPublicView;
}
export class EosModuleHost {
    constructor(
        owner: Adapter,
        options: { baseDir: string; dataDir: string; installationDir?: string; eosDataDir?: string },
    );
    start(): Promise<void>;
    stop(): Promise<void>;
    onObjectChange(id: string, object?: unknown): void;
    onStateChange(id: string, state?: ioBroker.State | null): void;
    view(id: string): Promise<ModuleView>;
    status(id: string): Promise<Record<string, unknown>>;
    save(id: string, config: unknown): Promise<ModuleView>;
    importLegacy(id: string, instance: unknown): Promise<ModuleView & { migration: Record<string, unknown> }>;
    command(id: string, command: unknown, payload: unknown): Promise<unknown>;
    download(
        id: string,
        name: string,
    ): Promise<{ stream: Readable; filename: string; contentType?: string; size?: number }>;
    migrationStatus(): LegacyMigrationStatus;
    bindBridge(handler: (message: ModuleBridgeMessage) => Promise<unknown>): void;
    receiveBridge(message: { command: string; message?: unknown }): boolean;
    bindDeviceEms(handler: (devices: DeviceEmsInventory[]) => Promise<unknown>): void;
    requestDeviceEms(): void;
    flushDeviceEms(): Promise<void>;
}
