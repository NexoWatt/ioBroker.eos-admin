import type { EventEmitter } from 'node:events';
import type { Readable } from 'node:stream';
export type RecordValue = Record<string, unknown>;
export type Call = (...args: unknown[]) => unknown;
export interface Transport extends Pick<EventEmitter, 'on' | 'off'> {
    connected?: boolean;
    send?: (message: RecordValue, callback: (error: Error | null) => void) => boolean | void;
}
export interface Channel {
    close(): void;
    event(type: string, data?: RecordValue): void;
    request(method: string, args?: unknown[], deadline?: number): Promise<unknown>;
}
export interface PendingRequest {
    resolve(value: unknown): void;
    reject(error: Error): void;
    timer: NodeJS.Timeout;
}
export interface Download {
    stream: Readable;
    filename: string;
    contentType?: string;
    size?: number;
}
export interface WorkerDownload {
    cancelled: boolean;
    stream: Readable | null;
    iterator: AsyncIterator<unknown> | null;
    remainder: Buffer | null;
    reading: boolean;
}
export interface ModuleRuntime {
    start(): unknown;
    stop(): unknown;
    getStatus(): unknown;
    command(name: unknown, payload: unknown): unknown;
    onStateChange?(id: unknown, state: unknown): unknown;
    onMessage?(message: unknown): unknown;
    getDownload?(name: unknown): Promise<Download>;
}
export interface WorkerInit extends RecordValue {
    type: 'init';
    id: 'devices' | 'eebus' | 'backup' | 'ocpp';
    generation: number;
    baseDir: string;
    moduleOptions: {
        adapter: RecordValue;
        config: RecordValue;
        dataDir: string;
        installationDir?: string;
        eosDataDir?: string;
        preservedUiNamespace?: string;
    };
}
