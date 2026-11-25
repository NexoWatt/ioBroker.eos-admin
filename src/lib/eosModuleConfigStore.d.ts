export interface ModuleConfigurationOwner {
    namespace: string;
    config: Record<string, unknown>;
    encrypt(value: string): string;
    decrypt(value: string): string;
    getForeignObjectAsync(id: string): Promise<unknown>;
    setForeignObjectAsync(id: string, value: unknown): Promise<unknown>;
}
export interface ModuleConfigurationEnvelope {
    v: 1;
    encrypted: string;
    [key: string]: unknown;
}
export class EosModuleConfigStore {
    constructor(owner: ModuleConfigurationOwner, options?: { moduleIds?: string[] });
    readonly revisions: Map<string, string | null>;
    objectId(id: string): string;
    load(id: string): Promise<ModuleConfigurationEnvelope | undefined>;
    save(id: string, envelope: unknown, canSave?: () => boolean): Promise<ModuleConfigurationEnvelope>;
}
