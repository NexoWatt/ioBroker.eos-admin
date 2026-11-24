export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export interface EosDeviceEmsStatus {
    baseId: string;
    devId: string;
    status: string;
    code: string;
    target: string;
    mappedFields: string[];
    missing: string[];
    optionalMissing: string[];
}
export interface EosDeviceEmsPlan {
    config: Record<string, Json>;
    patch: Record<string, Json>;
    changed: boolean;
    statuses: EosDeviceEmsStatus[];
}
export function planDeviceEms(input: {
    config: unknown;
    devices: unknown;
    limits?: { chargePoints?: unknown; batteries?: unknown };
    writeTargets?: Record<string, string>;
    readTargets?: Record<string, string>;
}): EosDeviceEmsPlan;
export function getDeviceEmsReferences(config: unknown): { read: string[]; write: string[] };
