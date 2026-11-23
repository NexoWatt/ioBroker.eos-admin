import type { Adapter } from '@iobroker/adapter-core';

export interface ModuleBridgeMessage {
    from: string;
    command: string;
    message: unknown;
}
export interface ModuleView {
    id: string;
    config: Record<string, unknown>;
    status: Record<string, unknown>;
}
export class EosModuleHost {
    constructor(owner: Adapter, options: { baseDir: string; dataDir: string });
    start(): Promise<void>;
    stop(): Promise<void>;
    onObjectChange(id: string, object?: unknown): void;
    onStateChange(id: string, state?: ioBroker.State | null): void;
    view(id: string): Promise<ModuleView>;
    status(id: string): Promise<Record<string, unknown>>;
    save(id: string, config: unknown): Promise<ModuleView>;
    importLegacy(id: string, instance: unknown): Promise<ModuleView & { migration: Record<string, unknown> }>;
    command(id: string, command: unknown, payload: unknown): Promise<unknown>;
    bindBridge(handler: (message: ModuleBridgeMessage) => Promise<unknown>): void;
    receiveBridge(message: { command: string; message?: unknown }): boolean;
}
