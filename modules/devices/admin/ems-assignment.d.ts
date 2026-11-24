interface EosDeviceEmsIntent { mode: string; scope?: string; flowSlot?: number; group?: string; }
interface EosDeviceEmsApi {
    modes(category: unknown): Array<{ value: string; label: string }>;
    intent(value: unknown): EosDeviceEmsIntent;
    targets(mode: string): Array<{ value: number; label: string }>;
    help(category: string, mode: string, scope: string): string;
    describe(id: unknown, settings: unknown, enabled: unknown): { status: string; label: string; detail: string };
    render(value: unknown): void;
}
interface Window { EosDeviceEms: Readonly<EosDeviceEmsApi>; }
