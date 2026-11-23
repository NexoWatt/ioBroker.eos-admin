import type { Adapter } from '@iobroker/adapter-core';
export interface LegacyMigrationStatus {
    phase: string;
    code: string;
    sources: Array<{ id: string; source: string; namespacePreserved: boolean }>;
    updatedAt: number | null;
}
export class EosLegacyMigration {
    constructor(owner: Adapter, options: { baseDir: string; dataDir: string; installationDir?: string });
    start(): Promise<void>;
    saveUi(config: unknown): Promise<void>;
    verifyRuntime(): Promise<void>;
    allowsWrites(): boolean;
    block(code?: string): void;
    status(): LegacyMigrationStatus;
    stop(): void;
}
