import type { Adapter } from '@iobroker/adapter-core';
import type { EosModuleHost } from './eosModuleHost';
export interface RuntimeControlView {
    enabled: boolean;
    canEnable: boolean;
    canDisable: boolean;
    canRestart: boolean;
    busy: boolean;
    reason: string;
    revision: string;
}
export class EosRuntimeControl {
    constructor(options: {
        owner: Adapter;
        host: EosModuleHost;
        runtime: {
            pause(): Promise<void>;
            resume(): Promise<void>;
            pauseEms(): Promise<void>;
            resumeEms(): Promise<void>;
            status(): Record<string, unknown>;
        };
        readTimeoutMs?: number;
    });
    initialize(): Promise<void>;
    isEnabled(id: string): boolean;
    view(id: string, configured?: boolean): RuntimeControlView | undefined;
    request(id: unknown, action: unknown, revision: unknown): { ok: boolean; accepted: boolean };
    whenIdle(): Promise<void>;
    close(): Promise<void>;
}
