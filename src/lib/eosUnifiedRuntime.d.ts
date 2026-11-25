import type { Request, Response, NextFunction } from 'express';
import type { DeviceEmsInventory } from './eosDeviceEmsService';
import type { DeviceProfileChanges } from './eosModuleHost';
export interface EosHostedRuntime {
    /** Build the request router only; device/EMS startup is explicitly separate. */
    start(): Promise<void>;
    startOperational(): Promise<void>;
    handle(req: Request, res: Response, next: NextFunction): void;
    stop(): Promise<void>;
    status?(): Record<string, unknown>;
    getHistoryBackupRequirement?():
        | { provider: 'influxdb2'; url: string; bucket: string; org: string }
        | { provider: 'postgresql'; namespace: string }
        | { provider: 'adapter'; instance: string }
        | { provider: 'none' | 'unknown' }
        | Promise<unknown>;
    revokeSessions?(): void;
    onStateChange?(id: string, state: ioBroker.State | null | undefined): void;
    onObjectChange?(id: string, object: ioBroker.Object | null | undefined): void;
    onMessage?(message: ioBroker.Message): boolean | void;
    onHostedEebusMessage?(message: { from: string; command: string; message: unknown }): Promise<unknown>;
    reconcileDeviceEms?(devices: DeviceEmsInventory[]): Promise<unknown>;
    reserveDeviceProfileChange?(change: DeviceProfileChanges): Promise<() => void>;
}
