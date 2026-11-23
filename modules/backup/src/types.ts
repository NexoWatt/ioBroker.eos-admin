/**
 * Copyright (c) 2026 NexoWatt. Proprietary EOS integration.
 * Retained upstream MIT rights and notices remain applicable; see ../upstream/LICENSE.
 */
import type { NotificationPlan } from './notifications';
import type { Readable } from 'node:stream';
export type Config = Record<string, unknown> & { enabled: boolean };
export interface Adapter {
    getBackupDataFolders?(): Promise<string[]>;
    subscribeStatesAsync?(pattern: string): Promise<void>;
    unsubscribeStatesAsync?(pattern: string): Promise<void>;
    sendBackupNotification?(plan: NotificationPlan): Promise<void>;
    namespace: string;
    hostNamespace?: string;
    log: {
        warn(message: string): void;
        info(message: string): void;
        error(message: string): void;
        debug(message: string): void;
    };
    setObjectNotExistsAsync(id: string, object: Record<string, unknown>): Promise<unknown>;
    setStateAsync(id: string, state: { val: string | number | boolean; ack: true }): Promise<unknown>;
}
export interface Options {
    adapter: Adapter;
    config: unknown;
    canOperate: () => boolean;
    dataDir: string;
    installationDir?: string;
    eosDataDir?: string;
    preservedUiNamespace?: string;
    workerPath?: string;
}
export interface JobContext {
    config: Config;
    installationDir: string;
    eosDataDir: string;
    dataDir: string;
    workDir: string;
    jobId: string;
    kind: 'iobroker' | 'ccu';
    key: string;
    retentionEnabled?: boolean;
    preservedUiNamespace?: string;
    operation?: 'backup' | 'remoteList' | 'remoteFetch' | 'legacyList' | 'legacyImport';
    provider?: string;
    remoteName?: string;
}
export interface ArchiveInfo {
    name: string;
    size: number;
    mtime: string;
    sha256: string;
    kind: string;
}
export interface JobResult {
    id: string;
    state: 'succeeded' | 'failed' | 'cancelled' | 'running';
    startedAt: string;
    finishedAt?: string;
    files: ArchiveInfo[];
    error?: string;
    remote?: Record<string, unknown>;
    operation?: string;
}
export interface Download {
    stream: Readable;
    filename: string;
    contentType: string;
    size: number;
}
export function record(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
export function fail(code: string): Error & { code: string } {
    return Object.assign(new Error(code), { code });
}
export function str(c: Record<string, unknown>, key: string, fallback = ''): string {
    const v = c[key];
    return typeof v === 'string' ? v : fallback;
}
export function num(c: Record<string, unknown>, key: string, fallback: number): number {
    const v = Number(c[key]);
    return Number.isFinite(v) ? v : fallback;
}
export function flag(c: Record<string, unknown>, key: string): boolean {
    return c[key] === true;
}
