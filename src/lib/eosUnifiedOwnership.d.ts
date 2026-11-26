export interface OwnershipStatus {
    schema: 1;
    owner: string;
    allowed: boolean;
    reason: string;
    generation: number;
    lastCheckedAt: number | null;
    blockers: Array<{ instance: string; host?: string; reason: string }>;
}

export type OwnershipScope = 'ui' | 'ems' | 'devices' | 'eebus' | 'backup' | 'ocpp';

export interface OwnershipGuard {
    start(): Promise<boolean>;
    refresh(): Promise<boolean>;
    canWrite(scope?: OwnershipScope): boolean;
    status(scope?: OwnershipScope): OwnershipStatus;
    onObjectChange(id: string, object?: unknown): void;
    onStateChange(id: string, state?: { val?: unknown; ack?: boolean } | null): void;
    stop(): void;
}

export function createOwnershipGuard(owner: ioBroker.Adapter): OwnershipGuard;
