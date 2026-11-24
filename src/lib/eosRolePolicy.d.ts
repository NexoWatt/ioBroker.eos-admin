export type EosRoleGroupKind = 'service' | 'installer' | 'enduser';
export type EosResolvedRole = 'admin' | 'installer' | 'enduser';
export function normalizeGroupId(value: unknown): string | null;
export function getEosRoleGroups(settings: unknown, role: EosRoleGroupKind): string[];
/** Resolve EOS scope only; the caller must separately authenticate and validate the active account/session. */
export function resolveEosRole(settings: unknown, userId: unknown, groupIds: unknown): EosResolvedRole;
