interface EosDeviceEmsIntent { mode: string; scope?: string; flowSlot?: number; group?: string; activation?: { requested: boolean; requestId?: string; limits?: Record<string, string | number> }; }
interface EosDeviceEmsApi {
    modes(category: unknown): Array<{ value: string; label: string }>;
    intent(value: unknown): EosDeviceEmsIntent;
    prepareSave(devices: unknown, originals: unknown): unknown[];
    requestRenewal(id: string): void;
    setDevices(devices: unknown): void;
    needsPolling(): boolean;
    capabilities(template: unknown): string[];
    targets(mode: string): Array<{ value: number; label: string }>;
    help(category: string, mode: string, scope: string): string;
    describe(id: unknown, settings: unknown, enabled: unknown): { status: string; label: string; detail: string; optionalDetail?: string };
    render(value: unknown): void;
    runtimeStatus(value: unknown): { state: string; text: string; monitor: boolean; starting: boolean };
}
interface Window { EosDeviceEms: Readonly<EosDeviceEmsApi>; }
