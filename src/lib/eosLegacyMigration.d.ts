import type { Adapter } from '@iobroker/adapter-core';
export interface LegacyMigrationStatus {
    phase: string;
    code: string;
    sources: Array<{
        id: string;
        source: string;
        namespacePreserved: boolean;
        sourceVersion?: string | null;
        instanceVersion?: string | null;
        adapterVersion?: string | null;
        versionCode?: string;
        enabled?: boolean;
        targetEnabled?: boolean;
    }>;
    updatedAt: number | null;
    issues?: Array<{ id: string; source: string; code: string }>;
}
export class EosLegacyMigration {
    constructor(owner: Adapter, options: { baseDir: string; dataDir: string; installationDir?: string });
    start(): Promise<void>;
    manualReview(): Promise<LegacyMigrationStatus>;
    manualView(): {
        canStart: boolean;
        canActivateDevices: boolean;
        revision: string;
        operation: { state: string; code: string };
    };
    requestManual(activateDevices: boolean, revision: string, confirmAuthority: () => Promise<boolean>): void;
    whenManualIdle(): Promise<void>;
    saveUi(config: unknown): Promise<void>;
    verifyRuntime(): Promise<void>;
    failStartup(code?: string): Promise<void>;
    allowsStartup(scope?: string): boolean;
    allowsSupervisorStartup(): boolean;
    allowsWrites(scope?: string): boolean;
    block(code?: string): void;
    status(): LegacyMigrationStatus;
    stop(): void;
}
export function hasConfirmedLegacyStop(
    reader: { host?: string; getForeignStateAsync(id: string): Promise<unknown> },
    object: unknown,
    alive: unknown,
): Promise<boolean>;
