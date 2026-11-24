export interface DeviceEmsAlias {
    id: string;
    exists: boolean;
    read: boolean;
    write: boolean;
    type: string;
    unit: string;
    role: string;
    targetId?: string;
    powerCapabilityValidated?: boolean;
}
export interface DeviceEmsInventory {
    baseId: string;
    deviceId: string;
    devId: string;
    name: string;
    enabled: boolean;
    templateId: string;
    protocol: string;
    deviceClass: string;
    category: string;
    aliases: Record<string, string>;
    aliasMeta: Record<string, DeviceEmsAlias>;
    capabilities: string[];
    missingRequired: string[];
    ems: Record<string, unknown>;
    discoveryCode?: string;
    optionalPowerCapabilityPending?: boolean;
}
export interface DeviceEmsSnapshot {
    namespace: string;
    devices: unknown[];
    moduleEnabled: boolean;
    ready: boolean;
    generation: number;
}
export interface DeviceEmsPublicView {
    state: 'pending' | 'ready' | 'error' | 'stopped';
    code: string;
    updatedAt: number;
    statuses: Array<{
        deviceId: string;
        devId: string;
        baseId: string;
        status: string;
        code: string;
        target: string;
        mappedFields: string[];
        missing: string[];
        optionalMissing: string[];
        activationRequestId?: string;
        activationApplied?: boolean;
        corrections?: string[];
    }>;
}
export interface DeviceEmsServiceOptions {
    owner: {
        getForeignStateAsync(id: string): Promise<unknown>;
        getForeignObjectsAsync(pattern: string, type: 'state'): Promise<unknown>;
    };
    getSnapshot(): DeviceEmsSnapshot;
    canRun(): boolean;
    apply(devices: DeviceEmsInventory[]): Promise<unknown>;
    report?(code: string): void;
}
export interface DeviceEmsTargetOptions {
    owner: { getForeignObjectAsync(id: string): Promise<unknown> };
    references: { read: string[]; write: string[] };
    devices: DeviceEmsInventory[];
    canRun?(): boolean;
}
export interface DeviceEmsReferenceMeta {
    type: string;
    unit: string;
    read: boolean;
    write: boolean;
}
export interface DeviceEmsTargets {
    readTargets: Record<string, string>;
    writeTargets: Record<string, string>;
    referenceMeta: Record<string, DeviceEmsReferenceMeta>;
}
export function resolveDeviceEmsTargets(options: DeviceEmsTargetOptions): Promise<DeviceEmsTargets>;
export function projectDeviceEmsConfig(value: unknown): Record<string, unknown>;
export class EosDeviceEmsService {
    constructor(options: DeviceEmsServiceOptions);
    request(reason?: string): void;
    event(id: string, state?: boolean): void;
    inventory(snapshot: DeviceEmsSnapshot): Promise<DeviceEmsInventory[]>;
    view(): DeviceEmsPublicView;
    flush(): Promise<void>;
    stop(): Promise<void>;
}
