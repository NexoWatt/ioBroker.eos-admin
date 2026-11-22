export interface OwnershipStatus {
    schema: 1;
    owner: string;
    allowed: boolean;
    reason: string;
    generation: number;
    lastCheckedAt: number | null;
    blockers: Array<{ instance: string; host?: string; reason: string }>;
}

export interface OwnershipGuard {
    start(): Promise<boolean>;
    refresh(): Promise<boolean>;
    canWrite(): boolean;
    status(): OwnershipStatus;
    onObjectChange(id: string, object?: unknown): void;
    onStateChange(id: string, state?: { val?: unknown; ack?: boolean } | null): void;
    stop(): void;
}

export function createOwnershipGuard(owner: ioBroker.Adapter): OwnershipGuard;
